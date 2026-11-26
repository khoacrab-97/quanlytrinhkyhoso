"use client";
// Hộp thoại thao tác trên hồ sơ: xác nhận giai đoạn, hủy, đổi trạng thái, ghi chú.
// (Ban kiểm soát trả về được ghi nhận khi Trình ký lại trên phiếu.)
// Thời điểm luôn ghi nhận theo giờ máy chủ lúc bấm xác nhận.
import { useEffect, useState } from "react";
import { api, useLookups } from "@/lib/client";
import { STAGES, stageIndex } from "@/lib/constants";
import { Button, cx, ErrorBox, Field, Modal, Select, useToast } from "./ui";

export const ACTION_META: Record<string, { label: string; variant: "primary" | "secondary" | "danger" | "success" | "warning"; desc: string }> = {
  advance: { label: "Xác nhận giai đoạn", variant: "primary", desc: "Chọn mốc hồ sơ đã đạt. Thời điểm được ghi nhận đúng lúc bạn bấm xác nhận." },
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
  const cur = stageIndex(doc.status.code);

  useEffect(() => {
    if (!action) return;
    setErr(null);
    setF({ stage: STAGES[cur + 1]?.code ?? "" });
  }, [action, doc, cur]);

  if (!action || !lk) return null;
  const meta = ACTION_META[action];
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      const n = (k: string) => f[k] || null;
      let body: Record<string, unknown> = { action, note: n("note") };
      if (action === "advance") body = { ...body, stage: f.stage };
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
    <Modal open onClose={onClose} title={meta.label} size="md" footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button variant={meta.variant} loading={busy} onClick={run}>{action === "advance" ? "Xác nhận" : meta.label}</Button></>}>
      {(doc.code || doc.title) && <p className="mb-2 text-sm font-medium text-slate-800">{doc.code} {doc.title && `· ${doc.title}`}</p>}
      <p className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">{meta.desc}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {action === "advance" && (
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-semibold text-slate-600">Hồ sơ đã tới giai đoạn</p>
            <div className="space-y-2">
              {STAGES.map((s, i) => {
                const done = i <= cur;
                return (
                  <label key={s.code} className={cx("flex items-center gap-3 rounded-lg border px-3 py-2 text-sm", done ? "border-emerald-200 bg-emerald-50 text-slate-500" : f.stage === s.code ? "border-brand-500 bg-brand-50" : "border-slate-200")}>
                    <input type="radio" name="stage" disabled={done} checked={f.stage === s.code} onChange={() => set("stage", s.code)} />
                    <span className="font-semibold">{s.done}</span>
                    {done && <span className="ml-auto text-xs text-emerald-700">đã qua</span>}
                  </label>
                );
              })}
            </div>
            {stageIndex(f.stage) - cur > 1 && <p className="mt-2 text-xs text-amber-700">Các giai đoạn bỏ qua ở giữa sẽ được ghi cùng thời điểm xác nhận này.</p>}
          </div>
        )}

        {action === "change_status" && (
          <Field label="Trạng thái mới" required><Select value={f.statusId ?? ""} onChange={(e) => set("statusId", e.target.value)} placeholder="— Chọn —" options={lk.statuses.map((s) => ({ value: s.id, label: s.name }))} /></Field>
        )}

        <Field label={action === "cancel" || action === "change_status" ? "Lý do" : action === "note" ? "Nội dung ghi chú" : "Ghi chú"} required={["cancel", "change_status", "note"].includes(action)} className="md:col-span-2">
          <textarea className="input" rows={2} value={f.note ?? ""} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3"><ErrorBox error={err} /></div>
    </Modal>
  );
}
