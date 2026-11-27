// Dịch vụ quản lý hồ sơ: tạo, sửa, sao chép, xóa mềm, truy vấn danh sách.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { audit } from "./audit";
import { AppErrorLite } from "./errors";
import { documentScopeWhere } from "./scope";
import { nextDocumentCode, type Actor } from "./workflow";
import type { CurrentUser } from "./session";

const optId = z.string().min(1).optional().nullable().transform((v) => v || null);

export const documentInputSchema = z.object({
  docNumber: z.string().trim().max(100).optional().nullable().transform((v) => v || null),
  title: z.string().trim().min(3, "Tên hồ sơ tối thiểu 3 ký tự").max(500),
  typeId: z.string().min(1, "Chọn loại hồ sơ"),
  projectId: z.string().min(1, "Chọn công trình"),
  contractorId: optId,
  departmentId: z.string().min(1, "Chọn bộ phận lập"),
  preparerId: z.string().min(1, "Chọn người lập"),
  submitterId: optId,
  recipientId: optId,
  preparedDate: z.coerce.date({ error: "Ngày lập không hợp lệ" }),
  priority: z.coerce.number().int().min(1).max(3).default(2),
  notes: z.string().max(4000).optional().nullable(),
  customFields: z.record(z.string(), z.unknown()).optional().nullable(),
  readyToSubmit: z.boolean().optional(),
});
export type DocumentInput = z.infer<typeof documentInputSchema>;

async function validateRefs(input: DocumentInput) {
  const [type, project, dept, preparer] = await Promise.all([
    prisma.documentType.findUnique({ where: { id: input.typeId } }),
    prisma.project.findUnique({ where: { id: input.projectId } }),
    prisma.department.findUnique({ where: { id: input.departmentId } }),
    prisma.user.findUnique({ where: { id: input.preparerId } }),
  ]);
  if (!type) throw new AppErrorLite(400, "Loại hồ sơ không hợp lệ");
  if (!project) throw new AppErrorLite(400, "Công trình không hợp lệ");
  if (!dept) throw new AppErrorLite(400, "Bộ phận không hợp lệ");
  if (!preparer) throw new AppErrorLite(400, "Người lập không hợp lệ");
  if (input.preparedDate.getTime() > Date.now() + 86_400_000) throw new AppErrorLite(400, "Ngày lập không được ở tương lai");
  // Trường mở rộng bắt buộc
  const fields = await prisma.customField.findMany({ where: { active: true, required: true } });
  for (const f of fields) {
    const v = input.customFields?.[f.key];
    if (v === undefined || v === null || v === "") throw new AppErrorLite(400, `Trường "${f.label}" là bắt buộc`);
  }
  return { type, project };
}

export async function createDocument(input: DocumentInput, actor: Actor, opts: { isSample?: boolean; ip?: string | null } = {}) {
  await validateRefs(input);
  const prefixRow = await prisma.systemSetting.findUnique({ where: { key: "document.codePrefix" } });
  const prefix = prefixRow?.value || "HS";

  return prisma.$transaction(async (tx) => {
    const status = await tx.documentStatus.findUniqueOrThrow({
      where: { code: STATUS.PREPARING },
    });
    const code = await nextDocumentCode(tx, prefix, input.preparedDate);
    const doc = await tx.document.create({
      data: {
        code,
        docNumber: input.docNumber,
        title: input.title,
        typeId: input.typeId,
        projectId: input.projectId,
        contractorId: input.contractorId,
        departmentId: input.departmentId,
        preparerId: input.preparerId,
        submitterId: input.submitterId,
        recipientId: input.recipientId,
        preparedDate: input.preparedDate,
        priority: input.priority,
        notes: input.notes ?? null,
        customFields: (input.customFields ?? undefined) as Prisma.InputJsonValue | undefined,
        statusId: status.id,
        currentHolderId: input.preparerId,
        currentDepartmentId: input.departmentId,
        lastActivityAt: input.preparedDate,
        createdById: actor.id,
        isSample: opts.isSample ?? false,
      },
    });
    await tx.documentStatusHistory.create({
      data: { documentId: doc.id, toStatusId: status.id, changedById: actor.id, changedAt: input.preparedDate, note: "Tạo hồ sơ" },
    });
    await tx.documentActivity.create({
      data: {
        documentId: doc.id, type: "CREATE", actorId: input.preparerId, departmentId: input.departmentId, statusId: status.id,
        startedAt: input.preparedDate, content: "Lập hồ sơ",
      },
    });
    await audit({ userId: actor.id, action: "document.create", entity: "Document", entityId: doc.id, detail: { code, title: doc.title }, ip: opts.ip }, tx);
    return doc;
  });
}

