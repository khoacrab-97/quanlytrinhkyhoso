"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BarChart3, Bell, Building2, CalendarRange, ClipboardList, FileText, FolderCog, KeyRound, LayoutDashboard, LogOut, Menu, Printer, Route,
  Search, Settings, ShieldAlert, Undo2, X,
} from "lucide-react";
import { api, useApi } from "@/lib/client";
import { fmtDateTime, toInputDate } from "@/lib/dates";
import { can, ROLE_LABELS, type Permission, type RoleName } from "@/lib/permissions";
import { Button, cx, Field, Modal, ToastProvider, useToast } from "./ui";

export type ShellUser = { id: string; fullName: string; role: RoleName; departmentName: string | null; position: string | null; dataScope: string; preferences: Record<string, unknown>; catalogGrants: string[] };

const UserCtx = createContext<ShellUser | null>(null);
export const useMe = () => useContext(UserCtx)!;
export const useCan = () => {
  const me = useMe();
  return (p: Permission) => can(me.role, p);
};

// ---------------------------------------------------------------- Bộ lọc thời gian toàn cục
export type Range = { preset: string; from: string; to: string };
const PRESETS: { value: string; label: string; calc: () => [Date | null, Date | null] }[] = [
  { value: "30d", label: "30 ngày qua", calc: () => [new Date(Date.now() - 29 * 864e5), new Date()] },
  { value: "month", label: "Tháng này", calc: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth(), 1), n]; } },
  { value: "quarter", label: "Quý này", calc: () => { const n = new Date(); return [new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1), n]; } },
  { value: "year", label: "Năm nay", calc: () => { const n = new Date(); return [new Date(n.getFullYear(), 0, 1), n]; } },
  { value: "12m", label: "12 tháng qua", calc: () => { const n = new Date(); return [new Date(n.getFullYear(), n.getMonth() - 11, 1), n]; } },
  { value: "all", label: "Toàn bộ thời gian", calc: () => [null, null] },
];
function rangeFromPreset(preset: string): Range {
  const p = PRESETS.find((x) => x.value === preset) ?? PRESETS[4];
  const [f, t] = p.calc();
  return { preset: p.value, from: f ? toInputDate(f) : "", to: t ? toInputDate(t) : "" };
}
const RangeCtx = createContext<{ range: Range; setRange: (r: Range) => void }>({ range: rangeFromPreset("12m"), setRange: () => {} });
export const useRange = () => useContext(RangeCtx);

