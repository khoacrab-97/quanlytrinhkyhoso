// Ký / xác thực JWT phiên đăng nhập. Dùng được ở cả Edge (middleware) và Node.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "qltk_session";
export const SESSION_HOURS = 10;

export type SessionPayload = { sub: string; role: string; name: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET chưa được cấu hình (tối thiểu 32 ký tự)");
  return new TextEncoder().encode(s);
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, role: String(payload.role), name: String(payload.name) };
  } catch {
    return null;
  }
}
