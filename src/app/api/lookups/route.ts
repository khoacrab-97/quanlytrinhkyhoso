import { prisma } from "@/lib/prisma";
import { handler } from "@/server/api";

/** Danh mục đang hoạt động phục vụ form và bộ lọc */
export const GET = handler(async ({ user }) => {
  const [projectRows, types, departments, users, contractors, statuses, errorCategories, customFields] = await Promise.all([
    prisma.project.findMany({ where: { active: true }, select: { id: true, code: true, name: true, investor: true, partners: { select: { contractorId: true } } }, orderBy: { code: "asc" } }),
    prisma.documentType.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true, divisions: { where: { active: true }, select: { id: true, name: true }, orderBy: { code: "asc" } } }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, select: { id: true, fullName: true, departmentId: true, position: true, role: true }, orderBy: { fullName: "asc" } }),
    prisma.contractor.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.documentStatus.findMany({ where: { active: true }, select: { id: true, code: true, name: true, color: true, category: true }, orderBy: { order: "asc" } }),
    prisma.errorCategory.findMany({
      where: { active: true },
      orderBy: { order: "asc" },
      select: { id: true, code: true, name: true, attributable: true, reasons: { where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true } } },
    }),
    prisma.customField.findMany({ where: { active: true }, orderBy: { order: "asc" } }),
  ]);
  const projects = projectRows.map(({ partners, ...p }) => ({ ...p, partnerIds: partners.map((x) => x.contractorId) }));
  return { projects, types, departments, users, contractors, statuses, errorCategories, customFields, me: { id: user.id, role: user.role } };
});
