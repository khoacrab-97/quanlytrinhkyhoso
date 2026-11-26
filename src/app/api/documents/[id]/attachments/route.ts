import { prisma } from "@/lib/prisma";
import { handler, badRequest, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { loadModifiable } from "@/server/guards";
import { saveUpload } from "@/server/storage";

/** Tải lên file đính kèm (multipart: files[], returnId?, activityNote?) */
export const POST = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const doc = await loadModifiable(user, params.id);
    const form = await req.formData();
    const files = form.getAll("files").filter((f): f is File => f instanceof File);
    if (!files.length) throw badRequest("Chưa chọn file");
    if (files.length > 20) throw badRequest("Tối đa 20 file mỗi lần tải");
    const returnId = (form.get("returnId") as string) || null;
    if (returnId) {
      const r = await prisma.documentReturn.findFirst({ where: { id: returnId, documentId: doc.id } });
      if (!r) throw badRequest("Lần trả hồ sơ không hợp lệ");
    }
    const saved: Awaited<ReturnType<typeof saveUpload>>[] = [];
    for (const f of files) saved.push(await saveUpload(f));

    const result = await prisma.$transaction(async (tx) => {
      const act = await tx.documentActivity.create({
        data: {
          documentId: doc.id, type: "ATTACH", actorId: user.id, departmentId: user.departmentId, startedAt: new Date(), endedAt: new Date(),
          content: `${returnId ? "Đính kèm minh chứng lần trả" : "Đính kèm file"}: ${saved.map((s) => s.fileName).join(", ")}${form.get("note") ? `. ${form.get("note")}` : ""}`,
        },
      });
      const rows = [];
      for (const s of saved) {
        rows.push(await tx.attachment.create({ data: { ...s, documentId: doc.id, returnId, activityId: act.id, uploadedById: user.id } }));
      }
      await tx.document.update({ where: { id: doc.id }, data: { lastActivityAt: new Date() } });
      return rows;
    });
    await audit({ userId: user.id, action: "attachment.upload", entity: "Document", entityId: doc.id, detail: { files: saved.map((s) => s.fileName), returnId }, ip: clientIp(req) });
    return { count: result.length };
  },
  { perm: "document.edit" },
);
