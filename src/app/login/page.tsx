"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Lock, User } from "lucide-react";
import { api } from "@/lib/client";
import { Button, ErrorBox } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { method: "POST", json: { username, password } });
      const next = sp.get("next");
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Tên đăng nhập</label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input className="input pl-9" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Mật khẩu</label>
        <div className="relative">
          <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input type="password" className="input pl-9" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
      </div>
      <ErrorBox error={error} />
      <Button type="submit" loading={busy} className="w-full py-2.5">Đăng nhập</Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }}
        />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500 text-brand-900"><Building2 className="h-6 w-6" /></div>
          <div>
            <p className="font-bold tracking-wide">HỆ THỐNG QUẢN LÝ TRÌNH KÝ HỒ SƠ</p>
            <p className="text-sm text-slate-400">Dành cho doanh nghiệp xây dựng</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-tight">Kiểm soát mọi hồ sơ trình ký — từ lúc lập đến khi lưu trữ.</h2>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li>• Theo dõi hồ sơ đang nằm ở đâu, ai đang xử lý</li>
            <li>• Ghi nhận từng lần trình, từng lần trả và nguyên nhân lỗi</li>
            <li>• Mỗi cấp xác nhận đúng thẩm quyền, ghi thời điểm từng giai đoạn</li>
            <li>• Báo cáo, phân tích lỗi và hiệu suất xuất Excel/PDF</li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">Phụ trách liên quan · Quản lý phòng ban · Ban kiểm soát · Tổng Giám Đốc</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-700 text-white"><Building2 className="h-6 w-6" /></div>
            <p className="font-bold text-brand-700">QUẢN LÝ TRÌNH KÝ HỒ SƠ</p>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Đăng nhập</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Sử dụng tài khoản được quản trị viên cấp.</p>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
