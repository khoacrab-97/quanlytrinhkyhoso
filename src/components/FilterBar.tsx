"use client";
import { RotateCcw } from "lucide-react";
import { useLookups } from "@/lib/client";
import { Button, Select } from "./ui";

export type AnalyticsFilters = {
  projectId?: string;
  departmentId?: string;
  personId?: string;
  typeId?: string;
  statusId?: string;
  sample?: string;
  period?: string;
};

/** Bộ lọc phân tích dùng chung cho Dashboard / Báo cáo / Phân tích lỗi */
export function FilterBar({ value, onChange, show = ["projectId", "departmentId", "personId", "typeId", "statusId", "sample"] }: { value: AnalyticsFilters; onChange: (v: AnalyticsFilters) => void; show?: (keyof AnalyticsFilters)[] }) {
  const { data: lk } = useLookups();
  const set = (k: keyof AnalyticsFilters, v: string) => onChange({ ...value, [k]: v || undefined });
  const has = (k: keyof AnalyticsFilters) => show.includes(k);
  return (
    <div className="card mb-4 grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-7">
      {has("projectId") && <Select value={value.projectId ?? ""} onChange={(e) => set("projectId", e.target.value)} placeholder="Tất cả công trình" options={(lk?.projects ?? []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} />}
      {has("departmentId") && <Select value={value.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value)} placeholder="Tất cả bộ phận" options={(lk?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))} />}
      {has("personId") && <Select value={value.personId ?? ""} onChange={(e) => set("personId", e.target.value)} placeholder="Tất cả người phụ trách" options={(lk?.users ?? []).map((u) => ({ value: u.id, label: u.fullName }))} />}
      {has("typeId") && <Select value={value.typeId ?? ""} onChange={(e) => set("typeId", e.target.value)} placeholder="Tất cả loại hồ sơ" options={(lk?.types ?? []).map((t) => ({ value: t.id, label: t.name }))} />}
      {has("statusId") && <Select value={value.statusId ?? ""} onChange={(e) => set("statusId", e.target.value)} placeholder="Tất cả trạng thái" options={(lk?.statuses ?? []).map((s) => ({ value: s.id, label: s.name }))} />}
      {has("period") && (
        <Select value={value.period ?? "month"} onChange={(e) => set("period", e.target.value)} options={[{ value: "day", label: "Theo ngày" }, { value: "month", label: "Theo tháng" }, { value: "quarter", label: "Theo quý" }, { value: "year", label: "Theo năm" }]} />
      )}
      {has("sample") && (
        <Select value={value.sample ?? ""} onChange={(e) => set("sample", e.target.value)} placeholder="Mẫu + chính thức" options={[{ value: "exclude", label: "Chỉ dữ liệu chính thức" }, { value: "only", label: "Chỉ dữ liệu mẫu" }]} />
      )}
      <Button variant="ghost" onClick={() => onChange({ period: value.period })} icon={<RotateCcw className="h-4 w-4" />}>Xóa lọc</Button>
    </div>
  );
}
