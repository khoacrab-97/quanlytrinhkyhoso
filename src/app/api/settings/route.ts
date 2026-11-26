import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { handler, parseBody, badRequest, clientIp } from "@/server/api";
import { audit, getSettings } from "@/server/audit";

export const GET = handler(async () => {
  const values = await getSettings();
  return Object.entries(DEFAULT_SETTINGS).map(([key, d]) => ({ key, label: d.label, value: values[key] }));
});

export const PUT = handler(
  async ({ req, user }) => {
    const body = await parseBody(req, z.record(z.string().max(100)));
    for (const [key, value] of Object.entries(body)) {
      if (!DEFAULT_SETTINGS[key]) throw badRequest(`Cấu hình không hợp lệ: ${key}`);
      if (key.startsWith("alert.") || key === "return.defaultFixDays" || key === "form.reprintMinutes") {
        const n = Number(value);
        if (!Number.isFinite(n) || n < 0 || n > 365) throw badRequest(`${DEFAULT_SETTINGS[key].label}: phải là số từ 0 đến 365`);
      }
      if (key === "document.codePrefix" && !/^[A-Z0-9]{1,10}$/.test(value)) throw badRequest("Tiền tố mã chỉ gồm chữ in hoa và số (tối đa 10 ký tự)");
      await prisma.systemSetting.upsert({ where: { key }, create: { key, value, label: DEFAULT_SETTINGS[key].label }, update: { value } });
    }
    await audit({ userId: user.id, action: "settings.update", entity: "SystemSetting", detail: body, ip: clientIp(req) });
    return { ok: true };
  },
  { perm: "system.manage" },
);
