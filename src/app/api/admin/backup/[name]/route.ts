import { handler, notFound } from "@/server/api";
import { audit } from "@/server/audit";
import { readBackupFile } from "@/server/backup";

export const GET = handler<{ name: string }>(
  async ({ user, params }) => {
    let buf: Buffer;
    try {
      buf = await readBackupFile(params.name);
    } catch {
      throw notFound("File sao lưu");
    }
    await audit({ userId: user.id, action: "system.backup_download", entity: "System", detail: { name: params.name } });
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "application/gzip", "Content-Disposition": `attachment; filename="${params.name}"`, "Cache-Control": "no-store" },
    });
  },
  { perm: "system.manage" },
);
