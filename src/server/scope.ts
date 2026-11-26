import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "./session";

/**
 * Điều kiện Prisma giới hạn hồ sơ theo phạm vi dữ liệu của người dùng.
 * Bất kể phạm vi nào, người dùng luôn thấy hồ sơ mà mình trực tiếp liên quan.
 */
export function documentScopeWhere(user: CurrentUser): Prisma.DocumentWhereInput {
  const base: Prisma.DocumentWhereInput = { deletedAt: null };
  if (user.role === "ADMIN" || user.dataScope === "ALL") return base;

  const own: Prisma.DocumentWhereInput[] = [
    { preparerId: user.id },
    { submitterId: user.id },
    { currentHolderId: user.id },
    { createdById: user.id },
    { recipient: { userId: user.id } },
    { returns: { some: { responsibleId: user.id } } },
  ];

  if (user.dataScope === "DEPARTMENT" && user.departmentId) {
    own.push({ departmentId: user.departmentId }, { currentDepartmentId: user.departmentId });
  }
  if (user.dataScope === "PROJECT" && user.projectIds.length) {
    own.push({ projectId: { in: user.projectIds } });
  }
  return { ...base, OR: own };
}

type DocLike = {
  preparerId: string;
  submitterId: string | null;
  currentHolderId: string | null;
  createdById: string;
  departmentId: string;
  projectId: string;
  recipient?: { userId: string | null } | null;
};

/** Người dùng có trực tiếp liên quan tới hồ sơ (người lập, trình, đang giữ, người nhận ký) */
export function isDirectlyInvolved(user: CurrentUser, d: DocLike) {
  return (
    d.preparerId === user.id ||
    d.submitterId === user.id ||
    d.currentHolderId === user.id ||
    d.createdById === user.id ||
    d.recipient?.userId === user.id
  );
}

/**
 * Quyền chỉnh sửa / xử lý một hồ sơ cụ thể (sau khi đã qua bộ lọc phạm vi xem).
 * - ADMIN: toàn quyền
 * - MANAGER: mọi hồ sơ trong phạm vi được xem
 * - STAFF: hồ sơ mình trực tiếp liên quan hoặc thuộc bộ phận mình
 * - VIEWER: không
 */
export function canModifyDocument(user: CurrentUser, d: DocLike) {
  if (user.role === "ADMIN" || user.role === "MANAGER") return true;
  if (user.role === "VIEWER") return false;
  return isDirectlyInvolved(user, d) || (!!user.departmentId && d.departmentId === user.departmentId);
}
