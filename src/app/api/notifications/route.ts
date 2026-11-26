import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, parseBody } from "@/server/api";

export const GET = handler(async ({ req, user }) => {
  const onlyUnread = req.nextUrl.searchParams.get("unread") === "1";
  const take = Math.min(200, Number(req.nextUrl.searchParams.get("take") ?? 50));
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: user.id, ...(onlyUnread ? { read: false } : {}) }, orderBy: { createdAt: "desc" }, take }),
    prisma.notification.count({ where: { userId: user.id, read: false } }),
  ]);
  return { items, unread };
});

/** Đánh dấu đã đọc: { ids?: string[], all?: true } */
export const PATCH = handler(async ({ req, user }) => {
  const body = await parseBody(req, z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() }));
  await prisma.notification.updateMany({
    where: { userId: user.id, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { read: true },
  });
  return { ok: true };
});
