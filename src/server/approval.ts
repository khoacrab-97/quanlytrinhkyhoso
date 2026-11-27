// =============================================================
//  THẨM QUYỀN XÁC NHẬN GIAI ĐOẠN
//  - Trình Phụ trách liên quan  -> Phụ trách liên quan cùng phòng ban (cùng khối với người lập) xác nhận "Đã kiểm tra"
//  - Quản lý phòng ban ký duyệt -> Quản lý phòng ban của phòng ban trình ký "Phê duyệt"
//  - Ban kiểm soát              -> Thành viên Ban kiểm soát "Kiểm duyệt" hoặc "Trả về" (kèm nhóm lỗi)
//  - Chờ TGĐ ký                 -> Thành viên Ban kiểm soát xác nhận "TGĐ đã ký"
//  Thành viên Ban kiểm soát = người dùng thuộc phòng ban có mã BKS.
//  Quản trị viên được xác nhận thay khi cần.
// =============================================================
import type { Prisma } from "@prisma/client";
import { STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const BKS_DEPARTMENT_CODE = "BKS";

export type Approver = {
  id: string;
  role: string;
  departmentId: string | null;
  divisionId: string | null;
  isRelatedPerson: boolean;
  isDeptManager: boolean;
  isBks: boolean;
};

/** Hồ sơ cần cho việc xét thẩm quyền: trạng thái, phòng ban trình ký, khối của người lập */
export type ApprovalDoc = { statusCode: string; departmentId: string; preparerDivisionId: string | null };

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function loadApprover(db: DbClient, userId: string): Promise<Approver> {
  const u = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, departmentId: true, divisionId: true, isRelatedPerson: true, isDeptManager: true, department: { select: { code: true } } },
  });
  return { ...u, isBks: u.department?.code === BKS_DEPARTMENT_CODE };
}

/** Người đang được chờ xác nhận ở từng giai đoạn */
export const WAITING_FOR: Record<string, string> = {
  [STATUS.STAGE_CHECK]: "Phụ trách liên quan",
  [STATUS.STAGE_MANAGER]: "Quản lý phòng ban",
  [STATUS.STAGE_BKS]: "Ban kiểm soát",
  [STATUS.STAGE_CEO]: "Ban kiểm soát (xác nhận Tổng Giám Đốc đã ký)",
};

export function canConfirm(a: Approver, d: ApprovalDoc) {
  if (!WAITING_FOR[d.statusCode]) return false;
  if (a.role === "ADMIN") return true;
  switch (d.statusCode) {
    case STATUS.STAGE_CHECK:
      return a.isRelatedPerson && a.departmentId === d.departmentId && (!d.preparerDivisionId || a.divisionId === d.preparerDivisionId);
    case STATUS.STAGE_MANAGER:
      return a.isDeptManager && a.departmentId === d.departmentId;
    default:
      return a.isBks;
  }
}

/** Chỉ Ban kiểm soát được trả hồ sơ, khi hồ sơ đang ở giai đoạn Ban kiểm soát */
export function canReturn(a: Approver, d: ApprovalDoc) {
  return d.statusCode === STATUS.STAGE_BKS && (a.role === "ADMIN" || a.isBks);
}

/** Điều kiện Prisma: hồ sơ đang chờ người này xác nhận */
export function pendingForWhere(a: Approver): Prisma.DocumentWhereInput {
  const or: Prisma.DocumentWhereInput[] = [];
  if (a.isRelatedPerson && a.departmentId) {
    or.push({
      status: { code: STATUS.STAGE_CHECK },
      departmentId: a.departmentId,
      ...(a.divisionId ? { preparer: { OR: [{ divisionId: a.divisionId }, { divisionId: null }] } } : { preparer: { divisionId: null } }),
    });
  }
  if (a.isDeptManager && a.departmentId) or.push({ status: { code: STATUS.STAGE_MANAGER }, departmentId: a.departmentId });
  if (a.isBks) or.push({ status: { code: { in: [STATUS.STAGE_BKS, STATUS.STAGE_CEO] } } });
  return or.length ? { OR: or } : { id: "__none__" };
}
