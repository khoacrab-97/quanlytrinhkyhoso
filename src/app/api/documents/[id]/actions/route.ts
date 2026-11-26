import { handler, parseBody, clientIp } from "@/server/api";
import { actionSchema, performAction } from "@/server/workflow";
import { loadModifiable } from "@/server/guards";

export const POST = handler<{ id: string }>(
  async ({ req, user, params }) => {
    await loadModifiable(user, params.id);
    const input = await parseBody(req, actionSchema);
    // Thời điểm luôn lấy theo máy chủ lúc xác nhận (không cho chọn lùi thời gian)
    return performAction(params.id, { ...input, at: null }, user, clientIp(req));
  },
  { perm: "document.process" },
);
