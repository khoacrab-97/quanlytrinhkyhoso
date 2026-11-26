import { handler, parseBody, clientIp } from "@/server/api";
import { createForm, createSchema, listForms, listSchema } from "@/server/signingForms";

export const GET = handler(async ({ req, user }) => listForms(user, listSchema.parse(Object.fromEntries(req.nextUrl.searchParams))));

export const POST = handler(
  async ({ req, user }) => {
    const form = await createForm(await parseBody(req, createSchema), user, clientIp(req));
    return { id: form.id, code: form.code, documentId: form.documentId };
  },
  { perm: "document.create" },
);
