import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/token";
import { getCurrentUser } from "@/server/session";

/** Đăng xuất: thu hồi mọi phiên đã cấp của tài khoản (kể cả token đã bị lộ), rồi xóa cookie */
export async function POST() {
  const user = await getCurrentUser();
  if (user) await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
