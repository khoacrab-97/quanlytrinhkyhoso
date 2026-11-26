import { handler, parseBody, clientIp } from "@/server/api";
import { createDocument, documentInputSchema, listDocuments, listQuerySchema } from "@/server/documents";

export const GET = handler(async ({ req, user }) => {
  const q = listQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return listDocuments(user, q);
});

/** Tạo hồ sơ (đang soạn). Việc nộp trình ký ghi nhận khi in phiếu trình ký. */
export const POST = handler(
  async ({ req, user }) => {
    const body = await parseBody(req, documentInputSchema);
    const doc = await createDocument(body, user, { ip: clientIp(req) });
    return { id: doc.id, code: doc.code };
  },
  { perm: "document.create" },
);
