"use client";
import Link from "next/link";
import { useState } from "react";
import { FileSpreadsheet, Plus } from "lucide-react";
import { download, qs, useApi, useLookups } from "@/lib/client";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useCan, useRange } from "@/components/AppShell";
import { Badge, Button, Card, ErrorBox, KpiCard, PageHeader, Pagination, Select, StatusBadge, useToast } from "@/components/ui";

type Row = {
  id: string; code: string; status: "DRAFT" | "PRINTED"; resubmitNo: number; resubmitReason: string | null; printedAt: string | null; printCount: number; createdAt: string;
  content: { docTitle: string; submitDate: string; departmentName: string };
  createdBy: { fullName: string };
  document: { id: string; code: string; project: { code: string }; status: { name: string; color: string } };
};
type Res = {
  total: number; rows: Row[];
  stats: { printed: number; first: number; resubmit: number; reprints: number; drafts: number; documents: number };
  byUser: Tally[];
  byDepartment: Tally[];
};
type Tally = { name: string; printed: number; first: number; resubmit: number; reprints: number; drafts: number };

function TallyTable({ title, label, rows }: { title: string; label: string; rows: Tally[] }) {
  return (
    <Card className="mb-4" title={title} bodyClass="p-0">
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead><tr><th className="th">{label}</th><th className="th text-right">Phiếu đã in</th><th className="th text-right">Lần đầu</th><th className="th text-right">Trình ký lại</th><th className="th text-right">Lượt in lại</th><th className="th text-right">Đang soạn</th></tr></thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.name} className="hover:bg-slate-50">
                <td className="td font-medium">{u.name}</td><td className="td text-right">{u.printed}</td><td className="td text-right">{u.first}</td>
                <td className="td text-right">{u.resubmit ? <Badge tone="red">{u.resubmit}</Badge> : 0}</td><td className="td text-right">{u.reprints}</td><td className="td text-right">{u.drafts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function FormsPage() {
  const can = useCan();
  const toast = useToast();
  const { range } = useRange();
  const { data: lk } = useLookups();
  const [f, setF] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const set = (k: string, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const query = { ...f, from: range.from, to: range.to };
  const { data, error } = useApi<Res>(`/api/signing-forms${qs({ ...query, page, pageSize: 20 })}`);
  const s = data?.stats;

  return (
    <div>
      <PageHeader
        title="Phiếu trình ký"
        subtitle="Tạo phiếu theo mẫu công ty, in và lưu làm dữ liệu thống kê. Thời gian lọc theo ngày in (thanh trên cùng)."
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => download(`/api/signing-forms/export${qs(query)}`).catch((e) => toast("error", e.message))}>Xuất Excel</Button>
            {can("document.create") && <Link href="/forms/new"><Button icon={<Plus className="h-4 w-4" />}>Tạo phiếu trình ký</Button></Link>}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Phiếu đã in" value={s?.printed ?? "…"} tone="blue" onClick={() => set("kind", "")} />
        <KpiCard label="Trình lần đầu" value={s?.first ?? "…"} tone="green" onClick={() => set("kind", "first")} />
        <KpiCard label="Trình ký lại" value={s?.resubmit ?? "…"} tone="red" onClick={() => set("kind", "resubmit")} />
        <KpiCard label="Lượt in lại (≤ hạn)" value={s?.reprints ?? "…"} tone="violet" />
        <KpiCard label="Số hồ sơ đã trình" value={s?.documents ?? "…"} tone="teal" />
        <KpiCard label="Đang soạn, chưa in" value={s?.drafts ?? "…"} tone="orange" onClick={() => set("kind", "draft")} />
      </div>

      {!!data?.byDepartment.length && (
        <div className="grid gap-x-4 xl:grid-cols-2">
          <TallyTable title="Theo phòng ban trình ký" label="Phòng ban" rows={data.byDepartment} />
          {can("report.staff") && <TallyTable title="Theo người thực hiện" label="Người thực hiện" rows={data.byUser} />}
        </div>
      )}

      <Card className="mb-4" bodyClass="p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <form onSubmit={(e) => { e.preventDefault(); set("q", String(new FormData(e.currentTarget).get("q") ?? "")); }}>
            <input name="q" className="input" placeholder="Mã phiếu / mã hồ sơ / tên, Enter" />
          </form>
          <Select value={f.kind ?? ""} onChange={(e) => set("kind", e.target.value)} placeholder="Tất cả loại phiếu" options={[{ value: "first", label: "Trình lần đầu" }, { value: "resubmit", label: "Trình ký lại" }, { value: "draft", label: "Đang soạn" }]} />
          <Select value={f.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value)} placeholder="Tất cả phòng ban" options={(lk?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={f.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} placeholder="Tất cả dự án" options={(lk?.projects ?? []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} />
          <Select value={f.createdById ?? ""} onChange={(e) => set("createdById", e.target.value)} placeholder="Tất cả người thực hiện" options={(lk?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }))} />
        </div>
      </Card>

      <ErrorBox error={error} />
      <Card bodyClass="p-0">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead><tr><th className="th">Mã phiếu</th><th className="th">Tên hồ sơ / Loại hồ sơ</th><th className="th">Hồ sơ</th><th className="th">Trình ký lần</th><th className="th">Ngày trình</th><th className="th">In lúc</th><th className="th">Số lần in</th><th className="th">Người thực hiện</th><th className="th">Trạng thái hồ sơ</th></tr></thead>
            <tbody>
              {data?.rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap"><Link className="font-semibold text-brand-600 hover:underline" href={`/forms/${r.id}`}>{r.code}</Link></td>
                  <td className="td max-w-sm"><p className="truncate" title={r.content.docTitle}>{r.content.docTitle}</p><p className="text-xs text-slate-400">{r.content.departmentName}</p></td>
                  <td className="td"><Link className="text-brand-600 hover:underline" href={`/documents/${r.document.id}`}>{r.document.code}</Link><span className="ml-1 text-xs text-slate-400">{r.document.project.code}</span></td>
                  <td className="td">
                    {r.status === "DRAFT" ? <Badge tone="orange">Đang soạn</Badge> : r.resubmitNo ? <Badge tone="red">Trình lại lần {r.resubmitNo}</Badge> : <Badge tone="blue">Lần đầu</Badge>}
                    {r.resubmitReason && <p className="mt-0.5 max-w-[220px] truncate text-xs text-slate-500" title={r.resubmitReason}>{r.resubmitReason}</p>}
                  </td>
                  <td className="td whitespace-nowrap">{fmtDate(r.content.submitDate)}</td>
                  <td className="td whitespace-nowrap">{fmtDateTime(r.printedAt) || "—"}</td>
                  <td className="td">{r.printCount}</td>
                  <td className="td">{r.createdBy.fullName}</td>
                  <td className="td"><StatusBadge status={r.document.status} /></td>
                </tr>
              ))}
              {data && !data.rows.length && <tr><td colSpan={9} className="td py-8 text-center text-slate-400">Chưa có phiếu trình ký</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-3"><Pagination page={page} pageSize={20} total={data?.total ?? 0} onPage={setPage} /></div>
      </Card>
    </div>
  );
}
