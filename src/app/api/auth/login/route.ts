import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/token";
import { audit } from "@/server/audit";
import { clientIp, toErrorResponse } from "@/server/api";

// Chống dò mật khẩu: tối đa 8 lần sai / 15 phút / (IP + tài khoản),
// và tối đa 20 lần sai / 15 phút / tài khoản bất kể IP (IP lấy từ header nên có thể bị giả mạo)
const attempts = new Map<string, { n: number; until: number }>();
const LIMITS: [string, number][] = [["ip", 8], ["user", 20]];

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ username: z.string().trim().min(1), password: z.string().min(1) }).parse(await req.json());
    const ip = clientIp(req);
    const name = body.username.toLowerCase();
    const keys = { ip: `${ip}|${name}`, user: `*|${name}` } as Record<string, string>;
    const now = Date.now();
    if (LIMITS.some(([k, max]) => { const a = attempts.get(keys[k]); return a && a.n >= max && a.until > now; })) {
      return NextResponse.json({ error: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút" }, { status: 429 });
    }
    const user = await prisma.user.findUnique({ where: { username: name } });
    const ok = user && user.active && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) {
      for (const [k] of LIMITS) {
        const a = attempts.get(keys[k]);
        attempts.set(keys[k], { n: (a && a.until > now ? a.n : 0) + 1, until: now + 15 * 60_000 });
      }
      await audit({ userId: user?.id, action: "auth.login_failed", entity: "User", entityId: user?.id, detail: { username: body.username }, ip });
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
    }
    attempts.delete(keys.ip);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip });
    const token = await signSession({ sub: user.id, role: user.role, name: user.fullName, ver: user.sessionVersion });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    return toErrorResponse(e);
  }
}
