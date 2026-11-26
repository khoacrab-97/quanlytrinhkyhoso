"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, DatabaseBackup, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { api, download, qs, useApi, useLookups } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { ROLE_LABELS } from "@/lib/permissions";
import { useCan, useMe } from "@/components/AppShell";
import { Badge, Button, Card, ErrorBox, Field, Modal, PageHeader, Pagination, Select, Spinner, Tabs, useConfirm, useToast } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ROLE_DESC: Record<string, string> = {
  ADMIN: "Toàn quyền: người dùng, danh mục, cấu hình, mọi dữ liệu",
  MANAGER: "Xem dashboard/báo cáo, giám sát & xử lý hồ sơ trong phạm vi, đổi trạng thái ngoài luồng",
  STAFF: "Tạo hồ sơ, cập nhật tiến độ, ghi nhận lỗi & xử lý hồ sơ bị trả trong phạm vi được giao",
  VIEWER: "Chỉ xem dữ liệu được cấp quyền, không chỉnh sửa",
};

const APPROVAL_ROLES = [{ value: "STAFF", label: "Nhân viên" }, { value: "RELATED", label: "Phụ trách liên quan" }, { value: "DEPT_MANAGER", label: "Quản lý phòng ban" }];
const approvalRoleOf = (u: Any) => (u.isDeptManager ? "DEPT_MANAGER" : u.isRelatedPerson ? "RELATED" : "STAFF");

