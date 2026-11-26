// Xuất Excel (exceljs) và PDF (pdfmake, font Roboto hỗ trợ tiếng Việt) từ cấu trúc bảng chung.
import ExcelJS from "exceljs";
import { fmtDate, fmtDateTime } from "@/lib/dates";

export type Col = { key: string; label: string; width?: number; format?: "date" | "datetime" | "number" | "pct" | "text" | "days" };
export type Table = { title: string; columns: Col[]; rows: Record<string, unknown>[]; note?: string };
export type ExportDoc = { title: string; subtitle?: string; tables: Table[]; footnotes?: string[] };

function cell(v: unknown, f?: Col["format"]) {
  if (v === null || v === undefined || v === "") return "";
  if (f === "date") return fmtDate(v as string);
  if (f === "datetime") return fmtDateTime(v as string);
  if (f === "pct") return `${v}%`;
  if (f === "number" && typeof v === "number") return v.toLocaleString("vi-VN");
  return String(v);
}

export async function toXlsx(doc: ExportDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Hệ thống Quản lý trình ký hồ sơ";
  wb.created = new Date();
  const used = new Set<string>();
  for (const t of doc.tables) {
    let name = t.title.replace(/[\\/?*[\]:]/g, " ").slice(0, 28) || "Sheet";
    while (used.has(name)) name = name.slice(0, 26) + used.size;
    used.add(name);
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
    ws.mergeCells(1, 1, 1, Math.max(1, t.columns.length));
    ws.getCell(1, 1).value = doc.title.toUpperCase();
    ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF0F3D6E" } };
    ws.getCell(2, 1).value = [t.title, doc.subtitle].filter(Boolean).join(" — ");
    ws.getCell(2, 1).font = { italic: true, color: { argb: "FF475569" } };
    const header = ws.getRow(4);
    t.columns.forEach((c, i) => {
      const h = header.getCell(i + 1);
      h.value = c.label;
      h.font = { bold: true, color: { argb: "FFFFFFFF" } };
      h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      h.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      h.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      ws.getColumn(i + 1).width = c.width ?? Math.min(45, Math.max(10, c.label.length + 4));
    });
    header.height = 32;
    t.rows.forEach((r, ri) => {
      const row = ws.getRow(5 + ri);
      t.columns.forEach((c, i) => {
        const v = r[c.key];
        const x = row.getCell(i + 1);
        if ((c.format === "date" || c.format === "datetime") && v) {
          x.value = new Date(v as string);
          x.numFmt = c.format === "date" ? "dd/mm/yyyy" : "dd/mm/yyyy hh:mm";
        } else if ((c.format === "number" || c.format === "days") && typeof v === "number") {
          x.value = v;
          x.numFmt = c.format === "days" ? "0.0" : "#,##0";
        } else if (c.format === "pct" && typeof v === "number") {
          x.value = v / 100;
          x.numFmt = "0.0%";
        } else x.value = v === null || v === undefined ? "" : (v as ExcelJS.CellValue);
        x.border = { top: { style: "hair" }, bottom: { style: "hair" }, left: { style: "hair" }, right: { style: "hair" } };
        x.alignment = { vertical: "top", wrapText: true };
      });
    });
    if (t.note) ws.getCell(5 + t.rows.length + 1, 1).value = t.note;
    if (doc.footnotes?.length) {
      doc.footnotes.forEach((f, i) => {
        const c = ws.getCell(5 + t.rows.length + 3 + i, 1);
        c.value = f;
        c.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
      });
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(doc: ExportDoc): Promise<Buffer> {
  // pdfmake (server) – nạp font Roboto từ gói vfs đi kèm
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PdfPrinter = require("pdfmake");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const vfsMod = require("pdfmake/build/vfs_fonts.js");
  const vfs: Record<string, string> = vfsMod.pdfMake?.vfs ?? vfsMod;
  const b = (n: string) => Buffer.from(vfs[n], "base64");
  const printer = new PdfPrinter({
    Roboto: { normal: b("Roboto-Regular.ttf"), bold: b("Roboto-Medium.ttf"), italics: b("Roboto-Italic.ttf"), bolditalics: b("Roboto-MediumItalic.ttf") },
  });

  const content: unknown[] = [
    { text: doc.title.toUpperCase(), style: "title" },
    doc.subtitle ? { text: doc.subtitle, style: "subtitle" } : null,
    { text: `Ngày xuất: ${fmtDateTime(new Date())}`, style: "meta" },
  ].filter(Boolean);

  for (const t of doc.tables) {
    content.push({ text: t.title, style: "h2" });
    if (!t.rows.length) {
      content.push({ text: "Không có dữ liệu", italics: true, color: "#64748b", margin: [0, 0, 0, 8] });
      continue;
    }
    content.push({
      table: {
        headerRows: 1,
        widths: t.columns.map((c) => (c.width && c.width >= 30 ? "*" : "auto")),
        body: [
          t.columns.map((c) => ({ text: c.label, style: "th" })),
          ...t.rows.map((r) => t.columns.map((c) => ({ text: cell(r[c.key], c.format), style: "td", alignment: ["number", "pct", "days"].includes(c.format ?? "") ? "right" : "left" }))),
        ],
      },
      layout: {
        fillColor: (ri: number) => (ri === 0 ? "#1e3a5f" : ri % 2 === 0 ? "#f1f5f9" : null),
        hLineColor: () => "#cbd5e1",
        vLineColor: () => "#cbd5e1",
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
      },
      margin: [0, 0, 0, 6],
    });
    if (t.note) content.push({ text: t.note, style: "note" });
  }
  if (doc.footnotes?.length) {
    content.push({ text: "Công thức / ghi chú", style: "h2" });
    content.push({ ul: doc.footnotes.map((f) => ({ text: f, style: "note" })) });
  }

  const pdf = printer.createPdfKitDocument({
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 36],
    defaultStyle: { font: "Roboto", fontSize: 8.5 },
    footer: (cur: number, total: number) => ({ text: `Trang ${cur}/${total}`, alignment: "right", margin: [0, 8, 28, 0], fontSize: 8, color: "#64748b" }),
    content,
    styles: {
      title: { fontSize: 15, bold: true, color: "#0f3d6e", alignment: "center" },
      subtitle: { fontSize: 10, alignment: "center", color: "#334155", margin: [0, 2, 0, 0] },
      meta: { fontSize: 8, alignment: "center", color: "#64748b", margin: [0, 2, 0, 10] },
      h2: { fontSize: 11, bold: true, color: "#1e3a5f", margin: [0, 10, 0, 4] },
      th: { bold: true, color: "#ffffff", fontSize: 8.5 },
      td: { fontSize: 8 },
      note: { fontSize: 7.5, italics: true, color: "#64748b" },
    },
  });
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.end();
  });
}

export function fileResponse(buf: Buffer, filename: string, type: "xlsx" | "pdf") {
  const mime = type === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
