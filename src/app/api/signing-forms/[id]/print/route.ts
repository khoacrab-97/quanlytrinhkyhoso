import { handler, clientIp } from "@/server/api";
import { confirmPrint } from "@/server/signingForms";

/** Xác nhận đã in (lần đầu hoặc in lại trong thời hạn) */
export const POST = handler<{ id: string }>(async ({ req, user, params }) => confirmPrint(user, params.id, clientIp(req)));
