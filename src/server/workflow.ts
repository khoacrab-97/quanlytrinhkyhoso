// =============================================================
//  ENGINE NGHIỆP VỤ TRÌNH KÝ
//  Mọi thay đổi trạng thái hồ sơ đều đi qua đây để đảm bảo:
//  - Lịch sử trạng thái, lần trình, lần trả, bước luân chuyển được GHI THÊM (không ghi đè)
//  - Số liệu tổng hợp (submissionCount, returnCount) nhất quán trong cùng transaction
//  - Nhật ký hệ thống + thông báo được tạo tự động
// =============================================================
import { z } from "zod";
import type { ActivityType, DocumentStatus, Prisma, StatusCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { STAGES, STATUS, stageIndex } from "@/lib/constants";
import { audit, notify } from "./audit";
import { AppErrorLite } from "./errors";

export type Actor = { id: string; role: string; departmentId: string | null; fullName?: string };
type Tx = Prisma.TransactionClient;

const optDate = z.coerce.date().optional().nullable();
const optId = z.string().min(1).optional().nullable();

export const errorItemSchema = z.object({
  categoryId: z.string().min(1, "Chọn nhóm lỗi"),
  reasonId: optId,
  customReason: z.string().max(500).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  responsibleId: optId,
});

export const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    at: optDate,
    submitterId: optId,
    note: z.string().max(2000).optional().nullable(),
    /** In ký lại khi hồ sơ còn đang trình (quá hạn in lại): lần trình đang chờ được đánh dấu rút lại */
    withdrawPending: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("advance"),
    at: optDate,
    stage: z.enum([STATUS.STAGE_MANAGER, STATUS.STAGE_BKS, STATUS.STAGE_CEO, STATUS.CEO_SIGNED], { errorMap: () => ({ message: "Chọn giai đoạn cần xác nhận" }) }),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({
    action: z.literal("return"),
    at: optDate,
    requirement: z.string().max(4000).optional().nullable(),
    responsibleId: optId,
    errors: z.array(errorItemSchema).min(1, "Phải ghi nhận ít nhất một lỗi"),
    note: z.string().max(2000).optional().nullable(),
  }),
  z.object({ action: z.literal("cancel"), at: optDate, note: z.string().min(1, "Nhập lý do hủy").max(2000) }),
  z.object({
    action: z.literal("change_status"),
    statusId: z.string().min(1),
    at: optDate,
    note: z.string().min(1, "Nhập lý do đổi trạng thái").max(2000),
  }),
  z.object({ action: z.literal("note"), at: optDate, note: z.string().min(1).max(4000) }),
]);
export type ActionInput = z.infer<typeof actionSchema>;

/** Hành động hợp lệ theo nhóm trạng thái hiện tại */
export const ALLOWED: Record<string, StatusCategory[]> = {
  submit: ["DRAFT", "RETURNED", "REVISING"],
  advance: ["SUBMITTED", "REVIEWING"],
  return: ["REVIEWING"],
  cancel: ["DRAFT", "SUBMITTED", "REVIEWING", "RETURNED", "REVISING", "APPROVED"],
  change_status: ["DRAFT", "SUBMITTED", "REVIEWING", "RETURNED", "REVISING", "APPROVED", "COMPLETED", "CANCELLED"],
  note: ["DRAFT", "SUBMITTED", "REVIEWING", "RETURNED", "REVISING", "APPROVED", "COMPLETED", "CANCELLED"],
};

/** Thao tác có hợp lệ với trạng thái hiện tại không. Chỉ Ban kiểm soát được trả hồ sơ. */
function actionFits(action: string, status: { category: StatusCategory; code: string }) {
  if (!ALLOWED[action]?.includes(status.category)) return false;
  if (action === "return") return status.code === STATUS.STAGE_BKS;
  if (action === "advance") return stageIndex(status.code) >= 0 && status.code !== STATUS.CEO_SIGNED;
  return true;
}

export function allowedActions(status: { category: StatusCategory; code: string }) {
  return Object.keys(ALLOWED).filter((a) => actionFits(a, status));
}

async function statusByCode(tx: Tx, code: string) {
  const s = await tx.documentStatus.findUnique({ where: { code } });
  if (!s) throw new AppErrorLite(500, `Thiếu trạng thái hệ thống ${code} trong danh mục`);
  return s;
}

