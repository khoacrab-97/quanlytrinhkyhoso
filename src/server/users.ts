import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest } from "@/server/api";

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
  /** Vai trò trình ký: Nhân viên / Phụ trách liên quan / Quản lý phòng ban */
  approvalRole: z.enum(["STAFF", "RELATED", "DEPT_MANAGER"]).default("STAFF"),
  /** Quyền hệ thống (Quản trị viên / Quản lý / Nhân viên / Người xem); bỏ trống khi tạo = Nhân viên */
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "VIEWER"]).optional(),
  active: z.boolean().default(true),
  password: passwordSchema.optional().or(z.literal("")).transform((v) => v || undefined),
});

/** Vai trò trình ký -> cờ lưu trong DB (mỗi người một vai trò) */
export function approvalFlags(r: "STAFF" | "RELATED" | "DEPT_MANAGER") {
  return { isRelatedPerson: r === "RELATED", isDeptManager: r === "DEPT_MANAGER" };
}

/**
 * Kiểm tra cơ cấu Phòng ban - Khối - Vai trò, trả về divisionId sẽ lưu:
 *  - Quản lý phòng ban: không thuộc khối, mỗi phòng ban chỉ 1 người.
 *  - Nhân viên / Phụ trách liên quan: bắt buộc chọn khối nếu phòng ban có khối; khối phải thuộc phòng ban.
 */
export async function resolveDivision(
  body: { departmentId: string; divisionId: string | null; approvalRole: "STAFF" | "RELATED" | "DEPT_MANAGER" },
  userId?: string,
) {
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
  departmentId: true, active: true, lastLoginAt: true, createdAt: true, isRelatedPerson: true, isDeptManager: true,
  divisionId: true,
  department: { select: { id: true, name: true } },
  division: { select: { id: true, name: true } },
  projects: { select: { projectId: true, project: { select: { code: true } } } },
  _count: { select: { preparedDocuments: true } },
} as const;
