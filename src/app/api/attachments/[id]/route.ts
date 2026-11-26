import { prisma } from "@/lib/prisma";
import { handler, notFound, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { loadModifiable, loadVisible } from "@/server/guards";
import { readUpload } from "@/server/storage";

type P = { id: string };

/** Tải file (kiểm tra quyền xem hồ sơ). ?inline=1 để xem trực tiếp PDF/ảnh */
export const GET = handler<P>(async ({ req, user, params }) => {
  const a = await prisma.attachment.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!a) throw notFound("File");
  await loadVisible(user, a.documentId);
  const buf = await readUpload(a.storedName);
  const inline = req.nextUrl.searchParams.get("inline") === "1" && /^(application\/pdf|image\/)/.test(a.mimeType);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": a.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** Xóa mềm file đính kèm (vẫn giữ trong lịch sử) */
export const DELETE = handler<P>(
  async ({ req, user, params }) => {
    const a = await prisma.attachment.findFirst({ where: { id: params.id, deletedAt: null } });
    if (!a) throw notFound("File");
    await loadModifiable(user, a.documentId);
    await prisma.attachment.update({ where: { id: a.id }, data: { deletedAt: new Date() } });
    await audit({ userId: user.id, action: "attachment.delete", entity: "Document", entityId: a.documentId, detail: { file: a.fileName }, ip: clientIp(req) });
    return { ok: true };
  },
  { perm: "document.edit" },
);
