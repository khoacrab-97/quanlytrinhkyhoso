// Kiểm thử quy tắc phiếu trình ký: in -> khóa, in lại trong 60 phút, quá hạn phải trình ký lại có lý do.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { confirmPrint, createForm, deleteDraft, resubmitForm, updateForm, formState } from "../src/server/signingForms";
import { performAction } from "../src/server/workflow";
import type { CurrentUser } from "../src/server/session";

let me: CurrentUser;
let docId = "";
let formId = "";
const content = {
  docTitle: "Công văn cam kết hoàn thành HĐ & PLHĐ số 10/2025/PLHĐ", projectName: "Trung tâm triển lãm quy hoạch", partnerName: "Ban QLDA",
  submitDate: "2026-11-25", departmentName: "Phòng Dự án", otherContent: "", preparerName: "Quản trị hệ thống", relatedPersonName: "", managerName: "",
};

before(async () => {
  const u = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  me = { id: u.id, username: u.username, fullName: u.fullName, role: "ADMIN", dataScope: "ALL", departmentId: u.departmentId, departmentName: null, position: null, projectIds: [], preferences: {}, isBks: false, approvalRole: "ADMIN", catalogGrants: [] };
  // Dự án riêng của file test (các file test chạy song song), xóa sau khi chạy
  const [t, p, d] = await Promise.all([prisma.documentType.findFirstOrThrow(), prisma.project.upsert({ where: { code: "TEST-SF" }, update: {}, create: { code: "TEST-SF", name: "Công trình test phiếu" } }), prisma.department.findFirstOrThrow()]);
  const f = await createForm({ documentId: null, newDocument: { typeId: t.id, projectId: p.id, departmentId: d.id, contractorId: null, recipientId: null, preparerId: null, docNumber: null }, content, reason: null }, me);
  formId = f.id;
  docId = f.documentId;
  await prisma.document.update({ where: { id: docId }, data: { isSample: true } });
});

after(async () => {
  await prisma.document.delete({ where: { id: docId } }).catch(() => {});
  await prisma.project.deleteMany({ where: { code: "TEST-SF", documents: { none: {} } } });
  await prisma.$disconnect();
});

const load = (id: string) => prisma.signingForm.findUniqueOrThrow({ where: { id }, include: { document: { include: { status: true, recipient: true } } } });

