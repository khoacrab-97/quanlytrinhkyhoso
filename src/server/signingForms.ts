// =============================================================
//  PHIẾU TRÌNH KÝ (theo mẫu "Phiếu phê duyệt và kiểm tra")
//  - Mỗi lần trình (lần đầu / trình lại lần n) là một phiếu riêng.
//  - Phiếu ĐANG SOẠN được sửa; khi người dùng xác nhận đã in -> khóa nội dung,
//    ghi nhận 1 lần trình ký vào hồ sơ (engine workflow) và bắt đầu tính hạn in lại.
//  - Được in lại trong N phút (mặc định 60) kể từ lần in đầu; sau đó phải "Trình ký lại"
//    (bắt buộc nhập lý do, số lần tự tăng).
// =============================================================
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { audit, getSettings, numSetting } from "./audit";
import { AppErrorLite } from "./errors";
import { createDocument } from "./documents";
import { canModifyDocument, documentScopeWhere } from "./scope";
import { performAction } from "./workflow";
import { NO_WITHDRAW_STAGES, noWithdrawMessage } from "@/lib/constants";
import type { CurrentUser } from "./session";

const txt = (max: number) => z.string().trim().max(max).optional().nullable().transform((v) => v || "");

/** Nội dung các ô trên phiếu (in nguyên văn) */
export const contentSchema = z.object({
  docTitle: z.string().trim().min(3, "Nhập Tên hồ sơ/Loại hồ sơ").max(500),
  projectName: txt(300),
  partnerName: txt(300),
  submitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày trình ký không hợp lệ"),
  departmentName: txt(200),
  otherContent: txt(2000),
  preparerName: txt(100),
  relatedPersonName: txt(100),
  managerName: txt(100),
});
export type FormContent = z.infer<typeof contentSchema>;

const optId = z.string().min(1).optional().nullable().transform((v) => v || null);

export const createSchema = z.object({
  documentId: optId,
  /** Khi không chọn hồ sơ có sẵn -> tạo hồ sơ mới từ phiếu */
  newDocument: z
    .object({
      typeId: z.string().min(1, "Chọn loại hồ sơ"),
      projectId: z.string().min(1, "Chọn dự án/công trình"),
      departmentId: z.string().min(1, "Chọn phòng ban"),
      contractorId: optId,
      recipientId: optId,
      docNumber: z.string().trim().max(100).optional().nullable().transform((v) => v || null),
    })
    .optional()
    .nullable(),
  content: contentSchema,
  reason: z.string().trim().max(2000).optional().nullable().transform((v) => v || null),
});

export async function reprintMinutes() {
  return numSetting(await getSettings(), "form.reprintMinutes", 60);
}

async function nextFormCode(tx: Prisma.TransactionClient) {
  const year = new Date().getFullYear();
  const c = await tx.counter.upsert({ where: { key: `ptk-${year}` }, create: { key: `ptk-${year}`, value: 1 }, update: { value: { increment: 1 } } });
  return `PTK-${year}-${String(c.value).padStart(5, "0")}`;
}

const CLOSED = ["APPROVED", "COMPLETED", "CANCELLED"];

function requireReason(resubmitNo: number, reason: string | null | undefined) {
  if (resubmitNo > 0 && (!reason || reason.trim().length < 5)) {
    throw new AppErrorLite(400, `Đây là lần trình ký lại lần ${resubmitNo}: bắt buộc nhập lý do trình lại (tối thiểu 5 ký tự)`);
  }
}

async function loadDocForForm(user: CurrentUser, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { AND: [{ id: documentId }, documentScopeWhere(user)] },
    include: { status: true, recipient: true, signingForms: { where: { status: "DRAFT" }, select: { id: true } } },
  });
  if (!doc) throw new AppErrorLite(404, "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập");
  if (!canModifyDocument(user, doc)) throw new AppErrorLite(403, "Bạn không có quyền lập phiếu trình ký cho hồ sơ này");
  if (CLOSED.includes(doc.status.category)) throw new AppErrorLite(409, `Hồ sơ đang ở trạng thái "${doc.status.name}", không thể trình ký`);
  if (NO_WITHDRAW_STAGES.includes(doc.status.code)) throw new AppErrorLite(409, noWithdrawMessage(doc.status.name));
  if (doc.signingForms.length) throw new AppErrorLite(409, "Hồ sơ đang có một phiếu chưa in. Hãy mở phiếu đó để sửa / in.");
  return doc;
}

