"use client";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Save } from "lucide-react";
import { api, useApi, useLookups } from "@/lib/client";
import { toInputDate } from "@/lib/dates";
import { SigningSheet, type SheetContent } from "./SigningSheet";
import { useMe } from "./AppShell";
import { Button, Card, ErrorBox, Field, Select, Spinner, useToast } from "./ui";

type DocLite = { id: string; code: string; title: string; submissionCount: number; status: { name: string; category: string } };
type Opt = { value: string; label: string; name: string };

const OPEN_CATS = ["DRAFT", "RETURNED", "REVISING", "SUBMITTED", "REVIEWING"];
const NOT_IN_CATALOG = "Lưu ý, thông tin không thuộc dữ liệu chung";

const norm = (s: string) => s.trim().toLowerCase();
/** Tìm mục danh mục khớp với nội dung nhập tay (theo tên hoặc "mã - tên") */
const match = (opts: Opt[], text: string) => opts.find((o) => norm(o.name) === norm(text) || norm(o.label) === norm(text));

/** Ô nhập tay có gợi ý theo danh mục; cảnh báo khi nội dung không có trong danh mục */
function SuggestInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string }) {
  const id = useId();
  const off = !!value.trim() && !match(options, value);
  return (
    <>
      <input className="input" list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>{options.map((o) => <option key={o.value} value={o.name}>{o.label}</option>)}</datalist>
      {off && <span className="mt-1 block text-xs font-medium text-amber-600">{NOT_IN_CATALOG}</span>}
    </>
  );
}

