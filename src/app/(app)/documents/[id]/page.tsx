"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft, CheckCircle2, CircleDot, Clock, Copy, Download, Eye, FileUp, MapPin, Paperclip, Pencil, Printer, Send, Trash2, Undo2, Wrench,
} from "lucide-react";
import { api, useApi } from "@/lib/client";
import { daysBetween, fmtDate, fmtDateTime, round1 } from "@/lib/dates";
import { ACTIVITY_LABELS, FIX_STATUS_LABELS, PRIORITY_LABELS, STAGE_CONFIRM_LABEL, STATUS, stageIndex } from "@/lib/constants";
import { ActionDialog, ACTION_META } from "@/components/ActionDialog";
import { Badge, Button, Card, cx, Empty, ErrorBox, Field, Modal, Spinner, StatusBadge, Tabs, useConfirm, useToast } from "@/components/ui";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const ACT_STYLE: Record<string, { color: string; icon: ReactNode }> = {
  CREATE: { color: "bg-slate-500", icon: <CircleDot className="h-3.5 w-3.5" /> },
  SUBMIT: { color: "bg-blue-600", icon: <Send className="h-3.5 w-3.5" /> },
  RESUBMIT: { color: "bg-sky-500", icon: <Send className="h-3.5 w-3.5" /> },
  FORWARD: { color: "bg-indigo-500", icon: <MapPin className="h-3.5 w-3.5" /> },
  RETURN: { color: "bg-red-600", icon: <Undo2 className="h-3.5 w-3.5" /> },
  START_REVISION: { color: "bg-orange-500", icon: <Wrench className="h-3.5 w-3.5" /> },
  FINISH_REVISION: { color: "bg-amber-500", icon: <Wrench className="h-3.5 w-3.5" /> },
  APPROVE: { color: "bg-teal-600", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  COMPLETE: { color: "bg-emerald-600", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  CANCEL: { color: "bg-slate-400", icon: <Trash2 className="h-3.5 w-3.5" /> },
  STATUS_CHANGE: { color: "bg-violet-500", icon: <CircleDot className="h-3.5 w-3.5" /> },
  NOTE: { color: "bg-slate-300", icon: <CircleDot className="h-3.5 w-3.5" /> },
  UPDATE: { color: "bg-slate-300", icon: <Pencil className="h-3.5 w-3.5" /> },
  ATTACH: { color: "bg-slate-300", icon: <Paperclip className="h-3.5 w-3.5" /> },
};

const MARK_COLOR = { blue: "#2563eb", yellow: "#ca8a04", green: "#16a34a", red: "#dc2626" };
type Mark = { title: string; name: string; color: string };

/** Mốc trình ký trên timeline: chức danh + trạng thái màu (vd: "Phụ trách liên quan • Đã kiểm tra") */
function stageMarks(a: Any): Mark[] | null {
  const { blue, green, red } = MARK_COLOR;
  if (a.type === "SUBMIT" || a.type === "RESUBMIT") return [{ title: ACTIVITY_LABELS[a.type], name: "Đã trình", color: blue }];
  if (a.type === "FORWARD" && a.status?.code === STATUS.STAGE_MANAGER) return [{ title: "Phụ trách liên quan", name: "Đã kiểm tra", color: green }];
  if (a.type === "FORWARD" && a.status?.code === STATUS.STAGE_BKS) return [{ title: "Quản lý phòng ban", name: "Đã phê duyệt", color: green }];
  if (a.type === "FORWARD" && a.status?.code === STATUS.STAGE_CEO) return [{ title: "Ban kiểm soát", name: "Đã kiểm duyệt", color: green }];
  if (a.type === "APPROVE") return [{ title: "Tổng Giám Đốc", name: "Đã ký", color: green }];
  if (a.type === "RETURN") return [{ title: "Ban kiểm soát", name: "Trả về - chờ in ký lại", color: red }];
  return null;
}

/** Giai đoạn đang chờ xác nhận (hiển thị cuối timeline, màu vàng) */
const PENDING_MARK: Record<string, Mark> = {
  [STATUS.STAGE_CHECK]: { title: "Phụ trách liên quan", name: "Đang chờ kiểm tra", color: MARK_COLOR.yellow },
  [STATUS.STAGE_MANAGER]: { title: "Quản lý phòng ban", name: "Đang chờ phê duyệt", color: MARK_COLOR.yellow },
  [STATUS.STAGE_BKS]: { title: "Ban kiểm soát", name: "Đang chờ kiểm duyệt", color: MARK_COLOR.yellow },
  [STATUS.STAGE_CEO]: { title: "Tổng Giám Đốc", name: "Đang chờ ký", color: MARK_COLOR.yellow },
};

function duration(a: string, b?: string | null) {
  const d = daysBetween(a, b ?? new Date());
  if (d < 1) return `${Math.max(1, Math.round(d * 24))} giờ`;
  return `${round1(d)} ngày`;
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800">{children || <span className="font-normal text-slate-400">—</span>}</dd>
    </div>
  );
}

function FileLink({ a }: { a: Any }) {
  const viewable = /^(application\/pdf|image\/)/.test(a.mimeType);
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Paperclip className="h-3.5 w-3.5 text-slate-400" />
      <a className="text-brand-600 hover:underline" href={`/api/attachments/${a.id}`}>{a.fileName}</a>
      {viewable && <a className="text-slate-400 hover:text-brand-600" href={`/api/attachments/${a.id}?inline=1`} target="_blank" rel="noreferrer" title="Xem"><Eye className="h-3.5 w-3.5" /></a>}
    </span>
  );
}

