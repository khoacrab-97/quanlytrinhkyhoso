// =============================================================
//  THỐNG KÊ & PHÂN TÍCH - mọi số liệu tính trực tiếp từ dữ liệu trong DB
//  Công thức được mô tả trong FORMULAS để hiển thị minh bạch trên giao diện/báo cáo.
// =============================================================
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { daysBetween, monthKey, monthLabel, pct, periodKey, periodLabel, round1 } from "@/lib/dates";
import { documentScopeWhere } from "./scope";
import type { CurrentUser } from "./session";
import { STAGES, stageIndex } from "@/lib/constants";

export const FORMULAS = {
  total: "Số hồ sơ (chưa bị xóa) có ngày lập trong khoảng thời gian và thỏa bộ lọc",
  completed: "Hồ sơ đã tới giai đoạn cuối 'TGĐ đã ký'",
  inReview: "Hồ sơ đã in phiếu, đang ở giai đoạn Phụ trách liên quan / Quản lý phòng ban ký duyệt / Ban kiểm soát",
  pending: "Hồ sơ đang soạn phiếu, chưa in",
  returnedNow: "Hồ sơ Ban kiểm soát trả về, đang chờ in ký lại",
  submissions: "Tổng số lần in phiếu & nộp = lần đầu + các lần in ký lại (không tính lượt in lại trong thời hạn)",
  completionRate: "Hồ sơ TGĐ đã ký ÷ (Tổng hồ sơ − Hồ sơ đã hủy) × 100%",
  returnRate: "Số hồ sơ bị Ban kiểm soát trả ít nhất 1 lần ÷ Số hồ sơ đã in nộp × 100% (đếm hồ sơ, không đếm số lần trả)",
  processingDays: "Thời gian xử lý = Thời điểm xác nhận 'TGĐ đã ký' − Thời điểm in nộp lần đầu (ngày); trung bình trên các hồ sơ TGĐ đã ký",
  stageDays: "Thời gian ở một giai đoạn = mốc xác nhận giai đoạn kế tiếp − mốc xác nhận giai đoạn đó (cùng một lần nộp)",
  returnsCount: "Tổng số lần trả = số lần Ban kiểm soát trả về; một hồ sơ có thể bị trả nhiều lần",
  errorsCount: "Tổng số lỗi = số lỗi ghi nhận; một lần trả có thể có nhiều lỗi",
  staffReturns: "Chỉ tính các lỗi thuộc nhóm có 'tính trách nhiệm' và gán cho người chịu trách nhiệm xử lý (không mặc định quy cho người lập)",
  staffReturnRate: "Hồ sơ do người đó lập bị trả ≥1 lần ÷ Hồ sơ do người đó lập đã in nộp",
  revisionDays: "Thời gian sửa = Thời điểm in ký lại − Thời điểm Ban kiểm soát trả về (các lần trả người đó chịu trách nhiệm)",
  processed: "Số hồ sơ khác nhau mà người đó xác nhận giai đoạn hoặc ghi nhận trả về",
};

export const filterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional(),
  departmentId: z.string().optional(),
  personId: z.string().optional(),
  typeId: z.string().optional(),
  statusId: z.string().optional(),
  sample: z.enum(["only", "exclude"]).optional(),
  period: z.enum(["day", "month", "quarter", "year"]).optional(),
});
export type Filters = z.infer<typeof filterSchema>;

const CLOSED = new Set(["APPROVED", "COMPLETED", "CANCELLED"]);

function endOfDay(s: string) {
  const d = new Date(s);
  d.setHours(23, 59, 59, 999);
  return d;
}

function docWhere(user: CurrentUser, f: Filters, withDate = true): Prisma.DocumentWhereInput {
  const and: Prisma.DocumentWhereInput[] = [documentScopeWhere(user)];
  if (f.projectId) and.push({ projectId: f.projectId });
  if (f.departmentId) and.push({ departmentId: f.departmentId });
  if (f.typeId) and.push({ typeId: f.typeId });
  if (f.statusId) and.push({ statusId: f.statusId });
  if (f.personId) and.push({ OR: [{ preparerId: f.personId }, { currentHolderId: f.personId }, { submitterId: f.personId }] });
  if (f.sample === "only") and.push({ isSample: true });
  if (f.sample === "exclude") and.push({ isSample: false });
  if (withDate && f.from) and.push({ preparedDate: { gte: new Date(f.from) } });
  if (withDate && f.to) and.push({ preparedDate: { lte: endOfDay(f.to) } });
  return { AND: and };
}

