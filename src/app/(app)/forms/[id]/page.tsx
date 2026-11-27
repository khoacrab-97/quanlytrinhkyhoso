"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { ArrowLeft, Lock, Pencil, Printer, RotateCcw, Trash2 } from "lucide-react";
import { api, useApi } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { SigningSheet, type SheetContent } from "@/components/SigningSheet";
import { Badge, Button, Card, cx, ErrorBox, Field, Modal, Spinner, StatusBadge, useConfirm, useToast } from "@/components/ui";

type Data = {
  form: {
    id: string; code: string; status: "DRAFT" | "PRINTED"; resubmitNo: number; resubmitReason: string | null; content: SheetContent;
    printedAt: string | null; printCount: number; createdAt: string; createdBy: { fullName: string };
    prints: { id: string; printedAt: string; isReprint: boolean; printedBy: { fullName: string } }[];
    document: { id: string; code: string; title: string; submissionCount: number; returnCount: number; status: { name: string; color: string } };
  };
  state: { reprintMinutes: number; reprintUntil: string | null; canEdit: boolean; canPrint: boolean; canReprint: boolean; canResubmit: boolean; nextResubmitNo: number; bksReturned: boolean; atBks: boolean };
  versions: { id: string; code: string; resubmitNo: number; status: string; printedAt: string | null; printCount: number }[];
};

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  return Math.max(0, new Date(until).getTime() - now);
}