/** Tạo phiếu (đang soạn). Số lần trình lại = số lần hồ sơ đã được trình. */
export async function createForm(input: z.infer<typeof createSchema>, user: CurrentUser, ip?: string | null) {
  let documentId = input.documentId;
  if (!documentId) {
    if (!input.newDocument) throw new AppErrorLite(400, "Chọn hồ sơ có sẵn hoặc nhập thông tin để tạo hồ sơ mới");
    const nd = input.newDocument;
    // Phòng ban trình ký = phòng ban của người lập; chỉ Quản trị viên được chọn phòng ban khác
    const departmentId = user.role === "ADMIN" || !user.departmentId ? nd.departmentId : user.departmentId;
    if (nd.contractorId) {
      const partners = await prisma.projectPartner.findMany({ where: { projectId: nd.projectId }, select: { contractorId: true } });
      if (partners.length && !partners.some((x) => x.contractorId === nd.contractorId)) {
        throw new AppErrorLite(400, "Chủ đầu tư / NCC / thầu phụ không thuộc dự án đã chọn");
      }
    }
    const doc = await createDocument(
      {
        docNumber: nd.docNumber, title: input.content.docTitle, typeId: nd.typeId, projectId: nd.projectId, contractorId: nd.contractorId,
        departmentId, preparerId: user.id, submitterId: user.id, recipientId: nd.recipientId,
        preparedDate: new Date(), priority: 2, notes: null, customFields: null, readyToSubmit: true,
      },
      user,
      { ip },
    );
    documentId = doc.id;
  }
  const doc = await loadDocForForm(user, documentId);
  const resubmitNo = doc.submissionCount;
  requireReason(resubmitNo, input.reason);
  const form = await prisma.$transaction(async (tx) =>
    tx.signingForm.create({
      data: {
        code: await nextFormCode(tx), documentId: doc.id, resubmitNo, resubmitReason: resubmitNo > 0 ? input.reason : null,
        content: input.content, createdById: user.id,
      },
    }),
  );
  await audit({ userId: user.id, action: "form.create", entity: "SigningForm", entityId: form.id, detail: { code: form.code, document: doc.code, resubmitNo }, ip });
  return form;
}

async function loadForm(user: CurrentUser, id: string) {
  const form = await prisma.signingForm.findFirst({
    where: { id, document: documentScopeWhere(user) },
    include: { document: { include: { status: true, recipient: true } } },
  });
  if (!form) throw new AppErrorLite(404, "Phiếu trình ký không tồn tại hoặc bạn không có quyền truy cập");
  return form;
}

function canHandle(user: CurrentUser, form: Awaited<ReturnType<typeof loadForm>>) {
  return user.role !== "VIEWER" && (form.createdById === user.id || canModifyDocument(user, form.document));
}

