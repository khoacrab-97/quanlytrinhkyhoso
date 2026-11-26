"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ComposedChart,
} from "recharts";
import { Empty } from "./ui";

export const PALETTE = ["#2f6aa8", "#f59e0b", "#16a34a", "#ef4444", "#8b5cf6", "#14b8a6", "#64748b", "#ec4899", "#0ea5e9", "#84cc16"];
const axis = { fontSize: 11, fill: "#64748b" };
const tip = { contentStyle: { borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }, cursor: { fill: "#f1f5f9" } };

type Series = { key: string; label: string; color?: string; type?: "bar" | "line"; stack?: string; right?: boolean };

export function BarBox({ data, x, series, height = 260, horizontal, unit }: { data: Record<string, unknown>[]; x: string; series: Series[]; height?: number; horizontal?: boolean; unit?: string }) {
  if (!data?.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, left: horizontal ? 8 : -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={!horizontal} vertical={!!horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={axis} allowDecimals={false} unit={unit} />
            <YAxis type="category" dataKey={x} tick={axis} width={150} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={x} tick={axis} interval="preserveStartEnd" />
            <YAxis tick={axis} allowDecimals={false} unit={unit} />
          </>
        )}
        <Tooltip {...tip} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Bar isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} stackId={s.stack} radius={s.stack ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComboBox({ data, x, series, height = 260 }: { data: Record<string, unknown>[]; x: string; series: Series[]; height?: number }) {
  if (!data?.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={x} tick={axis} />
        <YAxis yAxisId="left" tick={axis} allowDecimals={false} />
        {series.some((s) => s.right) && <YAxis yAxisId="right" orientation="right" tick={axis} unit="%" domain={[0, 100]} />}
        <Tooltip {...tip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) =>
          s.type === "line" ? (
            <Line yAxisId={s.right ? "right" : "left"} isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={{ r: 3 }} type="monotone" />
          ) : (
            <Bar yAxisId={s.right ? "right" : "left"} isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? PALETTE[i]} radius={[4, 4, 0, 0]} maxBarSize={28} />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function LineBox({ data, x, series, height = 260, unit }: { data: Record<string, unknown>[]; x: string; series: Series[]; height?: number; unit?: string }) {
  if (!data?.length) return <Empty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey={x} tick={axis} />
        <YAxis tick={axis} unit={unit} />
        <Tooltip {...tip} />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {series.map((s, i) => (
          <Line isAnimationActive={false} key={s.key} dataKey={s.key} name={s.label} stroke={s.color ?? PALETTE[i]} strokeWidth={2} dot={{ r: 3 }} type="monotone" connectNulls />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PieBox({ data, height = 260, nameKey = "name", valueKey = "value" }: { data: Record<string, unknown>[]; height?: number; nameKey?: string; valueKey?: string }) {
  if (!data?.length) return <Empty />;
  const total = data.reduce((a, d) => a + Number(d[valueKey] ?? 0), 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie isAnimationActive={false} data={data} dataKey={valueKey} nameKey={nameKey} innerRadius="52%" outerRadius="80%" paddingAngle={1.5} stroke="#fff">
          {data.map((d, i) => <Cell key={i} fill={(d.color as string) ?? PALETTE[i % PALETTE.length]} />)}
        </Pie>
        <Tooltip {...tip} formatter={(v: number, n: string) => [`${v} (${total ? ((v / total) * 100).toFixed(1) : 0}%)`, n]} />
        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12, lineHeight: "20px" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
