import { prisma } from "@/lib/prisma";
import { AppErrorLite } from "./errors";
import { canModifyDocument, documentScopeWhere } from "./scope";
import type { CurrentUser } from "./session";

/** Tải hồ sơ trong phạm vi người dùng và kiểm tra quyền sửa/xử lý */
export async function loadModifiable(user: CurrentUser, id: string) {
  const doc = await prisma.document.findFirst({ where: { AND: [{ id }, documentScopeWhere(user)] }, include: { recipient: true } });
  if (!doc) throw new AppErrorLite(404, "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập");
  if (!canModifyDocument(user, doc)) throw new AppErrorLite(403, "Bạn không có quyền chỉnh sửa / xử lý hồ sơ này");
  return doc;
}

/** Tải hồ sơ trong phạm vi được xem */
export async function loadVisible(user: CurrentUser, id: string) {
  const doc = await prisma.document.findFirst({ where: { AND: [{ id }, documentScopeWhere(user)] } });
  if (!doc) throw new AppErrorLite(404, "Hồ sơ không tồn tại hoặc bạn không có quyền truy cập");
  return doc;
}
