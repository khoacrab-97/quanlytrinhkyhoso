"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Printer, Save } from "lucide-react";
import { api, useLookups } from "@/lib/client";
import { toInputDate } from "@/lib/dates";
import { Button, Card, ErrorBox, Field, Select, Spinner, useToast } from "./ui";

export type DocFormValue = {
  docNumber: string; title: string; typeId: string; projectId: string; contractorId: string; departmentId: string; preparerId: string;
  submitterId: string; recipientId: string; preparedDate: string; priority: number; notes: string; customFields: Record<string, unknown>;
};

export function DocumentForm({ initial, id }: { initial?: Partial<DocFormValue>; id?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data: lk, isLoading } = useLookups();
  const [v, setV] = useState<DocFormValue>({
    docNumber: "", title: "", typeId: "", projectId: "", contractorId: "", departmentId: "", preparerId: "", submitterId: "", recipientId: "",
    preparedDate: toInputDate(new Date()), priority: 2, notes: "", customFields: {}, ...initial,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Mặc định người lập = người đang đăng nhập (khi tạo mới)
  useEffect(() => {
    if (!lk || id || v.preparerId) return;
    const me = lk.users.find((u) => u.id === lk.me.id);
    setV((x) => ({ ...x, preparerId: lk.me.id, departmentId: x.departmentId || me?.departmentId || "" }));
  }, [lk, id, v.preparerId]);

  if (isLoading || !lk) return <Spinner />;
  const set = <K extends keyof DocFormValue>(k: K, val: DocFormValue[K]) => setV((x) => ({ ...x, [k]: val }));
  const project = lk.projects.find((p) => p.id === v.projectId);
  // Dự án có gắn đối tác thì chỉ chọn trong danh sách đối tác của dự án
  const partners = project?.partnerIds.length ? lk.contractors.filter((c) => project.partnerIds.includes(c.id)) : lk.contractors;

  const submit = async (mode: "draft" | "form") => {
    setBusy(mode);
    setError(null);
    try {
      const body = {
        ...v,
        contractorId: v.contractorId || null, submitterId: v.submitterId || null, recipientId: v.recipientId || null,
        docNumber: v.docNumber || null, notes: v.notes || null,
      };
      const r = id
        ? await api<{ id: string }>(`/api/documents/${id}`, { method: "PATCH", json: body })
        : await api<{ id: string; code: string }>("/api/documents", { method: "POST", json: body });
      toast("success", id ? "Đã lưu thay đổi" : `Đã tạo hồ sơ ${"code" in r ? r.code : ""}`);
      router.push(mode === "form" ? `/forms/new?documentId=${r.id}` : `/documents/${r.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const users = lk.users.map((u) => ({ value: u.id, label: `${u.fullName}${u.position ? ` — ${u.position}` : ""}` }));

  return (
    <div className="space-y-4">
      <Card title="Thông tin hồ sơ">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Tên hồ sơ" required className="md:col-span-2 xl:col-span-3">
            <input className="input" value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="VD: Hồ sơ nghiệm thu cốt thép sàn tầng 5" />
          </Field>
          <Field label="Số hồ sơ / số hiệu văn bản"><input className="input" value={v.docNumber} onChange={(e) => set("docNumber", e.target.value)} /></Field>
          <Field label="Loại hồ sơ" required>
            <Select value={v.typeId} onChange={(e) => set("typeId", e.target.value)} placeholder="— Chọn loại hồ sơ —" options={lk.types.map((t) => ({ value: t.id, label: t.name }))} />
          </Field>
          <Field label="Công trình / dự án" required>
            <Select value={v.projectId} onChange={(e) => setV((x) => ({ ...x, projectId: e.target.value, contractorId: "" }))} placeholder="— Chọn công trình —" options={lk.projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} />
          </Field>
          <Field label="Chủ đầu tư / NCC / thầu phụ" hint={project?.investor ? `CĐT: ${project.investor}` : undefined}>
            <Select value={v.contractorId} onChange={(e) => set("contractorId", e.target.value)} placeholder="— Không —" options={partners.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
          <Field label="Mức ưu tiên">
            <Select value={String(v.priority)} onChange={(e) => set("priority", Number(e.target.value))} options={[{ value: "1", label: "Gấp" }, { value: "2", label: "Bình thường" }, { value: "3", label: "Thấp" }]} />
          </Field>
        </div>
      </Card>

      <Card title="Phòng ban & người lập">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Phòng ban trình ký" required hint="Mặc định theo phòng ban của người lập">
            <Select value={v.departmentId} onChange={(e) => set("departmentId", e.target.value)} placeholder="— Chọn bộ phận —" options={lk.departments.map((d) => ({ value: d.id, label: d.name }))} />
          </Field>
          <Field label="Người lập (chịu trách nhiệm)" required><Select value={v.preparerId} onChange={(e) => set("preparerId", e.target.value)} placeholder="— Chọn —" options={users} /></Field>
          <Field label="Người trình ký" hint="Bỏ trống: người thực hiện thao tác trình ký"><Select value={v.submitterId} onChange={(e) => set("submitterId", e.target.value)} placeholder="— Chưa xác định —" options={users} /></Field>
          <Field label="Ngày lập" required><input type="date" className="input" value={v.preparedDate} onChange={(e) => set("preparedDate", e.target.value)} /></Field>
        </div>
      </Card>

      {!!lk.customFields.length && (
        <Card title="Thông tin mở rộng" subtitle="Các trường do quản trị viên cấu hình">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lk.customFields.map((f) => {
              const val = v.customFields[f.key];
              const setC = (x: unknown) => set("customFields", { ...v.customFields, [f.key]: x });
              return (
                <Field key={f.id} label={f.label} required={f.required}>
                  {f.type === "SELECT" ? (
                    <Select value={String(val ?? "")} onChange={(e) => setC(e.target.value)} placeholder="— Chọn —" options={f.options.map((o) => ({ value: o, label: o }))} />
                  ) : f.type === "BOOLEAN" ? (
                    <input type="checkbox" className="h-4 w-4" checked={!!val} onChange={(e) => setC(e.target.checked)} />
                  ) : (
                    <input
                      type={f.type === "NUMBER" ? "number" : f.type === "DATE" ? "date" : "text"}
                      className="input"
                      value={String(val ?? "")}
                      onChange={(e) => setC(f.type === "NUMBER" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
                    />
                  )}
                </Field>
              );
            })}
          </div>
        </Card>
      )}

      <Card title="Ghi chú">
        <textarea className="input" rows={3} value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Nội dung bổ sung, lưu ý khi trình ký..." />
      </Card>

      <ErrorBox error={error} />
      <div className="sticky bottom-0 -mx-3 flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button variant="secondary" onClick={() => router.back()}>Hủy</Button>
        {id ? (
          <Button loading={busy === "draft"} icon={<Save className="h-4 w-4" />} onClick={() => submit("draft")}>Lưu thay đổi</Button>
        ) : (
          <>
            <Button variant="secondary" loading={busy === "draft"} icon={<Save className="h-4 w-4" />} onClick={() => submit("draft")}>Lưu hồ sơ</Button>
            <Button loading={busy === "form"} icon={<Printer className="h-4 w-4" />} onClick={() => submit("form")}>Lưu & lập phiếu trình ký</Button>
          </>
        )}
      </div>
    </div>
  );
}
