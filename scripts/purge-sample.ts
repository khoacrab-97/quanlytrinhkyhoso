// Xóa dữ liệu mẫu: npm run db:purge-sample
import { purgeSampleData } from "../src/server/sample";
import { prisma } from "../src/lib/prisma";
purgeSampleData()
  .then((r) => console.log(`✔ Đã xóa ${r.deleted} hồ sơ mẫu`))
  .finally(() => prisma.$disconnect());
