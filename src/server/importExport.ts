// Import / Export danh sách hồ sơ bằng Excel.
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { PRIORITY_LABELS } from "@/lib/constants";
import { createDocument } from "./documents";
import { performAction, type Actor } from "./workflow";
import type { Col } from "./exporters";

export const DOC_EXPORT_COLUMNS: Col[] = [
  { key: "code", label: "Mã hồ sơ", width: 16 },
  { key: "docNumber", label: "Số hồ sơ", width: 22 },
  { key: "title", label: "Tên hồ sơ", width: 45 },
  { key: "type", label: "Loại hồ sơ", width: 28 },
  { key: "project", label: "Công trình", width: 30 },
  { key: "contractor", label: "Nhà thầu", width: 28 },
  { key: "department", label: "Bộ phận lập", width: 22 },
  { key: "preparer", label: "Người lập", width: 20 },
  { key: "submitter", label: "Người trình ký", width: 20 },
  { key: "recipient", label: "Người nhận ký", width: 26 },
  { key: "preparedDate", label: "Ngày lập", format: "date", width: 12 },
  { key: "firstSubmittedAt", label: "Ngày trình", format: "date", width: 12 },
  { key: "lastSubmittedAt", label: "Ngày trình gần nhất", format: "date", width: 12 },
  { key: "approvedAt", label: "Ngày ký duyệt", format: "date", width: 12 },
  { key: "completedAt", label: "Ngày hoàn thành", format: "date", width: 12 },
  { key: "status", label: "Trạng thái", width: 20 },
  { key: "holder", label: "Đang nằm ở", width: 24 },
  { key: "submissionCount", label: "Số lần trình", format: "number", width: 10 },
  { key: "returnCount", label: "Số lần trả lại", format: "number", width: 10 },
  { key: "priority", label: "Ưu tiên", width: 12 },
  { key: "notes", label: "Ghi chú", width: 30 },
  { key: "isSample", label: "Dữ liệu mẫu", width: 10 },
];

type ListRow = Awaited<ReturnType<typeof import("./documents").listDocuments>>["rows"][number];
export function docToExportRow(d: ListRow) {
  return {
    code: d.code, docNumber: d.docNumber, title: d.title, type: d.type.name, project: `${d.project.code} - ${d.project.name}`,
    contractor: d.contractor?.name ?? "", department: d.department.name, preparer: d.preparer.fullName, submitter: d.submitter?.fullName ?? "",
    recipient: d.recipient ? [d.recipient.name, d.recipient.organization].filter(Boolean).join(" - ") : "",
    preparedDate: d.preparedDate, firstSubmittedAt: d.firstSubmittedAt, lastSubmittedAt: d.lastSubmittedAt,
    approvedAt: d.approvedAt, completedAt: d.completedAt, status: d.status.name,
    holder: d.currentHolder?.fullName ?? d.currentHolderNote ?? d.currentDepartment?.name ?? "",
    submissionCount: d.submissionCount, returnCount: d.returnCount, priority: PRIORITY_LABELS[d.priority], notes: d.notes ?? "",
    isSample: d.isSample ? "Có" : "",
  };
}

// ----------------------------------------------------------- IMPORT
export const IMPORT_COLUMNS = [
  { key: "docNumber", label: "Số hồ sơ", required: false, hint: "Số hiệu văn bản" },
  { key: "title", label: "Tên hồ sơ", required: true, hint: "Bắt buộc" },
  { key: "type", label: "Loại hồ sơ", required: true, hint: "Mã hoặc tên loại hồ sơ trong danh mục" },
  { key: "project", label: "Công trình", required: true, hint: "Mã công trình (vd: CT-HP01)" },
  { key: "contractor", label: "Nhà thầu", required: false, hint: "Mã hoặc tên nhà thầu" },
  { key: "department", label: "Bộ phận lập", required: true, hint: "Mã hoặc tên bộ phận" },
  { key: "preparer", label: "Người lập", required: true, hint: "Tên đăng nhập hoặc họ tên" },
  { key: "submitter", label: "Người trình ký", required: false, hint: "Tên đăng nhập hoặc họ tên" },
  { key: "recipient", label: "Người nhận ký", required: false, hint: "Tên người nhận trong danh mục" },
  { key: "preparedDate", label: "Ngày lập", required: true, hint: "dd/mm/yyyy" },
  { key: "submittedDate", label: "Ngày nộp", required: false, hint: "dd/mm/yyyy - nếu có sẽ ghi nhận lần in nộp 1 (Trình Phụ trách liên quan)" },
  { key: "approvedDate", label: "Ngày TGĐ ký", required: false, hint: "dd/mm/yyyy - nếu có sẽ ghi nhận giai đoạn TGĐ đã ký" },
  { key: "notes", label: "Ghi chú", required: false, hint: "" },
] as const;

