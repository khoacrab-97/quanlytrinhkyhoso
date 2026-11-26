// Ma trận phân quyền theo vai trò (dùng chung client + server).
// Phạm vi dữ liệu (DataScope) được áp dụng riêng ở src/server/scope.ts.

export type RoleName = "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  VIEWER: "Người xem",
};

export const SCOPE_LABELS: Record<string, string> = {
  ALL: "Toàn hệ thống",
  DEPARTMENT: "Theo bộ phận",
  PROJECT: "Theo công trình được phân công",
  OWN: "Hồ sơ cá nhân liên quan",
};

export type Permission =
  | "document.create"
  | "document.edit"
  | "document.delete"
  | "document.process" // trình ký, trả, ký duyệt, cập nhật tiến độ
  | "document.forceStatus" // đổi trạng thái tự do (ngoài luồng chuẩn)
  | "document.import"
  | "return.manage"
  | "report.view"
  | "report.staff" // báo cáo hiệu suất nhân sự
  | "catalog.manage"
  | "user.manage"
  | "system.manage" // cấu hình, sao lưu, nhật ký
  | "audit.view";

const MATRIX: Record<RoleName, Permission[]> = {
  ADMIN: [
    "document.create", "document.edit", "document.delete", "document.process", "document.forceStatus",
    "document.import", "return.manage", "report.view", "report.staff", "catalog.manage", "user.manage",
    "system.manage", "audit.view",
  ],
  MANAGER: [
    "document.create", "document.edit", "document.delete", "document.process", "document.forceStatus",
    "document.import", "return.manage", "report.view", "report.staff",
  ],
  STAFF: ["document.create", "document.edit", "document.delete", "document.process", "return.manage", "report.view"],
  VIEWER: ["report.view"],
};

export function can(role: string | undefined | null, perm: Permission) {
  if (!role) return false;
  return MATRIX[role as RoleName]?.includes(perm) ?? false;
}
