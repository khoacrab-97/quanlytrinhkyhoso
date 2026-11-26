// Định nghĩa 4 báo cáo quản trị -> dữ liệu JSON cho giao diện + cấu trúc bảng cho xuất Excel/PDF.
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/dates";
import { errorAnalytics, FORMULAS, reportStaff, reportSummary, reportTime, type Filters } from "./analytics";
import type { ExportDoc } from "./exporters";
import type { CurrentUser } from "./session";

export const REPORT_TITLES: Record<string, string> = {
  summary: "Báo cáo tổng hợp hồ sơ trình ký",
  time: "Báo cáo thời gian theo giai đoạn trình ký",
  errors: "Báo cáo phân tích lỗi hồ sơ",
  staff: "Báo cáo hiệu suất nhân sự",
};

async function describeFilters(f: Filters) {
  const parts: string[] = [];
  if (f.from || f.to) parts.push(`Thời gian: ${f.from ? fmtDate(f.from) : "…"} – ${f.to ? fmtDate(f.to) : "nay"}`);
  if (f.projectId) parts.push(`Công trình: ${(await prisma.project.findUnique({ where: { id: f.projectId } }))?.name ?? ""}`);
  if (f.departmentId) parts.push(`Bộ phận: ${(await prisma.department.findUnique({ where: { id: f.departmentId } }))?.name ?? ""}`);
  if (f.typeId) parts.push(`Loại: ${(await prisma.documentType.findUnique({ where: { id: f.typeId } }))?.name ?? ""}`);
  if (f.personId) parts.push(`Nhân sự: ${(await prisma.user.findUnique({ where: { id: f.personId } }))?.fullName ?? ""}`);
  if (f.sample === "exclude") parts.push("Chỉ dữ liệu chính thức");
  if (f.sample === "only") parts.push("Chỉ dữ liệu mẫu");
  return parts.join(" | ") || "Toàn bộ dữ liệu trong phạm vi được phân quyền";
}