function UserEditor({ row, onClose, onSaved }: { row: Any | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { data: lk } = useLookups();
  const [v, setV] = useState<Any>(() => row ? { ...row, password: "", approvalRole: approvalRoleOf(row), departmentId: row.departmentId ?? "", divisionId: row.divisionId ?? "", email: row.email ?? "", phone: row.phone ?? "", position: row.position ?? "" }
    : { username: "", fullName: "", email: "", phone: "", position: "", departmentId: "", divisionId: "", approvalRole: "STAFF", active: true, password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { username: v.username, fullName: v.fullName, email: v.email, phone: v.phone, position: v.position, departmentId: v.departmentId, divisionId: v.approvalRole === "DEPT_MANAGER" ? null : v.divisionId, approvalRole: v.approvalRole, active: v.active, password: v.password };
      await api(row ? `/api/users/${row.id}` : "/api/users", { method: row ? "PATCH" : "POST", json: body });
      toast("success", row ? "Đã lưu người dùng" : "Đã thêm người dùng");
      onSaved();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const set = (k: string, val: unknown) => setV((x: Any) => ({ ...x, [k]: val }));
  const divisions = lk?.departments.find((d) => d.id === v.departmentId)?.divisions ?? [];
  return (
    <Modal open onClose={onClose} title={row ? `Sửa người dùng: ${row.fullName}` : "Thêm người dùng"} footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Tên đăng nhập" required><input className="input" value={v.username} onChange={(e) => set("username", e.target.value)} disabled={!!row} /></Field>
        <Field label="Họ tên" required><input className="input" value={v.fullName} onChange={(e) => set("fullName", e.target.value)} /></Field>
        <Field label="Chức danh"><input className="input" value={v.position} onChange={(e) => set("position", e.target.value)} /></Field>
        <Field label="Phòng ban" required><Select value={v.departmentId} onChange={(e) => setV((x: Any) => ({ ...x, departmentId: e.target.value, divisionId: "" }))} placeholder="— Chọn —" options={(lk?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} /></Field>
        <Field label="Vai trò" required hint="Phụ trách liên quan / Quản lý phòng ban dùng cho bước duyệt hồ sơ"><Select value={v.approvalRole} onChange={(e) => set("approvalRole", e.target.value)} options={APPROVAL_ROLES} /></Field>
        {divisions.length > 0 && v.approvalRole !== "DEPT_MANAGER" && (
          <Field label="Khối" required hint="Phụ trách liên quan phụ trách khối này"><Select value={v.divisionId} onChange={(e) => set("divisionId", e.target.value)} placeholder="— Chọn khối —" options={divisions.map((d) => ({ value: d.id, label: d.name }))} /></Field>
        )}
        <Field label="Email"><input className="input" value={v.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Điện thoại"><input className="input" value={v.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label={row ? "Đặt lại mật khẩu" : "Mật khẩu"} required={!row} hint="Tối thiểu 8 ký tự, có chữ và số. Bỏ trống nếu không đổi."><input type="password" autoComplete="new-password" className="input" value={v.password} onChange={(e) => set("password", e.target.value)} /></Field>
        <Field label="Trạng thái tài khoản"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={(e) => set("active", e.target.checked)} /> Đang hoạt động</label></Field>
      </div>
      {!row && <p className="mt-3 text-xs text-slate-500">Quyền sử dụng hệ thống mặc định là Nhân viên, chỉnh ở tab Phân quyền.</p>}
      <div className="mt-3"><ErrorBox error={err} /></div>
    </Modal>
  );
}

function useUserRows() {
  const res = useApi<Any[]>("/api/users");
  const [q, setQ] = useState("");
  const rows = (res.data ?? []).filter((u) => !q || `${u.username} ${u.fullName} ${u.department?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const search = <input className="input w-56 py-1.5" placeholder="Tìm người dùng..." value={q} onChange={(e) => setQ(e.target.value)} />;
  return { ...res, rows, search };
}

function Users() {
  const toast = useToast();
  const me = useMe();
  const { confirm, dialog } = useConfirm();
  const { data, error, mutate, rows, search } = useUserRows();
  const [editing, setEditing] = useState<Any | null | false>(false);
  const remove = async (u: Any) => {
    const ok = await confirm("Xóa người dùng", <>Xóa <b>{u.fullName}</b> ({u.username}) khỏi hệ thống? Tài khoản không đăng nhập được nữa và không còn trong danh sách chọn. Hồ sơ, lịch sử đã phát sinh vẫn giữ tên người này.</>, { danger: true });
    if (!ok) return;
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      toast("success", `Đã xóa ${u.fullName}`);
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };
  return (
    <Card title="Người dùng" subtitle="Danh mục nhân sự đồng thời là tài khoản đăng nhập" bodyClass="p-0" actions={<>{search}<Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(null)}>Thêm người dùng</Button></>}>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead><tr><th className="th">Tài khoản</th><th className="th">Họ tên</th><th className="th">Phòng ban</th><th className="th">Vai trò</th><th className="th">Email</th><th className="th">Điện thoại</th><th className="th">HS đã lập</th><th className="th">Đăng nhập gần nhất</th><th className="th">Trạng thái</th><th className="th"></th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.active ? "hover:bg-slate-50" : "bg-slate-50 text-slate-400"}>
                  <td className="td font-mono text-xs">{u.username}</td>
                  <td className="td font-medium">{u.fullName}<p className="text-xs font-normal text-slate-400">{u.position}</p></td>
                  <td className="td">{u.department?.name}{u.division && <p className="text-xs text-slate-400">{u.division.name}</p>}</td>
                  <td className="td">{u.isDeptManager ? <Badge tone="violet">Quản lý phòng ban</Badge> : u.isRelatedPerson ? <Badge tone="blue">Phụ trách liên quan</Badge> : <span className="text-sm">Nhân viên</span>}</td>
                  <td className="td text-xs">{u.email}</td>
                  <td className="td text-xs">{u.phone}</td>
                  <td className="td">{u._count.preparedDocuments}</td>
                  <td className="td text-xs">{fmtDateTime(u.lastLoginAt) || "—"}</td>
                  <td className="td">{u.active ? <Badge tone="green">Hoạt động</Badge> : <Badge>Đã khóa</Badge>}</td>
                  <td className="td whitespace-nowrap">
                    <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" title="Sửa" onClick={() => setEditing(u)}><Pencil className="h-4 w-4" /></button>
                    {u.id !== me.id && <button className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Xóa khỏi hệ thống" onClick={() => remove(u)}><Trash2 className="h-4 w-4" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== false && <UserEditor row={editing} onClose={() => setEditing(false)} onSaved={() => mutate()} />}
      {dialog}
    </Card>
  );
}

/** Xếp theo phòng ban → Quản lý phòng ban → khối → Phụ trách liên quan → nhân viên */
const orgOrder = (a: Any, b: Any) =>
  (a.department?.name ?? "~").localeCompare(b.department?.name ?? "~", "vi") ||
  Number(b.isDeptManager) - Number(a.isDeptManager) ||
  (a.division?.name ?? "").localeCompare(b.division?.name ?? "", "vi") ||
  Number(b.isRelatedPerson) - Number(a.isRelatedPerson) ||
  a.fullName.localeCompare(b.fullName, "vi");

/** Phân quyền: vai trò + Phụ trách liên quan + Quản lý phòng (chuẩn bị cho luồng Quản lý duyệt) */
function Permissions() {
  const toast = useToast();
  const me = useMe();
  const { data, error, mutate, rows, search } = useUserRows();
  const [saving, setSaving] = useState<string | null>(null);
  const update = async (u: Any, patch: Record<string, unknown>) => {
    setSaving(u.id);
    try {
      await api(`/api/users/${u.id}/permissions`, { method: "PATCH", json: { role: u.role, ...patch } });
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setSaving(null);
    }
  };
  return (
    <Card title="Phân quyền" subtitle="Quyền sử dụng hệ thống. Phòng ban, Khối và Phụ trách liên quan / Quản lý phòng ban được thiết lập khi tạo người dùng (tab Người dùng). Khối quản lý tại Danh mục → Khối" bodyClass="p-0" actions={search}>
      <ErrorBox error={error} />
      {!data ? <Spinner /> : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead><tr><th className="th">Tài khoản</th><th className="th">Họ tên</th><th className="th">Phòng ban</th><th className="th">Khối</th><th className="th">Quyền hệ thống</th><th className="th text-center">Phụ trách liên quan</th><th className="th text-center">Quản lý phòng ban</th></tr></thead>
            <tbody>
              {[...rows].sort(orgOrder).map((u) => (
                <tr key={u.id} className={u.active ? "hover:bg-slate-50" : "bg-slate-50 text-slate-400"}>
                  <td className="td font-mono text-xs">{u.username}</td>
                  <td className="td font-medium">{u.fullName}<p className="text-xs font-normal text-slate-400">{u.position}</p></td>
                  <td className="td">{u.department?.name}</td>
                  <td className="td">{u.division?.name ?? (u.isDeptManager ? <span className="text-xs text-slate-400">Toàn phòng</span> : "")}</td>
                  <td className="td">
                    <Select className="py-1" value={u.role} disabled={saving === u.id || u.id === me.id} title={ROLE_DESC[u.role]} onChange={(e) => update(u, { role: e.target.value })} options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
                  </td>
                  <td className="td text-center">{u.isRelatedPerson ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="Có" /> : ""}</td>
                  <td className="td text-center">{u.isDeptManager ? <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" aria-label="Có" /> : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        {Object.entries(ROLE_DESC).map(([k, d]) => <p key={k}><b>{ROLE_LABELS[k as keyof typeof ROLE_LABELS]}:</b> {d}</p>)}
      </div>
    </Card>
  );
}

function Settings() {
  const toast = useToast();
  const { data, mutate } = useApi<{ key: string; label: string; value: string }[]>("/api/settings");
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (data) setV(Object.fromEntries(data.map((d) => [d.key, d.value]))); }, [data]);
  const save = async () => {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PUT", json: v });
      toast("success", "Đã lưu cấu hình");
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!data) return <Spinner />;
  return (
    <Card title="Cấu hình hệ thống" subtitle="Tham số nghiệp vụ" actions={<Button loading={busy} onClick={save}>Lưu cấu hình</Button>}>
      <div className="grid gap-4 md:grid-cols-2">
        {data.map((d) => <Field key={d.key} label={d.label} hint={d.key}><input className="input" value={v[d.key] ?? ""} onChange={(e) => setV({ ...v, [d.key]: e.target.value })} /></Field>)}
      </div>
    </Card>
  );
}

function Data() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data: backups, mutate } = useApi<{ name: string; size: number; createdAt: string }[]>("/api/admin/backup");
  const { data: counts, mutate: mutCounts } = useApi<{ sample: number; official: number }>("/api/admin/sample");
  const [busy, setBusy] = useState<string | null>(null);
  const backup = async () => {
    setBusy("backup");
    try {
      const r = await api<{ name: string }>("/api/admin/backup", { method: "POST" });
      toast("success", `Đã tạo bản sao lưu ${r.name}`);
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const purge = async () => {
    if (!(await confirm("Xóa toàn bộ dữ liệu mẫu", <>Sẽ xóa vĩnh viễn <b>{counts?.sample}</b> hồ sơ mẫu cùng lịch sử, lần trả, file đính kèm của chúng. Dữ liệu chính thức không bị ảnh hưởng. Nên sao lưu trước.</>, { danger: true }))) return;
    setBusy("purge");
    try {
      const r = await api<{ deleted: number }>("/api/admin/sample", { method: "DELETE" });
      toast("success", `Đã xóa ${r.deleted} hồ sơ mẫu`);
      mutCounts();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Sao lưu dữ liệu" subtitle="Bản sao lưu logic toàn bộ CSDL (JSON nén). Production nên kết hợp pg_dump định kỳ — xem README." actions={<Button loading={busy === "backup"} icon={<DatabaseBackup className="h-4 w-4" />} onClick={backup}>Tạo bản sao lưu</Button>} bodyClass="p-0">
        {!backups ? <Spinner /> : (
          <table className="w-full">
            <thead><tr><th className="th">File</th><th className="th">Dung lượng</th><th className="th">Thời gian</th><th className="th"></th></tr></thead>
            <tbody>
              {!backups.length && <tr><td colSpan={4} className="td py-6 text-center text-slate-400">Chưa có bản sao lưu</td></tr>}
              {backups.map((b) => (
                <tr key={b.name}>
                  <td className="td font-mono text-xs">{b.name}</td>
                  <td className="td">{(b.size / 1024).toFixed(0)} KB</td>
                  <td className="td">{fmtDateTime(b.createdAt)}</td>
                  <td className="td"><button className="rounded p-1.5 text-slate-500 hover:bg-slate-100" onClick={() => download(`/api/admin/backup/${b.name}`).catch((e) => toast("error", e.message))}><Download className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Dữ liệu mẫu và dữ liệu chính thức" subtitle="Hồ sơ mẫu được gắn nhãn 'Mẫu' và có thể lọc riêng ở mọi màn hình">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-slate-50 p-4"><p className="text-xs text-slate-500">Hồ sơ mẫu</p><p className="text-2xl font-bold">{counts?.sample ?? "…"}</p></div>
          <div className="rounded-lg bg-emerald-50 p-4"><p className="text-xs text-slate-500">Hồ sơ chính thức</p><p className="text-2xl font-bold text-emerald-700">{counts?.official ?? "…"}</p></div>
        </div>
        <Button className="mt-4" variant="danger" disabled={!counts?.sample} loading={busy === "purge"} icon={<Trash2 className="h-4 w-4" />} onClick={purge}>Xóa toàn bộ dữ liệu mẫu</Button>
        <p className="mt-2 text-xs text-slate-500">Danh mục mẫu (công trình, nhân sự mẫu…) không bị xóa tự động; có thể vô hiệu hóa trong Danh mục.</p>
      </Card>
      {dialog}
    </div>
  );
}

function Audit() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const { data } = useApi<{ total: number; rows: Any[] }>(`/api/audit${qs({ page, pageSize: 30, action })}`);
  return (
    <Card title="Nhật ký hoạt động" subtitle="Ghi nhận đăng nhập, thao tác dữ liệu, xuất báo cáo, thay đổi cấu hình" bodyClass="p-0" actions={<input className="input w-56 py-1.5" placeholder="Lọc theo hành động (vd: document.return)" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />}>
      {!data ? <Spinner /> : (
        <>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr><th className="th">Thời gian</th><th className="th">Người dùng</th><th className="th">Hành động</th><th className="th">Đối tượng</th><th className="th">Chi tiết</th><th className="th">IP</th></tr></thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td whitespace-nowrap text-xs">{fmtDateTime(r.createdAt)}</td>
                    <td className="td">{r.user?.fullName ?? "—"}</td>
                    <td className="td"><code className="text-xs">{r.action}</code></td>
                    <td className="td text-xs">{r.entity}{r.entityId ? ` · ${r.entityId.slice(0, 10)}…` : ""}</td>
                    <td className="td max-w-md truncate text-xs text-slate-500" title={JSON.stringify(r.detail)}>{r.detail ? JSON.stringify(r.detail).slice(0, 160) : ""}</td>
                    <td className="td text-xs">{r.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-3"><Pagination page={page} pageSize={30} total={data.total} onPage={setPage} /></div>
        </>
      )}
    </Card>
  );
}

export default function AdminPage() {
  const can = useCan();
  const [tab, setTab] = useState("users");
  if (!can("user.manage")) return <ErrorBox error="Bạn không có quyền truy cập trang quản trị" />;
  return (
    <div>
      <PageHeader title="Quản trị hệ thống" subtitle="Người dùng, phân quyền, cấu hình, sao lưu và nhật ký hoạt động" />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "users", label: "Người dùng" }, { value: "permissions", label: "Phân quyền" }, { value: "settings", label: "Cấu hình" }, { value: "data", label: "Sao lưu & dữ liệu mẫu" }, { value: "audit", label: "Nhật ký hoạt động" }]} />
      {tab === "users" && <Users />}
      {tab === "permissions" && <Permissions />}
      {tab === "settings" && <Settings />}
      {tab === "data" && <Data />}
      {tab === "audit" && <Audit />}
    </div>
  );
}
