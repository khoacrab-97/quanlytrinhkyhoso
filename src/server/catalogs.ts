// Danh mục dùng chung - cấu hình CRUD tổng quát cho từng loại danh mục.
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AppErrorLite } from "./errors";

const str = (max = 200) => z.string().trim().min(1, "Không được để trống").max(max);
const optStr = (max = 500) => z.string().trim().max(max).optional().nullable().transform((v) => v || null);
const optId = z.string().optional().nullable().transform((v) => v || null);
const optDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));
const code = z.string().trim().min(1, "Nhập mã").max(30).regex(/^[A-Za-z0-9._-]+$/, "Mã chỉ gồm chữ, số, dấu . _ -");

type Delegate = {
  findMany: (a: unknown) => Promise<unknown[]>;
  create: (a: unknown) => Promise<{ id: string }>;
  update: (a: unknown) => Promise<unknown>;
  delete: (a: unknown) => Promise<unknown>;
  findUnique: (a: unknown) => Promise<Record<string, unknown> | null>;
};

type Cfg = {
  label: string;
  model: () => Delegate;
  schema: z.ZodTypeAny;
  include?: Record<string, unknown>;
  orderBy?: unknown;
  search?: string[];
  filterKeys?: string[];
  beforeSave?: (data: Record<string, unknown>, existing: Record<string, unknown> | null) => Promise<void> | void;
  beforeDelete?: (existing: Record<string, unknown>) => Promise<void> | void;
  /** Chuyển dữ liệu đã kiểm tra thành dữ liệu ghi Prisma (vd: quan hệ nhiều-nhiều) */
  toData?: (data: Record<string, unknown>, isUpdate: boolean) => Record<string, unknown>;
};

const m = <T,>(x: T) => x as unknown as Delegate;

