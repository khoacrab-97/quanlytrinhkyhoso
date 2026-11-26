import { handler, badRequest, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { importDocuments } from "@/server/importExport";

/** Import hồ sơ từ Excel. form: file, mode=validate|commit */
export const POST = handler(
  async ({ req, user }) => {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Chưa chọn file Excel");
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw badRequest("Chỉ hỗ trợ file .xlsx");
    if (file.size > 10 * 1024 * 1024) throw badRequest("File vượt quá 10MB");
    const commit = form.get("mode") === "commit";
    let result;
    try {
      result = await importDocuments(await file.arrayBuffer(), user, commit);
    } catch (e) {
      throw badRequest(`Không đọc được file Excel: ${e instanceof Error ? e.message : ""}`);
    }
    if (commit) await audit({ userId: user.id, action: "document.import", entity: "Document", detail: { file: file.name, imported: result.imported, errors: result.errors.length }, ip: clientIp(req) });
    return result;
  },
  { perm: "document.import" },
);
