import { can } from "@/lib/permissions";
import { handler, notFound, forbidden } from "@/server/api";
import { filterSchema } from "@/server/analytics";
import { audit } from "@/server/audit";
import { fileResponse, toPdf, toXlsx } from "@/server/exporters";
import { buildReport, REPORT_TITLES } from "@/server/reports";

/** GET /api/reports/{summary|time|errors|staff}?format=json|xlsx|pdf&...bộ lọc */
export const GET = handler<{ type: string }>(
  async ({ req, user, params }) => {
    if (!REPORT_TITLES[params.type]) throw notFound("Báo cáo");
    if (params.type === "staff" && !can(user.role, "report.staff")) throw forbidden("Chỉ Quản lý / Quản trị viên được xem báo cáo hiệu suất nhân sự");
    const sp = Object.fromEntries(req.nextUrl.searchParams);
    const { data, doc } = await buildReport(params.type, user, filterSchema.parse(sp));
    if (sp.format === "xlsx" || sp.format === "pdf") {
      await audit({ userId: user.id, action: "report.export", entity: "Report", entityId: params.type, detail: { format: sp.format, filters: sp } });
      const name = `bao-cao-${params.type}-${new Date().toISOString().slice(0, 10)}.${sp.format}`;
      return sp.format === "pdf" ? fileResponse(await toPdf(doc), name, "pdf") : fileResponse(await toXlsx(doc), name, "xlsx");
    }
    return data;
  },
  { perm: "report.view" },
);
