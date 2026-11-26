"use client";
import Link from "next/link";
import { useState } from "react";
import { qs, useApi } from "@/lib/client";
import { useRange } from "@/components/AppShell";
import { ErrorAnalysis, type ErrorData } from "@/components/ErrorAnalysis";
import { FilterBar, type AnalyticsFilters } from "@/components/FilterBar";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";

export default function ErrorsPage() {
  const { range } = useRange();
  const [f, setF] = useState<AnalyticsFilters>({ period: "month" });
  const { data, error, isLoading } = useApi<ErrorData>(`/api/errors${qs({ from: range.from, to: range.to, ...f })}`);
  return (
    <div>
      <PageHeader
        title="Quản lý & phân tích lỗi hồ sơ"
        subtitle="Thời gian lọc theo ngày bị trả. Phân biệt rõ số hồ sơ bị trả và tổng số lần trả; một lần trả có thể có nhiều lỗi."
        actions={<Link href="/catalogs?tab=errorReasons" className="text-sm font-medium text-brand-600 hover:underline">Danh mục nhóm lỗi / nguyên nhân →</Link>}
      />
      <FilterBar value={f} onChange={setF} show={["projectId", "departmentId", "personId", "typeId", "period", "sample"]} />
      <ErrorBox error={error} />
      {isLoading && !data ? <Spinner /> : data && <ErrorAnalysis data={data} />}
    </div>
  );
}
