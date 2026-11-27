import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handler, parseBody, badRequest, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { approvalFlags, resolveDivision, userSchema, userSelect } from "@/server/users";

export const GET = handler(
  async () => prisma.user.findMany({ where: { deletedAt: null }, select: userSelect, orderBy: [{ active: "desc" }, { fullName: "asc" }] }),
  { perm: "user.manage" },
);

/** Tạo tài khoản: phòng ban + vai trò trình ký + quyền hệ thống (mặc định Nhân viên), phạm vi theo bộ phận */
export const POST = handler(
  async ({ req, user }) => {
    const body = await parseBody(req, userSchema);
    if (!body.password) throw badRequest("Nhập mật khẩu cho tài khoản mới");
    const { password, approvalRole, ...data } = body;
    if (await prisma.user.findUnique({ where: { username: data.username } })) throw badRequest("Tên đăng nhập đã tồn tại");
    data.divisionId = await resolveDivision(body);
    const created = await prisma.user.create({
      data: { ...data, ...approvalFlags(approvalRole), role: data.role ?? "STAFF", dataScope: "DEPARTMENT", passwordHash: await bcrypt.hash(password, 10) },
      select: userSelect,
    });
    await audit({ userId: user.id, action: "user.create", entity: "User", entityId: created.id, detail: { ...data, approvalRole }, ip: clientIp(req) });
    return created;
  },
  { perm: "user.manage" },
);
