import { can } from "@/lib/permissions";
import { handler, parseBody, forbidden, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { getCatalog, listCatalog } from "@/server/catalogs";

type P = { entity: string };

export const GET = handler<P>(async ({ req, user, params }) => {
  if (!can(user.role, "catalog.manage") && !can(user.role, "report.view")) throw forbidden();
  return listCatalog(params.entity, req.nextUrl.searchParams);
});

export const POST = handler<P>(
  async ({ req, user, params }) => {
    const c = getCatalog(params.entity);
    const data = (await parseBody(req, c.schema)) as Record<string, unknown>;
    await c.beforeSave?.(data, null);
    const row = await c.model().create({ data: c.toData ? c.toData(data, false) : data });
    await audit({ userId: user.id, action: `catalog.create`, entity: params.entity, entityId: row.id, detail: data, ip: clientIp(req) });
    return row;
  },
  { perm: "catalog.manage" },
);
