import { can } from "@/lib/permissions";
import { handler, parseBody, forbidden, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { getCatalog, listCatalog } from "@/server/catalogs";
import type { CurrentUser } from "@/server/session";
import { DELEGABLE_CATALOGS } from "@/lib/constants";

type P = { entity: string };

/** Quản trị viên quản lý mọi danh mục; người được ủy quyền xem và thêm mới đúng danh mục được giao */
const granted = (user: CurrentUser, entity: string) => can(user.role, "catalog.manage") || user.catalogGrants.includes(entity);

export const GET = handler<P>(async ({ req, user, params }) => {
  if (!granted(user, params.entity) && !can(user.role, "report.view")) throw forbidden();
  return listCatalog(params.entity, req.nextUrl.searchParams);
});

export const POST = handler<P>(async ({ req, user, params }) => {
  if (!granted(user, params.entity)) throw forbidden();
  const c = getCatalog(params.entity);
  const data = (await parseBody(req, c.schema)) as Record<string, unknown>;
  await c.beforeSave?.(data, null);
  // Ghi người thêm (5 danh mục được ủy quyền) để người đó sửa/xóa được mục của mình
  const owner = params.entity in DELEGABLE_CATALOGS ? { createdById: user.id } : {};
  const row = await c.model().create({ data: { ...(c.toData ? c.toData(data, false) : data), ...owner } });
  await audit({ userId: user.id, action: `catalog.create`, entity: params.entity, entityId: row.id, detail: data, ip: clientIp(req) });
  return row;
});
