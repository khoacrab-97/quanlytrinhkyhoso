// Lưu trữ file đính kèm trên đĩa, ngoài thư mục public; chỉ tải qua API có kiểm tra quyền.
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ALLOWED_UPLOAD_EXT } from "@/lib/constants";
import { AppErrorLite } from "./errors";

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR || "./storage/uploads");
}

export async function saveUpload(file: File) {
  const maxMb = Number(process.env.MAX_UPLOAD_MB || 25);
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_UPLOAD_EXT.includes(ext)) throw new AppErrorLite(400, `Định dạng ${ext || "(không có)"} không được phép`);
  if (file.size > maxMb * 1024 * 1024) throw new AppErrorLite(400, `File "${file.name}" vượt quá ${maxMb}MB`);
  if (file.size === 0) throw new AppErrorLite(400, `File "${file.name}" rỗng`);
  const dir = uploadDir();
  await fs.mkdir(dir, { recursive: true });
  const storedName = `${new Date().toISOString().slice(0, 7)}-${crypto.randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, storedName), Buffer.from(await file.arrayBuffer()));
  return { storedName, fileName: file.name.slice(0, 255), mimeType: file.type || "application/octet-stream", size: file.size };
}

export async function readUpload(storedName: string) {
  // storedName chỉ do hệ thống sinh ra; vẫn chặn path traversal để an toàn
  if (storedName.includes("/") || storedName.includes("\\") || storedName.includes("..")) throw new AppErrorLite(400, "Tên file không hợp lệ");
  return fs.readFile(path.join(uploadDir(), storedName));
}
