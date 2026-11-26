"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Copy, Download, Eye, FileSpreadsheet, Filter, Pencil, Plus, Upload, X } from "lucide-react";
import { api, download, qs, useApi, useLookups } from "@/lib/client";
import { fmtDate } from "@/lib/dates";
import { PRIORITY_LABELS } from "@/lib/constants";
import { useCan } from "@/components/AppShell";
import { DataTable } from "@/components/DataTable";
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Pagination, Select, StatusBadge, useToast } from "@/components/ui";

type Row = {
  id: string; code: string; docNumber: string | null; title: string; priority: number; isSample: boolean; notes: string | null;
  preparedDate: string; firstSubmittedAt: string | null; lastSubmittedAt: string | null; approvedAt: string | null; completedAt: string | null;
  submissionCount: number; returnCount: number; currentHolderNote: string | null;
  type: { name: string }; project: { code: string; name: string }; contractor: { name: string } | null; department: { name: string };
  preparer: { fullName: string }; submitter: { fullName: string } | null; recipient: { name: string; organization: string | null } | null;
  currentHolder: { fullName: string } | null; currentDepartment: { name: string } | null; currentStep: { name: string } | null;
  status: { name: string; color: string; category: string };
};

const FILTER_KEYS = ["q", "projectId", "typeId", "statusId", "category", "departmentId", "preparerId", "contractorId", "from", "to", "dateField", "flag", "sample"] as const;
const FLAG_LABELS: Record<string, string> = { returned: "Từng bị BKS trả", open: "Chưa xong (chưa TGĐ ký)" };
const CATEGORY_LABELS: Record<string, string> = {
  DRAFT: "Đang soạn phiếu", "SUBMITTED,REVIEWING": "Đang trình", "RETURNED,REVISING": "BKS trả - chờ in ký lại", COMPLETED: "TGĐ đã ký",
};

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{ total: number; valid: number; imported: number; errors: { row: number; message: string }[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (mode: "validate" | "commit") => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mode", mode);
      const r = await api<typeof result>("/api/documents/import", { method: "POST", body: fd });
      setResult(r);
      if (mode === "commit") {
        toast("success", `Đã import ${r!.imported} hồ sơ`);
        onDone();
      }
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const close = () => { setFile(null); setResult(null); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Import hồ sơ từ Excel" footer={
      <>
        <Button variant="secondary" onClick={close}>Đóng</Button>
        <Button variant="secondary" disabled={!file} loading={busy} onClick={() => run("validate")}>Kiểm tra dữ liệu</Button>
        <Button disabled={!file || !result || !result.valid || result.imported > 0} loading={busy} onClick={() => run("commit")}>Import {result?.valid ?? 0} dòng hợp lệ</Button>
      </>
    }>
      <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>Tải <button className="font-medium text-brand-600 hover:underline" onClick={() => download("/api/documents/import/template").catch((e) => toast("error", e.message))}>file mẫu Excel</button> (có sheet danh mục tham chiếu).</li>
        <li>Điền dữ liệu, mỗi dòng một hồ sơ. Có “Ngày trình” sẽ ghi nhận lần trình 1; có “Ngày ký duyệt” sẽ ghi nhận ký duyệt.</li>
        <li>Bấm <b>Kiểm tra dữ liệu</b> để xem lỗi trước, sau đó <b>Import</b>.</li>
      </ol>
      <input type="file" accept=".xlsx" className="input" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }} />
      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">Tổng: {result.total} dòng</Badge>
            <Badge tone="green">Hợp lệ: {result.valid}</Badge>
            <Badge tone="red">Lỗi: {result.errors.length}</Badge>
            {result.imported > 0 && <Badge tone="teal">Đã import: {result.imported}</Badge>}
          </div>
          {!!result.errors.length && (
            <div className="scroll-thin max-h-60 overflow-y-auto rounded border border-red-100 bg-red-50 p-2 text-xs text-red-700">
              {result.errors.map((e, i) => <div key={i}>Dòng {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function DocumentsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const can = useCan();
  const toast = useToast();
  const { data: lk } = useLookups();
  const [showFilters, setShowFilters] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  const params = Object.fromEntries(sp.entries());
  const page = Number(params.page ?? 1);
  const pageSize = Number(params.pageSize ?? 20);
  const sort = params.sort ?? "createdAt";
  const dir = (params.dir as "asc" | "desc") ?? "desc";
  const setParams = (patch: Record<string, string | number | undefined>, resetPage = true) => {
    const next = { ...params, ...(resetPage ? { page: "1" } : {}), ...patch } as Record<string, unknown>;
    router.replace(`${pathname}${qs(next)}`, { scroll: false });
  };
  const listUrl = `/api/documents${qs({ ...params, page, pageSize, sort, dir })}`;
  const { data, error, isLoading, mutate } = useApi<{ total: number; rows: Row[] }>(listUrl);
  const activeFilters = FILTER_KEYS.filter((k) => params[k]);

  const copyDoc = async (id: string) => {
    try {
      const r = await api<{ id: string; code: string }>(`/api/documents/${id}/copy`, { method: "POST" });
      toast("success", `Đã tạo bản sao ${r.code}`);
      router.push(`/documents/${r.id}/edit`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const columns = useMemo(() => [
    { id: "code", header: "Mã hồ sơ", size: 158, meta: { sortKey: "code", label: "Mã hồ sơ" }, enableHiding: false,
      cell: ({ row }: { row: { original: Row } }) => <Link href={`/documents/${row.original.id}`} className="font-semibold text-brand-600 hover:underline">{row.original.code}</Link> },
    { id: "docNumber", header: "Số hồ sơ", size: 160, meta: { sortKey: "docNumber", label: "Số hồ sơ" }, accessorFn: (r: Row) => r.docNumber ?? "" },
    { id: "title", header: "Tên hồ sơ", size: 320, meta: { sortKey: "title", label: "Tên hồ sơ" },
      cell: ({ row }: { row: { original: Row } }) => (
        <span title={row.original.title}>
          {row.original.priority === 1 && <Badge tone="violet" className="mr-1">Gấp</Badge>}
          {row.original.isSample && <Badge tone="gray" className="mr-1">Mẫu</Badge>}
          {row.original.title}
        </span>
      ) },
    { id: "type", header: "Loại hồ sơ", size: 190, meta: { label: "Loại hồ sơ" }, accessorFn: (r: Row) => r.type.name },
    { id: "project", header: "Công trình", size: 120, meta: { label: "Công trình" }, cell: ({ row }: { row: { original: Row } }) => <span title={row.original.project.name}>{row.original.project.code}</span> },
    { id: "contractor", header: "CĐT / NCC / thầu phụ", size: 200, meta: { label: "CĐT / NCC / thầu phụ" }, accessorFn: (r: Row) => r.contractor?.name ?? "" },
    { id: "department", header: "Phòng ban trình", size: 170, meta: { label: "Phòng ban trình" }, accessorFn: (r: Row) => r.department.name },
    { id: "preparer", header: "Người lập", size: 150, meta: { label: "Người lập" }, accessorFn: (r: Row) => r.preparer.fullName },
    { id: "preparedDate", header: "Ngày lập", size: 100, meta: { sortKey: "preparedDate", label: "Ngày lập" }, accessorFn: (r: Row) => fmtDate(r.preparedDate) },
    { id: "firstSubmittedAt", header: "Nộp lần đầu", size: 105, meta: { sortKey: "firstSubmittedAt", label: "Nộp lần đầu" }, accessorFn: (r: Row) => fmtDate(r.firstSubmittedAt) },
    { id: "approvedAt", header: "TGĐ đã ký", size: 105, meta: { sortKey: "approvedAt", label: "TGĐ đã ký" }, accessorFn: (r: Row) => fmtDate(r.approvedAt) },
    { id: "status", header: "Giai đoạn / trạng thái", size: 190, meta: { label: "Giai đoạn / trạng thái" },
      cell: ({ row }: { row: { original: Row } }) => <StatusBadge status={row.original.status} /> },
    { id: "submissionCount", header: "Lần in nộp", size: 90, meta: { sortKey: "submissionCount", label: "Số lần in nộp" }, accessorFn: (r: Row) => r.submissionCount },
    { id: "returnCount", header: "Lần BKS trả", size: 95, meta: { sortKey: "returnCount", label: "Số lần BKS trả" },
      cell: ({ row }: { row: { original: Row } }) => (row.original.returnCount ? <Badge tone="red">{row.original.returnCount}</Badge> : <span className="text-slate-400">0</span>) },
    { id: "priority", header: "Ưu tiên", size: 90, meta: { sortKey: "priority", label: "Ưu tiên" }, accessorFn: (r: Row) => PRIORITY_LABELS[r.priority] },
    { id: "notes", header: "Ghi chú", size: 200, meta: { label: "Ghi chú" }, accessorFn: (r: Row) => r.notes ?? "" },
    { id: "actions", header: "", size: 96, meta: { label: "Thao tác" }, enableHiding: false,
      cell: ({ row }: { row: { original: Row } }) => (
        <div className="flex gap-0.5">
          <Link href={`/documents/${row.original.id}`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Xem chi tiết"><Eye className="h-4 w-4" /></Link>
          {can("document.edit") && <Link href={`/documents/${row.original.id}/edit`} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sửa"><Pencil className="h-4 w-4" /></Link>}
          {can("document.create") && <button onClick={() => copyDoc(row.original.id)} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sao chép"><Copy className="h-4 w-4" /></button>}
        </div>
      ) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const exportFile = (format: "xlsx" | "pdf") =>
    download(`/api/documents/export${qs({ ...params, sort, dir, format })}`).catch((e) => toast("error", e.message));

  const opt = (list?: { id: string; name: string; code?: string }[], withCode = false) => (list ?? []).map((x) => ({ value: x.id, label: withCode && x.code ? `${x.code} - ${x.name}` : x.name }));

  return (
    <div>
      <PageHeader
        title="Quản lý hồ sơ trình ký"
        subtitle="Tra cứu, lọc, sắp xếp và quản lý toàn bộ hồ sơ trong phạm vi được phân quyền"
        actions={
          <>
            <Button variant="secondary" icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => exportFile("xlsx")}>Xuất Excel</Button>
            <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => exportFile("pdf")}>Xuất PDF</Button>
            {can("document.import") && <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImportOpen(true)}>Import Excel</Button>}
            {can("document.create") && <Link href="/forms/new"><Button icon={<Plus className="h-4 w-4" />}>Tạo phiếu trình ký</Button></Link>}
          </>
        }
      />

      <Card className="mb-4" bodyClass="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <form className="flex min-w-[240px] flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); setParams({ q: String(new FormData(e.currentTarget).get("q") ?? "") }); }}>
            <input name="q" key={params.q} defaultValue={params.q} className="input" placeholder="Tìm theo mã hồ sơ, số hiệu, tên hồ sơ..." />
            <Button type="submit">Tìm</Button>
          </form>
          <Button variant="secondary" icon={<Filter className="h-4 w-4" />} onClick={() => setShowFilters((s) => !s)}>Bộ lọc{activeFilters.length ? ` (${activeFilters.length})` : ""}</Button>
          {!!activeFilters.length && <Button variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => router.replace(pathname)}>Xóa lọc</Button>}
        </div>
        {showFilters && (
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <Select value={params.projectId ?? ""} onChange={(e) => setParams({ projectId: e.target.value })} placeholder="Công trình" options={opt(lk?.projects, true)} />
            <Select value={params.typeId ?? ""} onChange={(e) => setParams({ typeId: e.target.value })} placeholder="Loại hồ sơ" options={opt(lk?.types)} />
            <Select value={params.statusId ?? ""} onChange={(e) => setParams({ statusId: e.target.value, category: undefined })} placeholder="Trạng thái" options={opt(lk?.statuses)} />
            <Select value={params.category ?? ""} onChange={(e) => setParams({ category: e.target.value, statusId: undefined })} placeholder="Nhóm trạng thái" options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label }))} />
            <Select value={params.departmentId ?? ""} onChange={(e) => setParams({ departmentId: e.target.value })} placeholder="Phòng ban trình" options={opt(lk?.departments)} />
            <Select value={params.preparerId ?? ""} onChange={(e) => setParams({ preparerId: e.target.value })} placeholder="Người lập" options={(lk?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }))} />
            <Select value={params.contractorId ?? ""} onChange={(e) => setParams({ contractorId: e.target.value })} placeholder="CĐT / NCC / thầu phụ" options={opt(lk?.contractors)} />
            <Select value={params.flag ?? ""} onChange={(e) => setParams({ flag: e.target.value })} placeholder="Tình trạng đặc biệt" options={Object.entries(FLAG_LABELS).map(([value, label]) => ({ value, label }))} />
            <Select value={params.dateField ?? "preparedDate"} onChange={(e) => setParams({ dateField: e.target.value })} options={[{ value: "preparedDate", label: "Lọc theo ngày lập" }, { value: "firstSubmittedAt", label: "Lọc theo ngày nộp lần đầu" }, { value: "approvedAt", label: "Lọc theo ngày TGĐ ký" }]} />
            <input type="date" className="input" value={params.from ?? ""} onChange={(e) => setParams({ from: e.target.value })} title="Từ ngày" />
            <input type="date" className="input" value={params.to ?? ""} onChange={(e) => setParams({ to: e.target.value })} title="Đến ngày" />
            <Select value={params.sample ?? ""} onChange={(e) => setParams({ sample: e.target.value })} placeholder="Mẫu + chính thức" options={[{ value: "exclude", label: "Chỉ dữ liệu chính thức" }, { value: "only", label: "Chỉ dữ liệu mẫu" }]} />
          </div>
        )}
      </Card>

      <ErrorBox error={error} />
      <Card bodyClass="p-0">
        <DataTable
          id="documents"
          columns={columns as never}
          data={data?.rows ?? []}
          loading={isLoading}
          sort={sort}
          dir={dir}
          onSort={(s, d) => setParams({ sort: s, dir: d }, false)}
          defaultHidden={["contractor", "priority", "notes"]}
          defaultPinned={["code"]}
        />
        <div className="border-t border-slate-100 px-3">
          <Pagination page={page} pageSize={pageSize} total={data?.total ?? 0} onPage={(p) => setParams({ page: p }, false)} onPageSize={(s) => setParams({ pageSize: s })} />
        </div>
      </Card>
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={() => mutate()} />
    </div>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense>
      <DocumentsInner />
    </Suspense>
  );
}
