import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handler, parseBody, notFound, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { loadModifiable } from "@/server/guards";

const schema = z.object({
  requirement: z.string().max(4000).optional().nullable(),
  responsibleId: z.string().optional().nullable(),
  requiredFixDate: z.coerce.date().optional().nullable(),
  fixNote: z.string().max(4000).optional().nullable(),
  errors: z
    .array(z.object({ id: z.string(), resolved: z.boolean(), description: z.string().max(2000).optional().nullable(), responsibleId: z.string().optional().nullable() }))
    .optional(),
});

/**
 * Cập nhật thông tin một lần trả: yêu cầu, người chịu trách nhiệm, hạn sửa, ghi chú khắc phục, tình trạng từng lỗi.
 * Trạng thái khắc phục tổng (Chưa xử lý → Đang sửa → Đã sửa → Đóng) đi theo luồng nghiệp vụ của hồ sơ.
 */
export const PATCH = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const ret = await prisma.documentReturn.findUnique({ where: { id: params.id }, include: { errors: true } });
    if (!ret) throw notFound("Lần trả hồ sơ");
    await loadModifiable(user, ret.documentId);
    const body = await parseBody(req, schema);
    await prisma.$transaction(async (tx) => {
      await tx.documentReturn.update({
        where: { id: ret.id },
        data: {
          requirement: body.requirement ?? undefined,
          responsibleId: body.responsibleId === undefined ? undefined : body.responsibleId,
          requiredFixDate: body.requiredFixDate === undefined ? undefined : body.requiredFixDate,
          fixNote: body.fixNote ?? undefined,
        },
      });
      for (const e of body.errors ?? []) {
        const cur = ret.errors.find((x) => x.id === e.id);
        if (!cur) continue;
        await tx.documentError.update({
          where: { id: e.id },
          data: {
            resolved: e.resolved,
            resolvedAt: e.resolved ? cur.resolvedAt ?? new Date() : null,
            description: e.description === undefined ? undefined : e.description,
            responsibleId: e.responsibleId === undefined ? undefined : e.responsibleId,
          },
        });
      }
      await tx.documentActivity.create({
        data: {
          documentId: ret.documentId, type: "NOTE", actorId: user.id, departmentId: user.departmentId, startedAt: new Date(), endedAt: new Date(),
          content: `Cập nhật thông tin lần trả ngày ${ret.returnedAt.toLocaleDateString("vi-VN")}${body.fixNote ? `: ${body.fixNote}` : ""}`,
        },
      });
      await audit({ userId: user.id, action: "return.update", entity: "DocumentReturn", entityId: ret.id, detail: body, ip: clientIp(req) }, tx);
    });
    return { ok: true };
  },
  { perm: "return.manage" },
);
