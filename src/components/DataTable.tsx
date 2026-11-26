"use client";
// Bảng dữ liệu chuyên nghiệp: kéo đổi độ rộng cột, ẩn/hiện cột, cố định cột trái, sắp xếp phía server,
// lưu cấu hình hiển thị theo từng người dùng (vào CSDL).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  flexRender, getCoreRowModel, useReactTable, type ColumnDef, type ColumnPinningState, type ColumnSizingState, type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, Pin, PinOff, RotateCcw } from "lucide-react";
import { api } from "@/lib/client";
import { useMe } from "./AppShell";
import { Button, cx, Empty } from "./ui";

type Prefs = { visibility?: VisibilityState; sizing?: ColumnSizingState; pinning?: ColumnPinningState };

export function DataTable<T>({
  id, columns, data, sort, dir, onSort, loading, defaultHidden = [], defaultPinned = [], rowClass,
}: {
  id: string;
  columns: (ColumnDef<T, unknown> & { id: string; meta?: { sortKey?: string; label?: string } })[];
  data: T[];
  sort?: string;
  dir?: "asc" | "desc";
  onSort?: (key: string, dir: "asc" | "desc") => void;
  loading?: boolean;
  defaultHidden?: string[];
  defaultPinned?: string[];
  rowClass?: (row: T) => string | undefined;
}) {
  const me = useMe();
  const saved = (me.preferences?.[`table.${id}`] ?? {}) as Prefs;
  const [visibility, setVisibility] = useState<VisibilityState>(saved.visibility ?? Object.fromEntries(defaultHidden.map((k) => [k, false])));
  const [sizing, setSizing] = useState<ColumnSizingState>(saved.sizing ?? {});
  const [pinning, setPinning] = useState<ColumnPinningState>(saved.pinning ?? { left: defaultPinned });
  const [menu, setMenu] = useState(false);
  const first = useRef(true);

  // Lưu cấu hình (debounce)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      api("/api/me/preferences", { method: "PUT", json: { [`table.${id}`]: { visibility, sizing, pinning } } }).catch(() => {});
      me.preferences[`table.${id}`] = { visibility, sizing, pinning };
    }, 800);
    return () => clearTimeout(t);
  }, [visibility, sizing, pinning, id, me.preferences]);

  const table = useReactTable({
    data,
    columns,
    state: { columnVisibility: visibility, columnSizing: sizing, columnPinning: pinning },
    onColumnVisibilityChange: setVisibility,
    onColumnSizingChange: setSizing,
    onColumnPinningChange: setPinning,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    enableColumnPinning: true,
    defaultColumn: { size: 140, minSize: 60, maxSize: 600 },
  });

  const leftOffsets = useMemo(() => {
    const m: Record<string, number> = {};
    let acc = 0;
    for (const c of table.getLeftLeafColumns()) {
      m[c.id] = acc;
      acc += c.getSize();
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, sizing, pinning, visibility]);

  const reset = () => {
    setVisibility(Object.fromEntries(defaultHidden.map((k) => [k, false])));
    setSizing({});
    setPinning({ left: defaultPinned });
  };

  const sortIcon = (key?: string) => {
    if (!key || !onSort) return null;
    if (sort !== key) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  return (
    <div>
      <div className="relative flex justify-end px-3 py-2">
        <Button variant="secondary" size="sm" icon={<Columns3 className="h-4 w-4" />} onClick={() => setMenu((m) => !m)}>Cột hiển thị</Button>
        {menu && (
          <div className="absolute right-3 top-11 z-30 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl" onMouseLeave={() => setMenu(false)}>
            <p className="px-2 pb-1 text-xs text-slate-500">Bật/tắt cột · ghim cột bên trái · cấu hình được lưu tự động</p>
            <div className="scroll-thin max-h-80 overflow-y-auto">
              {table.getAllLeafColumns().map((c) => {
                const label = (c.columnDef.meta as { label?: string } | undefined)?.label ?? c.id;
                const pinned = c.getIsPinned();
                return (
                  <div key={c.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={c.getIsVisible()} onChange={c.getToggleVisibilityHandler()} disabled={!c.getCanHide()} />
                      {label}
                    </label>
                    <button className={cx("rounded p-1", pinned ? "text-brand-600" : "text-slate-300 hover:text-slate-600")} title={pinned ? "Bỏ ghim" : "Ghim bên trái"} onClick={() => c.pin(pinned ? false : "left")}>
                      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="mt-1 flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-50" onClick={reset}><RotateCcw className="h-3 w-3" /> Khôi phục mặc định</button>
          </div>
        )}
      </div>
      <div className={cx("scroll-thin relative overflow-x-auto", loading && "opacity-60")}>
        <table className="border-separate border-spacing-0" style={{ width: table.getTotalSize(), minWidth: "100%" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta as { sortKey?: string } | undefined;
                  const pinned = h.column.getIsPinned();
                  return (
                    <th
                      key={h.id}
                      className={cx("th group relative select-none", pinned && "sticky z-10 bg-slate-100")}
                      style={{ width: h.getSize(), left: pinned ? leftOffsets[h.column.id] : undefined }}
                    >
                      <button
                        className={cx("flex w-full items-center gap-1", meta?.sortKey && onSort ? "cursor-pointer hover:text-slate-900" : "cursor-default")}
                        onClick={() => meta?.sortKey && onSort?.(meta.sortKey, sort === meta.sortKey && dir === "desc" ? "asc" : "desc")}
                      >
                        <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                        {sortIcon(meta?.sortKey)}
                      </button>
                      <span
                        onMouseDown={h.getResizeHandler()}
                        onTouchStart={h.getResizeHandler()}
                        className={cx("absolute right-0 top-0 h-full w-1.5 cursor-col-resize opacity-0 group-hover:opacity-100", h.column.getIsResizing() ? "bg-brand-500 opacity-100" : "bg-slate-300")}
                      />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <tr key={r.id} className={cx("group hover:bg-blue-50/40", rowClass?.(r.original))}>
                {r.getVisibleCells().map((c) => {
                  const pinned = c.column.getIsPinned();
                  return (
                    <td
                      key={c.id}
                      className={cx("td truncate", pinned && "sticky z-[5] bg-white group-hover:bg-blue-50")}
                      style={{ width: c.column.getSize(), maxWidth: c.column.getSize(), left: pinned ? leftOffsets[c.column.id] : undefined }}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext()) as ReactNode}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.length && !loading && <Empty text="Không có hồ sơ phù hợp" />}
      </div>
    </div>
  );
}
