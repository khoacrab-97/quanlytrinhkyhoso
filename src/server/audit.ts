import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function audit(
  entry: { userId?: string | null; action: string; entity: string; entityId?: string | null; detail?: unknown; ip?: string | null },
  tx: Tx = prisma,
) {
  await tx.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      detail: entry.detail === undefined ? undefined : (JSON.parse(JSON.stringify(entry.detail)) as Prisma.InputJsonValue),
      ip: entry.ip ?? null,
    },
  });
}

export async function notify(
  tx: Tx,
  n: { userIds: (string | null | undefined)[]; type: string; title: string; message: string; documentId?: string; excludeUserId?: string },
) {
  const ids = [...new Set(n.userIds.filter((x): x is string => !!x && x !== n.excludeUserId))];
  if (!ids.length) return;
  await tx.notification.createMany({
    data: ids.map((userId) => ({
      userId,
      type: n.type,
      title: n.title,
      message: n.message,
      documentId: n.documentId,
      link: n.documentId ? `/documents/${n.documentId}` : null,
    })),
  });
}

export async function getSettings(): Promise<Record<string, string>> {
  const { DEFAULT_SETTINGS } = await import("@/lib/constants");
  const rows = await prisma.systemSetting.findMany();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) out[k] = v.value;
  for (const r of rows) out[r.key] = r.value;
  return out;
}

export function numSetting(s: Record<string, string>, key: string, fallback: number) {
  const n = Number(s[key]);
  return Number.isFinite(n) ? n : fallback;
}
