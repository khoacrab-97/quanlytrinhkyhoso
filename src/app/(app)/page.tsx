"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, FileStack, FileSignature, Hourglass, Percent, Printer, Timer, Undo2 } from "lucide-react";
import { qs, useApi } from "@/lib/client";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useRange } from "@/components/AppShell";
import { FilterBar, type AnalyticsFilters } from "@/components/FilterBar";
import { BarBox, ComboBox, LineBox, PieBox } from "@/components/charts";
import { Badge, Card, ErrorBox, fmtNum, KpiCard, PageHeader, Spinner } from "@/components/ui";

type Dash = {
  kpis: Record<string, number | null>;
  monthly: { label: string; created: number; firstSubmitted: number; submissions: number; approved: number }[];
  returnsMonthly: { label: string; returns: number; docs: number }[];
  processingMonthly: { label: string; avgDays: number | null; count: number }[];
  byStatus: { name: string; color: string; value: number }[];
  byType: { name: string; total: number; completed: number; returned: number; avgDays: number | null }[];
  byProject: { code: string; name: string; total: number; completed: number; inProgress: number; returns: number }[];
  byDepartment: { name: string; total: number; pending: number; inReview: number; returnedNow: number; completed: number; submissions: number; resubmissions: number; totalReturns: number; returnRate: number }[];
  errorGroups: { name: string; value: number }[];
  waitingReprint: { id: string; code: string; title: string; project: string; department: string; status: { name: string; color: string }; returnedAt: string; returnCount: number; submissionCount: number; preparer: string }[];
  formulas: Record<string, string>;
};