const docSelect = {
  id: true, code: true, title: true, preparedDate: true, firstSubmittedAt: true, lastSubmittedAt: true, approvedAt: true, completedAt: true,
  returnCount: true, submissionCount: true, priority: true, lastActivityAt: true, departmentId: true, preparerId: true, currentHolderNote: true,
  status: { select: { name: true, color: true, category: true, code: true } },
  type: { select: { id: true, name: true } },
  project: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, name: true } },
  preparer: { select: { id: true, fullName: true } },
  currentHolder: { select: { fullName: true } },
  currentDepartment: { select: { name: true } },
} satisfies Prisma.DocumentSelect;
type Doc = Prisma.DocumentGetPayload<{ select: typeof docSelect }>;

function processingDays(d: Doc) {
  return d.firstSubmittedAt && d.approvedAt ? Math.max(0, daysBetween(d.firstSubmittedAt, d.approvedAt)) : null;
}
function avg(xs: number[]) {
  return xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null;
}

function monthsRange(f: Filters, dates: Date[]) {
  const end = f.to ? new Date(f.to) : new Date();
  let start = f.from ? new Date(f.from) : new Date(end.getFullYear(), end.getMonth() - 11, 1);
  if (!f.from && dates.length) {
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    if (min > start) start = new Date(min.getFullYear(), min.getMonth(), 1);
  }
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur <= end && keys.length < 60) {
    keys.push(monthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

function groupCount<T>(items: T[], key: (t: T) => string | null | undefined) {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), it]);
  }
  return m;
}

export function computeKpis(docs: Doc[]) {
  const by = (cats: string[]) => docs.filter((d) => cats.includes(d.status.category)).length;
  const total = docs.length;
  const cancelled = by(["CANCELLED"]);
  const completed = by(["COMPLETED"]);
  const submitted = docs.filter((d) => d.submissionCount > 0).length;
  const returnedDocs = docs.filter((d) => d.returnCount > 0).length;
  const proc = docs.map(processingDays).filter((x): x is number => x !== null);
  return {
    total,
    completed,
    approved: by(["APPROVED"]),
    inReview: by(["SUBMITTED", "REVIEWING"]),
    pending: by(["DRAFT"]),
    returnedNow: by(["RETURNED", "REVISING"]),
    cancelled,
    submitted,
    submissions: docs.reduce((a, d) => a + d.submissionCount, 0),
    resubmissions: docs.reduce((a, d) => a + Math.max(0, d.submissionCount - 1), 0),
    returnedDocs,
    totalReturns: docs.reduce((a, d) => a + d.returnCount, 0),
    completionRate: pct(completed, total - cancelled),
    returnRate: pct(returnedDocs, submitted),
    avgProcessingDays: avg(proc),
  };
}

