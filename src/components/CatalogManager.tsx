"use client";
// Bảng quản lý một danh mục (danh sách, thêm, sửa, ngừng dùng, xóa) - dùng ở trang Danh mục và Quản trị hệ thống
import { useState, type ReactNode } from "react";
import { Ban, CheckCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { api, useApi, useLookups } from "@/lib/client";
import { fmtDate, toInputDate } from "@/lib/dates";
import { CATEGORY_LABELS } from "@/lib/constants";
import { Badge, Button, Card, ErrorBox, Field, Modal, Select, Spinner, useConfirm, useToast } from "@/components/ui";
import { useMe } from "@/components/AppShell";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type FieldDef = { key: string; label: string; type?: "text" | "number" | "select" | "bool" | "color" | "date" | "textarea" | "tags" | "multi"; required?: boolean; options?: (lk: Any) => { value: string; label: string }[]; hint?: string; full?: boolean };
type Col = { label: string; render: (r: Any) => ReactNode };
type Def = { label: string; desc: string; fields: FieldDef[]; cols: Col[]; defaults?: Record<string, unknown> };

const activeCol: Col = { label: "Trạng thái", render: (r) => (r.active ? <Badge tone="green">Đang dùng</Badge> : <Badge tone="gray">Vô hiệu</Badge>) };
/** Người thêm mục (5 danh mục được ủy quyền) */
const createdByCol: Col = { label: "Được thêm bởi", render: (r) => r.createdBy?.fullName ?? <span className="text-slate-400">—</span> };
const usage = (k: string, label = "Đang dùng") => ({ label, render: (r: Any) => r._count?.[k] ?? 0 });

export const DEFS: Record<string, Def> = {
  projects: {
    label: "Công trình / dự án", desc: "Danh sách công trình, dự án mà hồ sơ trình ký thuộc về",
    fields: [
      { key: "code", label: "Mã công trình", required: true }, { key: "name", label: "Tên công trình", required: true, full: true },
      { key: "investor", label: "Chủ đầu tư", hint: "Tự điền vào phiếu trình ký khi chọn dự án" }, { key: "location", label: "Địa điểm" }, { key: "startDate", label: "Ngày khởi công", type: "date" },
      { key: "endDate", label: "Ngày hoàn thành dự kiến", type: "date" },
      { key: "partnerIds", label: "Chủ đầu tư / NCC / thầu phụ của dự án", type: "multi", full: true, options: (lk) => lk.contractors.map((c: Any) => ({ value: c.id, label: c.name })), hint: "Phiếu trình ký của dự án chỉ chọn đối tác trong danh sách này" },
      { key: "description", label: "Mô tả", type: "textarea", full: true }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    cols: [{ label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên công trình", render: (r) => r.name }, { label: "Chủ đầu tư", render: (r) => r.investor }, { label: "NCC / thầu phụ", render: (r) => <span className="whitespace-normal text-xs">{r.partners?.map((x: Any) => x.contractor.name).join(", ")}</span> }, { label: "Địa điểm", render: (r) => r.location }, { label: "Khởi công", render: (r) => fmtDate(r.startDate) }, usage("documents", "Số HS"), usage("members", "Thành viên"), createdByCol, activeCol],
  },
  documentTypes: {
    label: "Loại hồ sơ", desc: "Phân loại hồ sơ trình ký",
    fields: [
      { key: "code", label: "Mã loại", required: true }, { key: "name", label: "Tên loại hồ sơ", required: true },
      { key: "description", label: "Mô tả", type: "textarea", full: true }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    cols: [{ label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên loại", render: (r) => r.name }, usage("documents", "Số HS"), createdByCol, activeCol],
  },
  departments: {
    label: "Bộ phận", desc: "Phòng ban, ban chỉ huy, bộ phận tham gia lập và xử lý hồ sơ",
    fields: [{ key: "code", label: "Mã bộ phận", required: true }, { key: "name", label: "Tên bộ phận", required: true }, { key: "description", label: "Mô tả", type: "textarea", full: true }, { key: "active", label: "Đang sử dụng", type: "bool" }],
    cols: [{ label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên bộ phận", render: (r) => r.name }, usage("users", "Nhân sự"), usage("documents", "Số HS lập"), activeCol],
  },
  divisions: {
    label: "Khối", desc: "Khối trong phòng ban (vd Phòng Dự án: Khối Phát triển dự án, Khối Thi công dự án). Nhân viên và Phụ trách liên quan được gán vào khối khi tạo người dùng",
    fields: [
      { key: "departmentId", label: "Phòng ban", type: "select", required: true, options: (lk) => lk.departments.map((d: Any) => ({ value: d.id, label: d.name })) },
      { key: "code", label: "Mã khối", required: true }, { key: "name", label: "Tên khối", required: true }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    cols: [{ label: "Phòng ban", render: (r) => r.department?.name }, { label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên khối", render: (r) => r.name }, usage("users", "Nhân sự"), activeCol],
  },
  contractors: {
    label: "CĐT / NCC / thầu phụ", desc: "Chủ đầu tư, nhà cung cấp, thầu phụ. Gắn vào dự án tại tab Công trình / dự án",
    fields: [{ key: "code", label: "Mã", required: true }, { key: "name", label: "Tên đơn vị", required: true, full: true }, { key: "taxCode", label: "Mã số thuế" }, { key: "contact", label: "Liên hệ" }, { key: "active", label: "Đang sử dụng", type: "bool" }],
    cols: [{ label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên đơn vị", render: (r) => r.name }, { label: "MST", render: (r) => r.taxCode }, { label: "Liên hệ", render: (r) => r.contact }, usage("documents", "Số HS"), createdByCol, activeCol],
  },
  errorCategories: {
    label: "Nhóm lỗi", desc: "Nhóm lỗi dùng để phân loại nguyên nhân trả hồ sơ",
    fields: [
      { key: "code", label: "Mã nhóm", required: true }, { key: "name", label: "Tên nhóm lỗi", required: true }, { key: "order", label: "Thứ tự", type: "number" },
      { key: "attributable", label: "Tính trách nhiệm cá nhân", type: "bool", hint: "Bỏ chọn với lỗi khách quan (vd: thay đổi yêu cầu từ CĐT) để không tính vào hiệu suất cá nhân" },
      { key: "description", label: "Mô tả", type: "textarea", full: true }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    defaults: { attributable: true },
    cols: [{ label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Nhóm lỗi", render: (r) => r.name }, { label: "Tính trách nhiệm", render: (r) => (r.attributable ? "Có" : <Badge tone="gray">Khách quan</Badge>) }, usage("reasons", "Số nguyên nhân"), usage("errors", "Lỗi đã ghi nhận"), createdByCol, activeCol],
  },
  errorReasons: {
    label: "Nguyên nhân trả hồ sơ", desc: "Các lỗi cụ thể trong từng nhóm lỗi",
    fields: [
      { key: "categoryId", label: "Nhóm lỗi", type: "select", required: true, options: (lk) => lk.errorCategories.map((c: Any) => ({ value: c.id, label: c.name })) },
      { key: "code", label: "Mã", required: true }, { key: "name", label: "Nội dung lỗi", required: true, full: true }, { key: "order", label: "Thứ tự", type: "number" }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    cols: [{ label: "Nhóm", render: (r) => r.category?.name }, { label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Nguyên nhân", render: (r) => r.name }, usage("errors", "Lần xuất hiện"), createdByCol, activeCol],
  },
  statuses: {
    label: "Trạng thái", desc: "Trạng thái hồ sơ. Trạng thái tùy chỉnh phải thuộc một nhóm để hệ thống áp dụng logic nghiệp vụ",
    fields: [
      { key: "code", label: "Mã", required: true }, { key: "name", label: "Tên trạng thái", required: true },
      { key: "category", label: "Nhóm trạng thái", type: "select", required: true, options: () => Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })) },
      { key: "color", label: "Màu hiển thị", type: "color", required: true }, { key: "order", label: "Thứ tự", type: "number" }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    defaults: { color: "#64748b", category: "REVIEWING" },
    cols: [
      { label: "Mã", render: (r) => <b>{r.code}</b> }, { label: "Tên", render: (r) => <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: r.color }} />{r.name}</span> },
      { label: "Nhóm", render: (r) => CATEGORY_LABELS[r.category] }, { label: "Loại", render: (r) => (r.isSystem ? <Badge tone="blue">Hệ thống</Badge> : <Badge>Tùy chỉnh</Badge>) }, usage("documents", "Số HS"), activeCol,
    ],
  },


  customFields: {
    label: "Trường mở rộng", desc: "Trường dữ liệu bổ sung cho hồ sơ (hiển thị trong form và chi tiết hồ sơ)",
    fields: [
      { key: "key", label: "Khóa (không dấu)", required: true, hint: "VD: contractValue" }, { key: "label", label: "Nhãn hiển thị", required: true },
      { key: "type", label: "Kiểu dữ liệu", type: "select", required: true, options: () => [{ value: "TEXT", label: "Văn bản" }, { value: "NUMBER", label: "Số" }, { value: "DATE", label: "Ngày" }, { value: "SELECT", label: "Danh sách chọn" }, { value: "BOOLEAN", label: "Có/Không" }] },
      { key: "options", label: "Các lựa chọn (kiểu Danh sách)", type: "tags", hint: "Phân tách bằng dấu phẩy", full: true },
      { key: "order", label: "Thứ tự", type: "number" }, { key: "required", label: "Bắt buộc nhập", type: "bool" }, { key: "active", label: "Đang sử dụng", type: "bool" },
    ],
    defaults: { type: "TEXT", options: [] },
    cols: [{ label: "Khóa", render: (r) => <code>{r.key}</code> }, { label: "Nhãn", render: (r) => r.label }, { label: "Kiểu", render: (r) => r.type }, { label: "Bắt buộc", render: (r) => (r.required ? "Có" : "") }, activeCol],
  },
};

function CatalogEditor({ entity, row, onClose, onSaved }: { entity: string; row: Any | null; onClose: () => void; onSaved: () => void }) {
  const def = DEFS[entity];
  const toast = useToast();
  const { data: lk } = useLookups();
  const [v, setV] = useState<Record<string, Any>>(() => {
    const base: Record<string, Any> = { active: true, ...(def.defaults ?? {}) };
    if (!row) return base;
    const x: Record<string, Any> = { ...base };
    for (const f of def.fields) x[f.key] = f.type === "date" ? toInputDate(row[f.key]) : row[f.key] ?? (f.type === "bool" ? false : "");
    if (entity === "projects") x.partnerIds = (row.partners ?? []).map((p: Any) => p.contractorId);
    return x;
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, Any> = {};
      for (const f of def.fields) {
        let val = v[f.key];
        if (f.type === "bool") val = !!val;
        else if (f.type === "multi") val = Array.isArray(val) ? val : [];
        else if (f.type === "tags") val = Array.isArray(val) ? val : String(val ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        else if (val === "") val = null;
        body[f.key] = val;
      }
      await api(row ? `/api/catalogs/${entity}/${row.id}` : `/api/catalogs/${entity}`, { method: row ? "PATCH" : "POST", json: body });
      toast("success", row ? "Đã cập nhật" : "Đã thêm mới");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`${row ? "Sửa" : "Thêm"} ${def.label.toLowerCase()}`} footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        {def.fields.map((f) => (
          <Field key={f.key} label={f.label} required={f.required} hint={f.hint} className={f.full || f.type === "textarea" ? "md:col-span-2" : ""}>
            {f.type === "select" ? (
              <Select value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} placeholder="— Chọn —" options={lk ? f.options!(lk) : []} />
            ) : f.type === "bool" ? (
              <input type="checkbox" className="h-4 w-4" checked={!!v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.checked })} />
            ) : f.type === "textarea" ? (
              <textarea className="input" rows={2} value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : f.type === "color" ? (
              <div className="flex gap-2"><input type="color" className="h-9 w-14 rounded border" value={v[f.key] ?? "#64748b"} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /><input className="input" value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} /></div>
            ) : f.type === "multi" ? (
              <div className="scroll-thin grid max-h-48 gap-1 overflow-y-auto rounded-md border border-slate-200 p-2 sm:grid-cols-2">
                {(lk ? f.options!(lk) : []).map((o) => {
                  const cur: string[] = Array.isArray(v[f.key]) ? v[f.key] : [];
                  return (
                    <label key={o.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={cur.includes(o.value)} onChange={(e) => setV({ ...v, [f.key]: e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value) })} />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            ) : f.type === "tags" ? (
              <input className="input" value={Array.isArray(v[f.key]) ? v[f.key].join(", ") : v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            ) : (
              <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} step="any" className="input" value={v[f.key] ?? ""} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-3"><ErrorBox error={err} /></div>
    </Modal>
  );
}

/** canEdit = true: Quản trị viên sửa / ngừng dùng / xóa mọi mục. Người được ủy quyền chỉ sửa / xóa mục do chính mình thêm */
export function CatalogTable({ entity, canEdit }: { entity: string; canEdit: boolean }) {
  const me = useMe();
  const editable = (r: Any) => canEdit || (!!r.createdById && r.createdById === me.id);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Any | null | false>(false);
  const { data, error, mutate, isLoading } = useApi<Any[]>(`/api/catalogs/${entity}${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  const { mutate: mutLk } = useLookups();
  const def = DEFS[entity];
  const refresh = () => { mutate(); mutLk(); };

  const toggle = async (r: Any) => {
    try {
      const body: Record<string, Any> = {};
      for (const f of def.fields) body[f.key] = f.type === "date" ? (r[f.key] ? toInputDate(r[f.key]) : null) : r[f.key];
      body.active = !r.active;
      await api(`/api/catalogs/${entity}/${r.id}`, { method: "PATCH", json: body });
      toast("success", body.active ? "Đã kích hoạt" : "Đã vô hiệu hóa");
      refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };
  const remove = async (r: Any) => {
    if (!(await confirm("Xóa danh mục", "Chỉ xóa được khi mục này chưa được sử dụng. Nếu đã phát sinh dữ liệu, hãy vô hiệu hóa.", { danger: true }))) return;
    try {
      await api(`/api/catalogs/${entity}/${r.id}`, { method: "DELETE" });
      toast("success", "Đã xóa");
      refresh();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  return (
    <>
      <Card
        title={def.label}
        subtitle={def.desc}
        bodyClass="p-0"
        actions={
          <>
            <input className="input w-56 py-1.5" placeholder="Tìm kiếm..." value={q} onChange={(e) => setQ(e.target.value)} />
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Thêm mới</Button>
          </>
        }
      >
        <ErrorBox error={error} />
        {isLoading && !data ? <Spinner /> : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead><tr>{def.cols.map((c) => <th key={c.label} className="th">{c.label}</th>)}<th className="th w-28"></th></tr></thead>
              <tbody>
                {data?.map((r) => (
                  <tr key={r.id} className={r.active === false ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50"}>
                    {def.cols.map((c) => <td key={c.label} className="td">{c.render(r)}</td>)}
                    {editable(r) ? (
                      <td className="td whitespace-nowrap text-right">
                        <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sửa" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></button>
                        {"active" in r && !(entity === "statuses" && r.isSystem) && (
                          <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title={r.active ? "Vô hiệu hóa" : "Kích hoạt"} onClick={() => toggle(r)}>{r.active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}</button>
                        )}
                        {!(entity === "statuses" && r.isSystem) && <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Xóa" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></button>}
                      </td>
                    ) : <td className="td" />}
                  </tr>
                ))}
                {data && !data.length && <tr><td colSpan={def.cols.length + 1} className="td py-8 text-center text-slate-400">Chưa có dữ liệu</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {editing !== false && <CatalogEditor entity={entity} row={editing} onClose={() => setEditing(false)} onSaved={refresh} />}
      {dialog}
    </>
  );
}
