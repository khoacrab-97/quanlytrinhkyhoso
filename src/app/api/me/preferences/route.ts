import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handler, parseBody } from "@/server/api";

/** Lưu cấu hình giao diện cá nhân (merge theo khóa), vd: { "table.documents": {...} } */
export const PUT = handler(async ({ req, user }) => {
  const body = await parseBody(req, z.record(z.string(), z.unknown()));
  const size = JSON.stringify(body).length;
  if (size > 50_000) throw new Error("Cấu hình quá lớn");
  const merged = { ...user.preferences, ...body };
  await prisma.user.update({ where: { id: user.id }, data: { preferences: merged as Prisma.InputJsonValue } });
  return { ok: true };
});
