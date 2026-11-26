import { prisma } from "@/lib/prisma";
import { handler, clientIp, notFound } from "@/server/api";
import { copyDocument } from "@/server/documents";
import { documentScopeWhere } from "@/server/scope";

export const POST = handler<{ id: string }>(
  async ({ req, user, params }) => {
    const src = await prisma.document.findFirst({ where: { AND: [{ id: params.id }, documentScopeWhere(user)] } });
    if (!src) throw notFound("Hồ sơ");
    const doc = await copyDocument(params.id, user, clientIp(req));
    return { id: doc.id, code: doc.code };
  },
  { perm: "document.create" },
);
