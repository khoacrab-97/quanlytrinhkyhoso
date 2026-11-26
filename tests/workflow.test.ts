// Kiểm thử luồng 4 giai đoạn trực tiếp trên CSDL (cần DB đã migrate + seed).
//   In phiếu -> Trình Phụ trách liên quan > Quản lý phòng ban ký duyệt > Ban kiểm soát > TGĐ đã ký
//   Ban kiểm soát trả về -> phải in ký lại, quay về giai đoạn đầu.
// Chạy: npm test
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createDocument } from "../src/server/documents";
import { allowedActions, performAction, type Actor } from "../src/server/workflow";
import { computeKpis } from "../src/server/analytics";

let actor: Actor;
let docId = "";
const day = (n: number) => new Date(Date.now() - n * 86_400_000);

before(async () => {
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  actor = { id: admin.id, role: "ADMIN", departmentId: admin.departmentId };
  const [type, project, dept] = await Promise.all([
    prisma.documentType.findFirstOrThrow({ where: { code: "TTGD" } }),
    prisma.project.findFirst(),
    prisma.department.findFirstOrThrow(),
  ]);
  const p = project ?? (await prisma.project.create({ data: { code: "TEST-CT", name: "Công trình test" } }));
  const doc = await createDocument(
    { docNumber: "TEST/001", title: "Hồ sơ kiểm thử tự động", typeId: type.id, projectId: p.id, contractorId: null, departmentId: dept.id, preparerId: admin.id, submitterId: null, recipientId: null, preparedDate: day(10), priority: 2, notes: null, customFields: null },
    actor,
    { isSample: true },
  );
  docId = doc.id;
});

after(async () => {
  await prisma.document.delete({ where: { id: docId } }).catch(() => {});
  await prisma.$disconnect();
});

const load = () =>
  prisma.document.findUniqueOrThrow({
    where: { id: docId },
    include: { status: true, submissions: { orderBy: { round: "asc" } }, returns: { include: { errors: true }, orderBy: { returnedAt: "asc" } }, statusHistory: true, activities: { include: { status: true } } },
  });

