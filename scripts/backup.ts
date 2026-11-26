// Sao lưu dữ liệu: npm run db:backup
import { createBackup } from "../src/server/backup";
import { prisma } from "../src/lib/prisma";
createBackup()
  .then((r) => console.log("✔ Đã tạo bản sao lưu", r.name))
  .finally(() => prisma.$disconnect());