/** Thống kê theo phòng ban trình ký */
function departmentRows(docs: Doc[]) {
  return [...groupCount(docs, (d) => d.department.name)].map(([name, ds]) => {
    const k = computeKpis(ds);
    return {
      name, total: k.total, pending: k.pending, inReview: k.inReview, returnedNow: k.returnedNow, completed: k.completed,
      submissions: k.submissions, resubmissions: k.resubmissions, returnedDocs: k.returnedDocs, totalReturns: k.totalReturns,
      returnRate: k.returnRate, avgProcessingDays: k.avgProcessingDays,
    };
  }).sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------- DASHBOARD
export async function dashboard(user: CurrentUser, f: Filters) {
  const docs = await prisma.document.findMany({ where: docWhere(user, f), select: docSelect });
  const ids = docs.map((d) => d.id);
  const [subs, returns] = await Promise.all([
    prisma.documentSubmission.findMany({ where: { documentId: { in: ids } }, select: { submittedAt: true, round: true } }),
    prisma.documentReturn.findMany({
      where: { documentId: { in: ids } },
      select: { returnedAt: true, documentId: true, errors: { select: { category: { select: { name: true } } } } },
    }),
  ]);

  const months = monthsRange(f, docs.map((d) => d.preparedDate));
  const monthly = months.map((m) => ({
    key: m,
    label: monthLabel(m),
    created: docs.filter((d) => monthKey(d.preparedDate) === m).length,
    firstSubmitted: docs.filter((d) => d.firstSubmittedAt && monthKey(d.firstSubmittedAt) === m).length,
    submissions: subs.filter((s) => monthKey(s.submittedAt) === m).length,
    approved: docs.filter((d) => d.approvedAt && monthKey(d.approvedAt) === m).length,
  }));
  const returnsMonthly = months.map((m) => {
    const rs = returns.filter((r) => monthKey(r.returnedAt) === m);
    return { key: m, label: monthLabel(m), returns: rs.length, docs: new Set(rs.map((r) => r.documentId)).size };
  });
  const processingMonthly = months.map((m) => {
    const ds = docs.filter((d) => d.approvedAt && monthKey(d.approvedAt) === m);
    return { key: m, label: monthLabel(m), avgDays: avg(ds.map(processingDays).filter((x): x is number => x !== null)), count: ds.length };
  });

  const statusMap = new Map<string, { name: string; color: string; value: number }>();
  for (const d of docs) {
    const s = statusMap.get(d.status.name) ?? { name: d.status.name, color: d.status.color, value: 0 };
    s.value++;
    statusMap.set(d.status.name, s);
  }

  const byType = [...groupCount(docs, (d) => d.type.name)].map(([name, ds]) => ({
    name,
    total: ds.length,
    completed: ds.filter((d) => d.status.category === "COMPLETED").length,
    returned: ds.filter((d) => d.returnCount > 0).length,
    avgDays: avg(ds.map(processingDays).filter((x): x is number => x !== null)),
  })).sort((a, b) => b.total - a.total);

  const byProject = [...groupCount(docs, (d) => d.project.code)].map(([code, ds]) => ({
    code,
    name: ds[0].project.name,
    total: ds.length,
    completed: ds.filter((d) => d.status.category === "COMPLETED").length,
    inProgress: ds.filter((d) => !["COMPLETED", "CANCELLED"].includes(d.status.category)).length,
    returns: ds.reduce((a, d) => a + d.returnCount, 0),
  })).sort((a, b) => b.total - a.total);

  const errorGroups = new Map<string, number>();
  for (const r of returns) for (const e of r.errors) errorGroups.set(e.category.name, (errorGroups.get(e.category.name) ?? 0) + 1);

  // Hồ sơ Ban kiểm soát trả về, đang chờ in ký lại
  const waitingReprint = docs
    .filter((d) => d.status.category === "RETURNED" || d.status.category === "REVISING")
    .sort((a, b) => a.lastActivityAt.getTime() - b.lastActivityAt.getTime())
    .slice(0, 20)
    .map((d) => ({
      id: d.id, code: d.code, title: d.title, project: d.project.code, department: d.department.name, status: d.status,
      returnedAt: d.lastActivityAt, returnCount: d.returnCount, submissionCount: d.submissionCount, preparer: d.preparer.fullName,
    }));

  return {
    kpis: computeKpis(docs),
    monthly,
    returnsMonthly,
    processingMonthly,
    byStatus: [...statusMap.values()].sort((a, b) => b.value - a.value),
    byType,
    byProject,
    byDepartment: departmentRows(docs),
    errorGroups: [...errorGroups].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    waitingReprint,
    formulas: FORMULAS,
  };
}

// ---------------------------------------------------------------- PHÂN TÍCH LỖI
export async function errorAnalytics(user: CurrentUser, f: Filters) {
  const period = f.period ?? "month";
  const scopeDocs = await prisma.document.findMany({ where: docWhere(user, f, false), select: docSelect });
  const docById = new Map(scopeDocs.map((d) => [d.id, d]));
  const rWhere: Prisma.DocumentReturnWhereInput = { documentId: { in: [...docById.keys()] } };
  if (f.from || f.to) rWhere.returnedAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: endOfDay(f.to) } : {}) };

  const returns = await prisma.documentReturn.findMany({
    where: rWhere,
    include: {
      errors: { include: { category: true, reason: true, responsible: { select: { id: true, fullName: true } } } },
      responsible: { select: { id: true, fullName: true } },
      fromDepartment: { select: { name: true } },
    },
    orderBy: { returnedAt: "asc" },
  });
  const errors = returns.flatMap((r) => r.errors.map((e) => ({ ...e, ret: r, doc: docById.get(r.documentId)! })));

  // Hồ sơ đã trình (trong phạm vi + khoảng thời gian theo ngày trình lần đầu)
  const submittedDocs = scopeDocs.filter(
    (d) => d.firstSubmittedAt && (!f.from || d.firstSubmittedAt >= new Date(f.from)) && (!f.to || d.firstSubmittedAt <= endOfDay(f.to)),
  );
  const returnedDocIds = new Set(returns.map((r) => r.documentId));

  const summary = {
    totalReturns: returns.length,
    returnedDocs: returnedDocIds.size,
    submittedDocs: submittedDocs.length,
    returnRate: pct(submittedDocs.filter((d) => returnedDocIds.has(d.id)).length, submittedDocs.length),
    totalErrors: errors.length,
    avgErrorsPerReturn: returns.length ? round1(errors.length / returns.length) : 0,
    avgReturnsPerReturnedDoc: returnedDocIds.size ? round1(returns.length / returnedDocIds.size) : 0,
    fixedReturns: returns.filter((r) => ["FIXED", "CLOSED"].includes(r.fixStatus)).length,
    openReturns: returns.filter((r) => ["OPEN", "IN_PROGRESS"].includes(r.fixStatus)).length,
    resolvedErrors: errors.filter((e) => e.resolved).length,
    unresolvedErrors: errors.filter((e) => !e.resolved).length,
    avgFixDays: avg(returns.filter((r) => r.fixedAt).map((r) => daysBetween(r.returnedAt, r.fixedAt!))),
  };

  const byCategory = [...groupCount(errors, (e) => e.category.name)].map(([name, es]) => ({
    name,
    errors: es.length,
    returns: new Set(es.map((e) => e.returnId)).size,
    docs: new Set(es.map((e) => e.ret.documentId)).size,
    pct: pct(es.length, errors.length),
    unresolved: es.filter((e) => !e.resolved).length,
  })).sort((a, b) => b.errors - a.errors);

  const reasonName = (e: (typeof errors)[number]) => e.reason?.name ?? (e.customReason ? `Khác: ${e.customReason}` : "Khác (không ghi rõ)");
  const topReasons = [...groupCount(errors, reasonName)].map(([name, es]) => ({
    name, category: es[0].category.name, count: es.length, docs: new Set(es.map((e) => e.ret.documentId)).size, pct: pct(es.length, errors.length),
  })).sort((a, b) => b.count - a.count).slice(0, 10);

  const dim = (key: (e: (typeof errors)[number]) => string | undefined) =>
    [...groupCount(errors, key)].map(([name, es]) => ({
      name,
      errors: es.length,
      returns: new Set(es.map((e) => e.returnId)).size,
      docs: new Set(es.map((e) => e.ret.documentId)).size,
    })).sort((a, b) => b.errors - a.errors);

  const byPreparer = dim((e) => e.doc.preparer.fullName);
  const byResponsible = dim((e) => (e.category.attributable ? e.responsible?.fullName ?? e.doc.preparer.fullName : undefined));
  const byDepartment = dim((e) => e.doc.department.name);
  const byProject = dim((e) => `${e.doc.project.code} - ${e.doc.project.name}`);

  const periodKeys = [...new Set(returns.map((r) => periodKey(r.returnedAt, period)))].sort();
  const byPeriod = periodKeys.map((k) => {
    const rs = returns.filter((r) => periodKey(r.returnedAt, period) === k);
    return {
      key: k, label: periodLabel(k, period), returns: rs.length, docs: new Set(rs.map((r) => r.documentId)).size,
      errors: rs.reduce((a, r) => a + r.errors.length, 0),
      fixed: rs.filter((r) => ["FIXED", "CLOSED"].includes(r.fixStatus)).length,
    };
  });

  // Lỗi tái diễn: cùng nguyên nhân lặp lại trên cùng hồ sơ, hoặc lặp lại ≥3 lần với cùng người lập
  const recurringOnDoc = [...groupCount(errors, (e) => `${e.ret.documentId}|${reasonName(e)}`)]
    .filter(([, es]) => new Set(es.map((e) => e.returnId)).size >= 2)
    .map(([, es]) => ({ docId: es[0].doc.id, code: es[0].doc.code, title: es[0].doc.title, reason: reasonName(es[0]), times: new Set(es.map((e) => e.returnId)).size, preparer: es[0].doc.preparer.fullName }))
    .sort((a, b) => b.times - a.times);
  const recurringByPerson = [...groupCount(errors.filter((e) => e.category.attributable), (e) => `${e.doc.preparer.fullName}|${reasonName(e)}`)]
    .filter(([, es]) => es.length >= 3)
    .map(([k, es]) => ({ person: k.split("|")[0], reason: reasonName(es[0]), category: es[0].category.name, times: es.length, docs: new Set(es.map((e) => e.ret.documentId)).size }))
    .sort((a, b) => b.times - a.times);

  return { summary, byCategory, topReasons, byPreparer, byResponsible, byDepartment, byProject, byPeriod, recurringOnDoc, recurringByPerson, formulas: FORMULAS };
}

