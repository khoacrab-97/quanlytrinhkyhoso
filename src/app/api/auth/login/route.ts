import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/token";
import { audit } from "@/server/audit";
import { clientIp, toErrorResponse } from "@/server/api";

// Chống dò mật khẩu: tối đa 8 lần sai / 15 phút / (IP + tài khoản)
const attempts = new Map<string, { n: number; until: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ username: z.string().trim().min(1), password: z.string().min(1) }).parse(await req.json());
    const ip = clientIp(req);
    const key = `${ip}|${body.username.toLowerCase()}`;
    const a = attempts.get(key);
    if (a && a.n >= 8 && a.until > Date.now()) {
      return NextResponse.json({ error: "Đăng nhập sai quá nhiều lần, vui lòng thử lại sau 15 phút" }, { status: 429 });
    }
    const user = await prisma.user.findUnique({ where: { username: body.username.toLowerCase() } });
    const ok = user && user.active && (await bcrypt.compare(body.password, user.passwordHash));
    if (!ok) {
      attempts.set(key, { n: (a && a.until > Date.now() ? a.n : 0) + 1, until: Date.now() + 15 * 60_000 });
      await audit({ userId: user?.id, action: "auth.login_failed", entity: "User", entityId: user?.id, detail: { username: body.username }, ip });
      return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng" }, { status: 401 });
    }
    attempts.delete(key);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await audit({ userId: user.id, action: "auth.login", entity: "User", entityId: user.id, ip });
    const token = await signSession({ sub: user.id, role: user.role, name: user.fullName });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
      path: "/",
      maxAge: SESSION_HOURS * 3600,
    });
    return res;
  } catch (e) {
    return toErrorResponse(e);
  }
}
