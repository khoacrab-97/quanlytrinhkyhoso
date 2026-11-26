import { prisma } from "@/lib/prisma";
import { handler } from "@/server/api";
import { fileResponse, toXlsx } from "@/server/exporters";
import { formListInclude, listSchema, listWhere, type FormContent } from "@/server/signingForms";

/** Xuất danh sách phiếu trình ký ra Excel theo bộ lọc */
export const GET = handler(async ({ req, user }) => {
  const p = listSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await prisma.signingForm.findMany({ where: listWhere(user, p), include: formListInclude, orderBy: { createdAt: "desc" }, take: 20000 });
  const data = rows.map((f) => {
    const c = f.content as FormContent;
    return {
      code: f.code, document: f.document.code, docTitle: c.docTitle, project: c.projectName, partner: c.partnerName, department: c.departmentName,
      kind: f.status === "DRAFT" ? "Đang soạn" : f.resubmitNo === 0 ? "Lần đầu" : `Trình lại lần ${f.resubmitNo}`,
      reason: f.resubmitReason ?? "", submitDate: c.submitDate, printedAt: f.printedAt, printCount: f.printCount,
      createdBy: f.createdBy.fullName, status: f.document.status.name, other: c.otherContent,
    };
  });
  const buf = await toXlsx({
    title: "Danh sách phiếu trình ký",
    subtitle: `Tổng số: ${data.length} phiếu`,
    tables: [{
      title: "Phiếu trình ký",
      columns: [
        { key: "code", label: "Mã phiếu", width: 16 }, { key: "document", label: "Mã hồ sơ", width: 16 }, { key: "docTitle", label: "Tên hồ sơ/Loại hồ sơ", width: 45 },
        { key: "project", label: "Dự án/Công trình", width: 30 }, { key: "partner", label: "CĐT/NCC/Thầu phụ", width: 30 }, { key: "department", label: "Phòng ban", width: 20 },
        { key: "kind", label: "Trình ký lần", width: 16 }, { key: "reason", label: "Lý do trình lại", width: 35 }, { key: "submitDate", label: "Ngày trình ký", format: "date", width: 12 },
        { key: "printedAt", label: "In lúc", format: "datetime", width: 16 }, { key: "printCount", label: "Số lần in", format: "number", width: 10 },
        { key: "createdBy", label: "Người thực hiện", width: 20 }, { key: "status", label: "Trạng thái hồ sơ", width: 18 }, { key: "other", label: "Nội dung khác", width: 30 },
      ],
      rows: data,
    }],
  });
  return fileResponse(buf, `phieu-trinh-ky-${new Date().toISOString().slice(0, 10)}.xlsx`, "xlsx");
});
