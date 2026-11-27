// Đặt lại mật khẩu cho một tài khoản (khi quên mật khẩu admin).
//   npx tsx scripts/reset-password.ts admin
// Mật khẩu mới được nhập từ bàn phím (không hiện ký tự), tối thiểu 8 ký tự, có chữ và số.
import readline from "node:readline";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
    let shown = false;
    out._writeToOutput = (s: string) => {
      if (!shown) { out.output.write(s); shown = true; } // chỉ in câu hỏi, không in ký tự gõ vào
    };
    rl.question(question, (answer) => { rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

async function main() {
  const username = (process.argv[2] ?? "").trim().toLowerCase();
  if (!username) throw new Error("Cách dùng: npx tsx scripts/reset-password.ts <tên đăng nhập>");
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.deletedAt) throw new Error(`Không có tài khoản "${username}"`);
  const pw = await askHidden(`Mật khẩu mới cho ${user.fullName} (${username}): `);
  // Cùng quy tắc với app: tối thiểu 8 ký tự, có chữ và số
  if (pw.length < 8) throw new Error("Mật khẩu tối thiểu 8 ký tự");
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) throw new Error("Mật khẩu phải có cả chữ và số");
  if ((await askHidden("Nhập lại mật khẩu mới: ")) !== pw) throw new Error("Hai lần nhập không khớp");
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10), active: true } });
  console.log(`✔ Đã đặt lại mật khẩu cho ${username}. Nếu vừa đăng nhập sai nhiều lần, chờ 15 phút hoặc khởi động lại app.`);
}

main()
  .catch((e) => { console.error("✖", (e as Error).message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