export default function FormDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const { data, error, mutate } = useApi<Data>(`/api/signing-forms/${id}`);
  const [askPrinted, setAskPrinted] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const left = useCountdown(data?.state.reprintUntil ?? null);

  // Hết hạn in lại trong lúc đang mở trang -> tải lại quyền từ server
  useEffect(() => {
    if (left === 0 && data?.state.canReprint) mutate();
  }, [left, data?.state.canReprint, mutate]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  const { form, state, versions } = data;
  const reprintOk = state.canReprint && (left ?? 0) > 0;
  const locked = form.status === "PRINTED" && !reprintOk;
  const mm = left !== null ? `${String(Math.floor(left / 60000)).padStart(2, "0")}:${String(Math.floor((left % 60000) / 1000)).padStart(2, "0")}` : "";

  const doPrint = () => {
    window.print(); // trình duyệt chờ đến khi hộp thoại in đóng
    setAskPrinted(true);
  };

  const confirmPrinted = async () => {
    setBusy(true);
    try {
      const r = await api<{ reprint: boolean }>(`/api/signing-forms/${id}/print`, { method: "POST" });
      toast("success", r.reprint ? "Đã ghi nhận in lại" : "Đã lưu phiếu và ghi nhận trình ký vào hồ sơ");
      setAskPrinted(false);
      mutate();
    } catch (e) {
      toast("error", (e as Error).message);
      setAskPrinted(false);
      mutate();
    } finally {
      setBusy(false);
    }
  };

  const resubmit = async () => {
    setBusy(true);
    try {
      const r = await api<{ id: string; code: string }>(`/api/signing-forms/${id}/resubmit`, { method: "POST", json: { reason } });
      toast("success", `Đã tạo phiếu trình ký lại ${r.code}. Kiểm tra nội dung rồi in.`);
      setResubmitOpen(false);
      setReason("");
      router.push(`/forms/${r.id}`);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    if (!(await confirm("Xóa phiếu đang soạn", `Xóa phiếu ${form.code}? Phiếu chưa in nên không ảnh hưởng số liệu.`, { danger: true }))) return;
    try {
      await api(`/api/signing-forms/${id}`, { method: "DELETE" });
      toast("success", "Đã xóa phiếu");
      router.push("/forms");
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  return (
    <>
      <div className="no-print">
        <button onClick={() => router.push("/forms")} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Danh sách phiếu</button>
        <div className="card mb-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-brand-50 px-2 py-0.5 font-mono text-sm font-bold text-brand-700">{form.code}</span>
                {form.status === "DRAFT" ? <Badge tone="orange">Đang soạn - chưa in</Badge> : <Badge tone="green">Đã in · {form.printCount} lần</Badge>}
                <Badge tone={form.resubmitNo ? "red" : "blue"}>{form.resubmitNo ? `Trình lại lần ${form.resubmitNo}` : "Trình lần đầu"}</Badge>
              </div>
              <h1 className="mt-2 text-lg font-bold text-slate-900">{form.content.docTitle}</h1>
              <p className="text-sm text-slate-500">
                Hồ sơ <Link className="font-medium text-brand-600 hover:underline" href={`/documents/${form.document.id}`}>{form.document.code}</Link> · <StatusBadge status={form.document.status} /> · Người lập phiếu: {form.createdBy.fullName}
                {form.printedAt && <> · In lần đầu: {fmtDateTime(form.printedAt)}</>}
              </p>
              {form.resubmitReason && <p className="mt-1 text-sm"><b>Lý do trình lại:</b> {form.resubmitReason}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {state.canEdit && <Link href={`/forms/${id}/edit`}><Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>Sửa</Button></Link>}
              {state.canEdit && <Button variant="ghost" className="text-red-600" icon={<Trash2 className="h-4 w-4" />} onClick={removeDraft}>Xóa nháp</Button>}
              {state.canPrint && <Button icon={<Printer className="h-4 w-4" />} onClick={doPrint}>In phiếu</Button>}
              {form.status === "PRINTED" && reprintOk && <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={doPrint}>In lại (còn {mm})</Button>}
              {state.canResubmit && <Button variant="warning" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setResubmitOpen(true)}>Trình ký lại</Button>}
            </div>
          </div>
          {form.status === "DRAFT" && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Kiểm tra bản xem trước bên dưới rồi bấm <b>In phiếu</b>. Sau khi xác nhận đã in, nội dung phiếu được khóa, hồ sơ được ghi nhận {form.resubmitNo ? `trình lại lần ${form.resubmitNo}` : "trình ký lần đầu"}, và bạn được in lại trong {state.reprintMinutes} phút.
            </p>
          )}
          {form.status === "PRINTED" && state.bksReturned && state.canResubmit && (
            <p className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <RotateCcw className="h-4 w-4" /> Ban kiểm soát đã trả hồ sơ — bắt buộc bấm <b>Trình ký lại</b> (ghi lý do) để in ký lại. Hồ sơ sẽ quay về giai đoạn Trình Phụ trách liên quan.
            </p>
          )}
          {form.status === "PRINTED" && !reprintOk && !state.bksReturned && (
            <p className="mt-3 flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <Lock className="h-4 w-4" /> Đã quá {state.reprintMinutes} phút kể từ lần in đầu — không được in lại. {state.canResubmit ? "Nếu cần trình lại, bấm \"Trình ký lại\" và ghi rõ lý do." : ""}
            </p>
          )}
        </div>
      </div>

      <div className="print-root card scroll-thin mb-4 overflow-x-auto bg-slate-100 p-4">
        <div className={cx("mx-auto w-fit bg-white p-[6mm] shadow", locked && "opacity-60")}>
          <SigningSheet c={form.content} resubmitNo={form.resubmitNo} reason={form.resubmitReason} code={form.code} locked={locked} />
        </div>
      </div>

      <div className="no-print grid gap-4 lg:grid-cols-2">
        <Card title="Lịch sử in" bodyClass="p-0">
          <table className="w-full">
            <thead><tr><th className="th">Thời điểm</th><th className="th">Người in</th><th className="th">Loại</th></tr></thead>
            <tbody>
              {!form.prints.length && <tr><td colSpan={3} className="td py-6 text-center text-slate-400">Chưa in</td></tr>}
              {form.prints.map((p) => (
                <tr key={p.id}><td className="td">{fmtDateTime(p.printedAt)}</td><td className="td">{p.printedBy.fullName}</td><td className="td">{p.isReprint ? <Badge>In lại</Badge> : <Badge tone="green">In lần đầu</Badge>}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Các lần trình của hồ sơ" bodyClass="p-0">
          <table className="w-full">
            <thead><tr><th className="th">Phiếu</th><th className="th">Lần</th><th className="th">Trạng thái</th><th className="th">In lúc</th></tr></thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id} className={v.id === id ? "bg-blue-50/50" : ""}>
                  <td className="td"><Link className="font-medium text-brand-600 hover:underline" href={`/forms/${v.id}`}>{v.code}</Link></td>
                  <td className="td">{v.resubmitNo ? `Trình lại lần ${v.resubmitNo}` : "Lần đầu"}</td>
                  <td className="td">{v.status === "DRAFT" ? <Badge tone="orange">Đang soạn</Badge> : <Badge tone="green">Đã in ({v.printCount})</Badge>}</td>
                  <td className="td">{fmtDateTime(v.printedAt) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <Modal
        open={askPrinted}
        onClose={() => setAskPrinted(false)}
        size="sm"
        title="Xác nhận đã in"
        footer={<><Button variant="secondary" onClick={() => setAskPrinted(false)}>Chưa in được</Button><Button loading={busy} onClick={confirmPrinted}>Đã in xong</Button></>}
      >
        <p className="text-sm text-slate-700">
          {form.status === "DRAFT"
            ? <>Phiếu đã được in ra giấy thành công? Khi xác nhận, nội dung phiếu sẽ được <b>khóa và lưu</b> làm dữ liệu thống kê, hồ sơ được ghi nhận <b>{form.resubmitNo ? `trình lại lần ${form.resubmitNo}` : "trình ký lần đầu"}</b>.</>
            : <>Ghi nhận một lần <b>in lại</b> phiếu {form.code}?</>}
        </p>
      </Modal>

      <Modal
        open={resubmitOpen}
        onClose={() => setResubmitOpen(false)}
        title="Trình ký lại"
        footer={<><Button variant="secondary" onClick={() => setResubmitOpen(false)}>Hủy</Button><Button variant="warning" loading={busy} disabled={reason.trim().length < 5} onClick={resubmit}>Tạo phiếu trình lại</Button></>}
      >
        <div className="space-y-3">
          <Field label="Trình ký lại - lần" hint="Hệ thống tự tính theo số lần hồ sơ đã trình">
            <div className="input bg-slate-50 font-semibold">Lần {state.nextResubmitNo}</div>
          </Field>
          <Field label="Lý do trình ký lại" required hint="Tối thiểu 5 ký tự. Nội dung được in lên phiếu và lưu để thống kê.">
            <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          </Field>
          <p className="text-xs text-slate-500">Hệ thống tạo phiếu mới sao chép nội dung phiếu hiện tại (ngày trình = hôm nay). Bạn có thể sửa trước khi in.</p>
        </div>
      </Modal>
      {dialog}
    </>
  );
}