// ---------------------------------------------------------------- BÁO CÁO
export async function reportSummary(user: CurrentUser, f: Filters) {
  const period = f.period ?? "month";
  const docs = await prisma.document.findMany({ where: docWhere(user, f), select: docSelect });
  const keys = [...new Set(docs.map((d) => periodKey(d.preparedDate, period)))].sort();
  const rows = keys.map((k) => {
    const ds = docs.filter((d) => periodKey(d.preparedDate, period) === k);
    const k2 = computeKpis(ds);
    return {
      period: periodLabel(k, period), total: k2.total, submitted: k2.submitted, completed: k2.completed, approved: k2.approved,
      notCompleted: k2.total - k2.completed - k2.cancelled, cancelled: k2.cancelled, returnedDocs: k2.returnedDocs,
      totalReturns: k2.totalReturns, submissions: k2.submissions, completionRate: k2.completionRate, returnRate: k2.returnRate,
    };
  });
  const t = computeKpis(docs);
  const byProject = [...groupCount(docs, (d) => `${d.project.code} - ${d.project.name}`)].map(([name, ds]) => {
    const k2 = computeKpis(ds);
    return { name, total: k2.total, completed: k2.completed, notCompleted: k2.total - k2.completed - k2.cancelled, returnedDocs: k2.returnedDocs, totalReturns: k2.totalReturns, completionRate: k2.completionRate };
  }).sort((a, b) => b.total - a.total);
  return {
    kpis: t,
    rows,
    totals: {
      period: "TỔNG CỘNG", total: t.total, submitted: t.submitted, completed: t.completed, approved: t.approved,
      notCompleted: t.total - t.completed - t.cancelled, cancelled: t.cancelled, returnedDocs: t.returnedDocs, totalReturns: t.totalReturns,
      submissions: t.submissions, completionRate: t.completionRate, returnRate: t.returnRate,
    },
    byProject,
    byDepartment: departmentRows(docs),
    formulas: FORMULAS,
  };
}