function UploadBox({ docId, returns, onDone }: { docId: string; returns: Any[]; onDone: () => void }) {
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [returnId, setReturnId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = async () => {
    const files = ref.current?.files;
    if (!files?.length) return toast("error", "Chọn file cần tải lên");
    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);
    if (returnId) fd.append("returnId", returnId);
    if (note) fd.append("note", note);
    setBusy(true);
    try {
      await api(`/api/documents/${docId}/attachments`, { method: "POST", body: fd });
      toast("success", "Đã tải lên");
      if (ref.current) ref.current.value = "";
      setNote("");
      onDone();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 md:grid-cols-12">
      <input ref={ref} type="file" multiple className="input md:col-span-4" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.dwg,.dxf,.zip,.rar,.7z" />
      <select className="input md:col-span-3" value={returnId} onChange={(e) => setReturnId(e.target.value)}>
        <option value="">File hồ sơ</option>
        {returns.map((r, i) => <option key={r.id} value={r.id}>Minh chứng lần trả {i + 1} ({fmtDate(r.returnedAt)})</option>)}
      </select>
      <input className="input md:col-span-3" placeholder="Ghi chú (tùy chọn)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Button className="md:col-span-2" loading={busy} icon={<FileUp className="h-4 w-4" />} onClick={upload}>Tải lên</Button>
      <p className="text-xs text-slate-400 md:col-span-12">PDF, Word, Excel, ảnh, bản vẽ (DWG/DXF), nén… tối đa 25MB/file. File được lưu an toàn, chỉ người có quyền xem hồ sơ mới tải được.</p>
    </div>
  );
}

function ReturnEditor({ ret, onClose, onDone, users }: { ret: Any; onClose: () => void; onDone: () => void; users: Any[] }) {
  const toast = useToast();
  const [v, setV] = useState({
    requirement: ret.requirement ?? "", responsibleId: ret.responsibleId ?? "", fixNote: ret.fixNote ?? "",
    errors: ret.errors.map((e: Any) => ({ id: e.id, resolved: e.resolved, description: e.description ?? "" })),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api(`/api/returns/${ret.id}`, { method: "PATCH", json: { ...v, responsibleId: v.responsibleId || null } });
      toast("success", "Đã cập nhật lần trả");
      onDone();
      onClose();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={`Cập nhật lần trả ngày ${fmtDate(ret.returnedAt)}`} size="lg" footer={<><Button variant="secondary" onClick={onClose}>Hủy</Button><Button loading={busy} onClick={save}>Lưu</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Yêu cầu chỉnh sửa / bổ sung" className="md:col-span-2"><textarea className="input" rows={2} value={v.requirement} onChange={(e) => setV({ ...v, requirement: e.target.value })} /></Field>
        <Field label="Người chịu trách nhiệm xử lý">
          <select className="input" value={v.responsibleId} onChange={(e) => setV({ ...v, responsibleId: e.target.value })}>
            <option value="">—</option>
            {users.map((u: Any) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
          </select>
        </Field>
        <Field label="Ghi chú khắc phục" className="md:col-span-2"><textarea className="input" rows={2} value={v.fixNote} onChange={(e) => setV({ ...v, fixNote: e.target.value })} /></Field>
      </div>
      <p className="mb-2 mt-4 text-xs font-semibold text-slate-600">Tình trạng khắc phục từng lỗi</p>
      <div className="space-y-2">
        {ret.errors.map((e: Any, i: number) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 p-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.errors[i].resolved} onChange={(ev) => setV({ ...v, errors: v.errors.map((x: Any, j: number) => (j === i ? { ...x, resolved: ev.target.checked } : x)) })} />
              <b>{e.reason?.name ?? e.customReason ?? "Lỗi khác"}</b> <span className="text-slate-400">({e.category.name})</span>
            </label>
            <input className="input flex-1" value={v.errors[i].description} placeholder="Mô tả" onChange={(ev) => setV({ ...v, errors: v.errors.map((x: Any, j: number) => (j === i ? { ...x, description: ev.target.value } : x)) })} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Lần trả được đóng tự động khi hồ sơ được in ký lại (Trình ký lại).</p>
    </Modal>
  );
}

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data, error, mutate } = useApi<{ doc: Any; perms: Record<string, boolean>; actions: string[]; approval: { waitingFor: string | null; canConfirm: boolean; canReturn: boolean } }>(`/api/documents/${id}`);
  const { data: lkUsers } = useApi<Any>("/api/lookups");
  const [tab, setTab] = useState("timeline");
  const [action, setAction] = useState<string | null>(null);
  const [editRet, setEditRet] = useState<Any>(null);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const { doc, perms, actions, approval } = data;
  // Mốc từng giai đoạn của lần nộp hiện tại (ghi nhận lúc người lập bấm xác nhận)
  const stamps: Record<string, Any> = {};
  if (doc.lastSubmittedAt) {
    for (const a of doc.activities) {
      if (a.status && stageIndex(a.status.code) >= 0 && new Date(a.startedAt) >= new Date(doc.lastSubmittedAt)) stamps[a.status.code] = a;
    }
  }
  // Thẻ giai đoạn: đã xong (xanh) / đang chờ (vàng) / BKS trả về (đỏ)
  const lastReturn = doc.status.code === STATUS.BKS_RETURNED ? [...doc.activities].reverse().find((a: Any) => a.type === "RETURN") : null;
  const { blue, green, red } = MARK_COLOR;
  const stageCards: { title: string; stamp: Any; mark: { name: string; color: string } | null }[] = [
    { title: "In phiếu & nộp trình ký", stamp: stamps[STATUS.STAGE_CHECK], done: { name: "Đã trình", color: blue }, wait: "" },
    { title: "Phụ trách liên quan", stamp: stamps[STATUS.STAGE_MANAGER], done: { name: "Đã kiểm tra", color: green }, wait: STATUS.STAGE_CHECK },
    { title: "Quản lý phòng ban", stamp: stamps[STATUS.STAGE_BKS], done: { name: "Đã phê duyệt", color: green }, wait: STATUS.STAGE_MANAGER },
    { title: "Ban kiểm soát", stamp: stamps[STATUS.STAGE_CEO] ?? lastReturn, done: { name: "Đã kiểm duyệt", color: green }, wait: STATUS.STAGE_BKS },
    { title: "Tổng Giám Đốc", stamp: stamps[STATUS.CEO_SIGNED], done: { name: "Đã ký", color: green }, wait: STATUS.STAGE_CEO },
  ].map(({ done, wait, ...c }) => ({
    ...c,
    mark: c.title === "Ban kiểm soát" && lastReturn ? { name: "Trả về - chờ in ký lại", color: red }
      : c.stamp ? done
      : wait && doc.status.code === wait ? PENDING_MARK[wait]
      : null,
  }));
  const totalErrors = doc.returns.reduce((a: number, r: Any) => a + r.errors.length, 0);

  const copy = async () => {
    try {
      const r = await api<{ id: string; code: string }>(`/api/documents/${id}/copy`, { method: "POST" });
      toast("success", `Đã tạo bản sao ${r.code}`);
      router.push(`/documents/${r.id}/edit`);
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };
  const del = async () => {
    const reason = await confirm("Xóa hồ sơ", <>Hồ sơ <b>{doc.code}</b> sẽ bị ẩn khỏi hệ thống (xóa mềm, lịch sử vẫn lưu trong nhật ký). Tiếp tục?</>, { danger: true, input: "Lý do xóa" });
    if (!reason) return;
    try {
      await api(`/api/documents/${id}`, { method: "DELETE", json: { reason } });
      toast("success", "Đã xóa hồ sơ");
      router.push("/documents");
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };
  const removeFile = async (a: Any) => {
    if (!(await confirm("Xóa file", `Xóa file "${a.fileName}"?`, { danger: true }))) return;
    try {
      await api(`/api/attachments/${a.id}`, { method: "DELETE" });
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  // Nộp/in và BKS trả về thực hiện qua phiếu trình ký (In phiếu / Trình ký lại)
  const primaryActions = actions.filter((a) => !["note", "change_status", "cancel", "submit", "return"].includes(a));
  const secondaryActions = actions.filter((a) => ["note", "change_status", "cancel"].includes(a));

  return (
    <div>
      <div className="mb-3">
        <button onClick={() => router.back()} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Quay lại</button>
      </div>

      {/* Tiêu đề + thao tác */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-sm font-bold text-brand-700">{doc.code}</span>
              <StatusBadge status={doc.status} />
              {doc.returnCount > 0 && <Badge tone="red">BKS trả {doc.returnCount} lần</Badge>}
              {doc.priority === 1 && <Badge tone="violet">Gấp</Badge>}
              {doc.isSample && <Badge tone="gray">Dữ liệu mẫu</Badge>}
            </div>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{doc.title}</h1>
            <p className="mt-0.5 text-sm text-slate-500">{doc.docNumber ? `Số: ${doc.docNumber} · ` : ""}{doc.type.name} · {doc.project.code} - {doc.project.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {perms.edit && <Link href={`/documents/${id}/edit`}><Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Sửa</Button></Link>}
            {perms.process && actions.includes("submit") && <Link href={`/forms/new?documentId=${id}`}><Button icon={<Printer className="h-4 w-4" />}>Lập phiếu trình ký</Button></Link>}
            {perms.copy && <Button variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={copy}>Sao chép</Button>}
            {perms.delete && <Button variant="secondary" className="text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={del}>Xóa</Button>}
          </div>
        </div>
        {approval.waitingFor && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <span>Đang chờ <b>{approval.waitingFor}</b> xác nhận.</span>
            {approval.canConfirm && <Button onClick={() => setAction("advance")}>{STAGE_CONFIRM_LABEL[doc.status.code]}</Button>}
            {approval.canReturn && <Button variant="danger" onClick={() => setAction("return")}>Trả về</Button>}
          </div>
        )}
        {doc.status.code === STATUS.BKS_RETURNED && perms.process && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Ban kiểm soát đã trả hồ sơ. Mở phiếu trình ký gần nhất và bấm <b>Trình ký lại</b> để in ký lại — hồ sơ quay về giai đoạn Trình Phụ trách liên quan.
            {doc.signingForms?.[0] && <Link className="ml-2 font-semibold underline" href={`/forms/${doc.signingForms[0].id}`}>Mở phiếu {doc.signingForms[0].code}</Link>}
          </p>
        )}
        {primaryActions.length + secondaryActions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <span className="mr-1 self-center text-xs font-semibold uppercase text-slate-400">Xử lý:</span>
            {primaryActions.map((a) => <Button key={a} variant={ACTION_META[a].variant} onClick={() => setAction(a)}>{ACTION_META[a].label}</Button>)}
            {secondaryActions.map((a) => <Button key={a} variant={a === "cancel" ? "ghost" : "secondary"} className={a === "cancel" ? "text-red-600" : ""} onClick={() => setAction(a)}>{ACTION_META[a].label}</Button>)}
          </div>
        )}
      </div>

      {/* Các mốc sau khi in phiếu: chức danh + trạng thái màu (cùng cách hiển thị với timeline) */}
      <Card className="mb-4" title="Giai đoạn trình ký" subtitle={doc.submissionCount ? `Lần nộp ${doc.submissionCount}${doc.submissionCount > 1 ? ` (in ký lại lần ${doc.submissionCount - 1})` : ""} · thời điểm = lúc người lập bấm xác nhận` : "Chưa in phiếu"}>
        <ol className="grid gap-2 md:grid-cols-5">
          {stageCards.map((c, i) => {
            const tone = c.mark?.color === MARK_COLOR.red ? "red" : c.mark?.color === MARK_COLOR.yellow ? "yellow" : c.mark ? "done" : "none";
            return (
              <li key={c.title} className={cx("flex items-start gap-2 rounded-lg border px-3 py-2", { red: "border-red-200 bg-red-50", yellow: "border-yellow-300 bg-yellow-50", done: "border-emerald-200 bg-emerald-50", none: "border-slate-200" }[tone])}>
                <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold", { red: "bg-red-500 text-white", yellow: "bg-yellow-500 text-white", done: "bg-emerald-500 text-white", none: "bg-slate-200 text-slate-600" }[tone])}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{c.title}</span>
                  {c.mark && <span className="mt-0.5 block"><StatusBadge status={c.mark} /></span>}
                  <span className="mt-0.5 block text-xs text-slate-500">{c.stamp ? `${fmtDateTime(c.stamp.startedAt)} · ${c.stamp.actor.fullName}` : "—"}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <p><span className="text-slate-500">Số lần in nộp:</span> <b>{doc.submissionCount}</b></p>
          <p><span className="text-slate-500">Ban kiểm soát trả:</span> <b>{doc.returnCount}</b> lần · {totalErrors} lỗi</p>
          <p><span className="text-slate-500">Nộp lần đầu → TGĐ ký:</span> <b>{doc.firstSubmittedAt ? duration(doc.firstSubmittedAt, doc.approvedAt) : "—"}</b>{!doc.approvedAt && doc.firstSubmittedAt ? " (tính đến nay)" : ""}</p>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <Card bodyClass="pt-2">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "timeline", label: "Luân chuyển (Timeline)", count: doc.activities.length },
                { value: "status", label: "Lịch sử trạng thái", count: doc.statusHistory.length },
                { value: "submissions", label: "Lần in nộp", count: doc.submissions.length },
                { value: "returns", label: "BKS trả về & lỗi", count: doc.returns.length },
                { value: "files", label: "File đính kèm", count: doc.attachments.length },
              ]}
            />

            {tab === "timeline" && (
              <ol className="relative ml-3 border-l-2 border-slate-200">
                {doc.activities.map((a: Any) => {
                  const st = ACT_STYLE[a.type] ?? ACT_STYLE.NOTE;
                  const marks = stageMarks(a);
                  return (
                    <li key={a.id} className="mb-5 ml-5">
                      <span className={cx("absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full text-white ring-4 ring-white", st.color)}>{st.icon}</span>
                      {marks ? marks.map((mk) => (
                        <div key={mk.title} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{mk.title}</span>
                          <StatusBadge status={mk} />
                        </div>
                      )) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{ACTIVITY_LABELS[a.type]}</span>
                          {a.status && <StatusBadge status={a.status} />}
                          {a.step && <Badge tone="blue">{a.step.name}</Badge>}
                        </div>
                      )}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtDateTime(a.startedAt)}
                        {a.endedAt && a.endedAt !== a.startedAt && ` → ${fmtDateTime(a.endedAt)} (${duration(a.startedAt, a.endedAt)})`}
                        {!marks && !a.endedAt && !["NOTE", "UPDATE", "ATTACH", "STATUS_CHANGE"].includes(a.type) && <b className="text-blue-600"> · đang ở bước này ({duration(a.startedAt)})</b>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Thực hiện: <b>{a.actor.fullName}</b>{a.department ? ` · ${a.department.name}` : ""}{a.handlerName ? ` · Xử lý: ${a.handlerName}` : ""}
                      </p>
                      {a.content && <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-sm text-slate-700">{a.content}</p>}
                      {!!a.attachments.length && <div className="mt-1 flex flex-wrap gap-3">{a.attachments.map((f: Any) => <FileLink key={f.id} a={f} />)}</div>}
                    </li>
                  );
                })}
                {PENDING_MARK[doc.status.code] && (() => {
                  const mk = PENDING_MARK[doc.status.code];
                  const since = [...doc.activities].reverse().find((a: Any) => a.status?.code === doc.status.code)?.startedAt;
                  return (
                    <li className="mb-5 ml-5">
                      <span className="absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full bg-yellow-500 text-white ring-4 ring-white"><Clock className="h-3.5 w-3.5" /></span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{mk.title}</span>
                        <StatusBadge status={mk} />
                      </div>
                      {since && <p className="mt-0.5 text-xs text-slate-500">Từ {fmtDateTime(since)} ({duration(since)})</p>}
                    </li>
                  );
                })()}
              </ol>
            )}

            {tab === "status" && (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead><tr><th className="th">Thời điểm</th><th className="th">Từ</th><th className="th">Sang</th><th className="th">Người thực hiện</th><th className="th">Thời gian ở trạng thái trước</th><th className="th">Nội dung</th></tr></thead>
                  <tbody>
                    {doc.statusHistory.map((h: Any) => (
                      <tr key={h.id}>
                        <td className="td whitespace-nowrap">{fmtDateTime(h.changedAt)}</td>
                        <td className="td">{h.fromStatus ? <StatusBadge status={h.fromStatus} /> : "—"}</td>
                        <td className="td"><StatusBadge status={h.toStatus} /></td>
                        <td className="td">{h.changedBy.fullName}</td>
                        <td className="td">{h.durationHours !== null ? (h.durationHours < 24 ? `${round1(h.durationHours)} giờ` : `${round1(h.durationHours / 24)} ngày`) : "—"}</td>
                        <td className="td">{h.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "submissions" && (
              doc.submissions.length ? (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead><tr><th className="th">Lần</th><th className="th">Thời điểm nộp</th><th className="th">Người nộp</th><th className="th">Kết quả</th><th className="th">Thời gian</th></tr></thead>
                    <tbody>
                      {doc.submissions.map((s: Any) => (
                        <tr key={s.id}>
                          <td className="td font-semibold">{s.round === 1 ? "Lần đầu" : `In ký lại lần ${s.round - 1}`}</td>
                          <td className="td whitespace-nowrap">{fmtDateTime(s.submittedAt)}</td>
                          <td className="td">{s.submittedBy.fullName}</td>
                          <td className="td">
                            <Badge tone={s.result === "APPROVED" ? "green" : s.result === "RETURNED" ? "red" : s.result === "WITHDRAWN" ? "gray" : "blue"}>
                              {{ APPROVED: "TGĐ đã ký", RETURNED: "BKS trả về", WITHDRAWN: "Thay bằng bản in lại", PENDING: "Đang trình" }[s.result as string]}
                            </Badge>
                            {s.resultAt && <span className="ml-1 text-xs text-slate-400">{fmtDate(s.resultAt)}</span>}
                          </td>
                          <td className="td">{duration(s.submittedAt, s.resultAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="Hồ sơ chưa in phiếu nộp" />
            )}

            {tab === "returns" && (
              doc.returns.length ? (
                <div className="space-y-3">
                  {doc.returns.map((r: Any, i: number) => (
                    <div key={r.id} className="rounded-lg border border-red-100 bg-red-50/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-red-700">Lần trả {i + 1}</span>
                          <span className="text-sm text-slate-600">{fmtDateTime(r.returnedAt)}</span>
                          <Badge tone={r.fixStatus === "CLOSED" || r.fixStatus === "FIXED" ? "green" : r.fixStatus === "IN_PROGRESS" ? "orange" : "red"}>{FIX_STATUS_LABELS[r.fixStatus]}</Badge>
                        </div>
                        {perms.edit && <Button size="sm" variant="secondary" onClick={() => setEditRet(r)}>Cập nhật</Button>}
                      </div>
                      <dl className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                        <Info label="Trả bởi">{r.returnedByName ?? "Ban kiểm soát"}</Info>
                        <Info label="Người chịu trách nhiệm sửa">{r.responsible?.fullName}</Info>
                        <Info label="In ký lại lúc">{fmtDateTime(r.fixedAt)}{r.fixedAt && ` (sau ${duration(r.returnedAt, r.fixedAt)})`}</Info>
                        <Info label="Người ghi nhận">{r.recordedBy.fullName}</Info>
                      </dl>
                      {r.requirement && <p className="mt-2 text-sm"><b>Yêu cầu:</b> {r.requirement}</p>}
                      {r.fixNote && <p className="mt-1 text-sm"><b>Ghi chú khắc phục:</b> {r.fixNote}</p>}
                      <table className="mt-2 w-full">
                        <thead><tr><th className="th">Nhóm lỗi</th><th className="th">Lỗi</th><th className="th">Nội dung</th><th className="th">Trách nhiệm</th><th className="th">Khắc phục</th></tr></thead>
                        <tbody>
                          {r.errors.map((e: Any) => (
                            <tr key={e.id}>
                              <td className="td">{e.category.name}</td>
                              <td className="td font-medium">{e.reason?.name ?? e.customReason ?? "—"}{e.reason && e.customReason ? `: ${e.customReason}` : ""}</td>
                              <td className="td">{e.description}</td>
                              <td className="td">{e.responsible?.fullName ?? "—"}</td>
                              <td className="td">{e.resolved ? <Badge tone="green">Đã khắc phục</Badge> : <Badge tone="red">Chưa</Badge>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {!!r.attachments.length && <div className="mt-2 flex flex-wrap gap-3"><span className="text-xs text-slate-500">Minh chứng:</span>{r.attachments.map((f: Any) => <FileLink key={f.id} a={f} />)}</div>}
                    </div>
                  ))}
                </div>
              ) : <Empty text="Ban kiểm soát chưa trả hồ sơ lần nào" />
            )}

            {tab === "files" && (
              <div className="space-y-3">
                {perms.edit && <UploadBox docId={id} returns={doc.returns} onDone={() => mutate()} />}
                {doc.attachments.length ? (
                  <table className="w-full">
                    <thead><tr><th className="th">Tên file</th><th className="th">Dung lượng</th><th className="th">Người tải</th><th className="th">Thời gian</th><th className="th"></th></tr></thead>
                    <tbody>
                      {doc.attachments.map((a: Any) => (
                        <tr key={a.id}>
                          <td className="td"><FileLink a={a} />{a.returnId && <Badge tone="red" className="ml-2">Minh chứng trả hồ sơ</Badge>}</td>
                          <td className="td">{(a.size / 1024 / 1024).toFixed(2)} MB</td>
                          <td className="td">{a.uploadedBy.fullName}</td>
                          <td className="td">{fmtDateTime(a.uploadedAt)}</td>
                          <td className="td text-right">
                            <a href={`/api/attachments/${a.id}`} className="mr-1 inline-flex rounded p-1 text-slate-500 hover:bg-slate-100"><Download className="h-4 w-4" /></a>
                            {perms.edit && <button onClick={() => removeFile(a)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <Empty text="Chưa có file đính kèm" />}
              </div>
            )}
          </Card>
        </div>

        <Card title="Thông tin hồ sơ">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Info label="Mã hồ sơ">{doc.code}</Info>
            <Info label="Số hồ sơ">{doc.docNumber}</Info>
            <Info label="Loại hồ sơ">{doc.type.name}</Info>
            <Info label="Mức ưu tiên">{PRIORITY_LABELS[doc.priority]}</Info>
            <div className="col-span-2"><Info label="Công trình">{doc.project.code} - {doc.project.name}</Info></div>
            <div className="col-span-2"><Info label="CĐT / NCC / thầu phụ">{doc.contractor?.name ?? doc.project.investor}</Info></div>
            <Info label="Phòng ban trình ký">{doc.department.name}</Info>
            <Info label="Người lập">{doc.preparer.fullName}</Info>
            <Info label="Người nộp">{doc.submitter?.fullName}</Info>
            <Info label="Ngày lập">{fmtDate(doc.preparedDate)}</Info>
            <Info label="Nộp lần đầu">{fmtDateTime(doc.firstSubmittedAt)}</Info>
            <Info label="Nộp gần nhất">{fmtDateTime(doc.lastSubmittedAt)}</Info>
            <Info label="TGĐ đã ký">{fmtDateTime(doc.approvedAt)}</Info>
            {doc.customFields && Object.entries(doc.customFields as Record<string, unknown>).map(([k, v]) => {
              const def = lkUsers?.customFields?.find((f: Any) => f.key === k);
              return <Info key={k} label={def?.label ?? k}>{typeof v === "number" ? v.toLocaleString("vi-VN") : typeof v === "boolean" ? (v ? "Có" : "Không") : String(v ?? "")}</Info>;
            })}
            <div className="col-span-2"><Info label="Ghi chú">{doc.notes}</Info></div>
            <Info label="Người tạo">{doc.createdBy.fullName}</Info>
            <Info label="Cập nhật lần cuối">{fmtDateTime(doc.updatedAt)}</Info>
          </dl>
        </Card>
      </div>

      <ActionDialog action={action} doc={doc} onClose={() => setAction(null)} onDone={() => mutate()} />
      {editRet && <ReturnEditor ret={editRet} users={lkUsers?.users ?? []} onClose={() => setEditRet(null)} onDone={() => mutate()} />}
      {dialog}
    </div>
  );
}
