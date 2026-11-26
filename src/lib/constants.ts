// Mã trạng thái hệ thống - logic nghiệp vụ tham chiếu theo mã, tên hiển thị có thể đổi trong danh mục.
export const STATUS = {
  PREPARING: "PREPARING", // Đang soạn phiếu (chưa in)
  STAGE_CHECK: "STAGE_CHECK", // GĐ1: Trình Phụ trách liên quan (đã in, đã nộp)
  STAGE_MANAGER: "STAGE_MANAGER", // GĐ2: Quản lý phòng ban ký duyệt
  STAGE_BKS: "STAGE_BKS", // GĐ3: Ban kiểm soát
  STAGE_CEO: "STAGE_CEO", // GĐ4: BKS đã kiểm duyệt, chờ TGĐ ký
  CEO_SIGNED: "CEO_SIGNED", // GĐ5: TGĐ đã ký (kết thúc)
  BKS_RETURNED: "BKS_RETURNED", // Ban kiểm soát trả về - phải in ký lại, quay về GĐ1
  CANCELLED: "CANCELLED", // Đã hủy
} as const;

/**
 * Các giai đoạn cố định sau khi in phiếu. Người lập xác nhận tới giai đoạn nào thì ghi thời điểm lúc xác nhận.
 * label: hồ sơ đang ở giai đoạn; done: nội dung hiển thị khi xác nhận (mốc đạt được để vào giai đoạn này).
 */
export const STAGES = [
  { code: STATUS.STAGE_CHECK, label: "Trình Phụ trách liên quan", done: "Đã nộp (in phiếu)" },
  { code: STATUS.STAGE_MANAGER, label: "Quản lý phòng ban ký duyệt", done: "Phụ trách liên quan - Đã kiểm tra" },
  { code: STATUS.STAGE_BKS, label: "Ban kiểm soát", done: "Quản lý phòng ban - Đã phê duyệt" },
  { code: STATUS.STAGE_CEO, label: "Chờ TGĐ ký", done: "Ban kiểm soát - Đã kiểm duyệt" },
  { code: STATUS.CEO_SIGNED, label: "TGĐ đã ký", done: "Tổng Giám Đốc - Đã ký" },
] as const;
export type StageCode = (typeof STAGES)[number]["code"];
export const stageIndex = (code: string | null | undefined) => STAGES.findIndex((s) => s.code === code);

export const CATEGORY_LABELS: Record<string, string> = {
  DRAFT: "Đang soạn phiếu",
  SUBMITTED: "Đã nộp - Phụ trách liên quan",
  REVIEWING: "Đang ký duyệt (QL phòng ban / BKS / chờ TGĐ ký)",
  RETURNED: "BKS trả về - chờ in ký lại",
  REVISING: "Đang chỉnh sửa",
  APPROVED: "Đã ký duyệt",
  COMPLETED: "TGĐ đã ký",
  CANCELLED: "Đã hủy",
};

/** Nhóm trạng thái coi là đã kết thúc xử lý */
export const CLOSED_CATEGORIES = ["APPROVED", "COMPLETED", "CANCELLED"] as const;
/** Nhóm trạng thái đang nằm ở bên nhận ký */
export const IN_REVIEW_CATEGORIES = ["SUBMITTED", "REVIEWING"] as const;

export const FIX_STATUS_LABELS: Record<string, string> = {
  OPEN: "Chưa xử lý",
  IN_PROGRESS: "Đang chỉnh sửa",
  FIXED: "Đã sửa, chờ trình lại",
  CLOSED: "Đã trình lại / Đóng",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  CREATE: "Lập hồ sơ",
  UPDATE: "Cập nhật thông tin",
  SUBMIT: "In phiếu & nộp trình ký",
  RESUBMIT: "In ký lại & nộp lại",
  FORWARD: "Xác nhận giai đoạn",
  RETURN: "Ban kiểm soát trả về",
  START_REVISION: "Bắt đầu chỉnh sửa",
  FINISH_REVISION: "Hoàn thành chỉnh sửa",
  APPROVE: "TGĐ đã ký",
  COMPLETE: "Hoàn thành quy trình",
  CANCEL: "Hủy hồ sơ",
  STATUS_CHANGE: "Đổi trạng thái",
  NOTE: "Ghi chú",
  ATTACH: "Đính kèm file",
};

export const PRIORITY_LABELS: Record<number, string> = { 1: "Gấp", 2: "Bình thường", 3: "Thấp" };

/** Cấu hình mặc định (có thể sửa trong Quản trị hệ thống > Cấu hình) */
export const DEFAULT_SETTINGS: Record<string, { value: string; label: string }> = {
  "document.codePrefix": { value: "HS", label: "Tiền tố mã hồ sơ" },
  "form.reprintMinutes": { value: "60", label: "Phiếu trình ký: được in lại trong (phút) sau lần in đầu" },
};

export const ALLOWED_UPLOAD_EXT = [
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".csv", ".txt",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".dwg", ".dxf", ".zip", ".rar", ".7z",
];