export async function reportTime(user: CurrentUser, f: Filters) {
  const docs = await prisma.document.findMany({ where: docWhere(user, f), select: docSelect });
  const stat = (ds: Doc[]) => {
    const p = ds.map(processingDays).filter((x): x is number => x !== null);
    return {
      count: ds.length, approvedCount: p.length, avgDays: avg(p), minDays: p.length ? round1(Math.min(...p)) : null, maxDays: p.length ? round1(Math.max(...p)) : null,
    };
  };
  const byType = [...groupCount(docs, (d) => d.type.name)].map(([name, ds]) => ({ name, ...stat(ds) })).sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0));
  const byDepartment = [...groupCount(docs, (d) => d.department.name)].map(([name, ds]) => ({ name, ...stat(ds) })).sort((a, b) => (b.avgDays ?? 0) - (a.avgDays ?? 0));

  // Thời gian thực tế ở từng giai đoạn: mốc xác nhận giai đoạn kế tiếp − mốc giai đoạn đó (trong cùng lần nộp)
  const acts = await prisma.documentActivity.findMany({
    where: { documentId: { in: docs.map((d) => d.id) }, type: { in: ["SUBMIT", "RESUBMIT", "FORWARD", "APPROVE", "RETURN"] } },
    select: { documentId: true, startedAt: true, meta: true },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }],
  });
  const durations = new Map<string, number[]>();
  for (const [, as] of groupCount(acts, (a) => a.documentId)) {
    for (let i = 0; i < as.length - 1; i++) {
      const m = as[i].meta as { stage?: string } | null;
      const idx = stageIndex(m?.stage);
      if (idx < 0 || idx === STAGES.length - 1) continue;
      const key = STAGES[idx].label;
      durations.set(key, [...(durations.get(key) ?? []), daysBetween(as[i].startedAt, as[i + 1].startedAt)]);
    }
  }
  const byStage = STAGES.slice(0, -1).map((st, i) => {
    const ds = durations.get(st.label) ?? [];
    return { stage: st.label, next: STAGES[i + 1].label, count: ds.length, avgDays: avg(ds), maxDays: ds.length ? round1(Math.max(...ds)) : null };
  });

  return { overall: stat(docs), byType, byDepartment, byStage, formulas: FORMULAS };
}

