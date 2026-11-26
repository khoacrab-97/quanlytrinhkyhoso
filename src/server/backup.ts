// Sao lưu logic toàn bộ dữ liệu ra file JSON nén (.json.gz) - không phụ thuộc pg_dump.
// Production nên kết hợp thêm pg_dump định kỳ (xem README).
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { prisma } from "@/lib/prisma";

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

/** Thứ tự bảng theo phụ thuộc khóa ngoại (khôi phục theo đúng thứ tự này) */
export const TABLE_ORDER = [
  "department", "user", "project", "projectMember", "contractor", "workflow", "workflowStep", "documentType", "documentStatus",
  "recipient", "errorCategory", "errorReason", "customField", "systemSetting", "counter", "document", "documentStatusHistory",
  "documentSubmission", "documentReturn", "documentError", "documentActivity", "attachment", "notification", "auditLog",
] as const;

type AnyDelegate = { findMany: (a?: unknown) => Promise<unknown[]>; createMany: (a: unknown) => Promise<unknown> };
const delegate = (t: string) => (prisma as unknown as Record<string, AnyDelegate>)[t];

export function backupDir() {
  return path.resolve(process.env.BACKUP_DIR || "./storage/backups");
}

export async function createBackup() {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLE_ORDER) data[t] = await delegate(t).findMany();
  const payload = { app: "qltk", version: 1, createdAt: new Date().toISOString(), data };
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  const name = `backup-${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}.json.gz`;
  await fs.writeFile(path.join(dir, name), await gzip(JSON.stringify(payload)));
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
  return { name, counts };
}

export async function listBackups() {
  const dir = backupDir();
  await fs.mkdir(dir, { recursive: true });
  const files = (await fs.readdir(dir)).filter((f) => /^backup-[\d-]+\.json\.gz$/.test(f));
  const out = [];
  for (const f of files) {
    const st = await fs.stat(path.join(dir, f));
    out.push({ name: f, size: st.size, createdAt: st.mtime });
  }
  return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function readBackupFile(name: string) {
  if (!/^backup-[\d-]+\.json\.gz$/.test(name)) throw new Error("Tên file sao lưu không hợp lệ");
  return fs.readFile(path.join(backupDir(), name));
}

/** Khôi phục vào CSDL RỖNG (dùng cho script khôi phục) */
export async function restoreBackup(buf: Buffer) {
  const payload = JSON.parse((await gunzip(buf)).toString("utf8")) as { app: string; data: Record<string, Record<string, unknown>[]> };
  if (payload.app !== "qltk") throw new Error("File không phải bản sao lưu của hệ thống");
  const dateKeys = /(At|Date|Since)$|^(startDate|endDate|preparedDate|dueDate)$/;
  for (const t of TABLE_ORDER) {
    const rows = (payload.data[t] ?? []).map((r) =>
      Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "string" && dateKeys.test(k) ? new Date(v) : v])),
    );
    for (let i = 0; i < rows.length; i += 500) await delegate(t).createMany({ data: rows.slice(i, i + 500) });
  }
}
