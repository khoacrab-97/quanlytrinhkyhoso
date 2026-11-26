import { handler, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { createBackup, listBackups } from "@/server/backup";

export const GET = handler(async () => listBackups(), { perm: "system.manage" });

export const POST = handler(
  async ({ req, user }) => {
    const r = await createBackup();
    await audit({ userId: user.id, action: "system.backup", entity: "System", detail: r, ip: clientIp(req) });
    return r;
  },
  { perm: "system.manage" },
);
