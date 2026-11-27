import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/server/api";
import { DELEGABLE_CATALOGS, type DelegableCatalog } from "@/lib/constants";

export const passwordSchema = z
  .string()
  .min(8, "Mật khẩu tối thiểu 8 ký tự")
  .max(100)
  .regex(/[A-Za-z]/, "Mật khẩu phải có chữ cái")
  .regex(/[0-9]/, "Mật khẩu phải có chữ số");

export const userSchema = z.object({
  username: z.string().trim().toLowerCase().min(3, "Tên đăng nhập tối thiểu 3 ký tự").max(50).regex(/^[a-z0-9._-]+$/, "Tên đăng nhập chỉ gồm chữ thường, số, . _ -"),
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email("Email không hợp lệ").optional().nullable().or(z.literal("")).transform((v) => v || null),
  phone: z.string().trim().max(20).optional().nullable().transform((v) => v || null),
  position: z.string().trim().max(100).optional().nullable().transform((v) => v || null),
  departmentId: z.string({ required_error: "Chọn phòng ban" }).min(1, "Chọn phòng ban"),
  divisionId: z.string().optional().nullable().transform((v) => v || null),
  /** Vai trò: Nhân viên / Phụ trách liên quan / Quản lý phòng ban / Quản trị viên (toàn quyền hệ thống) */
  approvalRole: z.enum(["STAFF", "RELATED", "DEPT_MANAGER", "ADMIN"]).default("STAFF"),
  /** Danh mục được ủy quyền thêm mới */
  catalogGrants: z.array(z.enum(Object.keys(DELEGABLE_CATALOGS) as [DelegableCatalog, ...DelegableCatalog[]])).default([]),
  active: z.boolean().default(true),
  password: passwordSchema.optional().or(z.literal("")).transform((v) => v || undefined),
});

/** Tài khoản admin luôn thuộc phòng ban Admin; phòng ban Admin chỉ dành cho tài khoản admin */
export const ADMIN_USERNAME = "admin";
export const ADMIN_DEPARTMENT_CODE = "ADMIN";

export async function checkAdminDepartment(username: string, departmentId: string) {
  const dept = await prisma.department.findUnique({ where: { id: departmentId }, select: { code: true } });
  const isAdminDept = dept?.code === ADMIN_DEPARTMENT_CODE;
  if (username === ADMIN_USERNAME && !isAdminDept) throw badRequest("Phòng ban của tài khoản admin được khóa là Admin");
  if (username !== ADMIN_USERNAME && isAdminDept) throw badRequest("Phòng ban Admin chỉ dành cho tài khoản admin");
}

/** Vai trò trình ký -> cờ lưu trong DB (mỗi người một vai trò) */
export function approvalFlags(r: "STAFF" | "RELATED" | "DEPT_MANAGER" | "ADMIN") {
  return { isRelatedPerson: r === "RELATED", isDeptManager: r === "DEPT_MANAGER" };
}

/**
 * Kiểm tra cơ cấu Phòng ban - Khối - Vai trò, trả về divisionId sẽ lưu:
 *  - Quản trị viên: không thuộc khối.
 *  - Quản lý phòng ban: không thuộc khối, mỗi phòng ban chỉ 1 người.
 *  - Nhân viên / Phụ trách liên quan: bắt buộc chọn khối nếu phòng ban có khối; khối phải thuộc phòng ban.
 */
export async function resolveDivision(
  body: { departmentId: string; divisionId: string | null; approvalRole: "STAFF" | "RELATED" | "DEPT_MANAGER" | "ADMIN" },
  userId?: string,
) {
  if (body.approvalRole === "ADMIN") return null;
  if (body.approvalRole === "DEPT_MANAGER") {
    const other = await prisma.user.findFirst({
      where: { departmentId: body.departmentId, isDeptManager: true, deletedAt: null, ...(userId ? { id: { not: userId } } : {}) },
      select: { fullName: true },
    });
    if (other) throw badRequest(`Phòng ban này đã có Quản lý phòng ban: ${other.fullName}`);
    return null;
  }
  const divisions = await prisma.division.findMany({ where: { departmentId: body.departmentId, active: true }, select: { id: true } });
  if (!divisions.length) return null;
  if (!body.divisionId) throw badRequest("Chọn khối");
  if (!divisions.some((d) => d.id === body.divisionId)) throw badRequest("Khối không thuộc phòng ban đã chọn");
  return body.divisionId;
}

/** Tab Phân quyền: quyền sử dụng hệ thống */
export const permissionSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]),
});

export const userSelect = {
  id: true, username: true, fullName: true, email: true, phone: true, position: true, role: true, dataScope: true,
  departmentId: true, active: true, lastLoginAt: true, createdAt: true, isRelatedPerson: true, isDeptManager: true, catalogGrants: true,
  divisionId: true,
  department: { select: { id: true, name: true } },
  division: { select: { id: true, name: true } },
  projects: { select: { projectId: true, project: { select: { code: true } } } },
  _count: { select: { preparedDocuments: true } },
} as const;
