// Kiểm thử các bản sửa bảo mật không cần CSDL: kiểu file đính kèm, phiên bản phiên đăng nhập.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { INLINE_MIME, mimeFromName } from "../src/server/storage";
import { signSession, verifySession } from "../src/lib/token";

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

describe("Phiên đăng nhập", () => {
  test("Token mang phiên bản phiên để thu hồi được", async () => {
    const t = await signSession({ sub: "u1", role: "STAFF", name: "A", ver: 3 });
    assert.equal((await verifySession(t))?.ver, 3);
  });
});
