import { prisma } from "@/lib/prisma";
import { handler, clientIp } from "@/server/api";
import { audit } from "@/server/audit";
import { purgeSampleData } from "@/server/sample";

export const GET = handler(async () => ({
  sample: await prisma.document.count({ where: { isSample: true } }),
  official: await prisma.document.count({ where: { isSample: false } }),
}), { perm: "system.manage" });

/** Xóa toàn bộ hồ sơ mẫu - dữ liệu chính thức không bị ảnh hưởng */
export const DELETE = handler(
  async ({ req, user }) => {
    const r = await purgeSampleData();
    await audit({ userId: user.id, action: "system.purge_sample", entity: "System", detail: r, ip: clientIp(req) });
    return r;
  },
  { perm: "system.manage" },
);
