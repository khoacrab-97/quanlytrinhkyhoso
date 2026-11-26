import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, parseBody, badRequest, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { passwordSchema } from "@/server/users";

export const PUT = handler(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ current: z.string().min(1, "Nhập mật khẩu hiện tại"), next: passwordSchema }));
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(body.current, u.passwordHash))) throw badRequest("Mật khẩu hiện tại không đúng");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.next, 10) } });
  await audit({ userId: user.id, action: "user.change_password", entity: "User", entityId: user.id, ip: clientIp(req) });
  return { ok: true };
});
