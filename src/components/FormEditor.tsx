"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { api, useApi, useLookups } from "@/lib/client";
import { toInputDate } from "@/lib/dates";
import { SigningSheet, type SheetContent } from "./SigningSheet";
import { useMe } from "./AppShell";
import { Button, Card, ErrorBox, Field, Select, Spinner, useToast } from "./ui";

type DocLite = { id: string; code: string; title: string; submissionCount: number; status: { name: string; category: string } };

const OPEN_CATS = ["DRAFT", "RETURNED", "REVISING", "SUBMITTED", "REVIEWING"];

export function FormEditor({ id, initial, initialReason, resubmitNo: fixedNo, presetDocumentId }: {
  id?: string; initial?: SheetContent; initialReason?: string | null; resubmitNo?: number; presetDocumentId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const { data: lk } = useLookups();
  const editing = !!id;
  const [mode, setMode] = useState<"existing" | "new">(presetDocumentId ? "existing" : "new");
  const [documentId, setDocumentId] = useState(presetDocumentId ?? "");
  const [nd, setNd] = useState({ typeId: "", projectId: "", departmentId: "", contractorId: "", docNumber: "" });
  const [c, setC] = useState<SheetContent>(
    initial ?? {
      docTitle: "", projectName: "", partnerName: "", submitDate: toInputDate(new Date()), departmentName: me.departmentName ?? "",
      otherContent: "", preparerName: me.fullName, relatedPersonName: "", managerName: "",
    },
  );
  const [reason, setReason] = useState(initialReason ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const { data: docs } = useApi<{ rows: DocLite[] }>(!editing ? "/api/documents?flag=open&pageSize=1000&sort=createdAt&dir=desc" : null);
  const openDocs = (docs?.rows ?? []).filter((d) => OPEN_CATS.includes(d.status.category));
  const selected = openDocs.find((d) => d.id === documentId);
  const resubmitNo = editing ? fixedNo ?? 0 : mode === "existing" ? selected?.submissionCount ?? 0 : 0;

  // Chọn hồ sơ có sẵn -> tự điền nội dung phiếu
  useEffect(() => {
    if (editing || mode !== "existing" || !documentId) return;
    api<{ doc: { title: string; project: { name: string; investor: string | null }; contractor: { name: string } | null; department: { name: string }; preparer: { fullName: string } } }>(`/api/documents/${documentId}`)
      .then(({ doc }) => setC((x) => ({
        ...x, docTitle: doc.title, projectName: doc.project.name, partnerName: doc.contractor?.name ?? doc.project.investor ?? "",
        departmentName: doc.department.name, preparerName: doc.preparer.fullName,
      })))
      .catch((e) => toast("error", e.message));
  }, [documentId, mode, editing, toast]);

  // Phòng ban trình ký mặc định = phòng ban của người lập (chỉ Quản trị viên được đổi)
  const myDeptId = lk?.users.find((u) => u.id === lk.me.id)?.departmentId ?? "";
  const canPickDept = me.role === "ADMIN" || !myDeptId;
  useEffect(() => {
    if (!myDeptId) return;
    setNd((x) => (x.departmentId ? x : { ...x, departmentId: myDeptId }));
  }, [myDeptId]);

  if (!lk) return <Spinner />;
  const project = lk.projects.find((p) => p.id === nd.projectId);
  // Dự án có gắn đối tác thì chỉ chọn trong danh sách đối tác của dự án
  const partners = project?.partnerIds.length ? lk.contractors.filter((t) => project.partnerIds.includes(t.id)) : lk.contractors;
  const set = (k: keyof SheetContent, v: string) => setC((x) => ({ ...x, [k]: v }));
  const setNew = (k: keyof typeof nd, v: string) => {
    setNd((x) => ({ ...x, [k]: v }));
    if (k === "projectId") {
      const p = lk.projects.find((x) => x.id === v);
      // Chọn dự án -> tự điền tên dự án và Chủ đầu tư; nếu dự án chỉ có 1 đối tác thì chọn luôn đối tác đó
      const only = p?.partnerIds.length === 1 ? lk.contractors.find((t) => t.id === p.partnerIds[0]) : undefined;
      setNd((x) => ({ ...x, projectId: v, contractorId: only?.id ?? "" }));
      if (p) setC((x) => ({ ...x, projectName: p.name, partnerName: only?.name ?? p.investor ?? "" }));
    }
    if (k === "departmentId") {
      const d = lk.departments.find((x) => x.id === v);
      if (d) setC((x) => ({ ...x, departmentName: d.name }));
    }
    if (k === "contractorId") {
      const t = lk.contractors.find((x) => x.id === v);
      if (t) setC((x) => ({ ...x, partnerName: t.name }));
    }
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        await api(`/api/signing-forms/${id}`, { method: "PATCH", json: { content: c, reason: resubmitNo > 0 ? reason : null } });
        toast("success", "Đã lưu phiếu");
        router.push(`/forms/${id}`);
      } else {
        const body = mode === "existing"
          ? { documentId, content: c, reason: resubmitNo > 0 ? reason : null }
          : { newDocument: { ...nd, contractorId: nd.contractorId || null, docNumber: nd.docNumber || null }, content: c };
        if (mode === "existing" && !documentId) throw new Error("Chọn hồ sơ cần trình ký");
        const r = await api<{ id: string; code: string }>("/api/signing-forms", { method: "POST", json: body });
        toast("success", `Đã tạo phiếu ${r.code}. Kiểm tra lại bản xem trước rồi bấm In.`);
        router.push(`/forms/${r.id}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <div className="space-y-4">
        {!editing && (
          <Card title="1. Hồ sơ trình ký">
            <div className="mb-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> Tạo hồ sơ mới</label>
              <label className="flex items-center gap-2"><input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> Hồ sơ đã có trên hệ thống</label>
            </div>
            {mode === "existing" ? (
              <Field label="Chọn hồ sơ" required hint={selected ? (selected.submissionCount ? `Hồ sơ đã trình ${selected.submissionCount} lần → phiếu này là TRÌNH LẠI lần ${selected.submissionCount}` : "Hồ sơ chưa trình → phiếu trình lần đầu") : undefined}>
                <Select value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder="— Chọn hồ sơ —" options={openDocs.map((d) => ({ value: d.id, label: `${d.code} · ${d.title} (${d.status.name})` }))} />
              </Field>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Loại hồ sơ" required><Select value={nd.typeId} onChange={(e) => setNew("typeId", e.target.value)} placeholder="— Chọn —" options={lk.types.map((t) => ({ value: t.id, label: t.name }))} /></Field>
                <Field label="Dự án / Công trình" required><Select value={nd.projectId} onChange={(e) => setNew("projectId", e.target.value)} placeholder="— Chọn —" options={lk.projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))} /></Field>
                <Field label="Phòng ban trình ký" required hint={canPickDept ? undefined : "Theo phòng ban của tài khoản"}><Select disabled={!canPickDept} value={nd.departmentId} onChange={(e) => setNew("departmentId", e.target.value)} placeholder="— Chọn —" options={lk.departments.map((d) => ({ value: d.id, label: d.name }))} /></Field>
                <Field label="Chủ đầu tư / NCC / Thầu phụ" hint={project ? (project.partnerIds.length ? `Đối tác của dự án${project.investor ? ` · CĐT: ${project.investor}` : ""}` : "Dự án chưa gắn đối tác (Danh mục > Công trình / dự án)") : "Chọn dự án trước"}><Select value={nd.contractorId} onChange={(e) => setNew("contractorId", e.target.value)} placeholder={project?.investor ? `CĐT: ${project.investor}` : "— Không chọn —"} options={partners.map((t) => ({ value: t.id, label: t.name }))} /></Field>
                <Field label="Số hồ sơ / số hiệu văn bản"><input className="input" value={nd.docNumber} onChange={(e) => setNew("docNumber", e.target.value)} /></Field>
              </div>
            )}
          </Card>
        )}

        <Card title={`${editing ? "" : "2. "}Nội dung phiếu (in đúng theo mẫu)`}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tên hồ sơ / Loại hồ sơ" required className="md:col-span-2"><textarea className="input" rows={2} value={c.docTitle} onChange={(e) => set("docTitle", e.target.value)} /></Field>
            <Field label="Dự án / Công trình"><input className="input" value={c.projectName} onChange={(e) => set("projectName", e.target.value)} /></Field>
            <Field label="Tên Chủ đầu tư / Nhà cung cấp / Thầu phụ…"><input className="input" value={c.partnerName} onChange={(e) => set("partnerName", e.target.value)} /></Field>
            <Field label="Ngày trình ký" required><input type="date" className="input" value={c.submitDate} onChange={(e) => set("submitDate", e.target.value)} /></Field>
            <Field label="Phòng ban"><input className="input" value={c.departmentName} onChange={(e) => set("departmentName", e.target.value)} /></Field>
            <Field label="Trình ký lần" hint="Hệ thống tự xác định theo số lần hồ sơ đã trình">
              <div className="input bg-slate-50 font-semibold">{resubmitNo === 0 ? "☑ Lần đầu" : `☑ Trình lại - lần: ${resubmitNo}`}</div>
            </Field>
            {resubmitNo > 0 && (
              <Field label="Lý do trình ký lại" required className="md:col-span-2"><textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            )}
            <Field label="Nội dung khác" className="md:col-span-2"><textarea className="input" rows={2} value={c.otherContent} onChange={(e) => set("otherContent", e.target.value)} /></Field>
            <Field label="Người lập"><input className="input" value={c.preparerName} onChange={(e) => set("preparerName", e.target.value)} /></Field>
            <Field label="Phụ trách liên quan"><input className="input" value={c.relatedPersonName} onChange={(e) => set("relatedPersonName", e.target.value)} placeholder="Bỏ trống để ký tay" /></Field>
            <Field label="Quản lý phòng ban"><input className="input" value={c.managerName} onChange={(e) => set("managerName", e.target.value)} placeholder="Bỏ trống để ký tay" /></Field>
          </div>
        </Card>
        <ErrorBox error={err} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.back()}>Hủy</Button>
          <Button loading={busy} icon={<Save className="h-4 w-4" />} onClick={save}>{editing ? "Lưu phiếu" : "Lưu & xem trước để in"}</Button>
        </div>
      </div>

      <Card title="Xem trước bản in" subtitle="Khổ A4 · Times New Roman 10pt · đúng bố cục mẫu công ty" bodyClass="scroll-thin overflow-x-auto bg-slate-100">
        <div className="inline-block bg-white p-[6mm] shadow">
          <SigningSheet c={c} resubmitNo={resubmitNo} reason={reason} />
        </div>
      </Card>
    </div>
  );
}