/** Trường danh mục ở bước 1: chọn danh sách thả xuống, hoặc nhập tay rồi gợi ý theo danh mục */
function CatalogPick({ typed, id, text, options, placeholder, onPick }: { typed: boolean; id: string; text: string; options: Opt[]; placeholder: string; onPick: (id: string, text: string) => void }) {
  if (!typed) return <Select value={id} onChange={(e) => onPick(e.target.value, options.find((o) => o.value === e.target.value)?.name ?? "")} placeholder={placeholder} options={options} />;
  return <SuggestInput value={text} options={options} placeholder="Gõ để tìm trong danh mục" onChange={(v) => onPick(match(options, v)?.value ?? "", v)} />;
}

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
  // Cách nhập ở bước 1: chọn danh sách / nhập tay có gợi ý (text = nội dung đang gõ)
  const [typed, setTyped] = useState(false);
  const [txt, setTxt] = useState({ type: "", project: "", partner: "" });
  // Người lập: tạo cho cá nhân / tạo giúp hộ người cùng phòng
  const [forOther, setForOther] = useState(false);
  const [preparerId, setPreparerId] = useState("");
  // Hồ sơ có sẵn: phòng ban và người lập của hồ sơ (để điền sẵn Phụ trách liên quan / Quản lý phòng ban)
  const [docRef, setDocRef] = useState<{ departmentId: string; preparerId: string } | null>(null);
  const [c, setC] = useState<SheetContent>(
    initial ?? {
      docTitle: "", projectName: "", partnerName: "", submitDate: toInputDate(new Date()), departmentName: me.departmentName ?? "",
      otherContent: "", preparerName: me.fullName, relatedPersonName: "", managerName: "",
    },
  );
  const [pickDate, setPickDate] = useState(() => !!initial && initial.submitDate !== toInputDate(new Date()));
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
    api<{ doc: { title: string; departmentId: string; preparerId: string; project: { name: string; investor: string | null }; contractor: { name: string } | null; department: { name: string }; preparer: { fullName: string } } }>(`/api/documents/${documentId}`)
      .then(({ doc }) => {
        setDocRef({ departmentId: doc.departmentId, preparerId: doc.preparerId });
        setC((x) => ({
          ...x, docTitle: doc.title, projectName: doc.project.name, partnerName: doc.contractor?.name ?? doc.project.investor ?? "",
          departmentName: doc.department.name, preparerName: doc.preparer.fullName,
        }));
      })
      .catch((e) => toast("error", e.message));
  }, [documentId, mode, editing, toast]);

  // Phòng ban trình ký mặc định = phòng ban của người lập (chỉ Quản trị viên được đổi)
  const myDeptId = lk?.users.find((u) => u.id === lk.me.id)?.departmentId ?? "";
  const canPickDept = me.role === "ADMIN" || !myDeptId;
  useEffect(() => {
    if (!myDeptId) return;
    setNd((x) => (x.departmentId ? x : { ...x, departmentId: myDeptId }));
  }, [myDeptId]);

  // Người lập và phòng ban đang áp dụng cho phiếu -> Phụ trách liên quan (cùng phòng, cùng khối) và Quản lý phòng ban
  const prepId = mode === "existing" ? docRef?.preparerId ?? "" : forOther && preparerId ? preparerId : me.id;
  const deptId = mode === "existing" ? docRef?.departmentId ?? "" : nd.departmentId;
  const prepDivision = lk?.users.find((u) => u.id === prepId)?.divisionId ?? null;
  const relatedOpts = (lk?.users ?? []).filter((u) => u.isRelatedPerson && u.id !== prepId && u.departmentId === deptId && (!prepDivision || u.divisionId === prepDivision));
  const managerOpts = (lk?.users ?? []).filter((u) => u.isDeptManager && u.departmentId === deptId);
  const autoKey = `${deptId}|${prepId}|${relatedOpts.length}|${managerOpts.length}`;
  useEffect(() => {
    if (editing || !deptId) return; // phiếu đang sửa giữ nguyên nội dung đã lưu
    setC((x) => ({ ...x, relatedPersonName: relatedOpts[0]?.fullName ?? "", managerName: managerOpts[0]?.fullName ?? "" }));
  }, [autoKey, editing]);

  if (!lk) return <Spinner />;
  const typeOpts: Opt[] = lk.types.map((t) => ({ value: t.id, label: t.name, name: t.name }));
  const projectOpts: Opt[] = lk.projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}`, name: p.name }));
  const deptOpts: Opt[] = lk.departments.map((d) => ({ value: d.id, label: d.name, name: d.name }));
  const contractorOpts: Opt[] = lk.contractors.map((t) => ({ value: t.id, label: t.name, name: t.name }));
  const project = lk.projects.find((p) => p.id === nd.projectId);
  // Dự án có gắn đối tác thì chỉ chọn trong danh sách đối tác của dự án
  const partnerOpts = project?.partnerIds.length ? contractorOpts.filter((t) => project.partnerIds.includes(t.value)) : contractorOpts;
  // Tạo hộ: người cùng phòng ban (Quản trị viên chọn được mọi người, trừ Ban kiểm soát)
  const bksDeptId = lk.departments.find((d) => d.code === "BKS")?.id;
  const others = lk.users.filter((u) => u.id !== me.id && u.departmentId && u.departmentId !== bksDeptId && (me.role === "ADMIN" || u.departmentId === myDeptId));
  const set = (k: keyof SheetContent, v: string) => setC((x) => ({ ...x, [k]: v }));
  const pickPreparer = (uid: string) => {
    setPreparerId(uid);
    const u = lk.users.find((x) => x.id === uid);
    setC((x) => ({ ...x, preparerName: u?.fullName ?? me.fullName }));
    if (u?.departmentId && me.role === "ADMIN") setNew("departmentId", u.departmentId);
  };
  const setNew = (k: keyof typeof nd, v: string) => {
    setNd((x) => ({ ...x, [k]: v }));
    if (k === "projectId") {
      const p = lk.projects.find((x) => x.id === v);
      // Chọn dự án -> tự điền tên dự án và Chủ đầu tư; nếu dự án chỉ có 1 đối tác thì chọn luôn đối tác đó
      const only = p?.partnerIds.length === 1 ? lk.contractors.find((t) => t.id === p.partnerIds[0]) : undefined;
      setNd((x) => ({ ...x, projectId: v, contractorId: only?.id ?? "" }));
      if (only) setTxt((x) => ({ ...x, partner: only.name }));
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
  const today = toInputDate(new Date());

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (editing) {
        await api(`/api/signing-forms/${id}`, { method: "PATCH", json: { content: c, reason: resubmitNo > 0 ? reason : null } });
        toast("success", "Đã lưu phiếu");
        router.push(`/forms/${id}`);
      } else {
        if (mode === "new" && forOther && !preparerId) throw new Error("Chọn người được tạo hộ");
        const body = mode === "existing"
          ? { documentId, content: c, reason: resubmitNo > 0 ? reason : null }
          : { newDocument: { ...nd, contractorId: nd.contractorId || null, docNumber: nd.docNumber || null, preparerId: forOther ? preparerId : null }, content: c };
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

  const nameField = (k: "relatedPersonName" | "managerName", opts: { id: string; fullName: string }[]) =>
    opts.length > 1
      ? <Select value={c[k]} onChange={(e) => set(k, e.target.value)} placeholder="— Bỏ trống để ký tay —" options={opts.map((u) => ({ value: u.fullName, label: u.fullName }))} />
      : <input className="input" value={c[k]} onChange={(e) => set(k, e.target.value)} placeholder="Bỏ trống để ký tay" />;

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
              <>
                <div className="mb-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <span className="font-semibold text-slate-600">Người lập:</span>
                    <label className="flex items-center gap-2"><input type="radio" checked={!forOther} onChange={() => { setForOther(false); pickPreparer(""); }} /> Tạo cho cá nhân</label>
                    <label className="flex items-center gap-2"><input type="radio" checked={forOther} onChange={() => setForOther(true)} /> Tạo giúp hộ người khác</label>
                  </div>
                  {forOther && (
                    <Field label="Người được tạo hộ (là người lập trên phiếu)" required className="mt-2" hint={me.role === "ADMIN" ? undefined : "Người cùng phòng ban"}>
                      <Select value={preparerId} onChange={(e) => pickPreparer(e.target.value)} placeholder="— Chọn người —" options={others.map((u) => ({ value: u.id, label: u.fullName }))} />
                    </Field>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-4 text-sm">
                  <span className="font-semibold text-slate-600">Cách nhập:</span>
                  <label className="flex items-center gap-2"><input type="radio" checked={!typed} onChange={() => setTyped(false)} /> Chọn từ danh sách</label>
                  <label className="flex items-center gap-2"><input type="radio" checked={typed} onChange={() => setTyped(true)} /> Nhập tay (gợi ý theo danh mục)</label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Loại hồ sơ" required hint={typed ? "Phải có trong danh mục để lưu hồ sơ" : undefined}>
                    <CatalogPick typed={typed} id={nd.typeId} text={txt.type} options={typeOpts} placeholder="— Chọn —" onPick={(v, t) => { setNew("typeId", v); setTxt((x) => ({ ...x, type: t })); }} />
                  </Field>
                  <Field label="Dự án / Công trình" required hint={typed ? "Phải có trong danh mục để lưu hồ sơ" : undefined}>
                    <CatalogPick typed={typed} id={nd.projectId} text={txt.project} options={projectOpts} placeholder="— Chọn —" onPick={(v, t) => { setNew("projectId", v); setTxt((x) => ({ ...x, project: t })); if (!v) set("projectName", t); }} />
                  </Field>
                  <Field label="Phòng ban trình ký" required hint={canPickDept ? undefined : "Theo phòng ban của người lập"}><Select disabled={!canPickDept} value={nd.departmentId} onChange={(e) => setNew("departmentId", e.target.value)} placeholder="— Chọn —" options={lk.departments.map((d) => ({ value: d.id, label: d.name }))} /></Field>
                  <Field label="Chủ đầu tư / NCC / Thầu phụ" hint={project ? (project.partnerIds.length ? `Đối tác của dự án${project.investor ? ` · CĐT: ${project.investor}` : ""}` : "Dự án chưa gắn đối tác (Danh mục > Công trình / dự án)") : "Chọn dự án trước"}>
                    <CatalogPick typed={typed} id={nd.contractorId} text={txt.partner} options={partnerOpts} placeholder={project?.investor ? `CĐT: ${project.investor}` : "— Không chọn —"} onPick={(v, t) => { setNew("contractorId", v); setTxt((x) => ({ ...x, partner: t })); if (!v) set("partnerName", t); }} />
                  </Field>
                  <Field label="Số hồ sơ / số hiệu văn bản"><input className="input" value={nd.docNumber} onChange={(e) => setNew("docNumber", e.target.value)} /></Field>
                </div>
              </>
            )}
          </Card>
        )}

        <Card title={`${editing ? "" : "2. "}Nội dung phiếu (in đúng theo mẫu)`}>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tên hồ sơ / Loại hồ sơ" required className="md:col-span-2"><textarea className="input" rows={2} value={c.docTitle} onChange={(e) => set("docTitle", e.target.value)} /></Field>
            <Field label="Dự án / Công trình"><SuggestInput value={c.projectName} options={projectOpts} onChange={(v) => set("projectName", v)} /></Field>
            <Field label="Tên Chủ đầu tư / Nhà cung cấp / Thầu phụ…"><SuggestInput value={c.partnerName} options={contractorOpts} onChange={(v) => set("partnerName", v)} /></Field>
            <Field label="Ngày trình ký" required>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5"><input type="radio" checked={!pickDate} onChange={() => { setPickDate(false); set("submitDate", today); }} /> Hôm nay</label>
                <label className="flex items-center gap-1.5"><input type="radio" checked={pickDate} onChange={() => setPickDate(true)} /> Chọn theo lịch</label>
                {pickDate && <input type="date" className="input w-auto" value={c.submitDate} onChange={(e) => set("submitDate", e.target.value)} />}
              </div>
            </Field>
            <Field label="Phòng ban"><SuggestInput value={c.departmentName} options={deptOpts} onChange={(v) => set("departmentName", v)} /></Field>
            <Field label="Trình ký lần" hint="Hệ thống tự xác định theo số lần hồ sơ đã trình">
              <div className="input bg-slate-50 font-semibold">{resubmitNo === 0 ? "☑ Lần đầu" : `☑ Trình lại - lần: ${resubmitNo}`}</div>
            </Field>
            {resubmitNo > 0 && (
              <Field label="Lý do trình ký lại" required className="md:col-span-2"><textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            )}
            <Field label="Nội dung khác" className="md:col-span-2"><textarea className="input" rows={2} value={c.otherContent} onChange={(e) => set("otherContent", e.target.value)} /></Field>
            <Field label="Người lập"><input className="input" value={c.preparerName} onChange={(e) => set("preparerName", e.target.value)} /></Field>
            <Field label="Phụ trách liên quan" hint={!editing && deptId ? (relatedOpts.length ? "Theo phòng ban, khối của người lập" : "Phòng ban / khối chưa có Phụ trách liên quan") : undefined}>{nameField("relatedPersonName", relatedOpts)}</Field>
            <Field label="Quản lý phòng ban" hint={!editing && deptId && !managerOpts.length ? "Phòng ban chưa có Quản lý phòng ban" : undefined}>{nameField("managerName", managerOpts)}</Field>
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
