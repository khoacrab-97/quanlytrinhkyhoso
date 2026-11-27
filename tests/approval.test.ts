// Kiểm thử thẩm quyền xác nhận giai đoạn: Phụ trách liên quan (đúng khối) -> Quản lý phòng ban -> Ban kiểm soát.
// Tạo phòng ban, khối, người dùng tạm và xóa sạch sau khi chạy.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { createDocument } from "../src/server/documents";
import { performAction, type Actor } from "../src/server/workflow";
import { loadApprover, pendingForWhere } from "../src/server/approval";

const TAG = `T${Date.now().toString(36)}`;
const ids = { dept: "", bksDept: "", createdBksDept: false, users: [] as string[], doc: "" };
const u: Record<string, Actor> = {};

async function mkUser(key: string, data: { departmentId: string; divisionId?: string | null; isRelatedPerson?: boolean; isDeptManager?: boolean }) {
  const x = await prisma.user.create({ data: { username: `${TAG}.${key}`.toLowerCase(), fullName: `Test ${key}`, passwordHash: "x", role: "STAFF", dataScope: "DEPARTMENT", ...data } });
  ids.users.push(x.id);
  u[key] = { id: x.id, role: "STAFF", departmentId: x.departmentId };
}

before(async () => {
  const dept = await prisma.department.create({ data: { code: `${TAG}-PB`, name: "Phòng test thẩm quyền" } });
  ids.dept = dept.id;
  const k1 = await prisma.division.create({ data: { code: `${TAG}-K1`, name: "Khối 1", departmentId: dept.id } });
  const k2 = await prisma.division.create({ data: { code: `${TAG}-K2`, name: "Khối 2", departmentId: dept.id } });
  let bks = await prisma.department.findUnique({ where: { code: "BKS" } });
  if (!bks) { bks = await prisma.department.create({ data: { code: "BKS", name: "Ban kiểm soát" } }); ids.createdBksDept = true; }
  ids.bksDept = bks.id;
  await mkUser("lap", { departmentId: dept.id, divisionId: k1.id });
  await mkUser("ptlq1", { departmentId: dept.id, divisionId: k1.id, isRelatedPerson: true });
  await mkUser("ptlq2", { departmentId: dept.id, divisionId: k2.id, isRelatedPerson: true });
  await mkUser("qlpb", { departmentId: dept.id, isDeptManager: true });
  await mkUser("bks", { departmentId: bks.id });
  const type = await prisma.documentType.findFirstOrThrow();
  const p = await prisma.project.create({ data: { code: `${TAG}-CT`, name: "Công trình test" } }); // dự án riêng của file test
  const doc = await createDocument(
    { docNumber: null, title: "Hồ sơ test thẩm quyền", typeId: type.id, projectId: p.id, contractorId: null, departmentId: dept.id, preparerId: u.lap.id, submitterId: null, recipientId: null, preparedDate: new Date(Date.now() - 86_400_000), priority: 2, notes: null, customFields: null },
    u.lap,
    { isSample: true },
  );
  ids.doc = doc.id;
  await performAction(doc.id, { action: "submit" }, u.lap);
});

after(async () => {
  await prisma.document.delete({ where: { id: ids.doc } }).catch(() => {});
  await prisma.project.deleteMany({ where: { code: `${TAG}-CT` } });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.notification.deleteMany({ where: { userId: { in: ids.users } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.division.deleteMany({ where: { departmentId: ids.dept } });
  await prisma.department.delete({ where: { id: ids.dept } });
  if (ids.createdBksDept) await prisma.department.delete({ where: { id: ids.bksDept } });
  await prisma.$disconnect();
});

const status = async () => (await prisma.document.findUniqueOrThrow({ where: { id: ids.doc }, include: { status: true } })).status.code;
const advance = (who: string, stage: string) => performAction(ids.doc, { action: "advance", stage: stage as never }, u[who]);
const pendingIds = async (who: string) =>
  (await prisma.document.findMany({ where: { AND: [{ id: ids.doc }, pendingForWhere(await loadApprover(prisma, u[who].id))] }, select: { id: true } })).map((d) => d.id);

describe("Thẩm quyền xác nhận giai đoạn", () => {
  test("Trình Phụ trách liên quan: chỉ PTLQ cùng khối với người lập xác nhận được", async () => {
    assert.equal(await status(), "STAGE_CHECK");
    await assert.rejects(() => advance("lap", "STAGE_MANAGER"), /Chỉ Phụ trách liên quan/);
    await assert.rejects(() => advance("ptlq2", "STAGE_MANAGER"), /Chỉ Phụ trách liên quan/);
    await assert.rejects(() => advance("qlpb", "STAGE_MANAGER"), /Chỉ Phụ trách liên quan/);
    assert.deepEqual(await pendingIds("ptlq1"), [ids.doc], "hiện trong Chờ tôi xác nhận của PTLQ đúng khối");
    assert.deepEqual(await pendingIds("ptlq2"), []);
  });

  test("Không được xác nhận vượt giai đoạn", async () => {
    await assert.rejects(() => advance("ptlq1", "STAGE_BKS"), /giai đoạn kế tiếp/);
  });

  test("PTLQ xác nhận Đã kiểm tra -> chờ Quản lý phòng ban", async () => {
    await advance("ptlq1", "STAGE_MANAGER");
    assert.equal(await status(), "STAGE_MANAGER");
    await assert.rejects(() => advance("ptlq1", "STAGE_BKS"), /Chỉ Quản lý phòng ban/);
    assert.deepEqual(await pendingIds("qlpb"), [ids.doc]);
  });

  test("Quản lý phòng ban phê duyệt -> chờ Ban kiểm soát", async () => {
    await advance("qlpb", "STAGE_BKS");
    assert.equal(await status(), "STAGE_BKS");
    assert.deepEqual(await pendingIds("bks"), [ids.doc], "BKS thấy hồ sơ của phòng khác");
  });

  test("Chỉ Ban kiểm soát được trả về; BKS trả về -> chờ in ký lại", async () => {
    const cat = await prisma.errorCategory.findFirstOrThrow();
    const ret = (who: string) => performAction(ids.doc, { action: "return", requirement: "Sai số liệu", errors: [{ categoryId: cat.id, customReason: "Sai số liệu" }] }, u[who]);
    await assert.rejects(() => ret("qlpb"), /Chỉ Ban kiểm soát/);
    await assert.rejects(() => ret("lap"), /Chỉ Ban kiểm soát/);
    await ret("bks");
    assert.equal(await status(), "BKS_RETURNED");
  });

  test("In ký lại -> đi lại đủ các cấp; BKS kiểm duyệt rồi BKS xác nhận TGĐ đã ký", async () => {
    await performAction(ids.doc, { action: "submit" }, u.lap);
    await advance("ptlq1", "STAGE_MANAGER");
    await advance("qlpb", "STAGE_BKS");
    await advance("bks", "STAGE_CEO");
    assert.equal(await status(), "STAGE_CEO");
    await assert.rejects(() => advance("lap", "CEO_SIGNED"), /Chỉ Ban kiểm soát/);
    await assert.rejects(() => advance("qlpb", "CEO_SIGNED"), /Chỉ Ban kiểm soát/);
    await advance("bks", "CEO_SIGNED");
    const d = await prisma.document.findUniqueOrThrow({ where: { id: ids.doc }, include: { status: true } });
    assert.equal(d.status.code, "CEO_SIGNED");
    assert.ok(d.approvedAt);
    assert.equal(d.returnCount, 1);
  });
});
