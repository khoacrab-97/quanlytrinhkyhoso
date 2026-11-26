"use client";
import { useState } from "react";
import { FileSpreadsheet, FileText, Printer } from "lucide-react";
import { download, qs, useApi } from "@/lib/client";
import { fmtDate } from "@/lib/dates";
import { useCan, useRange } from "@/components/AppShell";
import { BarBox, ComboBox } from "@/components/charts";
import { ErrorAnalysis } from "@/components/ErrorAnalysis";
import { FilterBar, type AnalyticsFilters } from "@/components/FilterBar";
import { Formulas, SimpleTable } from "@/components/SimpleTable";
import { Button, Card, ErrorBox, KpiCard, PageHeader, Spinner, Tabs, useToast } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
type ReportType = "summary" | "time" | "errors" | "staff";

function Summary({ d }: { d: Any }) {
  const k = d.kpis;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <KpiCard label="Tổng hồ sơ" value={k.total} tone="blue" />
        <KpiCard label="Số lần in nộp" value={k.submissions} sub={`gồm ${k.resubmissions} lần in ký lại`} tone="violet" hint={d.formulas.submissions} />
        <KpiCard label="TGĐ đã ký" value={k.completed} tone="green" />
        <KpiCard label="Hồ sơ bị BKS trả" value={k.returnedDocs} sub={`${k.totalReturns} lần trả`} tone="red" />
        <KpiCard label="Tỷ lệ TGĐ đã ký" value={`${k.completionRate}%`} tone="teal" hint={d.formulas.completionRate} />
      </div>
      <Card className="mt-4" title="Biểu đồ tổng hợp theo kỳ">
        <ComboBox data={d.rows} x="period" series={[
          { key: "total", label: "Tổng HS", color: "#2f6aa8" }, { key: "completed", label: "TGĐ đã ký", color: "#16a34a" },
          { key: "returnedDocs", label: "HS bị BKS trả", color: "#ef4444" }, { key: "completionRate", label: "Tỷ lệ TGĐ đã ký (%)", type: "line", color: "#f59e0b", right: true },
        ]} />
      </Card>
      <Card className="mt-4" title="Bảng tổng hợp theo kỳ (theo ngày lập)" bodyClass="p-0">
        <SimpleTable
          cols={[
            { key: "period", label: "Kỳ" }, { key: "total", label: "Tổng HS", format: "number" }, { key: "submitted", label: "Đã in nộp", format: "number" },
            { key: "submissions", label: "Lần in nộp", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" },
            { key: "notCompleted", label: "Chưa xong", format: "number" }, { key: "cancelled", label: "Hủy", format: "number" },
            { key: "returnedDocs", label: "HS bị BKS trả", format: "number" }, { key: "totalReturns", label: "Lần BKS trả", format: "number" },
            { key: "completionRate", label: "Tỷ lệ TGĐ ký", format: "pct" }, { key: "returnRate", label: "Tỷ lệ bị trả", format: "pct" },
          ]}
          rows={d.rows}
          footer={d.totals}
        />
      </Card>
      <Card className="mt-4" title="Tổng hợp theo công trình" bodyClass="p-0">
        <SimpleTable cols={[{ key: "name", label: "Công trình" }, { key: "total", label: "Tổng", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" }, { key: "notCompleted", label: "Chưa xong", format: "number" }, { key: "returnedDocs", label: "HS bị BKS trả", format: "number" }, { key: "totalReturns", label: "Lần BKS trả", format: "number" }, { key: "completionRate", label: "Tỷ lệ TGĐ ký", format: "pct" }]} rows={d.byProject} />
      </Card>
      <Card className="mt-4" title="Tổng hợp theo phòng ban trình ký" bodyClass="p-0">
        <SimpleTable cols={[{ key: "name", label: "Phòng ban" }, { key: "total", label: "Tổng HS", format: "number" }, { key: "pending", label: "Đang soạn", format: "number" }, { key: "inReview", label: "Đang trình", format: "number" }, { key: "returnedNow", label: "Chờ in ký lại", format: "number" }, { key: "completed", label: "TGĐ đã ký", format: "number" }, { key: "submissions", label: "Lần in nộp", format: "number" }, { key: "totalReturns", label: "Lần BKS trả", format: "number" }, { key: "returnRate", label: "Tỷ lệ bị trả", format: "pct" }]} rows={d.byDepartment} />
      </Card>
      <Formulas items={[d.formulas.completionRate, d.formulas.returnRate, d.formulas.completed, d.formulas.submissions]} />
    </>
  );
}

function Time({ d }: { d: Any }) {
  const statCols = [
    { key: "count", label: "Số HS", format: "number" as const }, { key: "approvedCount", label: "TGĐ đã ký", format: "number" as const },
    { key: "avgDays", label: "TB (ngày)", format: "days" as const }, { key: "minDays", label: "Min", format: "days" as const }, { key: "maxDays", label: "Max", format: "days" as const },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <KpiCard label="Nộp lần đầu → TGĐ ký (TB)" value={d.overall.avgDays !== null ? `${d.overall.avgDays} ngày` : "—"} tone="violet" hint={d.formulas.processingDays} />
        <KpiCard label="Nhanh nhất / chậm nhất" value={`${d.overall.minDays ?? "—"} / ${d.overall.maxDays ?? "—"}`} sub="ngày" tone="blue" />
        <KpiCard label="Hồ sơ TGĐ đã ký" value={d.overall.approvedCount} sub={`trên ${d.overall.count} hồ sơ`} tone="green" />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Thời gian ở từng giai đoạn (ngày)" subtitle="Từ mốc xác nhận giai đoạn đến mốc giai đoạn kế tiếp">
          <BarBox data={d.byStage} x="stage" horizontal height={200} series={[{ key: "avgDays", label: "Ngày TB", color: "#8b5cf6" }, { key: "maxDays", label: "Lâu nhất", color: "#cbd5e1" }]} />
        </Card>
        <Card title="Nộp → TGĐ ký theo phòng ban (ngày)">
          <BarBox data={d.byDepartment} x="name" horizontal height={Math.max(200, d.byDepartment.length * 34)} series={[{ key: "avgDays", label: "Ngày TB", color: "#14b8a6" }]} />
        </Card>
        <Card title="Theo giai đoạn" bodyClass="p-0" className="xl:col-span-2">
          <SimpleTable cols={[{ key: "stage", label: "Giai đoạn" }, { key: "next", label: "Đến giai đoạn" }, { key: "count", label: "Lượt", format: "number" }, { key: "avgDays", label: "TB (ngày)", format: "days" }, { key: "maxDays", label: "Lâu nhất", format: "days" }]} rows={d.byStage} />
        </Card>
        <Card title="Theo loại hồ sơ" bodyClass="p-0"><SimpleTable cols={[{ key: "name", label: "Loại hồ sơ" }, ...statCols]} rows={d.byType} /></Card>
        <Card title="Theo phòng ban trình ký" bodyClass="p-0"><SimpleTable cols={[{ key: "name", label: "Phòng ban" }, ...statCols]} rows={d.byDepartment} /></Card>
      </div>
      <Formulas items={[d.formulas.processingDays, d.formulas.stageDays]} />
    </>
  );
}

function Staff({ d }: { d: Any }) {
  return (
    <>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <b>Lưu ý khi đánh giá:</b> Chỉ số lỗi chỉ tính các lỗi thuộc nhóm có tính trách nhiệm và được gán cho đúng người chịu trách nhiệm xử lý; các lần trả do nguyên nhân khách quan (thay đổi yêu cầu của CĐT…) được tách riêng.
        Cần xem xét cùng độ phức tạp của loại hồ sơ và khối lượng công việc, không đánh giá chỉ dựa trên số lần bị trả.
      </div>
      <Card title="Khối lượng & chất lượng hồ sơ theo nhân sự">
        <BarBox data={d.rows.slice(0, 15)} x="name" horizontal height={Math.max(260, Math.min(15, d.rows.length) * 34)} series={[{ key: "prepared", label: "HS đã lập", color: "#2f6aa8" }, { key: "processed", label: "HS đã xử lý", color: "#14b8a6" }, { key: "responsibleReturns", label: "Lần trả có trách nhiệm", color: "#ef4444" }]} />
      </Card>
      <Card className="mt-4" title="Bảng hiệu suất nhân sự" bodyClass="p-0">
        <SimpleTable
          cols={[
            { key: "name", label: "Nhân sự" }, { key: "department", label: "Bộ phận" }, { key: "prepared", label: "Đã lập", format: "number" },
            { key: "submitted", label: "Đã trình", format: "number" }, { key: "completed", label: "Hoàn thành", format: "number" }, { key: "processed", label: "Đã xử lý", format: "number" },
            { key: "returnRate", label: "% HS bị trả", format: "pct" }, { key: "responsibleReturns", label: "Trả có TN", format: "number" },
            { key: "attributableErrors", label: "Lỗi có TN", format: "number" }, { key: "objectiveReturns", label: "Trả khách quan", format: "number" },
            { key: "avgPrepDays", label: "Lập→trình (ngày)", format: "days" }, { key: "avgFixDays", label: "Sửa TB (ngày)", format: "days" },
          ]}
          rows={d.rows}
        />
      </Card>
      <Formulas items={[d.formulas.staffReturnRate, d.formulas.staffReturns, d.formulas.processed, d.formulas.revisionDays]} />
    </>
  );
}

export default function ReportsPage() {
  const can = useCan();
  const toast = useToast();
  const { range } = useRange();
  const [tab, setTab] = useState<ReportType>("summary");
  const [f, setF] = useState<AnalyticsFilters>({ period: "month" });
  const query = qs({ from: range.from, to: range.to, ...f });
  const { data, error, isLoading } = useApi<Any>(`/api/reports/${tab}${query}`);
  const [busy, setBusy] = useState<string | null>(null);
  const exp = async (format: "xlsx" | "pdf") => {
    setBusy(format);
    try {
      await download(`/api/reports/${tab}${qs({ from: range.from, to: range.to, ...f, format })}`);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const tabs = [
    { value: "summary" as const, label: "1. Tổng hợp hồ sơ" },
    { value: "time" as const, label: "2. Thời gian theo giai đoạn" },
    { value: "errors" as const, label: "3. Phân tích lỗi" },
    ...(can("report.staff") ? [{ value: "staff" as const, label: "4. Hiệu suất nhân sự" }] : []),
  ];
  return (
    <div>
      <PageHeader
        title="Báo cáo & phân tích"
        subtitle={`Khoảng thời gian: ${range.from ? `${fmtDate(range.from)} – ${fmtDate(range.to)}` : "toàn bộ"} (đổi ở thanh trên cùng)`}
        actions={
          <>
            <Button variant="secondary" loading={busy === "xlsx"} icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => exp("xlsx")}>Xuất Excel</Button>
            <Button variant="secondary" loading={busy === "pdf"} icon={<FileText className="h-4 w-4" />} onClick={() => exp("pdf")}>Xuất PDF</Button>
            <Button variant="ghost" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>In</Button>
          </>
        }
      />
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <FilterBar value={f} onChange={setF} show={["projectId", "departmentId", "personId", "typeId", "period", "sample"]} />
      <ErrorBox error={error} />
      {isLoading && !data ? <Spinner /> : data && (
        <>
          {tab === "summary" && data.rows && <Summary d={data} />}
          {tab === "time" && data.overall && <Time d={data} />}
          {tab === "errors" && data.summary && <ErrorAnalysis data={data} />}
          {tab === "staff" && data.rows && data.rows[0]?.prepared !== undefined && <Staff d={data} />}
          {tab === "staff" && data.rows && !data.rows.length && <Staff d={data} />}
        </>
      )}
    </div>
  );
}
