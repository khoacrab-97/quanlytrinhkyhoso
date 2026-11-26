// Theo dõi trình ký: mỗi hồ sơ kèm mốc thời gian từng giai đoạn của lần nộp hiện tại.
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { STAGES, stageIndex } from "@/lib/constants";
import { handler } from "@/server/api";
import { buildDocumentWhere } from "@/server/documents";
import { canModifyDocument } from "@/server/scope";

const querySchema = z.object({
  q: z.string().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  statusId: z.string().optional(),
  view: z.enum(["open", "done", "all"]).default("open"),
  mine: z.enum(["1"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(30),
});

export const GET = handler(async ({ req, user }) => {
  const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const base = buildDocumentWhere(user, { q: q.q, departmentId: q.departmentId, projectId: q.projectId });
  const and: Prisma.DocumentWhereInput[] = [base];
  if (q.mine) and.push({ OR: [{ preparerId: user.id }, { createdById: user.id }, { submitterId: user.id }] });
  // Thẻ đếm theo trạng thái: không áp bộ lọc tab và trạng thái
  const countWhere: Prisma.DocumentWhereInput = { AND: [...and] };
  if (q.view === "open") and.push({ status: { category: { notIn: ["COMPLETED", "CANCELLED"] } } });
  if (q.view === "done") and.push({ status: { category: "COMPLETED" } });
  const where: Prisma.DocumentWhereInput = { AND: [...and, ...(q.statusId ? [{ statusId: q.statusId }] : [])] };

  const [total, rows, counts] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: [{ lastActivityAt: "desc" }, { code: "desc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true, code: true, title: true, preparerId: true, submitterId: true, currentHolderId: true, createdById: true, departmentId: true, projectId: true,
        submissionCount: true, returnCount: true, firstSubmittedAt: true, lastSubmittedAt: true,
        status: { select: { id: true, code: true, name: true, color: true, category: true } },
        department: { select: { name: true } },
        project: { select: { code: true } },
        preparer: { select: { fullName: true } },
        signingForms: { orderBy: { resubmitNo: "desc" }, take: 1, select: { id: true, code: true, status: true } },
      },
    }),
    prisma.document.groupBy({ by: ["statusId"], where: countWhere, _count: true }),
  ]);

  // Mốc giai đoạn của lần nộp hiện tại: các bước ghi nhận từ lần in nộp gần nhất trở đi
  const acts = await prisma.documentActivity.findMany({
    where: { documentId: { in: rows.map((r) => r.id) }, type: { in: ["SUBMIT", "RESUBMIT", "FORWARD", "APPROVE"] } },
    select: { documentId: true, startedAt: true, actor: { select: { fullName: true } }, status: { select: { code: true } } },
    orderBy: { startedAt: "asc" },
  });
  const process = can(user.role, "document.process");
  const out = rows.map((r) => {
    const stages: Record<string, { at: Date; by: string } | null> = Object.fromEntries(STAGES.map((s) => [s.code, null]));
    if (r.lastSubmittedAt) {
      for (const a of acts) {
        if (a.documentId !== r.id || a.startedAt < r.lastSubmittedAt) continue;
        if (stageIndex(a.status?.code) >= 0) stages[a.status!.code] = { at: a.startedAt, by: a.actor.fullName };
      }
    }
    const { preparerId, submitterId, currentHolderId, createdById, departmentId, projectId, signingForms, ...rest } = r;
    return {
      ...rest,
      stages,
      latestForm: signingForms[0] ?? null,
      canProcess: process && canModifyDocument(user, { preparerId, submitterId, currentHolderId, createdById, departmentId, projectId }),
    };
  });
  return { total, rows: out, counts: Object.fromEntries(counts.map((c) => [c.statusId, c._count])) };
});
