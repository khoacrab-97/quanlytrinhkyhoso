import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handler, parseBody, badRequest, notFound, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { approvalFlags, resolveDivision, userSchema, userSelect } from "@/server/users";

async function load(id: string) {
  const u = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!u) throw notFound("Người dùng");
  return u;
}

/** Sửa thông tin tài khoản: phòng ban, vai trò trình ký... (quyền hệ thống sửa ở /permissions) */
export const PATCH = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const existing = await load(params.id);
    const body = await parseBody(req, userSchema);
    if (existing.id === user.id && !body.active) throw badRequest("Không thể tự khóa tài khoản của chính mình");
    const { password, username: _u, approvalRole, ...data } = body;
    void _u; // tên đăng nhập không đổi được
    data.divisionId = await resolveDivision(body, existing.id);
    const updated = await prisma.user.update({
      where: { id: params.id },
      data: { ...data, ...approvalFlags(approvalRole), ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      select: userSelect,
    });
    await audit({ userId: user.id, action: password ? "user.update_password" : "user.update", entity: "User", entityId: params.id, detail: { ...data, approvalRole }, ip: clientIp(req) });
    return updated;
  },
  { perm: "user.manage" },
);

/**
 * Xóa người dùng khỏi hệ thống: tài khoản bị khóa, ẩn khỏi mọi danh sách, tên đăng nhập được giải phóng.
 * Hồ sơ, lịch sử đã phát sinh vẫn giữ nguyên tên người thực hiện.
 */
export const DELETE = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const existing = await load(params.id);
    if (existing.id === user.id) throw badRequest("Không thể xóa tài khoản đang đăng nhập");
    await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { userId: existing.id } }),
      prisma.user.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), active: false, username: `${existing.username}#xoa-${Date.now()}` },
      }),
    ]);
    await audit({ userId: user.id, action: "user.delete", entity: "User", entityId: existing.id, detail: { username: existing.username, fullName: existing.fullName }, ip: clientIp(req) });
    return { ok: true };
  },
  { perm: "user.manage" },
);
