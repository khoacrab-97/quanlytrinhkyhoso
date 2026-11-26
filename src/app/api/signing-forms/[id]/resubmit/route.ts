import { z } from "zod";
import { handler, parseBody, clientIp } from "@/server/api";
import { resubmitForm } from "@/server/signingForms";

/** Trình ký lại: bắt buộc lý do (ở giai đoạn Ban kiểm soát: bắt buộc thêm nhóm lỗi); số lần do hệ thống tự tính */
export const POST = handler<{ id: string }>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({
    reason: z.string().trim().min(5, "Nhập nội dung / lý do trình ký lại (tối thiểu 5 ký tự)").max(2000),
    categoryId: z.string().min(1).optional().nullable(),
  }));
  const f = await resubmitForm(user, params.id, body, clientIp(req));
  return { id: f.id, code: f.code, resubmitNo: f.resubmitNo };
});
