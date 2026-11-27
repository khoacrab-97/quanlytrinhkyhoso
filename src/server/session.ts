import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/token";
import { BKS_DEPARTMENT_CODE } from "./approval";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "VIEWER";
  dataScope: "ALL" | "DEPARTMENT" | "PROJECT" | "OWN";
  departmentId: string | null;
  departmentName: string | null;
  position: string | null;
  projectIds: string[];
  /** Thành viên Ban kiểm soát (phòng ban mã BKS): xem và xác nhận hồ sơ của mọi phòng ban */
  isBks: boolean;
  preferences: Record<string, unknown>;
};

/** Lấy người dùng hiện tại (đã kiểm tra tài khoản còn hoạt động). Cache trong 1 request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const u = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { department: true, projects: { select: { projectId: true } } },
  });
  if (!u || !u.active) return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    dataScope: u.dataScope,
    departmentId: u.departmentId,
    departmentName: u.department?.name ?? null,
    position: u.position,
    projectIds: u.projects.map((p) => p.projectId),
    isBks: u.department?.code === BKS_DEPARTMENT_CODE,
    preferences: (u.preferences as Record<string, unknown>) ?? {},
  };
});
