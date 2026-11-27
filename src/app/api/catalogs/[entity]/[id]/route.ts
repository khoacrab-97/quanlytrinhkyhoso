import { can } from "@/lib/permissions";
import { handler, parseBody, notFound, forbidden, clientIp } from "@/server/api";
import type { CurrentUser } from "@/server/session";
import { audit } from "@/server/audit";
import { getCatalog } from "@/server/catalogs";

type P = { entity: string; id: string };

/** Quản trị viên: mọi mục. Người được ủy quyền: chỉ mục do chính mình thêm, trong danh mục được giao */
function assertCanModify(user: CurrentUser, entity: string, existing: Record<string, unknown>) {
  if (can(user.role, "catalog.manage")) return;
  if (user.catalogGrants.includes(entity) && existing.createdById === user.id) return;
  throw forbidden("Bạn chỉ sửa / xóa được mục do chính mình thêm");
}

export const PATCH = handler<P>(
  async ({ req, user, params }) => {
    const c = getCatalog(params.entity);
    const existing = await c.model().findUnique({ where: { id: params.id } });
    if (!existing) throw notFound();
    assertCanModify(user, params.entity, existing);
    const data = (await parseBody(req, c.schema)) as Record<string, unknown>;
    await c.beforeSave?.(data, existing);
    const row = await c.model().update({ where: { id: params.id }, data: c.toData ? c.toData(data, true) : data });
    await audit({ userId: user.id, action: "catalog.update", entity: params.entity, entityId: params.id, detail: { before: existing, after: data }, ip: clientIp(req) });
    return row;
  },
);

/** Xóa cứng chỉ khi chưa được sử dụng; nếu đã phát sinh dữ liệu -> báo lỗi, đề nghị vô hiệu hóa */
export const DELETE = handler<P>(
  async ({ req, user, params }) => {
    const c = getCatalog(params.entity);
    const existing = await c.model().findUnique({ where: { id: params.id } });
    if (!existing) throw notFound();
    assertCanModify(user, params.entity, existing);
    await c.beforeDelete?.(existing);
    await c.model().delete({ where: { id: params.id } });
    await audit({ userId: user.id, action: "catalog.delete", entity: params.entity, entityId: params.id, detail: existing, ip: clientIp(req) });
    return { ok: true };
  },
);
