import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handler } from "@/server/api";

export const GET = handler(
  async ({ req }) => {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, Number(sp.get("page") ?? 1));
    const pageSize = Math.min(200, Number(sp.get("pageSize") ?? 50));
    const where: Prisma.AuditLogWhereInput = {};
    if (sp.get("userId")) where.userId = sp.get("userId")!;
    if (sp.get("entity")) where.entity = sp.get("entity")!;
    if (sp.get("entityId")) where.entityId = sp.get("entityId")!;
    if (sp.get("action")) where.action = { contains: sp.get("action")!, mode: "insensitive" };
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { user: { select: { fullName: true, username: true } } } }),
    ]);
    return { total, page, pageSize, rows };
  },
  { perm: "audit.view" },
);