export async function importTemplate() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Ho so");
  ws.addRow(IMPORT_COLUMNS.map((c) => c.label + (c.required ? " *" : "")));
  ws.addRow(IMPORT_COLUMNS.map((c) => c.hint));
  ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
  ws.getRow(2).font = { italic: true, color: { argb: "FF64748B" } };
  IMPORT_COLUMNS.forEach((_, i) => (ws.getColumn(i + 1).width = 22));
  // Sheet tham chiếu danh mục
  const ref = wb.addWorksheet("Danh muc tham chieu");
  const [types, projects, depts, users, contractors, recipients] = await Promise.all([
    prisma.documentType.findMany({ where: { active: true } }), prisma.project.findMany({ where: { active: true } }),
    prisma.department.findMany({ where: { active: true } }), prisma.user.findMany({ where: { active: true } }),
    prisma.contractor.findMany({ where: { active: true } }), prisma.recipient.findMany({ where: { active: true } }),
  ]);
  ref.addRow(["Loại hồ sơ (mã - tên)", "Công trình (mã - tên)", "Bộ phận (mã - tên)", "Nhân sự (tên đăng nhập - họ tên)", "Nhà thầu (mã - tên)", "Người nhận ký"]).font = { bold: true };
  const n = Math.max(types.length, projects.length, depts.length, users.length, contractors.length, recipients.length);
  for (let i = 0; i < n; i++) {
    ref.addRow([
      types[i] ? `${types[i].code} - ${types[i].name}` : "", projects[i] ? `${projects[i].code} - ${projects[i].name}` : "",
      depts[i] ? `${depts[i].code} - ${depts[i].name}` : "", users[i] ? `${users[i].username} - ${users[i].fullName}` : "",
      contractors[i] ? `${contractors[i].code} - ${contractors[i].name}` : "", recipients[i]?.name ?? "",
    ]);
  }
  ref.columns.forEach((c) => (c.width = 40));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return new Date(Math.round((v - 25569) * 86400 * 1000)); // serial Excel
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 9, 0, 0);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function cellText(v: ExcelJS.CellValue): unknown {
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("text" in v) return (v as { text: string }).text;
    if ("result" in v) return (v as { result: unknown }).result;
    if ("richText" in v) return (v as { richText: { text: string }[] }).richText.map((r) => r.text).join("");
  }
  return v;
}

