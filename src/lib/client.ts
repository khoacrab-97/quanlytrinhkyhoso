"use client";
// Tiện ích gọi API phía trình duyệt.
import useSWR, { type SWRConfiguration } from "swr";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "Content-Type": "application/json", ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (res.status === 401 && typeof window !== "undefined" && !url.includes("/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const data = res.headers.get("content-type")?.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `Lỗi ${res.status}`, data?.details);
  return data as T;
}

export function useApi<T>(url: string | null, opts?: SWRConfiguration) {
  return useSWR<T>(url, (u: string) => api<T>(u), { revalidateOnFocus: false, keepPreviousData: true, ...opts });
}

/** Tạo query string, bỏ các giá trị rỗng */
export function qs(params: Record<string, unknown>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Tải file từ API (giữ cookie phiên, báo lỗi rõ ràng) */
export async function download(url: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data?.error ?? "Không tải được file");
  }
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const m = cd.match(/filename\*=UTF-8''([^;]+)/) ?? cd.match(/filename="?([^";]+)"?/);
  const name = m ? decodeURIComponent(m[1]) : "download";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export type Lookups = {
  projects: { id: string; code: string; name: string; investor: string | null; investorId: string | null; partnerIds: string[] }[];
  types: { id: string; code: string; name: string }[];
  departments: { id: string; code: string; name: string; divisions: { id: string; name: string }[] }[];
  users: { id: string; fullName: string; departmentId: string | null; divisionId: string | null; position: string | null; role: string; isRelatedPerson: boolean; isDeptManager: boolean }[];
  contractors: { id: string; code: string; name: string; kind: "INVESTOR" | "SUPPLIER" | "SUBCONTRACTOR" }[];
  statuses: { id: string; code: string; name: string; color: string; category: string }[];
  errorCategories: { id: string; code: string; name: string; attributable: boolean; reasons: { id: string; name: string }[] }[];
  customFields: { id: string; key: string; label: string; type: string; options: string[]; required: boolean }[];
  me: { id: string; role: string };
};

export function useLookups() {
  return useApi<Lookups>("/api/lookups", { revalidateOnMount: true, dedupingInterval: 60_000 });
}
