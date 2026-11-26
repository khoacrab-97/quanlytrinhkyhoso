"use client";
import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Printer, Undo2 } from "lucide-react";
import { qs, useApi, useLookups } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { STAGES, STATUS } from "@/lib/constants";
import { ActionDialog, type ActionDoc } from "@/components/ActionDialog";
import { useMe } from "@/components/AppShell";
import { Badge, Button, Card, cx, ErrorBox, PageHeader, Pagination, Select, Spinner, StatusBadge, Tabs } from "@/components/ui";

type Stamp = { at: string; by: string } | null;
type Row = {
  id: string; code: string; title: string; submissionCount: number; returnCount: number; lastSubmittedAt: string | null;
  status: { id: string; code: string; name: string; color: string; category: string };
  department: { name: string }; project: { code: string }; preparer: { fullName: string };
  stages: Record<string, Stamp>; latestForm: { id: string; code: string; status: string } | null; canProcess: boolean;
};
type Res = { total: number; rows: Row[]; counts: Record<string, number> };

function StampCell({ s }: { s: Stamp }) {
  if (!s) return <span className="text-slate-300">—</span>;
  return (
    <span className="whitespace-nowrap" title={`Xác nhận bởi ${s.by}`}>
      <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-emerald-500" />
      {fmtDateTime(s.at)}
    </span>
  );
}

export default function TrackingPage() {
  const me = useMe();
  const { data: lk } = useLookups();
  const [view, setView] = useState("open");
  const [f, setF] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [act, setAct] = useState<{ action: string; doc: ActionDoc } | null>(null);
  const set = (k: string, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const { data, error, mutate } = useApi<Res>(`/api/tracking${qs({ ...f, view, page, pageSize: 30 })}`);
  const statuses = lk?.statuses ?? [];
  const byCode = (code: string) => statuses.find((s) => s.code === code);
  const quick = [STATUS.PREPARING, ...STAGES.map((s) => s.code), STATUS.BKS_RETURNED].map(byCode).filter(Boolean) as { id: string; name: string; code: string }[];

  return (
    <div>
      <PageHeader
        title="Theo dõi trình ký"
        subtitle="Mỗi mốc ghi nhận thời điểm người lập bấm xác nhận. Ở Ban kiểm soát: Xác nhận = Tổng Giám Đốc đã ký; bị trả thì bấm Trình ký lại. Không tính hạn."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!f.mine} onChange={(e) => set("mine", e.target.checked ? "1" : "")} /> Chỉ hồ sơ tôi lập
          </label>
        }
      />
      <ErrorBox error={error} />

      <div className="mb-4 flex flex-wrap gap-2">
        {quick.map((s) => (
          <button
            key={s.id}
            onClick={() => { set("statusId", f.statusId === s.id ? "" : s.id); if (s.code === STATUS.CEO_SIGNED) setView("all"); }}
            className={cx("rounded-full border px-3 py-1 text-sm", f.statusId === s.id ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
          >
            {s.name} <b className="ml-1">{data?.counts[s.id] ?? 0}</b>
          </button>
        ))}
      </div>

      <Card className="mb-4" bodyClass="p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <form onSubmit={(e) => { e.preventDefault(); set("q", String(new FormData(e.currentTarget).get("q") ?? "")); }}>
            <input name="q" className="input" placeholder="Mã / tên hồ sơ, Enter" />
          </form>
          <Select value={f.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value)} placeholder="Tất cả phòng ban trình" options={(lk?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={f.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} placeholder="Tất cả dự án" options={(lk?.projects ?? []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} />
          {me.departmentName && <Button variant="secondary" onClick={() => set("departmentId", lk?.departments.find((d) => d.name === me.departmentName)?.id ?? "")}>Phòng của tôi</Button>}
        </div>
      </Card>

      <Card bodyClass="pt-2">
        <Tabs value={view} onChange={(v) => { setView(v); setPage(1); }} tabs={[{ value: "open", label: "Đang trình" }, { value: "done", label: "TGĐ đã ký" }, { value: "all", label: "Tất cả" }]} />
        {!data ? <Spinner /> : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1180px]">
              <thead>
                <tr>
                  <th className="th">Hồ sơ</th><th className="th">Phòng ban</th><th className="th">Lần nộp</th>
                  {STAGES.map((s) => <th key={s.code} className="th">{s.done}</th>)}
                  <th className="th">Hiện tại</th><th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {!data.rows.length && <tr><td colSpan={STAGES.length + 5} className="td py-8 text-center text-slate-400">Không có hồ sơ</td></tr>}
                {data.rows.map((r) => {
                  const atBks = r.status.code === STATUS.STAGE_BKS;
                  const inStages = STAGES.some((s) => s.code === r.status.code) && r.status.code !== STATUS.CEO_SIGNED;
                  const returned = r.status.code === STATUS.BKS_RETURNED;
                  const doc: ActionDoc = { id: r.id, code: r.code, title: r.title, status: r.status };
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="td max-w-xs">
                        <Link className="font-semibold text-brand-600 hover:underline" href={`/documents/${r.id}`}>{r.code}</Link>
                        <p className="truncate text-sm text-slate-700" title={r.title}>{r.title}</p>
                        <p className="text-xs text-slate-400">{r.project.code} · {r.preparer.fullName}</p>
                      </td>
                      <td className="td">{r.department.name}</td>
                      <td className="td whitespace-nowrap">
                        {r.submissionCount ? (r.submissionCount === 1 ? "Lần đầu" : <Badge tone="red">In ký lại lần {r.submissionCount - 1}</Badge>) : "—"}
                        {r.returnCount > 0 && <p className="text-xs text-red-600">BKS trả {r.returnCount} lần</p>}
                      </td>
                      {STAGES.map((s) => <td key={s.code} className="td text-sm"><StampCell s={r.stages[s.code]} /></td>)}
                      <td className="td"><StatusBadge status={r.status} /></td>
                      <td className="td whitespace-nowrap text-right">
                        {r.canProcess && inStages && <Button size="sm" onClick={() => setAct({ action: "advance", doc })}>Xác nhận</Button>}
                        {r.canProcess && atBks && r.latestForm && <Link href={`/forms/${r.latestForm.id}`} className="ml-1" title="Ban kiểm soát trả về: chọn nhóm lỗi và in ký lại"><Button size="sm" variant="danger" icon={<Undo2 className="h-3.5 w-3.5" />}>Trình ký lại</Button></Link>}
                        {r.canProcess && returned && r.latestForm && <Link href={`/forms/${r.latestForm.id}`}><Button size="sm" variant="warning" icon={<Printer className="h-3.5 w-3.5" />}>In ký lại</Button></Link>}
                        {r.canProcess && r.status.category === "DRAFT" && (r.latestForm
                          ? <Link href={`/forms/${r.latestForm.id}`}><Button size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />}>In phiếu</Button></Link>
                          : <Link href={`/forms/new?documentId=${r.id}`}><Button size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />}>Lập phiếu</Button></Link>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-slate-100 px-3"><Pagination page={page} pageSize={30} total={data?.total ?? 0} onPage={setPage} /></div>
      </Card>
      {act && <ActionDialog action={act.action} doc={act.doc} onClose={() => setAct(null)} onDone={() => mutate()} />}
    </div>
  );
}
