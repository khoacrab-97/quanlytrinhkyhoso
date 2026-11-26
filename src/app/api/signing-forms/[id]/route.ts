import { z } from "zod";
import { handler, parseBody, clientIp } from "@/server/api";
import { contentSchema, deleteDraft, getForm, updateForm } from "@/server/signingForms";

type P = { id: string };

export const GET = handler<P>(async ({ user, params }) => getForm(user, params.id));

export const PATCH = handler<P>(async ({ req, user, params }) => {
  const body = await parseBody(req, z.object({ content: contentSchema, reason: z.string().trim().max(2000).optional().nullable() }));
  await updateForm(user, params.id, body, clientIp(req));
  return { ok: true };
});

export const DELETE = handler<P>(async ({ req, user, params }) => {
  await deleteDraft(user, params.id, clientIp(req));
  return { ok: true };
});