const TRACKED: (keyof DocumentInput)[] = [
  "docNumber", "title", "typeId", "projectId", "contractorId", "departmentId", "preparerId", "submitterId",
  "recipientId", "preparedDate", "priority", "notes", "customFields",
];

export async function updateDocument(id: string, input: DocumentInput, actor: Actor, ip?: string | null) {
  await validateRefs(input);
  const found = await prisma.document.findFirst({ where: { id, deletedAt: null }, include: { status: true } });
  if (!found) throw new AppErrorLite(404, "Hồ sơ không tồn tại");
  const { status, ...before } = found;

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of TRACKED) {
    const a = (before as Record<string, unknown>)[k];
    const b = (input as Record<string, unknown>)[k] ?? null;
    const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : JSON.stringify(v ?? null));
    if (norm(a) !== norm(b)) changes[k] = { from: a, to: b };
  }
  if (!Object.keys(changes).length) return before;
  // Thẩm quyền duyệt dựa trên phòng ban và người lập: không cho đổi khi hồ sơ đang trong luồng duyệt
  if (actor.role !== "ADMIN" && ["SUBMITTED", "REVIEWING"].includes(status.category) && (changes.departmentId || changes.preparerId)) {
    throw new AppErrorLite(409, `Hồ sơ đang ở bước "${status.name}": không được đổi phòng ban hoặc người lập`);
  }

  return prisma.$transaction(async (tx) => {
    const doc = await tx.document.update({
      where: { id },
      data: {
        docNumber: input.docNumber,
        title: input.title,
        typeId: input.typeId,
        projectId: input.projectId,
        contractorId: input.contractorId,
        departmentId: input.departmentId,
        preparerId: input.preparerId,
        submitterId: input.submitterId,
        recipientId: input.recipientId,
        preparedDate: input.preparedDate,
        priority: input.priority,
        notes: input.notes ?? null,
        customFields: (input.customFields ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await tx.documentActivity.create({
      data: {
        documentId: id, type: "UPDATE", actorId: actor.id, departmentId: actor.departmentId, startedAt: new Date(), endedAt: new Date(),
        content: `Cập nhật: ${Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k).join(", ")}`,
        meta: JSON.parse(JSON.stringify(changes)),
      },
    });
    await audit({ userId: actor.id, action: "document.update", entity: "Document", entityId: id, detail: changes, ip }, tx);
    return doc;
  });
}

export const FIELD_LABELS: Record<string, string> = {
  docNumber: "Số hồ sơ", title: "Tên hồ sơ", typeId: "Loại hồ sơ", projectId: "Công trình", contractorId: "Nhà thầu",
  departmentId: "Bộ phận lập", preparerId: "Người lập", submitterId: "Người trình ký", recipientId: "Người nhận ký",
  preparedDate: "Ngày lập", priority: "Mức ưu tiên", notes: "Ghi chú", customFields: "Trường mở rộng",
};

export async function copyDocument(id: string, actor: Actor, ip?: string | null) {
  const src = await prisma.document.findFirst({ where: { id, deletedAt: null } });
  if (!src) throw new AppErrorLite(404, "Hồ sơ không tồn tại");
  const doc = await createDocument(
    {
      docNumber: null,
      title: `${src.title} (bản sao)`,
      typeId: src.typeId,
      projectId: src.projectId,
      contractorId: src.contractorId,
      departmentId: src.departmentId,
      preparerId: actor.id,
      submitterId: src.submitterId,
      recipientId: src.recipientId,
      preparedDate: new Date(),
      priority: src.priority,
      notes: src.notes,
      customFields: (src.customFields as Record<string, unknown>) ?? null,
    },
    actor,
    { ip },
  );
  await audit({ userId: actor.id, action: "document.copy", entity: "Document", entityId: doc.id, detail: { from: src.code, to: doc.code }, ip });
  return doc;
}

export async function softDeleteDocument(id: string, user: CurrentUser, reason: string, ip?: string | null) {
  const doc = await prisma.document.findFirst({ where: { AND: [{ id }, documentScopeWhere(user)] }, include: { status: true } });
  if (!doc) throw new AppErrorLite(404, "Hồ sơ không tồn tại");
  if (user.role === "STAFF") {
    const own = doc.preparerId === user.id || doc.createdById === user.id;
    if (!own || doc.submissionCount > 0 || doc.status.category !== "DRAFT") {
      throw new AppErrorLite(403, "Nhân viên chỉ được xóa hồ sơ do mình lập và chưa trình ký. Hãy dùng chức năng Hủy hồ sơ.");
    }
  }
  if (user.role === "VIEWER") throw new AppErrorLite(403, "Bạn không có quyền xóa hồ sơ");
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ userId: user.id, action: "document.delete", entity: "Document", entityId: id, detail: { code: doc.code, title: doc.title, reason }, ip });
}

// ---------------- Truy vấn danh sách ----------------

export const listQuerySchema = z.object({
  q: z.string().optional(),
  projectId: z.string().optional(),
  typeId: z.string().optional(),
  statusId: z.string().optional(),
  category: z.string().optional(),
  departmentId: z.string().optional(),
  preparerId: z.string().optional(),
  holderId: z.string().optional(),
  contractorId: z.string().optional(),
  recipientId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  dateField: z.enum(["preparedDate", "firstSubmittedAt", "approvedAt"]).optional(),
  flag: z.enum(["returned", "open"]).optional(),
  sample: z.enum(["only", "exclude"]).optional(),
  sort: z.string().optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

const SORTABLE = new Set([
  "code", "docNumber", "title", "preparedDate", "firstSubmittedAt", "approvedAt", "completedAt",
  "returnCount", "submissionCount", "createdAt", "updatedAt", "priority", "lastActivityAt",
]);

function endOfDay(s: string) {
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function buildDocumentWhere(user: CurrentUser, q: Partial<ListQuery>): Prisma.DocumentWhereInput {
  const and: Prisma.DocumentWhereInput[] = [documentScopeWhere(user)];
  if (q.q?.trim()) {
    const s = q.q.trim();
    and.push({
      OR: [
        { code: { contains: s, mode: "insensitive" } },
        { title: { contains: s, mode: "insensitive" } },
        { docNumber: { contains: s, mode: "insensitive" } },
      ],
    });
  }
  if (q.projectId) and.push({ projectId: q.projectId });
  if (q.typeId) and.push({ typeId: q.typeId });
  if (q.statusId) and.push({ statusId: q.statusId });
  if (q.category) and.push({ status: { category: { in: q.category.split(",") as never[] } } });
  if (q.departmentId) and.push({ departmentId: q.departmentId });
  if (q.preparerId) and.push({ preparerId: q.preparerId });
  if (q.holderId) and.push({ currentHolderId: q.holderId });
  if (q.contractorId) and.push({ contractorId: q.contractorId });
  if (q.recipientId) and.push({ recipientId: q.recipientId });
  const field = q.dateField ?? "preparedDate";
  if (q.from) and.push({ [field]: { gte: new Date(q.from) } });
  if (q.to) and.push({ [field]: { lte: endOfDay(q.to) } });
  if (q.flag === "returned") and.push({ returnCount: { gt: 0 } });
  if (q.flag === "open") and.push({ status: { category: { notIn: ["COMPLETED", "CANCELLED"] } } });
  if (q.sample === "only") and.push({ isSample: true });
  if (q.sample === "exclude") and.push({ isSample: false });
  return { AND: and };
}

export const documentListInclude = {
  type: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  contractor: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  preparer: { select: { id: true, fullName: true } },
  submitter: { select: { id: true, fullName: true } },
  recipient: { select: { id: true, name: true, organization: true } },
  currentHolder: { select: { id: true, fullName: true } },
  currentDepartment: { select: { id: true, name: true } },
  currentStep: { select: { id: true, name: true } },
  status: { select: { id: true, code: true, name: true, color: true, category: true } },
} satisfies Prisma.DocumentInclude;

export async function listDocuments(user: CurrentUser, q: ListQuery) {
  const where = buildDocumentWhere(user, q);
  const sortKey = q.sort && SORTABLE.has(q.sort) ? q.sort : "createdAt";
  const nullable = new Set(["docNumber", "firstSubmittedAt", "approvedAt", "completedAt"]);
  const order = q.dir ?? "desc";
  const orderBy: Prisma.DocumentOrderByWithRelationInput[] = [
    { [sortKey]: nullable.has(sortKey) ? { sort: order, nulls: "last" } : order },
    { code: "desc" },
  ];
  const [total, rows] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({ where, include: documentListInclude, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, rows };
}