export async function buildReport(type: string, user: CurrentUser, f: Filters): Promise<{ data: unknown; doc: ExportDoc }> {
  const subtitle = await describeFilters(f);
  switch (type) {
    case "summary": {
      const data = await reportSummary(user, f);
      return {
        data,
        doc: {
          title: REPORT_TITLES.summary, subtitle,
          tables: [
            {
              title: "Tổng hợp theo kỳ (theo ngày lập hồ sơ)",
              columns: [
                { key: "period", label: "Kỳ", width: 14 }, { key: "total", label: "Tổng HS", format: "number" }, { key: "submitted", label: "Đã in nộp", format: "number" },
                { key: "submissions", label: "Số lần in nộp", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" },
                { key: "notCompleted", label: "Chưa xong", format: "number" }, { key: "cancelled", label: "Đã hủy", format: "number" },
                { key: "returnedDocs", label: "HS bị BKS trả", format: "number" }, { key: "totalReturns", label: "Số lần BKS trả", format: "number" },
                { key: "completionRate", label: "Tỷ lệ TGĐ đã ký", format: "pct" },
                { key: "returnRate", label: "Tỷ lệ bị trả", format: "pct" },
              ],
              rows: [...data.rows, data.totals],
            },
            {
              title: "Tổng hợp theo công trình",
              columns: [
                { key: "name", label: "Công trình", width: 40 }, { key: "total", label: "Tổng HS", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" },
                { key: "notCompleted", label: "Chưa xong", format: "number" }, { key: "returnedDocs", label: "HS bị BKS trả", format: "number" },
                { key: "totalReturns", label: "Số lần BKS trả", format: "number" }, { key: "completionRate", label: "Tỷ lệ TGĐ đã ký", format: "pct" },
              ],
              rows: data.byProject,
            },
            {
              title: "Tổng hợp theo phòng ban trình ký",
              columns: [
                { key: "name", label: "Phòng ban", width: 30 }, { key: "total", label: "Tổng HS", format: "number" }, { key: "pending", label: "Đang soạn", format: "number" },
                { key: "inReview", label: "Đang trình", format: "number" }, { key: "returnedNow", label: "Chờ in ký lại", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" },
                { key: "submissions", label: "Số lần in nộp", format: "number" }, { key: "totalReturns", label: "Số lần BKS trả", format: "number" }, { key: "returnRate", label: "Tỷ lệ bị trả", format: "pct" },
              ],
              rows: data.byDepartment,
            },
          ],
          footnotes: [FORMULAS.completionRate, FORMULAS.returnRate, FORMULAS.completed, FORMULAS.submissions],
        },
      };
    }
    case "time": {
      const data = await reportTime(user, f);
      const statCols = [
        { key: "count", label: "Số HS", format: "number" as const }, { key: "approvedCount", label: "TGĐ đã ký", format: "number" as const },
        { key: "avgDays", label: "Nộp → TGĐ ký TB (ngày)", format: "days" as const }, { key: "minDays", label: "Nhanh nhất", format: "days" as const },
        { key: "maxDays", label: "Chậm nhất", format: "days" as const },
      ];
      return {
        data,
        doc: {
          title: REPORT_TITLES.time, subtitle,
          tables: [
            { title: "Tổng quan", columns: statCols, rows: [data.overall] },
            {
              title: "Thời gian thực tế ở từng giai đoạn",
              columns: [
                { key: "stage", label: "Giai đoạn", width: 28 }, { key: "next", label: "Đến giai đoạn", width: 28 }, { key: "count", label: "Lượt", format: "number" },
                { key: "avgDays", label: "TG TB (ngày)", format: "days" }, { key: "maxDays", label: "Lâu nhất", format: "days" },
              ],
              rows: data.byStage,
            },
            { title: "Theo loại hồ sơ", columns: [{ key: "name", label: "Loại hồ sơ", width: 34 }, ...statCols], rows: data.byType },
            { title: "Theo phòng ban trình ký", columns: [{ key: "name", label: "Phòng ban", width: 30 }, ...statCols], rows: data.byDepartment },
          ],
          footnotes: [FORMULAS.processingDays, FORMULAS.stageDays],
        },
      };
    }
    case "errors": {
      const data = await errorAnalytics(user, f);
      const s = data.summary;
      return {
        data,
        doc: {
          title: REPORT_TITLES.errors, subtitle,
          tables: [
            {
              title: "Tổng quan",
              columns: [{ key: "k", label: "Chỉ tiêu", width: 40 }, { key: "v", label: "Giá trị" }],
              rows: [
                { k: "Tổng số lần hồ sơ bị trả", v: s.totalReturns }, { k: "Số hồ sơ bị trả (ít nhất 1 lần)", v: s.returnedDocs },
                { k: "Số hồ sơ đã trình ký", v: s.submittedDocs }, { k: "Tỷ lệ hồ sơ bị trả", v: `${s.returnRate}%` },
                { k: "Tổng số lỗi ghi nhận", v: s.totalErrors }, { k: "Số lỗi trung bình / lần trả", v: s.avgErrorsPerReturn },
                { k: "Số lần trả trung bình / hồ sơ bị trả", v: s.avgReturnsPerReturnedDoc }, { k: "Lần trả đã khắc phục", v: s.fixedReturns },
                { k: "Lần trả chưa in ký lại", v: s.openReturns },
                { k: "Thời gian khắc phục TB (ngày)", v: s.avgFixDays ?? "" },
              ],
            },
            {
              title: "Theo nhóm lỗi",
              columns: [{ key: "name", label: "Nhóm lỗi", width: 34 }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "pct", label: "Tỷ lệ", format: "pct" }, { key: "returns", label: "Số lần trả", format: "number" }, { key: "docs", label: "Số HS", format: "number" }, { key: "unresolved", label: "Chưa khắc phục", format: "number" }],
              rows: data.byCategory,
            },
            {
              title: "Top 10 lỗi thường gặp",
              columns: [{ key: "name", label: "Lỗi", width: 36 }, { key: "category", label: "Nhóm", width: 26 }, { key: "count", label: "Tần suất", format: "number" }, { key: "pct", label: "Tỷ lệ", format: "pct" }, { key: "docs", label: "Số HS", format: "number" }],
              rows: data.topReasons,
            },
            { title: "Theo người lập hồ sơ", columns: [{ key: "name", label: "Người lập", width: 28 }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "returns", label: "Lần trả", format: "number" }, { key: "docs", label: "Số HS", format: "number" }], rows: data.byPreparer },
            { title: "Theo bộ phận", columns: [{ key: "name", label: "Bộ phận", width: 28 }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "returns", label: "Lần trả", format: "number" }, { key: "docs", label: "Số HS", format: "number" }], rows: data.byDepartment },
            { title: "Theo công trình", columns: [{ key: "name", label: "Công trình", width: 40 }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "returns", label: "Lần trả", format: "number" }, { key: "docs", label: "Số HS", format: "number" }], rows: data.byProject },
            { title: "Theo kỳ", columns: [{ key: "label", label: "Kỳ" }, { key: "returns", label: "Lần trả", format: "number" }, { key: "docs", label: "HS bị trả", format: "number" }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "fixed", label: "Đã khắc phục", format: "number" }], rows: data.byPeriod },
            { title: "Lỗi tái diễn trên cùng hồ sơ", columns: [{ key: "code", label: "Mã HS" }, { key: "title", label: "Hồ sơ", width: 36 }, { key: "reason", label: "Lỗi", width: 30 }, { key: "times", label: "Số lần", format: "number" }, { key: "preparer", label: "Người lập" }], rows: data.recurringOnDoc },
            { title: "Lỗi lặp lại theo người lập (≥3 lần)", columns: [{ key: "person", label: "Người lập", width: 24 }, { key: "reason", label: "Lỗi", width: 30 }, { key: "category", label: "Nhóm" }, { key: "times", label: "Số lần", format: "number" }, { key: "docs", label: "Số HS", format: "number" }], rows: data.recurringByPerson },
          ],
          footnotes: [FORMULAS.returnsCount, FORMULAS.errorsCount, FORMULAS.returnRate],
        },
      };
    }
    case "staff": {
      const data = await reportStaff(user, f);
      return {
        data,
        doc: {
          title: REPORT_TITLES.staff, subtitle,
          tables: [
            {
              title: "Hiệu suất theo nhân sự",
              columns: [
                { key: "name", label: "Nhân sự", width: 22 }, { key: "department", label: "Bộ phận", width: 20 }, { key: "prepared", label: "HS đã lập", format: "number" },
                { key: "submitted", label: "Đã trình", format: "number" }, { key: "completed", label: "Hoàn thành", format: "number" }, { key: "processed", label: "HS đã xử lý", format: "number" },
                { key: "returnRate", label: "Tỷ lệ HS bị trả", format: "pct" }, { key: "responsibleReturns", label: "Lần trả có trách nhiệm", format: "number" },
                { key: "attributableErrors", label: "Lỗi có trách nhiệm", format: "number" }, { key: "objectiveReturns", label: "Trả do khách quan", format: "number" },
                { key: "avgPrepDays", label: "TG lập→trình TB", format: "days" }, { key: "avgFixDays", label: "TG chỉnh sửa TB", format: "days" },
              ],
              rows: data.rows,
            },
          ],
          footnotes: [
            FORMULAS.staffReturnRate, FORMULAS.staffReturns, FORMULAS.processed, FORMULAS.revisionDays,
            "Lưu ý: chỉ số mang tính tham khảo, cần xem xét cùng độ phức tạp của loại hồ sơ, khối lượng công việc và nguyên nhân khách quan trước khi đánh giá cá nhân.",
          ],
        },
      };
    }
  }
  throw new Error("Loại báo cáo không hợp lệ");
}