/** Trạng thái quyền thao tác của phiếu tại thời điểm hiện tại (giờ server là chuẩn) */
export async function formState(user: CurrentUser, form: Awaited<ReturnType<typeof loadForm>>) {
  const minutes = await reprintMinutes();
  const latest = await prisma.signingForm.findFirst({ where: { documentId: form.documentId }, orderBy: { resubmitNo: "desc" }, select: { id: true } });
  const handle = canHandle(user, form);
  const reprintUntil = form.printedAt ? new Date(form.printedAt.getTime() + minutes * 60_000) : null;
  const closed = CLOSED.includes(form.document.status.category);
  const returned = form.document.status.category === "RETURNED";
  const atBks = NO_WITHDRAW_STAGES.includes(form.document.status.code);
  return {
    reprintMinutes: minutes,
    reprintUntil,
    canEdit: handle && form.status === "DRAFT",
    canPrint: handle && form.status === "DRAFT" && !closed && !atBks,
    // Ban kiểm soát đã trả về thì không in lại bản cũ: bắt buộc In ký lại (phiếu mới, có lý do)
    canReprint: handle && form.status === "PRINTED" && latest?.id === form.id && !returned && !closed && !!reprintUntil && reprintUntil > new Date(),
    // Đang ở Ban kiểm soát hoặc chờ TGĐ ký: người lập chưa được trình ký lại (chỉ khi BKS trả về)
    canResubmit: handle && form.status === "PRINTED" && latest?.id === form.id && !closed && !atBks,
    nextResubmitNo: form.document.submissionCount,
    isLatest: latest?.id === form.id,
    bksReturned: returned,
    /** Đang ở Ban kiểm soát hoặc chờ TGĐ ký */
    atBks,
  };
}

export async function getForm(user: CurrentUser, id: string) {
  const form = await loadForm(user, id);
  const [full, state, versions] = await Promise.all([
    prisma.signingForm.findUniqueOrThrow({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        prints: { orderBy: { printedAt: "asc" }, include: { printedBy: { select: { fullName: true } } } },
        document: { select: { id: true, code: true, title: true, submissionCount: true, returnCount: true, status: { select: { name: true, color: true, category: true } } } },
      },
    }),
    formState(user, form),
    prisma.signingForm.findMany({ where: { documentId: form.documentId }, orderBy: { resubmitNo: "asc" }, select: { id: true, code: true, resubmitNo: true, status: true, printedAt: true, printCount: true } }),
  ]);
  return { form: full, state, versions };
}

export async function updateForm(user: CurrentUser, id: string, body: { content: FormContent; reason?: string | null }, ip?: string | null) {
  const form = await loadForm(user, id);
  if (!canHandle(user, form)) throw new AppErrorLite(403, "Bạn không có quyền sửa phiếu này");
  if (form.status !== "DRAFT") throw new AppErrorLite(409, "Phiếu đã in, không được sửa nội dung. Hãy dùng chức năng Trình ký lại.");
  requireReason(form.resubmitNo, body.reason ?? form.resubmitReason);
  await prisma.signingForm.update({ where: { id }, data: { content: body.content, resubmitReason: form.resubmitNo > 0 ? body.reason ?? form.resubmitReason : null } });
  await audit({ userId: user.id, action: "form.update", entity: "SigningForm", entityId: id, detail: body, ip });
}

export async function deleteDraft(user: CurrentUser, id: string, ip?: string | null) {
  const form = await loadForm(user, id);
  if (!canHandle(user, form)) throw new AppErrorLite(403, "Bạn không có quyền xóa phiếu này");
  if (form.status !== "DRAFT") throw new AppErrorLite(409, "Phiếu đã in được lưu làm dữ liệu thống kê, không được xóa");
  await prisma.signingForm.delete({ where: { id } });
  await audit({ userId: user.id, action: "form.delete_draft", entity: "SigningForm", entityId: id, detail: { code: form.code }, ip });
}

/**
 * Người dùng xác nhận đã in.
 * - Phiếu đang soạn: khóa nội dung + ghi nhận trình ký vào hồ sơ.
 * - Phiếu đã in: chỉ cho in lại trong thời hạn.
 */
