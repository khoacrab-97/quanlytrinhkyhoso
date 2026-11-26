// Khôi phục từ bản sao lưu vào CSDL RỖNG (đã chạy migrate, chưa seed):
//   npx tsx scripts/restore.ts storage/backups/backup-xxxx.json.gz
import fs from "node:fs/promises";
import { restoreBackup } from "../src/server/backup";
import { prisma } from "../src/lib/prisma";
(async () => {
  const file = process.argv[2];
  if (!file) throw new Error("Thiếu đường dẫn file sao lưu");
  if ((await prisma.user.count()) > 0) throw new Error("CSDL đích không rỗng - hãy khôi phục vào CSDL mới đã chạy 'prisma migrate deploy'");
  await restoreBackup(await fs.readFile(file));
  console.log("✔ Khôi phục thành công");
})()
  .catch((e) => { console.error(e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