export async function importDocuments(buf: ArrayBuffer, actor: Actor, commit: boolean) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("File không có dữ liệu");

  const header = (ws.getRow(1).values as ExcelJS.CellValue[]).map((v) => String(cellText(v) ?? "").replace("*", "").trim().toLowerCase());
  const colIdx: Record<string, number> = {};
  for (const c of IMPORT_COLUMNS) {
    const i = header.indexOf(c.label.toLowerCase());
    if (i > 0) colIdx[c.key] = i;
  }
  const missing = IMPORT_COLUMNS.filter((c) => c.required && !colIdx[c.key]).map((c) => c.label);
  if (missing.length) return { ok: false, errors: [{ row: 1, message: `Thiếu cột bắt buộc: ${missing.join(", ")}` }], valid: 0, imported: 0, total: 0 };

  const [types, projects, depts, users, contractors, recipients] = await Promise.all([
    prisma.documentType.findMany({ where: { active: true } }), prisma.project.findMany({ where: { active: true } }),
    prisma.department.findMany({ where: { active: true } }), prisma.user.findMany({ where: { active: true } }),
    prisma.contractor.findMany({ where: { active: true } }), prisma.recipient.findMany({ where: { active: true } }),
  ]);
  const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();
  const find = <T extends Record<string, unknown>>(list: T[], v: unknown, keys: (keyof T)[]) => {
    const x = norm(v);
    if (!x) return null;
    const head = x.split(" - ")[0];
    return list.find((it) => keys.some((k) => norm(it[k]) === x || norm(it[k]) === head)) ?? null;
  };

  const errors: { row: number; message: string }[] = [];
  const rows: { row: number; input: Parameters<typeof createDocument>[0]; submitted: Date | null; approved: Date | null; recipientId: string | null }[] = [];
  ws.eachRow((r, rowNumber) => {
    if (rowNumber === 1) return;
    const get = (k: string) => (colIdx[k] ? cellText(r.getCell(colIdx[k]).value) : null);
    const title = String(get("title") ?? "").trim();
    if (!title || (rowNumber === 2 && title === "Bắt buộc")) return; // bỏ dòng trống / dòng hướng dẫn
    const errs: string[] = [];
    const type = find(types, get("type"), ["code", "name"]);
    const project = find(projects, get("project"), ["code", "name"]);
    const dept = find(depts, get("department"), ["code", "name"]);
    const preparer = find(users, get("preparer"), ["username", "fullName"]);
    const submitter = get("submitter") ? find(users, get("submitter"), ["username", "fullName"]) : null;
    const contractor = get("contractor") ? find(contractors, get("contractor"), ["code", "name"]) : null;
    const recipient = get("recipient") ? find(recipients, get("recipient"), ["name"]) : null;
    const preparedDate = parseDate(get("preparedDate"));
    const submitted = parseDate(get("submittedDate"));
    const approved = parseDate(get("approvedDate"));
    if (!type) errs.push(`Loại hồ sơ "${get("type") ?? ""}" không có trong danh mục`);
    if (!project) errs.push(`Công trình "${get("project") ?? ""}" không có trong danh mục`);
    if (!dept) errs.push(`Bộ phận "${get("department") ?? ""}" không có trong danh mục`);
    if (!preparer) errs.push(`Người lập "${get("preparer") ?? ""}" không tồn tại`);
    if (get("submitter") && !submitter) errs.push(`Người trình "${get("submitter")}" không tồn tại`);
    if (get("contractor") && !contractor) errs.push(`Nhà thầu "${get("contractor")}" không có trong danh mục`);
    if (get("recipient") && !recipient) errs.push(`Người nhận ký "${get("recipient")}" không có trong danh mục`);
    if (!preparedDate) errs.push("Ngày lập không hợp lệ (dd/mm/yyyy)");
    if (preparedDate && submitted && submitted < preparedDate) errs.push("Ngày trình trước ngày lập");
    if (approved && !submitted) errs.push("Có ngày ký duyệt nhưng thiếu ngày trình");
    if (approved && submitted && approved < submitted) errs.push("Ngày ký duyệt trước ngày trình");
    if (title.length > 500) errs.push("Tên hồ sơ quá dài");
    if (errs.length) {
      errors.push({ row: rowNumber, message: errs.join("; ") });
      return;
    }
    rows.push({
      row: rowNumber,
      submitted,
      approved,
      recipientId: recipient?.id ?? null,
      input: {
        docNumber: get("docNumber") ? String(get("docNumber")).trim() : null,
        title, typeId: type!.id, projectId: project!.id, contractorId: contractor?.id ?? null, departmentId: dept!.id,
        preparerId: preparer!.id, submitterId: submitter?.id ?? null, recipientId: recipient?.id ?? null,
        preparedDate: preparedDate!, priority: 2, notes: get("notes") ? String(get("notes")) : null, customFields: null,
      },
    });
  });

  let imported = 0;
  if (commit) {
    for (const r of rows) {
      try {
        const doc = await createDocument(r.input, actor);
        if (r.submitted) await performAction(doc.id, { action: "submit", at: r.submitted }, actor);
        if (r.approved) await performAction(doc.id, { action: "advance", stage: "CEO_SIGNED", at: r.approved, note: "Nhập từ Excel" }, actor);
        imported++;
      } catch (e) {
        errors.push({ row: r.row, message: e instanceof Error ? e.message : "Lỗi không xác định" });
      }
    }
  }
  return { ok: errors.length === 0, total: rows.length + errors.length, valid: rows.length, imported, errors: errors.sort((a, b) => a.row - b.row) };
}
