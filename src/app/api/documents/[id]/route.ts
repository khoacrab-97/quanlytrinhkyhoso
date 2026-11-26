import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/permissions";
import { handler, parseBody, clientIp, notFound } from "@/server/api";
import { documentInputSchema, softDeleteDocument, updateDocument } from "@/server/documents";
import { canModifyDocument, documentScopeWhere } from "@/server/scope";
import { allowedActions } from "@/server/workflow";
import { loadModifiable } from "@/server/guards";

type P = { id: string };
const userSel = { select: { id: true, fullName: true } };

export const GET = handler<P>(async ({ user, params }) => {
  const doc = await prisma.document.findFirst({
    where: { AND: [{ id: params.id }, documentScopeWhere(user)] },
    include: {
      type: true,
      project: true,
      contractor: true,
      department: true,
      preparer: userSel,
      submitter: userSel,
      createdBy: userSel,
      recipient: true,
      currentHolder: userSel,
      currentDepartment: true,
      currentStep: true,
      status: true,
      statusHistory: { orderBy: { changedAt: "asc" }, include: { fromStatus: true, toStatus: true, changedBy: userSel } },
      submissions: { orderBy: { round: "asc" }, include: { submittedBy: userSel, recipient: true, step: true } },
      returns: {
        orderBy: { returnedAt: "asc" },
        include: {
          errors: { include: { category: true, reason: true, responsible: userSel } },
          returnedByRecipient: true,
          fromDepartment: true,
          toDepartment: true,
          receivedBy: userSel,
          responsible: userSel,
          recordedBy: userSel,
          attachments: { where: { deletedAt: null }, include: { uploadedBy: userSel } },
        },
      },
      activities: {
        orderBy: [{ startedAt: "asc" }, { id: "asc" }],
        include: { actor: userSel, department: true, step: true, status: true, attachments: { where: { deletedAt: null } } },
      },
      attachments: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" }, include: { uploadedBy: userSel } },
      signingForms: { orderBy: { resubmitNo: "desc" }, take: 1, select: { id: true, code: true } },
    },
  });
  if (!doc) throw notFound("Hồ sơ");
  const modify = canModifyDocument(user, doc);
  return {
    doc,
    perms: {
      edit: modify && can(user.role, "document.edit"),
      process: modify && can(user.role, "document.process"),
      delete: modify && can(user.role, "document.delete"),
      forceStatus: can(user.role, "document.forceStatus"),
      copy: can(user.role, "document.create"),
    },
    actions: modify && can(user.role, "document.process")
      ? allowedActions(doc.status).filter((a) => a !== "change_status" || can(user.role, "document.forceStatus"))
      : [],
  };
});

export const PATCH = handler<P>(
  async ({ req, user, params }) => {
    await loadModifiable(user, params.id);
    const body = await parseBody(req, documentInputSchema);
    const doc = await updateDocument(params.id, body, user, clientIp(req));
    return { id: doc.id };
  },
  { perm: "document.edit" },
);

export const DELETE = handler<P>(
  async ({ req, user, params }) => {
    await loadModifiable(user, params.id);
    const { reason } = await parseBody(req, z.object({ reason: z.string().trim().min(3, "Nhập lý do xóa (tối thiểu 3 ký tự)") }));
    await softDeleteDocument(params.id, user, reason, clientIp(req));
    return { ok: true };
  },
  { perm: "document.delete" },
);