export async function confirmPrint(user: CurrentUser, id: string, ip?: string | null) {
  const form = await loadForm(user, id);
  if (!canHandle(user, form)) throw new AppErrorLite(403, "Bạn không có quyền in phiếu này");
  const state = await formState(user, form);
  const now = new Date();

  if (form.status === "PRINTED") {
    if (!state.canReprint && state.bksReturned) {
      throw new AppErrorLite(409, "Ban kiểm soát đã trả hồ sơ: không được in lại phiếu cũ. Vui lòng chọn \"Trình ký lại\".");
    }
    if (!state.canReprint) {
      throw new AppErrorLite(409, `Đã quá ${state.reprintMinutes} phút kể từ lần in đầu, không được in lại. Vui lòng chọn "Trình ký lại".`);
    }
    await prisma.$transaction([
      prisma.signingFormPrint.create({ data: { formId: id, printedById: user.id, printedAt: now, isReprint: true } }),
      prisma.signingForm.update({ where: { id }, data: { printCount: { increment: 1 } } }),
    ]);
    await audit({ userId: user.id, action: "form.reprint", entity: "SigningForm", entityId: id, detail: { code: form.code }, ip });
    return { reprint: true };
  }

  if (!state.canPrint) throw new AppErrorLite(409, "Không thể in phiếu này");
  // Đồng bộ số lần với số lần trình thực tế của hồ sơ (phòng khi hồ sơ được trình bằng cách khác trong lúc soạn phiếu)
  const resubmitNo = form.document.submissionCount;
  requireReason(resubmitNo, form.resubmitReason);
  const content = form.content as FormContent;
  const note = resubmitNo > 0 ? `Phiếu ${form.code} - Trình ký lại lần ${resubmitNo}. Lý do: ${form.resubmitReason}` : `Phiếu ${form.code} - Trình ký lần đầu`;

  await performAction(
    form.documentId,
    { action: "submit", at: now, note, withdrawPending: true },
    user,
    ip,
  );
  // Khóa phiếu: điều kiện status = DRAFT để chống bấm xác nhận 2 lần đồng thời
  const locked = await prisma.signingForm.updateMany({
    where: { id, status: "DRAFT" },
    data: { status: "PRINTED", printedAt: now, printCount: 1, resubmitNo, content: { ...content } },
  });
  if (!locked.count) throw new AppErrorLite(409, "Phiếu đã được xác nhận in trước đó");
  await prisma.signingFormPrint.create({ data: { formId: id, printedById: user.id, printedAt: now } });
  await audit({ userId: user.id, action: "form.print", entity: "SigningForm", entityId: id, detail: { code: form.code, resubmitNo }, ip });
  return { reprint: false };
}

/** Trình ký lại: tạo phiếu mới (sao chép nội dung), số lần tự tăng, bắt buộc lý do */
/**
 * Trình ký lại: tạo phiếu mới (đang soạn) để in ký lại, bắt buộc lý do.
 * Lỗi do Ban kiểm soát trả về được BKS ghi nhận khi bấm "Trả về" (không ghi ở đây).
 */
