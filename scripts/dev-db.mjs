// Khởi chạy PostgreSQL nhúng cho môi trường phát triển khi không có Docker/PostgreSQL cài sẵn.
// Dữ liệu lưu tại ./storage/pgdata, cổng 5433, user/pass/db theo .env.example.
// Chạy: npm run db:local   (giữ cửa sổ này mở trong lúc dùng ứng dụng)
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.resolve("storage/pgdata");
const fresh = !fs.existsSync(path.join(dataDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "qltk",
  password: "qltk_dev_password",
  port: 5433,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

if (fresh) {
  console.log("Khởi tạo cụm PostgreSQL mới tại", dataDir);
  await pg.initialise();
}
await pg.start();
if (fresh) await pg.createDatabase("qltk");
console.log("PostgreSQL đang chạy tại localhost:5433 (Ctrl+C để dừng)");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