function RangePicker() {
  const { range, setRange } = useRange();
  return (
    <div className="flex items-center gap-1.5">
      <CalendarRange className="hidden h-4 w-4 text-slate-400 sm:block" />
      <select
        className="input w-auto py-1.5 text-xs"
        value={range.preset}
        onChange={(e) => (e.target.value === "custom" ? setRange({ ...range, preset: "custom" }) : setRange(rangeFromPreset(e.target.value)))}
        aria-label="Khoảng thời gian"
      >
        {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        <option value="custom">Tùy chọn...</option>
      </select>
      {range.preset === "custom" && (
        <>
          <input type="date" className="input w-auto py-1 text-xs" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <span className="text-slate-400">–</span>
          <input type="date" className="input w-auto py-1 text-xs" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Menu
const NAV: { href: string; label: string; icon: ReactNode; perm?: Permission }[] = [
  { href: "/", label: "Tổng quan", icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
  { href: "/forms", label: "Phiếu trình ký", icon: <Printer className="h-4.5 w-4.5" /> },
  { href: "/tracking", label: "Theo dõi trình ký", icon: <Route className="h-4.5 w-4.5" /> },
  { href: "/documents", label: "Quản lý hồ sơ", icon: <FileText className="h-4.5 w-4.5" /> },
  { href: "/returns", label: "BKS trả về", icon: <Undo2 className="h-4.5 w-4.5" /> },
  { href: "/errors", label: "Quản lý lỗi", icon: <ShieldAlert className="h-4.5 w-4.5" /> },
  { href: "/reports", label: "Báo cáo thống kê", icon: <BarChart3 className="h-4.5 w-4.5" />, perm: "report.view" },
  { href: "/catalogs", label: "Danh mục", icon: <FolderCog className="h-4.5 w-4.5" />, perm: "catalog.manage" },
  { href: "/admin", label: "Quản trị hệ thống", icon: <Settings className="h-4.5 w-4.5" />, perm: "user.manage" },
];

function Notifications() {
  const [open, setOpen] = useState(false);
  const { data, mutate } = useApi<{ items: { id: string; title: string; message: string; link: string | null; read: boolean; createdAt: string; type: string }[]; unread: number }>(
    "/api/notifications?take=15",
    { refreshInterval: 60_000 },
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const markAll = async () => {
    await api("/api/notifications", { method: "PATCH", json: { all: true } });
    mutate();
  };
  return (
    <div className="relative" ref={ref}>
      <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" onClick={() => setOpen((o) => !o)} aria-label="Thông báo">
        <Bell className="h-5 w-5" />
        {!!data?.unread && <span className="absolute right-1 top-1 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">{data.unread > 99 ? "99+" : data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Thông báo</span>
            <button className="text-xs text-brand-600 hover:underline" onClick={markAll}>Đánh dấu đã đọc tất cả</button>
          </div>
          <div className="scroll-thin max-h-96 overflow-y-auto">
            {!data?.items.length && <p className="px-4 py-8 text-center text-sm text-slate-400">Không có thông báo</p>}
            {data?.items.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/notifications"}
                onClick={async () => { setOpen(false); if (!n.read) { await api("/api/notifications", { method: "PATCH", json: { ids: [n.id] } }); mutate(); } }}
                className={cx("block border-b border-slate-50 px-4 py-2.5 hover:bg-slate-50", !n.read && "bg-blue-50/50")}
              >
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />}
                  <span className={cx("text-sm font-medium", n.type.includes("overdue") || n.type === "RETURN" ? "text-red-700" : "text-slate-800")}>{n.title}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.message}</p>
                <p className="mt-0.5 text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </Link>
            ))}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block py-2 text-center text-xs font-medium text-brand-600 hover:bg-slate-50">Xem tất cả</Link>
        </div>
      )}
    </div>
  );
}

function PasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (f.next !== f.confirm) return toast("error", "Mật khẩu xác nhận không khớp");
    setBusy(true);
    try {
      await api("/api/me/password", { method: "PUT", json: { current: f.current, next: f.next } });
      toast("success", "Đã đổi mật khẩu");
      setF({ current: "", next: "", confirm: "" });
      onClose();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Đổi mật khẩu" size="sm" footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={busy} onClick={submit}>Lưu</Button></>}>
      <div className="space-y-3">
        <Field label="Mật khẩu hiện tại" required><input type="password" className="input" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} /></Field>
        <Field label="Mật khẩu mới" required hint="Tối thiểu 8 ký tự, có chữ và số"><input type="password" className="input" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Nhập lại mật khẩu mới" required><input type="password" className="input" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [q, setQ] = useState("");
  const [range, setRangeState] = useState<Range>(() => rangeFromPreset("12m"));

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qltk.range");
      if (saved) {
        const r = JSON.parse(saved) as Range;
        setRangeState(r.preset === "custom" ? r : rangeFromPreset(r.preset));
      }
    } catch {}
  }, []);
  const rangeValue = useMemo(
    () => ({
      range,
      setRange: (r: Range) => {
        setRangeState(r);
        try { localStorage.setItem("qltk.range", JSON.stringify(r)); } catch {}
      },
    }),
    [range],
  );
  useEffect(() => setMobileOpen(false), [pathname]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };
  // Danh mục: Quản trị viên, hoặc người được ủy quyền thêm mới ít nhất một danh mục
  const nav = NAV.filter((n) => !n.perm || can(user.role, n.perm) || (n.href === "/catalogs" && user.catalogGrants.length > 0));
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const sidebar = (
    <div className="flex h-full flex-col bg-brand-900 text-slate-300">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500 text-brand-900"><Building2 className="h-5 w-5" /></div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">TRÌNH KÝ HỒ SƠ</p>
          <p className="text-[11px] text-slate-400">Quản lý · Theo dõi · Phân tích</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3 py-2">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              isActive(n.href) ? "bg-white/10 text-white shadow-inner" : "hover:bg-white/5 hover:text-white",
            )}
          >
            <span className={isActive(n.href) ? "text-accent-500" : ""}>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-slate-500">
        <ClipboardList className="mr-1 inline h-3.5 w-3.5" /> Phạm vi dữ liệu: {user.role === "ADMIN" ? "Toàn hệ thống" : { ALL: "Toàn hệ thống", DEPARTMENT: "Bộ phận", PROJECT: "Công trình được giao", OWN: "Cá nhân" }[user.dataScope]}
      </div>
    </div>
  );

  return (
    <UserCtx.Provider value={user}>
      <RangeCtx.Provider value={rangeValue}>
        <ToastProvider>
          <div className="flex min-h-screen">
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sidebar}</aside>
            {mobileOpen && (
              <div className="fixed inset-0 z-40 lg:hidden">
                <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
                <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
                <button className="absolute left-64 top-3 ml-2 rounded bg-white p-1" onClick={() => setMobileOpen(false)} aria-label="Đóng menu"><X className="h-5 w-5" /></button>
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col lg:pl-60 print:pl-0">
              <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur md:px-5">
                <button className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Mở menu"><Menu className="h-5 w-5" /></button>
                <span className="hidden text-sm font-semibold text-brand-700 xl:block">Hệ thống Quản lý trình ký hồ sơ</span>
                <form
                  className="relative ml-auto w-full max-w-xs xl:ml-6"
                  onSubmit={(e) => { e.preventDefault(); router.push(`/documents?q=${encodeURIComponent(q.trim())}`); }}
                >
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input className="input py-1.5 pl-8 text-sm" placeholder="Tìm mã, số hiệu, tên hồ sơ..." value={q} onChange={(e) => setQ(e.target.value)} />
                </form>
                <div className="hidden md:block"><RangePicker /></div>
                <Notifications />
                <div className="relative">
                  <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-100" onClick={() => setMenuOpen((o) => !o)}>
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                      {user.fullName.split(" ").slice(-1)[0]?.[0]}
                    </span>
                    <span className="hidden text-left leading-tight sm:block">
                      <span className="block text-sm font-medium text-slate-800">{user.fullName}</span>
                      <span className="block text-[11px] text-slate-500">{ROLE_LABELS[user.role]}{user.departmentName ? ` · ${user.departmentName}` : ""}</span>
                    </span>
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 z-40 mt-2 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-xl" onMouseLeave={() => setMenuOpen(false)}>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => { setPwOpen(true); setMenuOpen(false); }}><KeyRound className="h-4 w-4" /> Đổi mật khẩu</button>
                      <button className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={logout}><LogOut className="h-4 w-4" /> Đăng xuất</button>
                    </div>
                  )}
                </div>
              </header>
              <div className="border-b border-slate-200 bg-white px-3 py-1.5 md:hidden"><RangePicker /></div>
              <main className="min-w-0 flex-1 p-3 md:p-6">{children}</main>
            </div>
          </div>
          <PasswordDialog open={pwOpen} onClose={() => setPwOpen(false)} />
        </ToastProvider>
      </RangeCtx.Provider>
    </UserCtx.Provider>
  );
}
