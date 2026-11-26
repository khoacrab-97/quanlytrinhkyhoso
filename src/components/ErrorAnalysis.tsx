"use client";
// Phần hiển thị phân tích lỗi - dùng chung cho trang Quản lý lỗi và Báo cáo 3.
import Link from "next/link";
import { BarBox, ComboBox, PieBox } from "./charts";
import { Formulas, SimpleTable } from "./SimpleTable";
import { Card, KpiCard } from "./ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ErrorData = any;

export function ErrorAnalysis({ data }: { data: ErrorData }) {
  const s = data.summary;
  const dimCols = (label: string) => [
    { key: "name", label },
    { key: "errors", label: "Số lỗi", format: "number" as const },
    { key: "returns", label: "Lần trả", format: "number" as const },
    { key: "docs", label: "Số HS", format: "number" as const },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Tổng số lần bị trả" value={s.totalReturns} tone="red" hint={data.formulas.returnsCount} />
        <KpiCard label="Số hồ sơ bị trả (≥1 lần)" value={s.returnedDocs} sub={`/ ${s.submittedDocs} hồ sơ đã trình`} tone="orange" />
        <KpiCard label="Tỷ lệ hồ sơ bị trả" value={`${s.returnRate}%`} tone="red" hint={data.formulas.returnRate} />
        <KpiCard label="Tổng số lỗi" value={s.totalErrors} sub={`${s.avgErrorsPerReturn} lỗi / lần trả`} tone="violet" hint={data.formulas.errorsCount} />
        <KpiCard label="Lỗi đã khắc phục" value={s.resolvedErrors} sub={`${s.fixedReturns} lần trả đã xử lý`} tone="green" />
        <KpiCard label="Lỗi chưa khắc phục" value={s.unresolvedErrors} tone="red" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Tỷ lệ theo nhóm lỗi"><PieBox data={data.byCategory} valueKey="errors" /></Card>
        <Card title="Top 10 lỗi phổ biến nhất">
          <BarBox data={data.topReasons} x="name" horizontal height={Math.max(240, data.topReasons.length * 30)} series={[{ key: "count", label: "Số lần", color: "#ef4444" }]} />
        </Card>
        <Card title="Diễn biến lỗi theo kỳ" subtitle="Số lần trả, số hồ sơ bị trả và số lỗi" className="xl:col-span-2">
          <ComboBox data={data.byPeriod} x="label" series={[
            { key: "returns", label: "Lần trả", color: "#ef4444" },
            { key: "docs", label: "Hồ sơ bị trả", color: "#f59e0b" },
            { key: "errors", label: "Số lỗi", type: "line", color: "#8b5cf6" },
            { key: "fixed", label: "Đã khắc phục", type: "line", color: "#16a34a" },
          ]} />
        </Card>
        <Card title="Thống kê theo nhóm lỗi" bodyClass="p-0">
          <SimpleTable cols={[{ key: "name", label: "Nhóm lỗi" }, { key: "errors", label: "Số lỗi", format: "number" }, { key: "pct", label: "Tỷ lệ", format: "pct" }, { key: "returns", label: "Lần trả", format: "number" }, { key: "docs", label: "Số HS", format: "number" }, { key: "unresolved", label: "Chưa sửa", format: "number" }]} rows={data.byCategory} />
        </Card>
        <Card title="Top 10 lỗi" bodyClass="p-0">
          <SimpleTable cols={[{ key: "name", label: "Lỗi" }, { key: "category", label: "Nhóm" }, { key: "count", label: "Tần suất", format: "number" }, { key: "pct", label: "Tỷ lệ", format: "pct" }]} rows={data.topReasons} highlightFirst />
        </Card>
        <Card title="Theo người lập hồ sơ" subtitle="Tham khảo — xem thêm cột 'theo người chịu trách nhiệm'" bodyClass="p-0"><SimpleTable cols={dimCols("Người lập")} rows={data.byPreparer} maxH={320} /></Card>
        <Card title="Theo người chịu trách nhiệm (chỉ lỗi có tính trách nhiệm)" bodyClass="p-0"><SimpleTable cols={dimCols("Người chịu trách nhiệm")} rows={data.byResponsible} maxH={320} /></Card>
        <Card title="Theo bộ phận" bodyClass="p-0"><SimpleTable cols={dimCols("Bộ phận")} rows={data.byDepartment} maxH={320} /></Card>
        <Card title="Theo công trình" bodyClass="p-0"><SimpleTable cols={dimCols("Công trình")} rows={data.byProject} maxH={320} /></Card>
        <Card title="Lỗi tái diễn trên cùng hồ sơ" subtitle="Cùng một lỗi lặp lại ở nhiều lần trả của một hồ sơ" bodyClass="p-0">
          <SimpleTable
            cols={[{ key: "code", label: "Mã HS", render: (r) => <Link className="font-semibold text-brand-600 hover:underline" href={`/documents/${r.docId}`}>{String(r.code)}</Link> }, { key: "reason", label: "Lỗi" }, { key: "times", label: "Số lần", format: "number" }, { key: "preparer", label: "Người lập" }]}
            rows={data.recurringOnDoc}
            maxH={320}
          />
        </Card>
        <Card title="Lỗi lặp lại theo người lập (≥3 lần)" subtitle="Gợi ý nhu cầu đào tạo / chuẩn hóa biểu mẫu" bodyClass="p-0">
          <SimpleTable cols={[{ key: "person", label: "Người lập" }, { key: "reason", label: "Lỗi" }, { key: "category", label: "Nhóm" }, { key: "times", label: "Số lần", format: "number" }, { key: "docs", label: "Số HS", format: "number" }]} rows={data.recurringByPerson} maxH={320} />
        </Card>
      </div>
      <Formulas items={[data.formulas.returnsCount, data.formulas.errorsCount, data.formulas.returnRate, data.formulas.staffReturns]} />
    </>
  );
}
