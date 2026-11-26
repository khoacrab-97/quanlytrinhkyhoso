import { prisma } from "@/lib/prisma";
import { handler, parseBody, badRequest, notFound, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { permissionSchema, userSelect } from "@/server/users";

/** Phân quyền: quyền sử dụng hệ thống (Phụ trách liên quan / Quản lý phòng ban thiết lập ở thông tin người dùng) */
export const PATCH = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const existing = await prisma.user.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!existing) throw notFound("Người dùng");
    const body = await parseBody(req, permissionSchema);
    if (existing.id === user.id && body.role !== "ADMIN") throw badRequest("Không thể tự hạ quyền Quản trị của chính mình");
    const updated = await prisma.user.update({ where: { id: params.id }, data: body, select: userSelect });
    await audit({ userId: user.id, action: "user.permissions", entity: "User", entityId: params.id, detail: { before: { role: existing.role }, after: body }, ip: clientIp(req) });
    return updated;
  },
  { perm: "user.manage" },
);
