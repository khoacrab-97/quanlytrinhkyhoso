// Kiểm thử các bản sửa bảo mật không cần CSDL: kiểu file đính kèm, phiên bản phiên đăng nhập.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { INLINE_MIME, mimeFromName } from "../src/server/storage";
import { signSession, verifySession } from "../src/lib/token";
import { documentScopeWhere } from "../src/server/scope";

process.env.AUTH_SECRET ||= "test-secret-test-secret-test-secret-1234";

describe("Kiểu file đính kèm", () => {
  test("MIME lấy theo đuôi file, không theo trình duyệt khai", () => {
    assert.equal(mimeFromName("anh.PNG"), "image/png");
    assert.equal(mimeFromName("x.svg"), "application/octet-stream");
    assert.equal(mimeFromName("ban-ve.dwg"), "application/octet-stream");
  });
  test("SVG/HTML không bao giờ được xem trực tiếp", () => {
    assert.ok(!INLINE_MIME.includes("image/svg+xml"));
    assert.ok(!INLINE_MIME.some((m) => m.includes("html")));
  });
});

describe("Phạm vi xem hồ sơ", () => {
  const base = { id: "u1", username: "nv", fullName: "NV", role: "STAFF" as const, departmentId: "PB1", departmentName: null, position: null, projectIds: [], preferences: {}, isBks: false, catalogGrants: [] };
  test("Nhân viên chỉ thấy hồ sơ phòng mình, kể cả khi phạm vi đặt Toàn hệ thống", () => {
    const w = documentScopeWhere({ ...base, approvalRole: "STAFF", dataScope: "ALL" });
    assert.deepEqual(w.OR, [{ preparerId: "u1" }, { createdById: "u1" }, { departmentId: "PB1" }]);
  });
  test("Phụ trách liên quan vẫn theo phạm vi được phân quyền", () => {
    assert.equal(documentScopeWhere({ ...base, approvalRole: "RELATED", dataScope: "ALL" }).OR, undefined);
  });
});

describe("Phiên đăng nhập", () => {
  test("Token mang phiên bản phiên để thu hồi được", async () => {
    const t = await signSession({ sub: "u1", role: "STAFF", name: "A", ver: 3 });
    assert.equal((await verifySession(t))?.ver, 3);
  });
});
