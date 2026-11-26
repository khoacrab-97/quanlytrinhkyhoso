"use client";
import type { ReactNode } from "react";
import { fmtDate } from "@/lib/dates";
import { cx, Empty } from "./ui";

export type SCol = { key: string; label: string; format?: "number" | "pct" | "days" | "date" | "text"; render?: (row: Record<string, unknown>) => ReactNode; className?: string };

function fmt(v: unknown, f?: SCol["format"]) {
  if (v === null || v === undefined || v === "") return <span className="text-slate-300">—</span>;
  if (f === "pct") return `${v}%`;
  if (f === "days") return `${v}`;
  if (f === "date") return fmtDate(v as string);
  if (f === "number" && typeof v === "number") return v.toLocaleString("vi-VN");
  return String(v);
}

/** Bảng số liệu gọn cho báo cáo / phân tích */
export function SimpleTable({ cols, rows, footer, maxH, highlightFirst }: { cols: SCol[]; rows: Record<string, unknown>[]; footer?: Record<string, unknown>; maxH?: number; highlightFirst?: boolean }) {
  if (!rows?.length) return <Empty />;
  return (
    <div className="scroll-thin overflow-auto" style={maxH ? { maxHeight: maxH } : undefined}>
      <table className="w-full">
        <thead className="sticky top-0">
          <tr>{cols.map((c) => <th key={c.key} className={cx("th", ["number", "pct", "days"].includes(c.format ?? "") && "text-right")}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cx("hover:bg-slate-50", highlightFirst && i === 0 && "bg-amber-50/50")}>
              {cols.map((c) => (
                <td key={c.key} className={cx("td", ["number", "pct", "days"].includes(c.format ?? "") && "text-right tabular-nums", c.className)}>
                  {c.render ? c.render(r) : fmt(r[c.key], c.format)}
                </td>
              ))}
            </tr>
          ))}
          {footer && (
            <tr className="bg-slate-100 font-semibold">
              {cols.map((c) => <td key={c.key} className={cx("td", ["number", "pct", "days"].includes(c.format ?? "") && "text-right tabular-nums")}>{fmt(footer[c.key], c.format)}</td>)}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Formulas({ items }: { items: string[] }) {
  return (
    <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600">
      <summary className="cursor-pointer font-medium text-slate-700">Công thức tính & lưu ý</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
    </details>
  );
}