describe("Phiếu trình ký", () => {
  test("phiếu mới: lần đầu, đang soạn, sửa được", async () => {
    const f = await load(formId);
    assert.equal(f.status, "DRAFT");
    assert.equal(f.resubmitNo, 0);
    assert.match(f.code, /^PTK-\d{4}-\d{5}$/);
    await updateForm(me, formId, { content: { ...content, otherContent: "Bổ sung bản gốc" } });
  });

  test("không được trình ký lại khi chưa in", async () => {
    await assert.rejects(() => resubmitForm(me, formId, { reason: "Lý do bất kỳ" }), /Không thể trình ký lại/);
  });

  test("xác nhận in -> khóa phiếu + hồ sơ được ghi nhận trình lần 1", async () => {
    await confirmPrint(me, formId);
    const f = await load(formId);
    assert.equal(f.status, "PRINTED");
    assert.equal(f.printCount, 1);
    assert.ok(f.printedAt);
    assert.equal(f.document.submissionCount, 1);
    await assert.rejects(() => updateForm(me, formId, { content }), /không được sửa/);
  });

  test("in lại trong thời hạn được ghi nhận", async () => {
    const r = await confirmPrint(me, formId);
    assert.equal(r.reprint, true);
    assert.equal((await load(formId)).printCount, 2);
    assert.equal(await prisma.signingFormPrint.count({ where: { formId } }), 2);
  });

  test("quá 60 phút: không được in lại", async () => {
    await prisma.signingForm.update({ where: { id: formId }, data: { printedAt: new Date(Date.now() - 61 * 60_000) } });
    const st = await formState(me, await load(formId));
    assert.equal(st.canReprint, false);
    assert.equal(st.canResubmit, true);
    await assert.rejects(() => confirmPrint(me, formId), /không được in lại/);
  });

  test("trình ký lại bắt buộc lý do, số lần tự tăng = 1", async () => {
    await assert.rejects(() => resubmitForm(me, formId, { reason: "abc" }), /bắt buộc nhập lý do/);
    const f2 = await resubmitForm(me, formId, { reason: "Chủ đầu tư yêu cầu bổ sung chữ ký" });
    assert.equal(f2.resubmitNo, 1);
    assert.equal(f2.status, "DRAFT");
    assert.equal(f2.resubmitReason, "Chủ đầu tư yêu cầu bổ sung chữ ký");
    // phiếu cũ không còn là phiếu mới nhất
    await assert.rejects(() => resubmitForm(me, formId, { reason: "Lý do khác nữa" }), /phiếu mới nhất/);

    await confirmPrint(me, f2.id);
    const d = await prisma.document.findUniqueOrThrow({ where: { id: docId }, include: { status: true, submissions: { orderBy: { round: "asc" } } } });
    assert.equal(d.submissionCount, 2);
    assert.equal(d.status.code, "STAGE_CHECK", "in ký lại -> quay về giai đoạn Trình Phụ trách liên quan");
    assert.equal(d.submissions[0].result, "WITHDRAWN", "lần trình trước đang chờ được đánh dấu rút lại");
    assert.equal(d.submissions[1].result, "PENDING");
  });

  test("ở Ban kiểm soát: người lập chưa trình ký lại được; BKS bấm Trả về (nhóm lỗi) rồi mới trình ký lại", async () => {
    const forms = await prisma.signingForm.findMany({ where: { documentId: docId }, orderBy: { resubmitNo: "desc" } });
    const latest = forms[0];
    await prisma.signingForm.update({ where: { id: latest.id }, data: { printedAt: new Date() } }); // còn trong 60 phút
    await performAction(docId, { action: "advance", stage: "STAGE_BKS" }, me);
    assert.equal((await formState(me, await load(latest.id))).atBks, true);
    await assert.rejects(() => resubmitForm(me, latest.id, { reason: "Sai số liệu bảng tổng hợp" }), /không được rút về/);
    const cat = await prisma.errorCategory.findFirstOrThrow({ where: { code: "ND" } });
    await performAction(docId, { action: "return", requirement: "Sai số liệu bảng tổng hợp", errors: [{ categoryId: cat.id, customReason: "Sai số liệu bảng tổng hợp" }] }, me);
    const f = await resubmitForm(me, latest.id, { reason: "Sai số liệu bảng tổng hợp" });
    assert.equal(f.resubmitNo, 2);
    assert.equal(f.resubmitReason, "Sai số liệu bảng tổng hợp");
    const d = await prisma.document.findUniqueOrThrow({ where: { id: docId }, include: { status: true, returns: { include: { errors: true } } } });
    assert.equal(d.status.code, "BKS_RETURNED");
    assert.equal(d.returnCount, 1);
    assert.equal(d.returns[0].errors[0].categoryId, cat.id);
    assert.equal(d.returns[0].errors[0].customReason, "Sai số liệu bảng tổng hợp");
    // Phiếu cũ không được in lại dù còn trong thời hạn
    const st = await formState(me, await load(latest.id));
    assert.equal(st.canReprint, false);
    await assert.rejects(() => confirmPrint(me, latest.id), /không được in lại/);
    // In phiếu mới -> quay về giai đoạn đầu
    await confirmPrint(me, f.id);
    assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: docId }, include: { status: true } })).status.code, "STAGE_CHECK");
  });

  test("trình ký lại khi chưa tới Ban kiểm soát: chỉ cần lý do, không tính lỗi", async () => {
    const f = await prisma.signingForm.findFirstOrThrow({ where: { documentId: docId }, orderBy: { resubmitNo: "desc" } });
    await prisma.signingForm.update({ where: { id: f.id }, data: { printedAt: new Date(Date.now() - 61 * 60_000) } });
    const f4 = await resubmitForm(me, f.id, { reason: "Mất bản in, in lại" });
    assert.equal(f4.resubmitNo, 3);
    assert.equal((await prisma.document.findUniqueOrThrow({ where: { id: docId } })).returnCount, 1);
    await deleteDraft(me, f4.id);
  });

  test("hồ sơ đã có trình -> phiếu tạo mới tự là trình lại, bắt buộc lý do", async () => {
    // tạo lần 4 theo luồng tạo phiếu cho hồ sơ có sẵn
    await prisma.signingForm.updateMany({ where: { documentId: docId }, data: { printedAt: new Date(Date.now() - 2 * 3600_000) } });
    await assert.rejects(() => createForm({ documentId: docId, newDocument: null, content, reason: null }, me), /bắt buộc nhập lý do/);
    const f3 = await createForm({ documentId: docId, newDocument: null, content, reason: "Trình lại sau khi bổ sung hồ sơ" }, me);
    assert.equal(f3.resubmitNo, 3);
    await assert.rejects(() => createForm({ documentId: docId, newDocument: null, content, reason: "Thêm phiếu nữa" }, me), /phiếu chưa in/);
  });
});