export async function resubmitForm(user: CurrentUser, id: string, input: { reason: string }, ip?: string | null) {
  const reason = input.reason;
  const form = await loadForm(user, id);
  const state = await formState(user, form);
  if (!state.canResubmit) {
    if (!state.isLatest) throw new AppErrorLite(409, "Chỉ trình ký lại từ phiếu mới nhất của hồ sơ");
    if (state.atBks) throw new AppErrorLite(409, noWithdrawMessage(form.document.status.name));
    throw new AppErrorLite(409, "Không thể trình ký lại phiếu này");
  }
  const resubmitNo = form.document.submissionCount;
  requireReason(resubmitNo, reason);
  const draft = await prisma.signingForm.findFirst({ where: { documentId: form.documentId, status: "DRAFT" } });
  if (draft) throw new AppErrorLite(409, "Hồ sơ đang có một phiếu chưa in");
  const old = form.content as FormContent;
  const today = new Date();
  const content: FormContent = {
    ...old,
    submitDate: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`,
  };
  const created = await prisma.$transaction(async (tx) =>
    tx.signingForm.create({ data: { code: await nextFormCode(tx), documentId: form.documentId, resubmitNo, resubmitReason: reason.trim(), content, createdById: user.id } }),
  );
  await audit({ userId: user.id, action: "form.resubmit", entity: "SigningForm", entityId: created.id, detail: { from: form.code, code: created.code, resubmitNo, reason }, ip });
  return created;
}

// ---------------------------------------------------------------- Danh sách & thống kê
export const listSchema = z.object({
  q: z.string().optional(),
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
  createdById: z.string().optional(),
  kind: z.enum(["first", "resubmit", "draft"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(1000).default(20),
});

export function listWhere(user: CurrentUser, p: z.infer<typeof listSchema>): Prisma.SigningFormWhereInput {
  const and: Prisma.SigningFormWhereInput[] = [{ document: documentScopeWhere(user) }];
  if (p.q) {
    and.push({
      OR: [
        { code: { contains: p.q, mode: "insensitive" } },
        { document: { code: { contains: p.q, mode: "insensitive" } } },
        { document: { title: { contains: p.q, mode: "insensitive" } } },
      ],
    });
  }
  if (p.projectId) and.push({ document: { projectId: p.projectId } });
  if (p.departmentId) and.push({ document: { departmentId: p.departmentId } });
  if (p.createdById) and.push({ createdById: p.createdById });
  if (p.kind === "first") and.push({ status: "PRINTED", resubmitNo: 0 });
  if (p.kind === "resubmit") and.push({ status: "PRINTED", resubmitNo: { gt: 0 } });
  if (p.kind === "draft") and.push({ status: "DRAFT" });
  // Thời gian lọc theo ngày in (phiếu đang soạn theo ngày tạo)
  if (p.from || p.to) {
    const to = p.to ? new Date(p.to) : undefined;
    to?.setHours(23, 59, 59, 999);
    const range = { ...(p.from ? { gte: new Date(p.from) } : {}), ...(to ? { lte: to } : {}) };
    and.push({ OR: [{ printedAt: range }, { status: "DRAFT", createdAt: range }] });
  }
  return { AND: and };
}

export const formListInclude = {
  createdBy: { select: { id: true, fullName: true } },
  document: { select: { id: true, code: true, title: true, project: { select: { code: true, name: true } }, department: { select: { name: true } }, status: { select: { name: true, color: true } } } },
} satisfies Prisma.SigningFormInclude;

export async function listForms(user: CurrentUser, p: z.infer<typeof listSchema>) {
  const where = listWhere(user, p);
  const [total, rows, all] = await Promise.all([
    prisma.signingForm.count({ where }),
    prisma.signingForm.findMany({ where, include: formListInclude, orderBy: [{ createdAt: "desc" }], skip: (p.page - 1) * p.pageSize, take: p.pageSize }),
    prisma.signingForm.findMany({ where, select: { status: true, resubmitNo: true, printCount: true, createdById: true, documentId: true, createdBy: { select: { fullName: true } }, document: { select: { departmentId: true, department: { select: { name: true } } } } } }),
  ]);
  const printed = all.filter((f) => f.status === "PRINTED");
  const stats = {
    printed: printed.length,
    first: printed.filter((f) => f.resubmitNo === 0).length,
    resubmit: printed.filter((f) => f.resubmitNo > 0).length,
    reprints: printed.reduce((a, f) => a + Math.max(0, f.printCount - 1), 0),
    drafts: all.length - printed.length,
    documents: new Set(printed.map((f) => f.documentId)).size,
  };
  // Tổng hợp theo một chiều (người thực hiện / phòng ban trình ký)
  const tally = (key: (f: (typeof all)[number]) => string, name: (f: (typeof all)[number]) => string) => {
    const m = new Map<string, { name: string; printed: number; first: number; resubmit: number; reprints: number; drafts: number }>();
    for (const f of all) {
      const r = m.get(key(f)) ?? { name: name(f), printed: 0, first: 0, resubmit: 0, reprints: 0, drafts: 0 };
      if (f.status === "PRINTED") {
        r.printed++;
        if (f.resubmitNo === 0) r.first++;
        else r.resubmit++;
        r.reprints += Math.max(0, f.printCount - 1);
      } else r.drafts++;
      m.set(key(f), r);
    }
    return [...m.values()].sort((a, b) => b.printed - a.printed);
  };
  const byUser = tally((f) => f.createdById, (f) => f.createdBy.fullName);
  const byDepartment = tally((f) => f.document.departmentId, (f) => f.document.department.name);
  return { total, page: p.page, pageSize: p.pageSize, rows, stats, byUser, byDepartment };
}
