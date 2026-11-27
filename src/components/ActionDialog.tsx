"use client";
// Hộp thoại thao tác trên hồ sơ: xác nhận giai đoạn (người có thẩm quyền), Ban kiểm soát trả về, hủy, đổi trạng thái, ghi chú.
// Thời điểm luôn ghi nhận theo giờ máy chủ lúc bấm xác nhận.
import { useEffect, useState } from "react";
import { api, useLookups } from "@/lib/client";
import { STAGE_CONFIRM_LABEL, STAGES, stageIndex } from "@/lib/constants";
import { Button, ErrorBox, Field, Modal, Select, useToast } from "./ui";

export const ACTION_META: Record<string, { label: string; variant: "primary" | "secondary" | "danger" | "success" | "warning"; desc: string }> = {
  advance: { label: "Xác nhận giai đoạn", variant: "primary", desc: "Xác nhận hồ sơ đã qua giai đoạn thuộc thẩm quyền của bạn. Thời điểm được ghi nhận đúng lúc bạn bấm xác nhận." },
  return: { label: "Trả về", variant: "danger", desc: "Ban kiểm soát trả hồ sơ: chọn nhóm lỗi và nhập nội dung lỗi. Người lập sẽ sửa, Trình ký lại và in ký lại; hồ sơ quay về giai đoạn đầu." },
  cancel: { label: "Hủy hồ sơ", variant: "danger", desc: "Hủy hồ sơ. Lịch sử vẫn được giữ nguyên." },
  change_status: { label: "Đổi trạng thái", variant: "secondary", desc: "Đổi trạng thái ngoài luồng chuẩn (chỉ Quản lý/Quản trị). Bắt buộc ghi lý do." },
  note: { label: "Thêm ghi chú", variant: "secondary", desc: "Ghi chú vào lịch sử của hồ sơ." },
};

export type ActionDoc = { id: string; code?: string; title?: string; status: { code: string; name?: string } };

export function ActionDialog({ action, doc, onClose, onDone }: { action: string | null; doc: ActionDoc; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data: lk } = useLookups();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next = STAGES[stageIndex(doc.status.code) + 1];

  useEffect(() => {
    if (!action) return;
    setErr(null);
    setF({});
  }, [action, doc]);

  if (!action || !lk) return null;
  const meta = ACTION_META[action];
  const title = action === "advance" ? STAGE_CONFIRM_LABEL[doc.status.code] ?? meta.label : meta.label;
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const n = (k: string) => f[k] || null;
      let body: Record<string, unknown> = { action, note: n("note") };
      if (action === "advance") body = { ...body, stage: next?.code };
      if (action === "return") {
        if (!f.categoryId) throw new Error("Chọn nhóm lỗi");
        if (!f.note?.trim()) throw new Error("Nhập nội dung lỗi");
        body = { action, requirement: f.note.trim(), errors: [{ categoryId: f.categoryId, customReason: f.note.trim() }] };
      }
      if (action === "change_status") body = { ...body, statusId: f.statusId };
      const r = await api<{ summary: string }>(`/api/documents/${doc.id}/actions`, { method: "POST", json: body });
      toast("success", r.summary || "Đã cập nhật");
      onDone();
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={title} size="md" footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button variant={meta.variant} loading={busy} onClick={run}>{action === "advance" ? title : meta.label}</Button></>}>
      {(doc.code || doc.title) && <p className="mb-2 text-sm font-medium text-slate-800">{doc.code} {doc.title && `· ${doc.title}`}</p>}
      <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{meta.desc}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {action === "advance" && next && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm md:col-span-2">
            Ghi nhận: <b>{next.done}</b>
          </p>
        )}

        {action === "return" && (
          <Field label="Nhóm lỗi" required className="md:col-span-2">
            <Select value={f.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value)} placeholder="— Chọn nhóm lỗi —" options={lk.errorCategories.map((c) => ({ value: c.id, label: c.name }))} />
          </Field>
        )}

        {action === "change_status" && (
          <Field label="Trạng thái mới" required><Select value={f.statusId ?? ""} onChange={(e) => set("statusId", e.target.value)} placeholder="— Chọn —" options={lk.statuses.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        )}

        <Field
          label={action === "return" ? "Nội dung lỗi / yêu cầu sửa" : action === "cancel" || action === "change_status" ? "Lý do" : action === "note" ? "Nội dung ghi chú" : "Ghi chú"}
          required={["return", "cancel", "change_status", "note"].includes(action)}
          className="md:col-span-2"
        >
          <textarea className="input" rows={action === "return" ? 3 : 2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3"><ErrorBox error={err} /></div>
    </Modal>
  );
}
