import { handler } from "@/server/api";
import { fileResponse } from "@/server/exporters";
import { importTemplate } from "@/server/importExport";

export const GET = handler(async () => fileResponse(await importTemplate(), "mau-import-ho-so.xlsx", "xlsx"), { perm: "document.import" });
