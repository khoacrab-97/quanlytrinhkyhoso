// Kiểm thử nhanh API qua HTTP (cần server đang chạy + dữ liệu mẫu).
// Chạy: npm run test:api   (BASE_URL mặc định http://localhost:3000)
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PASS: Record<string, string> = { admin: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123" };

async function login(username: string) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password: PASS[username] ?? "Matkhau@123" }) });
  assert.equal(r.status, 200, `đăng nhập ${username}`);
  const cookie = r.headers.get("set-cookie")!.split(";")[0];
  return (path: string, init: RequestInit = {}) => fetch(`${BASE}${path}`, { ...init, headers: { ...(init.headers ?? {}), cookie, "Content-Type": "application/json" } });
}

const results: [string, boolean, string?][] = [];
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push([name, true]);
  } catch (e) {
    results.push([name, false, (e as Error).message]);
  }
}

(async () => {
  await check("Chưa đăng nhập -> 401", async () => assert.equal((await fetch(`${BASE}/api/documents`)).status, 401));
  await check("Sai mật khẩu -> 401", async () => {
    const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "admin", password: "sai" }) });
    assert.equal(r.status, 401);
  });

  const admin = await login("admin");
  const viewer = await login("xem");
  const staffOwn = await login("nv.linh");
  const staffDept = await login("nv.binh");

  await check("Admin thấy toàn bộ hồ sơ", async () => {
    const j = await (await admin("/api/documents?pageSize=1")).json();
    assert.ok(j.total > 100);
  });
  await check("Phạm vi OWN thấy ít hồ sơ hơn admin", async () => {
    const a = await (await admin("/api/documents?pageSize=1")).json();
    const o = await (await staffOwn("/api/documents?pageSize=1")).json();
    assert.ok(o.total < a.total, `${o.total} < ${a.total}`);
  });
  await check("Viewer không được tạo hồ sơ (403)", async () => assert.equal((await viewer("/api/documents", { method: "POST", body: "{}" })).status, 403));
  await check("Viewer không xem được báo cáo nhân sự (403)", async () => assert.equal((await viewer("/api/reports/staff")).status, 403));
  await check("Staff không quản lý được danh mục (403)", async () => assert.equal((await staffDept("/api/catalogs/projects", { method: "POST", body: "{}" })).status, 403));
  await check("Staff không xem được nhật ký hệ thống (403)", async () => assert.equal((await staffDept("/api/audit")).status, 403));
  await check("Dữ liệu không hợp lệ -> 400 kèm thông báo", async () => {
    const r = await admin("/api/documents", { method: "POST", body: JSON.stringify({ title: "a" }) });
    assert.equal(r.status, 400);
    assert.match((await r.json()).error, /không hợp lệ/);
  });
  await check("Dashboard trả KPI", async () => {
    const j = await (await admin("/api/dashboard")).json();
    assert.ok(j.kpis.total >= 0 && Array.isArray(j.monthly));
  });
  for (const t of ["summary", "time", "errors", "staff"]) {
    await check(`Báo cáo ${t} JSON`, async () => assert.equal((await admin(`/api/reports/${t}`)).status, 200));
    await check(`Báo cáo ${t} Excel`, async () => {
      const r = await admin(`/api/reports/${t}?format=xlsx`);
      assert.equal(r.status, 200);
      assert.match(r.headers.get("content-type")!, /spreadsheetml/);
      assert.ok((await r.arrayBuffer()).byteLength > 1000);
    });
    await check(`Báo cáo ${t} PDF`, async () => {
      const r = await admin(`/api/reports/${t}?format=pdf`);
      assert.equal(r.status, 200);
      const b = Buffer.from(await r.arrayBuffer());
      assert.equal(b.subarray(0, 4).toString(), "%PDF");
    });
  }
  await check("Xuất danh sách hồ sơ Excel", async () => assert.equal((await admin("/api/documents/export?format=xlsx")).status, 200));
  await check("Tải file mẫu import", async () => assert.equal((await admin("/api/documents/import/template")).status, 200));
  await check("API cảnh báo quá hạn đã bỏ (404)", async () => assert.equal((await admin("/api/alerts")).status, 404));
  await check("Phân tích lỗi", async () => assert.ok((await (await admin("/api/errors")).json()).summary.totalReturns >= 0));
  await check("Theo dõi trình ký có mốc 4 giai đoạn", async () => {
    const j = await (await admin("/api/tracking?view=all&pageSize=5")).json();
    assert.ok(j.total > 0);
    assert.deepEqual(Object.keys(j.rows[0].stages), ["STAGE_CHECK", "STAGE_MANAGER", "STAGE_BKS", "STAGE_CEO", "CEO_SIGNED"]);
  });
  await check("Danh mục dự án có đối tác (CĐT/NCC/thầu phụ)", async () => {
    const lk = await (await admin("/api/lookups")).json();
    assert.ok(lk.projects.some((p: { partnerIds: string[] }) => p.partnerIds.length > 0));
  });
  await check("Phòng Dự án có 2 khối; quy tắc Khối / Quản lý phòng ban khi tạo người dùng", async () => {
    const lk = await (await admin("/api/lookups")).json();
    const pda = lk.departments.find((d: { code: string }) => d.code === "PDA");
    assert.deepEqual(pda.divisions.map((x: { name: string }) => x.name).sort(), ["Khối Phát triển dự án", "Khối Thi công dự án"]);
    const other = lk.departments.find((d: { divisions: unknown[] }) => d.divisions.length === 0);
    const base = { fullName: "Test khối", password: "Matkhau@123", departmentId: pda.id };
    const post = (b: object) => admin("/api/users", { method: "POST", body: JSON.stringify({ ...base, ...b }) });
    assert.match((await (await post({ username: "test.k1", approvalRole: "RELATED" })).json()).error, /Chọn khối/);
    assert.match((await (await post({ username: "test.k2", approvalRole: "STAFF", divisionId: "khong-co" })).json()).error, /không thuộc phòng ban/);
    assert.match((await (await post({ username: "test.k3", approvalRole: "DEPT_MANAGER" })).json()).error, /đã có Quản lý phòng ban/);
    const ok = await post({ username: "test.k4", approvalRole: "RELATED", divisionId: pda.divisions[0].id });
    assert.equal(ok.status, 200);
    const u = await ok.json();
    assert.equal(u.division.id, pda.divisions[0].id);
    // Phòng chưa có khối: không cần chọn khối
    const r2 = await post({ username: "test.k5", approvalRole: "STAFF", departmentId: other.id });
    assert.equal(r2.status, 200);
    const u2 = await r2.json();
    assert.equal(u2.divisionId, null);
    for (const id of [u.id, u2.id]) assert.equal((await admin(`/api/users/${id}`, { method: "DELETE" })).status, 200);
  });

  // Luồng đầy đủ qua API: phiếu -> in -> Phụ trách liên quan > QL phòng ban > BKS trả -> in ký lại -> ... -> TGĐ đã ký
  await check("Luồng 4 giai đoạn qua API", async () => {
    const lk = await (await admin("/api/lookups")).json();
    const content = { docTitle: "Smoke test hồ sơ", projectName: "", partnerName: "", submitDate: new Date().toISOString().slice(0, 10), departmentName: "", otherContent: "", preparerName: "", relatedPersonName: "", managerName: "" };
    const form = await (await admin("/api/signing-forms", {
      method: "POST",
      body: JSON.stringify({ newDocument: { typeId: lk.types[0].id, projectId: lk.projects[0].id, departmentId: lk.departments[0].id }, content }),
    })).json();
    assert.ok(form.id, JSON.stringify(form));
    assert.equal((await admin(`/api/signing-forms/${form.id}/print`, { method: "POST" })).status, 200);
    const docId = form.documentId;
    const act = async (body: unknown, status = 200) => {
      const r = await admin(`/api/documents/${docId}/actions`, { method: "POST", body: JSON.stringify(body) });
      assert.equal(r.status, status, JSON.stringify(await r.clone().json()));
    };
    const cat = lk.errorCategories[0];
    await act({ action: "return", errors: [{ categoryId: cat.id, reasonId: cat.reasons[0].id }] }, 409); // Phụ trách liên quan không được trả
    await act({ action: "advance", stage: "STAGE_MANAGER" });
    await act({ action: "advance", stage: "STAGE_BKS" });
    // Ở BKS: người lập chưa trình ký lại được; Ban kiểm soát bấm Trả về (nhóm lỗi), sau đó mới trình ký lại
    const early = await admin(`/api/signing-forms/${form.id}/resubmit`, { method: "POST", body: JSON.stringify({ reason: "Sửa theo ý kiến BKS" }) });
    assert.equal(early.status, 409);
    await act({ action: "return", requirement: "Sai số liệu", errors: [{ categoryId: cat.id, customReason: "Sai số liệu" }] });
    const re = await (await admin(`/api/signing-forms/${form.id}/resubmit`, { method: "POST", body: JSON.stringify({ reason: "Sửa theo ý kiến BKS" }) })).json();
    assert.ok(re.id, JSON.stringify(re));
    assert.equal((await admin(`/api/signing-forms/${re.id}/print`, { method: "POST" })).status, 200);
    let d = (await (await admin(`/api/documents/${docId}`)).json()).doc;
    assert.equal(d.status.code, "STAGE_CHECK");
    // BKS đã kiểm duyệt -> chờ TGĐ ký (không trả về được nữa) -> TGĐ đã ký là bước riêng
    await act({ action: "advance", stage: "STAGE_CEO" });
    d = (await (await admin(`/api/documents/${docId}`)).json()).doc;
    assert.equal(d.status.code, "STAGE_CEO");
    assert.equal(d.approvedAt, null);
    await act({ action: "return", errors: [{ categoryId: cat.id, reasonId: cat.reasons[0].id }] }, 409);
    await act({ action: "advance", stage: "CEO_SIGNED" });
    d = (await (await admin(`/api/documents/${docId}`)).json()).doc;
    assert.equal(d.status.code, "CEO_SIGNED");
    assert.equal(d.submissions.length, 2);
    assert.equal(d.returns.length, 1);
    const del = await admin(`/api/documents/${docId}`, { method: "DELETE", body: JSON.stringify({ reason: "Xóa hồ sơ smoke test" }) });
    assert.equal(del.status, 200);
  });

  const failed = results.filter((r) => !r[1]);
  for (const [n, ok, m] of results) console.log(`${ok ? "✔" : "✘"} ${n}${m ? ` — ${m}` : ""}`);
  console.log(`\n${results.length - failed.length}/${results.length} kiểm thử đạt`);
  process.exit(failed.length ? 1 : 0);
})();
