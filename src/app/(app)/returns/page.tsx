"use client";
import Link from "next/link";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Paperclip } from "lucide-react";
import { qs, useApi, useLookups } from "@/lib/client";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { useRange } from "@/components/AppShell";
import { Badge, Button, Card, ErrorBox, KpiCard, PageHeader, Pagination, Select, StatusBadge } from "@/components/ui";

type Ret = {
  id: string; returnedAt: string; fixedAt: string | null; fixStatus: string; requirement: string | null; returnedByName: string | null;
  document: { id: string; code: string; title: string; returnCount: number; project: { code: string }; preparer: { fullName: string }; status: { name: string; color: string } };
  errors: { id: string; resolved: boolean; description: string | null; customReason: string | null; category: { name: string }; reason: { name: string } | null }[];
  responsible: { fullName: string } | null; receivedBy: { fullName: string } | null; fromDepartment: { name: string } | null; _count: { attachments: number };
};

const WAITING = "OPEN,IN_PROGRESS,FIXED";
const FIX_FILTER = [{ value: WAITING, label: "Chờ in ký lại" }, { value: "CLOSED", label: "Đã in ký lại" }];

export default function ReturnsPage() {
  const { range } = useRange();
  const { data: lk } = useLookups();
  const [f, setF] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const set = (k: string, v: string) => { setF((x) => ({ ...x, [k]: v })); setPage(1); };
  const { data, error } = useApi<{ total: number; rows: Ret[]; stats: Record<string, number>; distinctDocs: number }>(
    `/api/returns${qs({ ...f, from: range.from, to: range.to, page, pageSize })}`,
  );
  const cat = lk?.errorCategories.find((c) => c.id === f.categoryId);
  const st = data?.stats ?? {};

  return (
    <div>
      <PageHeader title="Ban kiểm soát trả về" subtitle="Mỗi dòng là một lần Ban kiểm soát trả hồ sơ (một hồ sơ có thể bị trả nhiều lần, mỗi lần có thể nhiều lỗi)" />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Tổng số lần trả" value={data?.total ?? "…"} tone="red" onClick={() => set("fixStatus", "")} />
        <KpiCard label="Số hồ sơ bị trả" value={data?.distinctDocs ?? "…"} tone="orange" hint="Đếm hồ sơ khác nhau" />
        <KpiCard label="Chờ in ký lại" value={(st.OPEN ?? 0) + (st.IN_PROGRESS ?? 0) + (st.FIXED ?? 0)} tone="red" onClick={() => set("fixStatus", WAITING)} />
        <KpiCard label="Đã in ký lại" value={st.CLOSED ?? 0} tone="green" onClick={() => set("fixStatus", "CLOSED")} />
      </div>

      <Card className="mb-4" bodyClass="p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
          <form className="col-span-2" onSubmit={(e) => { e.preventDefault(); set("q", String(new FormData(e.currentTarget).get("q") ?? "")); }}>
            <input name="q" className="input" placeholder="Tìm mã / tên / số hồ sơ, Enter" />
          </form>
          <Select value={f.fixStatus ?? ""} onChange={(e) => set("fixStatus", e.target.value)} placeholder="Tình trạng" options={FIX_FILTER} />
          <Select value={f.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value)} placeholder="Phòng ban trình" options={(lk?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <Select value={f.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} placeholder="Công trình" options={(lk?.projects ?? []).map((p) => ({ value: p.id, label: p.code }))} />
          <Select value={f.categoryId ?? ""} onChange={(e) => { set("categoryId", e.target.value); set("reasonId", ""); }} placeholder="Nhóm lỗi" options={(lk?.errorCategories ?? []).map((c) => ({ value: c.id, label: c.name }))} />
          <Select value={f.reasonId ?? ""} onChange={(e) => set("reasonId", e.target.value)} placeholder="Lỗi cụ thể" options={(cat?.reasons ?? []).map((r) => ({ value: r.id, label: r.name }))} disabled={!cat} />
          <Select value={f.responsibleId ?? ""} onChange={(e) => set("responsibleId", e.target.value)} placeholder="Người chịu trách nhiệm" options={(lk?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }))} />
        </div>
        {Object.values(f).some(Boolean) && <Button className="mt-2" size="sm" variant="ghost" onClick={() => { setF({}); setPage(1); }}>Xóa lọc</Button>}
      </Card>

      <ErrorBox error={error} />
      <Card bodyClass="p-0">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[1000px]">
            <thead>
              <tr><th className="th w-8"></th><th className="th">Ngày trả</th><th className="th">Hồ sơ</th><th className="th">Trả bởi</th><th className="th">Số lỗi</th><th className="th">Nhóm lỗi</th><th className="th">Chịu trách nhiệm</th><th className="th">In ký lại lúc</th><th className="th">Tình trạng</th></tr>
            </thead>
            <tbody>
              {data?.rows.map((r) => {
                return (
                  <Fragment key={r.id}>
                    <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}>
                      <td className="td">{open[r.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                      <td className="td whitespace-nowrap">{fmtDate(r.returnedAt)}</td>
                      <td className="td max-w-xs">
                        <Link onClick={(e) => e.stopPropagation()} href={`/documents/${r.document.id}`} className="font-semibold text-brand-600 hover:underline">{r.document.code}</Link>
                        <span className="ml-1 text-xs text-slate-400">({r.document.project.code})</span>
                        <p className="truncate text-xs text-slate-600" title={r.document.title}>{r.document.title}</p>
                        <span className="text-[11px] text-slate-400">Bị trả tổng {r.document.returnCount} lần · Lập: {r.document.preparer.fullName}</span>
                      </td>
                      <td className="td min-w-[170px]">{r.returnedByName ?? "—"}{r.fromDepartment && <p className="text-xs text-slate-400">{r.fromDepartment.name}</p>}</td>
                      <td className="td"><Badge tone="red">{r.errors.length}</Badge></td>
                      <td className="td min-w-[160px] text-xs">{[...new Set(r.errors.map((e) => e.category.name))].join(", ")}</td>
                      <td className="td">{r.responsible?.fullName ?? "—"}</td>
                      <td className="td whitespace-nowrap">{fmtDateTime(r.fixedAt) || "—"}</td>
                      <td className="td">{r.fixStatus === "CLOSED" ? <Badge tone="green">Đã in ký lại</Badge> : <Badge tone="red">Chờ in ký lại</Badge>}</td>
                    </tr>
                    {open[r.id] && (
                      <tr className="bg-slate-50/70">
                        <td></td>
                        <td colSpan={8} className="px-3 py-3">
                          {r.requirement && <p className="mb-2 text-sm"><b>Yêu cầu:</b> {r.requirement}</p>}
                          <ul className="space-y-1">
                            {r.errors.map((e) => (
                              <li key={e.id} className="flex items-start gap-2 text-sm">
                                <Badge tone={e.resolved ? "green" : "red"}>{e.resolved ? "Đã sửa" : "Chưa sửa"}</Badge>
                                <span><b>{e.reason?.name ?? e.customReason ?? "Lỗi khác"}</b> <span className="text-slate-400">· {e.category.name}</span>{e.description && <span className="text-slate-600"> — {e.description}</span>}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-xs text-slate-500">
                            Trạng thái hồ sơ hiện tại: <StatusBadge status={r.document.status} /> · Người nhận lại: {r.receivedBy?.fullName ?? "—"}
                            {r._count.attachments > 0 && <span className="ml-2"><Paperclip className="inline h-3 w-3" /> {r._count.attachments} file minh chứng</span>}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data && !data.rows.length && <tr><td colSpan={9} className="td py-8 text-center text-slate-400">Không có lần trả nào phù hợp</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 px-3">
          <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      </Card>
    </div>
  );
}