export default function DashboardPage() {
  const { range } = useRange();
  const router = useRouter();
  const [f, setF] = useState<AnalyticsFilters>({});
  const query = qs({ from: range.from, to: range.to, ...f });
  const { data, error, isLoading } = useApi<Dash>(`/api/dashboard${query}`);
  const k = data?.kpis;
  const go = (extra: Record<string, string>) => router.push(`/documents${qs({ from: range.from, to: range.to, projectId: f.projectId, departmentId: f.departmentId, typeId: f.typeId, ...extra })}`);

  return (
    <div>
      <PageHeader title="Tổng quan trình ký hồ sơ" subtitle={`Số liệu tính trực tiếp từ dữ liệu hệ thống · ${range.from ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : "toàn bộ thời gian"} (theo ngày lập hồ sơ)`} />
      <FilterBar value={f} onChange={setF} />
      <ErrorBox error={error} />
      {isLoading && !data && <Spinner />}
      {data && k && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Tổng số hồ sơ" value={fmtNum(k.total)} sub={`${fmtNum(k.submitted)} đã in nộp`} icon={<FileStack className="h-4 w-4" />} tone="blue" hint={data.formulas.total} onClick={() => go({})} />
            <KpiCard label="Số lần in nộp" value={fmtNum(k.submissions)} sub={`gồm ${fmtNum(k.resubmissions)} lần in ký lại`} icon={<Printer className="h-4 w-4" />} tone="violet" hint={data.formulas.submissions} />
            <KpiCard label="Đang trình" value={fmtNum(k.inReview)} sub="Phụ trách liên quan / QL phòng ban / BKS" icon={<FileSignature className="h-4 w-4" />} tone="blue" hint={data.formulas.inReview} onClick={() => go({ category: "SUBMITTED,REVIEWING" })} />
            <KpiCard label="TGĐ đã ký" value={fmtNum(k.completed)} sub={`Tỷ lệ ${k.completionRate}%`} icon={<CheckCircle2 className="h-4 w-4" />} tone="green" hint={data.formulas.completed} onClick={() => go({ category: "COMPLETED" })} />
            <KpiCard label="BKS trả - chờ in ký lại" value={fmtNum(k.returnedNow)} sub={`${fmtNum(k.returnedDocs)} HS từng bị trả · ${fmtNum(k.totalReturns)} lần`} icon={<Undo2 className="h-4 w-4" />} tone="red" hint={data.formulas.returnedNow} onClick={() => go({ category: "RETURNED,REVISING" })} />
            <KpiCard label="Đang soạn phiếu" value={fmtNum(k.pending)} sub="Chưa in" icon={<Hourglass className="h-4 w-4" />} tone="orange" hint={data.formulas.pending} onClick={() => go({ category: "DRAFT" })} />
            <KpiCard label="Tỷ lệ bị BKS trả" value={`${k.returnRate}%`} sub="HS bị trả ≥1 lần / HS đã nộp" icon={<Percent className="h-4 w-4" />} tone="red" hint={data.formulas.returnRate} />
            <KpiCard label="Nộp → TGĐ ký (TB)" value={k.avgProcessingDays !== null ? `${k.avgProcessingDays} ngày` : "—"} sub={`${fmtNum(k.cancelled)} hồ sơ đã hủy`} icon={<Timer className="h-4 w-4" />} tone="teal" hint={data.formulas.processingDays} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card title="Số lượng hồ sơ trình ký theo tháng" subtitle="Hồ sơ lập mới, in nộp lần đầu, tổng lần in nộp (gồm in ký lại) và TGĐ đã ký" className="xl:col-span-2">
              <ComboBox data={data.monthly} x="label" series={[
                { key: "created", label: "Lập mới", color: "#94a3b8" },
                { key: "firstSubmitted", label: "Nộp lần đầu", color: "#2f6aa8" },
                { key: "submissions", label: "Tổng lần in nộp", type: "line", color: "#f59e0b" },
                { key: "approved", label: "TGĐ đã ký", type: "line", color: "#16a34a" },
              ]} />
            </Card>
            <Card title="Tỷ lệ hồ sơ theo trạng thái"><PieBox data={data.byStatus} /></Card>
            <Card title="Hồ sơ theo phòng ban trình ký" className="xl:col-span-3" bodyClass="p-0">
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead><tr><th className="th">Phòng ban</th><th className="th text-right">Tổng HS</th><th className="th text-right">Đang soạn</th><th className="th text-right">Đang trình</th><th className="th text-right">Chờ in ký lại</th><th className="th text-right">TGĐ đã ký</th><th className="th text-right">Lần in nộp</th><th className="th text-right">Lần BKS trả</th><th className="th text-right">Tỷ lệ bị trả</th></tr></thead>
                  <tbody>
                    {data.byDepartment.map((d) => (
                      <tr key={d.name} className="hover:bg-slate-50">
                        <td className="td font-medium">{d.name}</td><td className="td text-right">{d.total}</td><td className="td text-right">{d.pending}</td><td className="td text-right">{d.inReview}</td>
                        <td className="td text-right">{d.returnedNow ? <Badge tone="red">{d.returnedNow}</Badge> : 0}</td><td className="td text-right">{d.completed}</td>
                        <td className="td text-right">{d.submissions}</td><td className="td text-right">{d.totalReturns}</td><td className="td text-right">{d.returnRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Hồ sơ theo loại hồ sơ" className="xl:col-span-2">
              <BarBox data={data.byType} x="name" horizontal height={Math.max(220, data.byType.length * 34)} series={[
                { key: "completed", label: "TGĐ đã ký", color: "#16a34a", stack: "a" },
                { key: "total", label: "Tổng", color: "#2f6aa8" },
                { key: "returned", label: "Từng bị BKS trả", color: "#ef4444" },
              ]} />
            </Card>
            <Card title="Hồ sơ theo công trình">
              <BarBox data={data.byProject} x="code" series={[
                { key: "completed", label: "TGĐ đã ký", color: "#16a34a", stack: "s" },
                { key: "inProgress", label: "Đang xử lý", color: "#2f6aa8", stack: "s" },
                { key: "returns", label: "Lần BKS trả", color: "#ef4444" },
              ]} />
            </Card>
            <Card title="Ban kiểm soát trả về theo tháng" subtitle="Phân biệt số lần trả và số hồ sơ bị trả">
              <BarBox data={data.returnsMonthly} x="label" series={[{ key: "returns", label: "Số lần trả", color: "#ef4444" }, { key: "docs", label: "Số hồ sơ bị trả", color: "#f59e0b" }]} />
            </Card>
            <Card title="Các nhóm lỗi phổ biến" subtitle="Số lỗi ghi nhận theo nhóm">
              <BarBox data={data.errorGroups} x="name" horizontal height={240} series={[{ key: "value", label: "Số lỗi", color: "#8b5cf6" }]} />
            </Card>
            <Card title="Thời gian nộp → TGĐ ký trung bình (ngày)" subtitle="Theo tháng TGĐ ký">
              <LineBox data={data.processingMonthly} x="label" series={[{ key: "avgDays", label: "Ngày TB", color: "#14b8a6" }]} />
            </Card>
          </div>

          <Card className="mt-4" title="Hồ sơ Ban kiểm soát trả về - chờ in ký lại" subtitle="Cần mở phiếu và bấm Trình ký lại để in ký lại" bodyClass="p-0" actions={<Link href="/tracking" className="text-sm font-medium text-brand-600 hover:underline">Xem theo dõi trình ký →</Link>}>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr><th className="th">Mã HS</th><th className="th">Tên hồ sơ</th><th className="th">CT</th><th className="th">Phòng ban</th><th className="th">Người lập</th><th className="th">BKS trả lúc</th><th className="th">Số lần trả</th></tr>
                </thead>
                <tbody>
                  {!data.waitingReprint.length && <tr><td colSpan={7} className="td py-8 text-center text-slate-400">Không có hồ sơ chờ in ký lại</td></tr>}
                  {data.waitingReprint.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="td font-medium"><Link className="text-brand-600 hover:underline" href={`/documents/${u.id}`}>{u.code}</Link></td>
                      <td className="td max-w-md">{u.title}</td>
                      <td className="td">{u.project}</td>
                      <td className="td">{u.department}</td>
                      <td className="td">{u.preparer}</td>
                      <td className="td whitespace-nowrap">{fmtDateTime(u.returnedAt)}</td>
                      <td className="td"><Badge tone="red">{u.returnCount}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