export async function reportStaff(user: CurrentUser, f: Filters) {
  const docs = await prisma.document.findMany({ where: docWhere(user, f), select: docSelect });
  const ids = docs.map((d) => d.id);
  const [acts, returns, users] = await Promise.all([
    prisma.documentActivity.findMany({
      where: { documentId: { in: ids }, type: { in: ["FORWARD", "RETURN", "APPROVE", "COMPLETE"] } },
      select: { actorId: true, documentId: true },
    }),
    prisma.documentReturn.findMany({
      where: { documentId: { in: ids } },
      select: { id: true, documentId: true, returnedAt: true, fixedAt: true, responsibleId: true, errors: { select: { responsibleId: true, category: { select: { attributable: true } } } } },
    }),
    prisma.user.findMany({ where: { active: true }, include: { department: true } }),
  ]);

  const rows = users.map((u) => {
    const prepared = docs.filter((d) => d.preparerId === u.id);
    const submitted = prepared.filter((d) => d.submissionCount > 0);
    const processed = new Set(acts.filter((a) => a.actorId === u.id).map((a) => a.documentId));
    const respReturns = returns.filter((r) => r.errors.some((e) => e.category.attributable && (e.responsibleId ?? r.responsibleId) === u.id));
    const attributableErrors = returns.flatMap((r) => r.errors.filter((e) => e.category.attributable && (e.responsibleId ?? r.responsibleId) === u.id)).length;
    const objectiveReturns = returns.filter((r) => r.responsibleId === u.id && r.errors.every((e) => !e.category.attributable)).length;
    const fixDays = returns.filter((r) => r.responsibleId === u.id && r.fixedAt).map((r) => daysBetween(r.returnedAt, r.fixedAt!));
    const prepDays = submitted.map((d) => daysBetween(d.preparedDate, d.firstSubmittedAt!));
    return {
      id: u.id, name: u.fullName, department: u.department?.name ?? "", position: u.position ?? "",
      prepared: prepared.length, submitted: submitted.length,
      completed: prepared.filter((d) => d.status.category === "COMPLETED").length,
      processed: processed.size,
      returnedDocs: submitted.filter((d) => d.returnCount > 0).length,
      returnRate: pct(submitted.filter((d) => d.returnCount > 0).length, submitted.length),
      responsibleReturns: respReturns.length,
      attributableErrors,
      objectiveReturns,
      returnsPerDoc: submitted.length ? round1(respReturns.length / submitted.length) : 0,
      avgPrepDays: avg(prepDays),
      avgFixDays: avg(fixDays),
    };
  }).filter((r) => r.prepared || r.processed || r.responsibleReturns);

  return { rows: rows.sort((a, b) => b.prepared + b.processed - (a.prepared + a.processed)), formulas: FORMULAS };
}