describe("Luồng 4 giai đoạn, Ban kiểm soát trả nhiều lần", () => {
  test("hồ sơ mới: Đang soạn phiếu, mã tự sinh, không có hạn xử lý", async () => {
    const d = await load();
    assert.equal(d.status.code, "PREPARING");
    assert.match(d.code, /^HS-\d{4}-\d{5}$/);
    assert.equal(d.dueDate, null);
  });

  test("chưa in nộp thì không xác nhận giai đoạn được", async () => {
    await assert.rejects(() => performAction(docId, { action: "advance", stage: "STAGE_MANAGER", at: day(9) }, actor), /Không thể thực hiện/);
  });

  test("in nộp lần 1 -> Trình Phụ trách liên quan", async () => {
    await performAction(docId, { action: "submit", at: day(9) }, actor);
    const d = await load();
    assert.equal(d.status.code, "STAGE_CHECK");
    assert.equal(d.submissionCount, 1);
    assert.equal(d.dueDate, null, "không còn tính hạn xử lý");
  });

  test("Phụ trách liên quan / QL phòng ban không được trả hồ sơ, chỉ Ban kiểm soát", async () => {
    const cat = await prisma.errorCategory.findFirstOrThrow({ where: { code: "KH" } });
    await assert.rejects(() => performAction(docId, { action: "return", at: day(8), errors: [{ categoryId: cat.id, customReason: "x" }] }, actor), /Ban kiểm soát/);
    assert.deepEqual(allowedActions((await load()).status).includes("return"), false);
  });

  test("xác nhận QL phòng ban ký duyệt rồi Ban kiểm soát; không lùi giai đoạn", async () => {
    await performAction(docId, { action: "advance", stage: "STAGE_MANAGER", at: day(8) }, actor);
    await performAction(docId, { action: "advance", stage: "STAGE_BKS", at: day(7) }, actor);
    const d = await load();
    assert.equal(d.status.code, "STAGE_BKS");
    await assert.rejects(() => performAction(docId, { action: "advance", stage: "STAGE_MANAGER", at: day(7) }, actor), /sau giai đoạn hiện tại/);
    assert.ok(allowedActions(d.status).includes("return"));
  });

  test("BKS trả với 2 lỗi -> chờ in ký lại, lần nộp 1 = RETURNED", async () => {
    const cats = await prisma.errorCategory.findMany({ include: { reasons: true }, orderBy: { order: "asc" } });
    await performAction(docId, {
      action: "return", at: day(6), requirement: "Bổ sung hồ sơ nghiệm thu",
      errors: [
        { categoryId: cats[3].id, reasonId: cats[3].reasons[2].id },
        { categoryId: cats[1].id, reasonId: cats[1].reasons[4].id, description: "Sai số liệu tổng hợp" },
      ],
    }, actor);
    const d = await load();
    assert.equal(d.status.code, "BKS_RETURNED");
    assert.equal(d.returnCount, 1);
    assert.equal(d.returns[0].errors.length, 2);
    assert.equal(d.returns[0].returnedByName, "Ban kiểm soát");
    assert.equal(d.submissions[0].result, "RETURNED");
    // Không xác nhận giai đoạn được nữa, chỉ in ký lại
    assert.deepEqual(allowedActions(d.status).filter((a) => ["advance", "submit"].includes(a)), ["submit"]);
  });

  test("in ký lại -> quay về Trình Phụ trách liên quan, lần trả trước được đóng", async () => {
    await performAction(docId, { action: "submit", at: day(5) }, actor);
    const d = await load();
    assert.equal(d.status.code, "STAGE_CHECK");
    assert.equal(d.submissionCount, 2);
    assert.equal(d.returns[0].fixStatus, "CLOSED");
    assert.ok(d.returns[0].errors.every((e) => e.resolved));
  });

  test("nguyên nhân lỗi không thuộc nhóm bị từ chối", async () => {
    const cats = await prisma.errorCategory.findMany({ include: { reasons: true }, orderBy: { order: "asc" } });
    await performAction(docId, { action: "advance", stage: "STAGE_BKS", at: day(4) }, actor);
    await assert.rejects(
      () => performAction(docId, { action: "return", at: day(4), errors: [{ categoryId: cats[0].id, reasonId: cats[2].reasons[0].id }] }, actor),
      /không thuộc nhóm/,
    );
  });

  test("xác nhận vượt giai đoạn: các giai đoạn bỏ qua có mốc cùng thời điểm", async () => {
    const d = await load();
    const round2 = d.activities.filter((a) => a.startedAt >= d.lastSubmittedAt!).map((a) => a.status?.code);
    assert.deepEqual(round2.filter(Boolean), ["STAGE_CHECK", "STAGE_MANAGER", "STAGE_BKS"]);
  });

  test("BKS trả lần 2, in ký lại lần 3, BKS kiểm duyệt, chờ TGĐ ký, TGĐ đã ký", async () => {
    const cat = await prisma.errorCategory.findFirstOrThrow({ where: { code: "KH" } });
    await performAction(docId, { action: "return", at: day(3), errors: [{ categoryId: cat.id, customReason: "CĐT thay đổi yêu cầu" }] }, actor);
    await performAction(docId, { action: "submit", at: day(2) }, actor);
    await performAction(docId, { action: "advance", stage: "STAGE_CEO", at: day(1.5) }, actor);
    const w = await load();
    assert.equal(w.status.code, "STAGE_CEO", "BKS đã kiểm duyệt -> chờ TGĐ ký");
    assert.equal(w.approvedAt, null, "chưa ký thì chưa hoàn thành");
    await performAction(docId, { action: "advance", stage: "CEO_SIGNED", at: day(1) }, actor);
    const d = await load();
    assert.equal(d.status.code, "CEO_SIGNED");
    assert.equal(d.returnCount, 2);
    assert.equal(d.submissionCount, 3);
    assert.ok(d.approvedAt && d.completedAt);
    assert.equal(d.submissions[2].result, "APPROVED");
    assert.deepEqual(allowedActions(d.status).filter((a) => ["advance", "return", "submit"].includes(a)), []);
    assert.ok(d.activities.filter((a) => !["NOTE", "UPDATE", "ATTACH"].includes(a.type)).every((a) => a.endedAt));
  });

  test("KPI: số hồ sơ bị trả, số lần trả, số lần in nộp", async () => {
    const docs = await prisma.document.findMany({
      where: { id: docId },
      select: {
        id: true, code: true, title: true, preparedDate: true, firstSubmittedAt: true, lastSubmittedAt: true, approvedAt: true, completedAt: true, returnCount: true, submissionCount: true,
        priority: true, lastActivityAt: true, departmentId: true, preparerId: true, currentHolderNote: true,
        status: { select: { name: true, color: true, category: true, code: true } }, type: { select: { id: true, name: true } },
        project: { select: { id: true, code: true, name: true } }, department: { select: { id: true, name: true } }, preparer: { select: { id: true, fullName: true } },
        currentHolder: { select: { fullName: true } }, currentDepartment: { select: { name: true } },
      },
    });
    const k = computeKpis(docs);
    assert.equal(k.returnedDocs, 1);
    assert.equal(k.totalReturns, 2);
    assert.equal(k.submissions, 3);
    assert.equal(k.resubmissions, 2);
    assert.equal(k.completed, 1);
    assert.equal(k.completionRate, 100);
  });

  test("không được thực hiện thao tác ở thời điểm tương lai", async () => {
    await assert.rejects(() => performAction(docId, { action: "note", note: "x", at: new Date(Date.now() + 86_400_000) }, actor), /tương lai/);
  });
});
