// Xóa toàn bộ dữ liệu MẪU (hồ sơ isSample = true và mọi lịch sử liên quan).
// Dữ liệu chính thức không bị ảnh hưởng.
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export async function purgeSampleData() {
  const docs = await prisma.document.findMany({ where: { isSample: true }, select: { id: true } });
  const ids = docs.map((d) => d.id);
  if (!ids.length) return { deleted: 0 };
  const files = await prisma.attachment.findMany({ where: { documentId: { in: ids } }, select: { storedName: true } });
  await prisma.$transaction([
    prisma.attachment.deleteMany({ where: { documentId: { in: ids } } }),
    prisma.document.deleteMany({ where: { id: { in: ids } } }),
  ]);
  const dir = path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
  for (const f of files) await fs.rm(path.join(dir, f.storedName), { force: true });
  // Nếu không còn hồ sơ nào, đặt lại bộ đếm mã hồ sơ
  if ((await prisma.document.count()) === 0) await prisma.counter.deleteMany({ where: { OR: [{ key: { startsWith: "doc-" } }, { key: { startsWith: "ptk-" } }] } });
  return { deleted: ids.length };
}
