"use client";
import Link from "next/link";
import { useState } from "react";
import { api, qs, useApi } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { Button, Card, cx, PageHeader, Spinner } from "@/components/ui";

type N = { id: string; title: string; message: string; link: string | null; read: boolean; createdAt: string; type: string };

export default function NotificationsPage() {
  const [unread, setUnread] = useState(false);
  const { data, mutate } = useApi<{ items: N[]; unread: number }>(`/api/notifications${qs({ take: 200, unread: unread ? 1 : undefined, sync: 0 })}`);
  const mark = async (body: unknown) => {
    await api("/api/notifications", { method: "PATCH", json: body });
    mutate();
  };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Thông báo"
        subtitle={`${data?.unread ?? 0} thông báo chưa đọc`}
        actions={<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unread} onChange={(e) => setUnread(e.target.checked)} /> Chỉ chưa đọc</label><Button variant="secondary" onClick={() => mark({ all: true })}>Đánh dấu đã đọc tất cả</Button></>}
      />
      <Card bodyClass="p-0">
        {!data ? <Spinner /> : !data.items.length ? <p className="py-10 text-center text-sm text-slate-400">Không có thông báo</p> : (
          <ul className="divide-y divide-slate-100">
            {data.items.map((n) => (
              <li key={n.id} className={cx("flex items-start gap-3 px-4 py-3", !n.read && "bg-blue-50/50")}>
                <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-slate-200" : "bg-blue-500")} />
                <div className="min-w-0 flex-1">
                  <p className={cx("text-sm font-medium", n.type.includes("overdue") || n.type === "RETURN" ? "text-red-700" : "text-slate-800")}>{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="text-xs text-slate-400">{fmtDateTime(n.createdAt)}</p>
                </div>
                {n.link && <Link href={n.link} onClick={() => !n.read && mark({ ids: [n.id] })} className="text-sm font-medium text-brand-600 hover:underline">Xem</Link>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
