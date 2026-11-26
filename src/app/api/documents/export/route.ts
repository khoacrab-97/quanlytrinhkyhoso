import { handler } from "@/server/api";
import { audit } from "@/server/audit";
import { listDocuments, listQuerySchema } from "@/server/documents";
import { fileResponse, toPdf, toXlsx } from "@/server/exporters";
import { DOC_EXPORT_COLUMNS, docToExportRow } from "@/server/importExport";

/** Xuất danh sách hồ sơ theo bộ lọc hiện tại (?format=xlsx|pdf) */
export const GET = handler(async ({ req, user }) => {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const q = listQuerySchema.parse({ ...params, page: 1, pageSize: 1000 });
  const all = [];
  for (let page = 1; ; page++) {
    const r = await listDocuments(user, { ...q, page, pageSize: 1000 });
    all.push(...r.rows);
    if (all.length >= r.total || !r.rows.length) break;
  }
  const format = params.format === "pdf" ? "pdf" : "xlsx";
  const columns = format === "pdf"
    ? DOC_EXPORT_COLUMNS.filter((c) => ["code", "docNumber", "title", "type", "project", "preparer", "firstSubmittedAt", "dueDate", "approvedAt", "status", "holder", "returnCount"].includes(c.key))
    : DOC_EXPORT_COLUMNS;
  const doc = { title: "Danh sách hồ sơ trình ký", subtitle: `Tổng số: ${all.length} hồ sơ`, tables: [{ title: "Danh sách hồ sơ", columns, rows: all.map(docToExportRow) }] };
  await audit({ userId: user.id, action: "document.export", entity: "Document", detail: { count: all.length, format, filters: params } });
  const stamp = new Date().toISOString().slice(0, 10);
  return format === "pdf" ? fileResponse(await toPdf(doc), `ho-so-${stamp}.pdf`, "pdf") : fileResponse(await toXlsx(doc), `ho-so-${stamp}.xlsx`, "xlsx");
});