/** Sinh mã hồ sơ duy nhất theo năm, an toàn khi tạo đồng thời */
export async function nextDocumentCode(tx: Tx, prefix: string, date = new Date()) {
  const year = date.getFullYear();
  const c = await tx.counter.upsert({
    where: { key: `doc-${year}` },
    create: { key: `doc-${year}`, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${year}-${String(c.value).padStart(5, "0")}`;
}

/** Đóng bước luân chuyển đang mở và tạo bước mới */
async function addActivity(
  tx: Tx,
  data: {
    documentId: string;
    type: ActivityType;
    actorId: string;
    departmentId?: string | null;
    handlerName?: string | null;
    stepId?: string | null;
    statusId?: string | null;
    at: Date;
    expectedDueAt?: Date | null;
    content?: string | null;
    meta?: unknown;
    /** Bước tức thời (ghi chú, cập nhật) - không đóng bước đang mở */
    instant?: boolean;
  },
) {
  if (!data.instant) {
    await tx.documentActivity.updateMany({
      where: { documentId: data.documentId, endedAt: null },
      data: { endedAt: data.at },
    });
  }
  return tx.documentActivity.create({
    data: {
      documentId: data.documentId,
      type: data.type,
      actorId: data.actorId,
      departmentId: data.departmentId ?? null,
      handlerName: data.handlerName ?? null,
      stepId: data.stepId ?? null,
      statusId: data.statusId ?? null,
      startedAt: data.at,
      endedAt: data.instant ? data.at : null,
      expectedDueAt: data.expectedDueAt ?? null,
      content: data.content ?? null,
      meta: data.meta === undefined ? undefined : (JSON.parse(JSON.stringify(data.meta)) as Prisma.InputJsonValue),
    },
  });
}

async function addStatusHistory(tx: Tx, documentId: string, from: DocumentStatus | null, to: DocumentStatus, actorId: string, at: Date, note?: string | null) {
  const last = await tx.documentStatusHistory.findFirst({ where: { documentId }, orderBy: { changedAt: "desc" } });
  const durationHours = last ? Math.max(0, (at.getTime() - last.changedAt.getTime()) / 3_600_000) : null;
  await tx.documentStatusHistory.create({
    data: { documentId, fromStatusId: from?.id ?? null, toStatusId: to.id, changedById: actorId, changedAt: at, note: note ?? null, durationHours },
  });
}

function resolveAt(at: Date | null | undefined, notBefore: Date) {
  const now = new Date();
  const t = at ? new Date(at) : now;
  if (t.getTime() > now.getTime() + 5 * 60_000) throw new AppErrorLite(400, "Thời điểm thực hiện không được ở tương lai");
  if (t.getTime() < notBefore.getTime() - 86_400_000) {
    throw new AppErrorLite(400, "Thời điểm thực hiện không được trước ngày lập hồ sơ");
  }
  return t;
}

/**
 * Thực hiện một hành động nghiệp vụ trên hồ sơ.
 * Kiểm tra quyền theo phạm vi phải được thực hiện trước khi gọi hàm này.
 */
export async function performAction(documentId: string, input: ActionInput, actor: Actor, ip?: string | null) {
  return prisma.$transaction(
    async (tx) => {
      const doc = await tx.document.findFirst({
        where: { id: documentId, deletedAt: null },
        include: { status: true },
      });
      if (!doc) throw new AppErrorLite(404, "Hồ sơ không tồn tại");

      const replacing = input.action === "submit" && !!input.withdrawPending && ["SUBMITTED", "REVIEWING"].includes(doc.status.category);
      if (!actionFits(input.action, doc.status) && !replacing) {
        throw new AppErrorLite(409, input.action === "return"
          ? "Chỉ ghi nhận trả về khi hồ sơ đang ở giai đoạn Ban kiểm soát"
          : `Không thể thực hiện thao tác này khi hồ sơ đang ở trạng thái "${doc.status.name}"`);
      }
      if (input.action === "change_status" && !["ADMIN", "MANAGER"].includes(actor.role)) {
        throw new AppErrorLite(403, "Chỉ Quản trị viên / Quản lý được đổi trạng thái ngoài luồng chuẩn");
      }

      const at = resolveAt(input.at, doc.preparedDate);
      let newStatus: DocumentStatus | null = null;
      const docUpdate: Prisma.DocumentUncheckedUpdateInput = { lastActivityAt: at };
      let summary = "";

      switch (input.action) {
        case "submit": {
          const isResubmit = doc.submissionCount > 0;
          if (replacing) {
            await tx.documentSubmission.updateMany({ where: { documentId: doc.id, result: "PENDING" }, data: { result: "WITHDRAWN", resultAt: at } });
          }
          const round = doc.submissionCount + 1;
          const submitterId = input.submitterId ?? doc.submitterId ?? actor.id;
          await tx.documentSubmission.create({
            data: { documentId: doc.id, round, submittedAt: at, submittedById: submitterId, note: input.note ?? null },
          });

          if (isResubmit) {
            // Đóng các lần trả chưa đóng: coi như đã khắc phục tại thời điểm in ký lại
            const open = await tx.documentReturn.findMany({ where: { documentId: doc.id, fixStatus: { not: "CLOSED" } } });
            for (const r of open) {
              await tx.documentReturn.update({ where: { id: r.id }, data: { fixStatus: "CLOSED", fixedAt: r.fixedAt ?? at } });
              await tx.documentError.updateMany({ where: { returnId: r.id, resolved: false }, data: { resolved: true, resolvedAt: r.fixedAt ?? at } });
            }
          }

          newStatus = await statusByCode(tx, STATUS.STAGE_CHECK);
          Object.assign(docUpdate, {
            submissionCount: round,
            firstSubmittedAt: doc.firstSubmittedAt ?? at,
            lastSubmittedAt: at,
            submitterId,
            currentStepId: null,
            currentHolderId: null,
            currentDepartmentId: doc.departmentId,
            currentHolderNote: STAGES[0].label,
          });
          summary = `${isResubmit ? "In ký lại" : "In phiếu"} - nộp trình lần ${round} → ${STAGES[0].label}`;
          await addActivity(tx, {
            documentId: doc.id, type: isResubmit ? "RESUBMIT" : "SUBMIT", actorId: actor.id, departmentId: doc.departmentId,
            handlerName: STAGES[0].label, statusId: newStatus.id, at,
            content: [summary, input.note].filter(Boolean).join(". "), meta: { stage: STATUS.STAGE_CHECK, round },
          });
          break;
        }

        case "advance": {
          const cur = stageIndex(doc.status.code);
          const target = stageIndex(input.stage);
          if (target <= cur) throw new AppErrorLite(400, "Chỉ xác nhận được giai đoạn sau giai đoạn hiện tại");
          // Xác nhận vượt nhiều giai đoạn: mỗi giai đoạn vẫn có một mốc (cùng thời điểm xác nhận)
          for (let i = cur + 1; i <= target; i++) {
            const st = await statusByCode(tx, STAGES[i].code);
            await addActivity(tx, {
              documentId: doc.id, type: i === STAGES.length - 1 ? "APPROVE" : "FORWARD", actorId: actor.id, departmentId: doc.departmentId,
              handlerName: STAGES[i].done, statusId: st.id, at,
              content: [STAGES[i].done, i === target ? input.note : null].filter(Boolean).join(". "),
              meta: { stage: STAGES[i].code, round: doc.submissionCount },
            });
            newStatus = st;
          }
          summary = target - cur > 1
            ? `${STAGES[target].done} (gồm ${STAGES.slice(cur + 1, target).map((s) => s.done).join(", ")})`
            : STAGES[target].done;
          Object.assign(docUpdate, { currentHolderNote: STAGES[target].label });
          if (input.stage === STATUS.CEO_SIGNED) {
            const pending = await tx.documentSubmission.findFirst({ where: { documentId: doc.id, result: "PENDING" }, orderBy: { round: "desc" } });
            if (pending) await tx.documentSubmission.update({ where: { id: pending.id }, data: { result: "APPROVED", resultAt: at } });
            Object.assign(docUpdate, { approvedAt: at, completedAt: at });
            await tx.documentActivity.updateMany({ where: { documentId: doc.id, endedAt: null }, data: { endedAt: at } });
          }
          break;
        }

        case "return": {
          const pending = await tx.documentSubmission.findFirst({ where: { documentId: doc.id, result: "PENDING" }, orderBy: { round: "desc" } });
          if (pending) await tx.documentSubmission.update({ where: { id: pending.id }, data: { result: "RETURNED", resultAt: at } });
          const responsibleId = input.responsibleId ?? doc.preparerId;

          // Kiểm tra lỗi: nguyên nhân phải thuộc đúng nhóm; nhóm "khác" bắt buộc nhập nội dung
          for (const e of input.errors) {
            if (e.reasonId) {
              const r = await tx.errorReason.findUnique({ where: { id: e.reasonId } });
              if (!r || r.categoryId !== e.categoryId) throw new AppErrorLite(400, "Nguyên nhân lỗi không thuộc nhóm lỗi đã chọn");
            } else if (!e.customReason?.trim() && !e.description?.trim()) {
              throw new AppErrorLite(400, "Lỗi không chọn nguyên nhân có sẵn thì phải nhập nội dung lỗi cụ thể");
            }
          }

          const ret = await tx.documentReturn.create({
            data: {
              documentId: doc.id,
              submissionId: pending?.id ?? null,
              returnedAt: at,
              returnedByName: STAGES[2].label,
              receivedById: doc.preparerId,
              toDepartmentId: doc.departmentId,
              requirement: input.requirement ?? null,
              responsibleId,
              recordedById: actor.id,
              errors: {
                create: input.errors.map((e) => ({
                  categoryId: e.categoryId,
                  reasonId: e.reasonId ?? null,
                  customReason: e.customReason?.trim() || null,
                  description: e.description?.trim() || null,
                  responsibleId: e.responsibleId ?? responsibleId,
                })),
              },
            },
          });
          newStatus = await statusByCode(tx, STATUS.BKS_RETURNED);
          Object.assign(docUpdate, {
            returnCount: { increment: 1 },
            currentHolderId: doc.preparerId,
            currentDepartmentId: doc.departmentId,
            currentHolderNote: "Chờ in ký lại",
            currentStepId: null,
          });
          summary = `Ban kiểm soát trả về lần ${doc.returnCount + 1} (${input.errors.length} lỗi) - phải in ký lại`;
          await addActivity(tx, {
            documentId: doc.id, type: "RETURN", actorId: actor.id, departmentId: doc.departmentId,
            handlerName: ret.returnedByName, statusId: newStatus.id, at,
            content: [summary, input.requirement].filter(Boolean).join(". "), meta: { returnId: ret.id, stage: STATUS.BKS_RETURNED, round: doc.submissionCount },
          });
          await notify(tx, {
            userIds: [doc.preparerId, responsibleId, doc.submitterId], type: "RETURN",
            title: "Ban kiểm soát trả hồ sơ", message: `${doc.code} - ${doc.title}: ${input.requirement ?? "cần chỉnh sửa và in ký lại"}`,
            documentId: doc.id, excludeUserId: actor.id,
          });
          break;
        }

        case "cancel": {
          await tx.documentSubmission.updateMany({ where: { documentId: doc.id, result: "PENDING" }, data: { result: "WITHDRAWN", resultAt: at } });
          newStatus = await statusByCode(tx, STATUS.CANCELLED);
          Object.assign(docUpdate, { cancelledAt: at, currentHolderId: null, currentHolderNote: null });
          summary = "Hủy hồ sơ";
          await addActivity(tx, { documentId: doc.id, type: "CANCEL", actorId: actor.id, departmentId: actor.departmentId, statusId: newStatus.id, at, content: `${summary}: ${input.note}` });
          await tx.documentActivity.updateMany({ where: { documentId: doc.id, endedAt: null }, data: { endedAt: at } });
          break;
        }

        case "change_status": {
          const s = await tx.documentStatus.findUnique({ where: { id: input.statusId } });
          if (!s || !s.active) throw new AppErrorLite(400, "Trạng thái không hợp lệ");
          if (s.id === doc.statusId) throw new AppErrorLite(400, "Hồ sơ đã ở trạng thái này");
          newStatus = s;
          if (s.category === "APPROVED" && !doc.approvedAt) docUpdate.approvedAt = at;
          if (s.category === "COMPLETED" && !doc.completedAt) {
            docUpdate.completedAt = at;
            if (!doc.approvedAt) docUpdate.approvedAt = at;
          }
          if (s.category === "CANCELLED") docUpdate.cancelledAt = at;
          summary = `Đổi trạng thái "${doc.status.name}" → "${s.name}"`;
          await addActivity(tx, { documentId: doc.id, type: "STATUS_CHANGE", actorId: actor.id, departmentId: actor.departmentId, statusId: s.id, at, content: `${summary}. Lý do: ${input.note}`, instant: true });
          break;
        }

        case "note": {
          summary = "Ghi chú";
          await addActivity(tx, { documentId: doc.id, type: "NOTE", actorId: actor.id, departmentId: actor.departmentId, at, content: input.note, instant: true });
          break;
        }
      }

      if (newStatus && newStatus.id !== doc.statusId) {
        docUpdate.statusId = newStatus.id;
        await addStatusHistory(tx, doc.id, doc.status, newStatus, actor.id, at, [summary, "note" in input ? input.note : null].filter(Boolean).join(". "));
      }
      await tx.document.update({ where: { id: doc.id }, data: docUpdate });
      await audit({ userId: actor.id, action: `document.${input.action}`, entity: "Document", entityId: doc.id, detail: { code: doc.code, summary, input }, ip }, tx);
      return { ok: true, summary };
    },
    { timeout: 20_000 },
  );
}
