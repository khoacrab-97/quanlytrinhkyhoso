import { handler, parseBody, clientIp } from "@/server/api";
import { actionSchema, performAction } from "@/server/workflow";
import { loadModifiable, loadVisible } from "@/server/guards";

export const POST = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const input = await parseBody(req, actionSchema);
    // Xác nhận giai đoạn / trả về: người có thẩm quyền (PTLQ, QL phòng ban, BKS) có thể không thuộc phòng ban trình ký.
    // Thẩm quyền được kiểm tra trong engine; các thao tác khác cần quyền xử lý hồ sơ.
    if (input.action === "advance" || input.action === "return") await loadVisible(user, params.id);
    else await loadModifiable(user, params.id);
    // Thời điểm luôn lấy theo máy chủ lúc xác nhận (không cho chọn lùi thời gian)
    return performAction(params.id, { ...input, at: null }, user, clientIp(req));
  },
  { perm: "document.process" },
);
