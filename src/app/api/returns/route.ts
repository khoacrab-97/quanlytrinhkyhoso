import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handler } from "@/server/api";
import { documentScopeWhere } from "@/server/scope";

const q = z.object({
  q: z.string().optional(),
  fixStatus: z.string().optional(),
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
  categoryId: z.string().optional(),
  reasonId: z.string().optional(),
  responsibleId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});

/** Danh sách các lần trả hồ sơ (mỗi lần trả là 1 dòng) */
export const GET = handler(async ({ req, user }) => {
  const p = q.parse(Object.fromEntries(req.nextUrl.searchParams));
  const docWhere: Prisma.DocumentWhereInput = { AND: [documentScopeWhere(user)] };
  const and = docWhere.AND as Prisma.DocumentWhereInput[];
  if (p.projectId) and.push({ projectId: p.projectId });
  if (p.departmentId) and.push({ departmentId: p.departmentId });
  if (p.q) and.push({ OR: [{ code: { contains: p.q, mode: "insensitive" } }, { title: { contains: p.q, mode: "insensitive" } }, { docNumber: { contains: p.q, mode: "insensitive" } }] });

  const where: Prisma.DocumentReturnWhereInput = { document: docWhere };
  if (p.fixStatus) where.fixStatus = { in: p.fixStatus.split(",") as never[] };
  if (p.responsibleId) where.responsibleId = p.responsibleId;
  if (p.categoryId || p.reasonId) where.errors = { some: { ...(p.categoryId ? { categoryId: p.categoryId } : {}), ...(p.reasonId ? { reasonId: p.reasonId } : {}) } };
  if (p.from || p.to) {
    const to = p.to ? new Date(p.to) : undefined;
    to?.setHours(23, 59, 59, 999);
    where.returnedAt = { ...(p.from ? { gte: new Date(p.from) } : {}), ...(to ? { lte: to } : {}) };
  }

  const [total, rows, stats] = await Promise.all([
    prisma.documentReturn.count({ where }),
    prisma.documentReturn.findMany({
      where,
      orderBy: { returnedAt: "desc" },
      skip: (p.page - 1) * p.pageSize,
      take: p.pageSize,
      include: {
        document: { select: { id: true, code: true, title: true, returnCount: true, project: { select: { code: true } }, preparer: { select: { fullName: true } }, status: { select: { name: true, color: true } } } },
        errors: { include: { category: { select: { name: true } }, reason: { select: { name: true } } } },
        responsible: { select: { id: true, fullName: true } },
        receivedBy: { select: { fullName: true } },
        fromDepartment: { select: { name: true } },
        _count: { select: { attachments: true } },
      },
    }),
    prisma.documentReturn.groupBy({ by: ["fixStatus"], where, _count: true }),
  ]);
  const docs = await prisma.documentReturn.findMany({ where, distinct: ["documentId"], select: { documentId: true } });
  return { total, page: p.page, pageSize: p.pageSize, rows, stats: Object.fromEntries(stats.map((s) => [s.fixStatus, s._count])), distinctDocs: docs.length };
});