export const CATALOGS: Record<string, Cfg> = {
  projects: {
    label: "Công trình / dự án",
    model: () => m(prisma.project),
    schema: z.object({
      code, name: str(300), investorId: optId, location: optStr(300), startDate: optDate, endDate: optDate, description: optStr(2000),
      partnerIds: z.array(z.string().min(1)).default([]), active: z.boolean().default(true),
    }),
    // Chủ đầu tư phải thuộc danh mục CĐT (loại Chủ đầu tư); lưu kèm tên để hiển thị
    beforeSave: async (data) => {
      if (!data.investorId) { data.investor = null; return; }
      const inv = await prisma.contractor.findUnique({ where: { id: data.investorId as string }, select: { name: true, kind: true } });
      if (!inv || inv.kind !== "INVESTOR") throw new AppErrorLite(400, "Chủ đầu tư phải chọn trong danh mục CĐT (loại Chủ đầu tư)");
      data.investor = inv.name;
    },
    include: { createdBy: { select: { id: true, fullName: true } }, partners: { select: { contractorId: true, contractor: { select: { name: true } } } }, _count: { select: { documents: true, members: true } } },
    toData: ({ partnerIds, ...rest }, isUpdate) => ({
      ...rest,
      partners: {
        ...(isUpdate ? { deleteMany: {} } : {}),
        create: [...new Set(partnerIds as string[])].map((contractorId) => ({ contractorId })),
      },
    }),
    orderBy: { code: "asc" },
    search: ["code", "name", "investor"],
  },
  documentTypes: {
    label: "Loại hồ sơ",
    model: () => m(prisma.documentType),
    schema: z.object({ code, name: str(300), description: optStr(), active: z.boolean().default(true) }),
    include: { createdBy: { select: { id: true, fullName: true } }, _count: { select: { documents: true } } },
    orderBy: { code: "asc" },
    search: ["code", "name"],
  },
  departments: {
    label: "Bộ phận",
    model: () => m(prisma.department),
    schema: z.object({ code, name: str(), description: optStr(), active: z.boolean().default(true) }),
    include: { _count: { select: { users: true, documents: true } } },
    orderBy: { code: "asc" },
    search: ["code", "name"],
    // Phòng ban Admin (của tài khoản admin) bị khóa
    beforeSave: (data, existing) => {
      if (existing?.code === "ADMIN" && (data.code !== "ADMIN" || data.name !== "Admin" || data.active === false)) {
        throw new AppErrorLite(400, "Phòng ban Admin của tài khoản admin được khóa, không sửa được");
      }
    },
    beforeDelete: (existing) => {
      if (existing.code === "ADMIN") throw new AppErrorLite(400, "Phòng ban Admin của tài khoản admin được khóa, không xóa được");
    },
  },
  divisions: {
    label: "Khối",
    model: () => m(prisma.division),
    schema: z.object({ code, name: str(), departmentId: z.string().min(1, "Chọn phòng ban"), active: z.boolean().default(true) }),
    include: { department: { select: { id: true, name: true } }, _count: { select: { users: true } } },
    orderBy: [{ department: { code: "asc" } }, { code: "asc" }],
    search: ["code", "name"],
    filterKeys: ["departmentId"],
  },
  contractors: {
    label: "Nhà thầu / đơn vị liên quan",
    model: () => m(prisma.contractor),
    schema: z.object({ code, name: str(300), kind: z.enum(["INVESTOR", "SUPPLIER", "SUBCONTRACTOR"], { error: "Chọn phân loại" }), taxCode: optStr(20), contact: optStr(300), active: z.boolean().default(true) }),
    include: { createdBy: { select: { id: true, fullName: true } }, _count: { select: { documents: true } } },
    orderBy: { code: "asc" },
    search: ["code", "name", "taxCode"],
    filterKeys: ["kind"],
    // Đổi tên Chủ đầu tư thì cập nhật tên hiển thị ở các công trình
    beforeSave: async (data, existing) => {
      if (existing && existing.name !== data.name) await prisma.project.updateMany({ where: { investorId: existing.id as string }, data: { investor: data.name as string } });
    },
  },
  recipients: {
    label: "Người nhận trình ký",
    model: () => m(prisma.recipient),
    schema: z.object({ name: str(), title: optStr(200), organization: optStr(300), userId: optId, departmentId: optId, active: z.boolean().default(true) }),
    include: { user: { select: { id: true, fullName: true } }, department: { select: { id: true, name: true } }, _count: { select: { documents: true } } },
    orderBy: { name: "asc" },
    search: ["name", "organization", "title"],
  },
  errorCategories: {
    label: "Nhóm lỗi",
    model: () => m(prisma.errorCategory),
    schema: z.object({ code, name: str(), description: optStr(), order: z.coerce.number().int().default(0), attributable: z.boolean().default(true), active: z.boolean().default(true) }),
    include: { createdBy: { select: { id: true, fullName: true } }, _count: { select: { reasons: true, errors: true } } },
    orderBy: { order: "asc" },
    search: ["code", "name"],
  },
  errorReasons: {
    label: "Nguyên nhân trả hồ sơ",
    model: () => m(prisma.errorReason),
    schema: z.object({ code, name: str(300), categoryId: z.string().min(1, "Chọn nhóm lỗi"), order: z.coerce.number().int().default(0), active: z.boolean().default(true) }),
    include: { createdBy: { select: { id: true, fullName: true } }, category: { select: { id: true, name: true } }, _count: { select: { errors: true } } },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
    search: ["code", "name"],
    filterKeys: ["categoryId"],
  },
  statuses: {
    label: "Trạng thái hồ sơ",
    model: () => m(prisma.documentStatus),
    schema: z.object({
      code, name: str(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Màu dạng #RRGGBB"),
      category: z.enum(["DRAFT", "SUBMITTED", "REVIEWING", "RETURNED", "REVISING", "APPROVED", "COMPLETED", "CANCELLED"]),
      order: z.coerce.number().int().default(0), active: z.boolean().default(true),
    }),
    include: { _count: { select: { documents: true } } },
    orderBy: { order: "asc" },
    search: ["code", "name"],
    beforeSave: (data, existing) => {
      if (existing?.isSystem) {
        if (data.code !== existing.code) throw new AppErrorLite(400, "Không được đổi mã của trạng thái hệ thống");
        if (data.category !== existing.category) throw new AppErrorLite(400, "Không được đổi nhóm của trạng thái hệ thống");
        if (data.active === false) throw new AppErrorLite(400, "Không được vô hiệu hóa trạng thái hệ thống");
      }
    },
    beforeDelete: (existing) => {
      if (existing.isSystem) throw new AppErrorLite(400, "Không được xóa trạng thái hệ thống");
    },
  },
  workflows: {
    label: "Quy trình xử lý",
    model: () => m(prisma.workflow),
    schema: z.object({ code, name: str(300), description: optStr(), active: z.boolean().default(true) }),
    include: { steps: { orderBy: { order: "asc" }, include: { department: { select: { name: true } } } }, _count: { select: { documentTypes: true } } },
    orderBy: { code: "asc" },
    search: ["code", "name"],
  },
  workflowSteps: {
    label: "Bước quy trình / thời gian xử lý tiêu chuẩn",
    model: () => m(prisma.workflowStep),
    schema: z.object({
      workflowId: z.string().min(1, "Chọn quy trình"), order: z.coerce.number().int().min(1), name: str(300),
      departmentId: optId, slaDays: z.coerce.number().min(0.1).max(365), active: z.boolean().default(true),
    }),
    include: { workflow: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
    orderBy: [{ workflow: { code: "asc" } }, { order: "asc" }],
    search: ["name"],
    filterKeys: ["workflowId"],
  },
  customFields: {
    label: "Trường dữ liệu mở rộng",
    model: () => m(prisma.customField),
    schema: z.object({
      key: z.string().trim().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Khóa bắt đầu bằng chữ, chỉ gồm chữ/số/_"),
      label: str(), type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT", "BOOLEAN"]),
      options: z.array(z.string().trim().min(1)).default([]), required: z.boolean().default(false),
      order: z.coerce.number().int().default(0), active: z.boolean().default(true),
    }),
    orderBy: { order: "asc" },
    search: ["key", "label"],
  },
};

export function getCatalog(entity: string) {
  const c = CATALOGS[entity];
  if (!c) throw new AppErrorLite(404, "Danh mục không tồn tại");
  return c;
}

export async function listCatalog(entity: string, params: URLSearchParams) {
  const c = getCatalog(entity);
  const where: Record<string, unknown> = {};
  const q = params.get("q")?.trim();
  if (q && c.search) where.OR = c.search.map((f) => ({ [f]: { contains: q, mode: "insensitive" } }));
  if (params.get("active") === "true") where.active = true;
  for (const k of c.filterKeys ?? []) if (params.get(k)) where[k] = params.get(k);
  return c.model().findMany({ where, include: c.include, orderBy: c.orderBy });
}
