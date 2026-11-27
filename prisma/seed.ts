/**
 * Seed dữ liệu.
 *   npx tsx prisma/seed.ts            -> chỉ danh mục nền + tài khoản admin (dùng cho production)
 *   npx tsx prisma/seed.ts --sample   -> thêm dữ liệu MẪU (isSample = true) để kiểm thử
 *
 * Seed nền là idempotent (chạy lại không tạo trùng).
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type StatusCategory } from "@prisma/client";
import { DEFAULT_SETTINGS, STATUS } from "../src/lib/constants";

const prisma = new PrismaClient();
const withSample = process.argv.includes("--sample");

const STATUSES: { code: string; name: string; category: StatusCategory; color: string }[] = [
  { code: STATUS.PREPARING, name: "Đang soạn phiếu", category: "DRAFT", color: "#94a3b8" },
  { code: STATUS.STAGE_CHECK, name: "Trình Phụ trách liên quan", category: "SUBMITTED", color: "#3b82f6" },
  { code: STATUS.STAGE_MANAGER, name: "Quản lý phòng ban ký duyệt", category: "REVIEWING", color: "#6366f1" },
  { code: STATUS.STAGE_BKS, name: "Ban kiểm soát", category: "REVIEWING", color: "#8b5cf6" },
  { code: STATUS.STAGE_CEO, name: "Chờ TGĐ ký", category: "REVIEWING", color: "#0ea5e9" },
  { code: STATUS.CEO_SIGNED, name: "TGĐ đã ký", category: "COMPLETED", color: "#16a34a" },
  { code: STATUS.BKS_RETURNED, name: "BKS trả về - chờ in ký lại", category: "RETURNED", color: "#ef4444" },
  { code: STATUS.CANCELLED, name: "Đã hủy", category: "CANCELLED", color: "#6b7280" },
];

const ERROR_GROUPS: { code: string; name: string; attributable: boolean; reasons: string[] }[] = [
  { code: "PL", name: "Lỗi hồ sơ pháp lý", attributable: true, reasons: ["Thiếu giấy tờ pháp lý", "Sai thông tin pháp nhân", "Thiếu chữ ký hoặc con dấu", "Hồ sơ pháp lý hết hiệu lực"] },
  { code: "ND", name: "Lỗi nội dung", attributable: true, reasons: ["Sai nội dung hồ sơ", "Thiếu thông tin", "Thông tin không thống nhất", "Sai biểu mẫu", "Sai số liệu"] },
  { code: "KT", name: "Lỗi kỹ thuật", attributable: true, reasons: ["Sai bản vẽ", "Sai thông số kỹ thuật", "Sai khối lượng", "Sai chủng loại vật tư", "Không phù hợp hồ sơ thiết kế"] },
  { code: "TT", name: "Lỗi khối lượng và thanh toán", attributable: true, reasons: ["Sai bảng khối lượng", "Sai đơn giá", "Thiếu hồ sơ nghiệm thu", "Thiếu hồ sơ thanh toán", "Sai giá trị đề nghị thanh toán"] },
  { code: "QT", name: "Lỗi quy trình", attributable: true, reasons: ["Thiếu bước kiểm tra nội bộ", "Trình sai thẩm quyền", "Thiếu chữ ký xác nhận", "Trình sai quy trình"] },
  { code: "KH", name: "Lỗi khác", attributable: false, reasons: ["Thay đổi yêu cầu từ Chủ đầu tư", "Nguyên nhân khác (ghi rõ)"] },
];

const DEPARTMENTS = [
  ["BGD", "Ban Giám đốc"],
  ["PDA", "Phòng Dự án"],
  ["BCH", "Ban Chỉ huy công trình"],
  ["PKT", "Phòng Kỹ thuật"],
  ["PKTOAN", "Phòng Kế toán"],
  ["PVT", "Phòng Vật tư - Thiết bị"],
  ["PHC", "Phòng Hành chính - Nhân sự"],
  // Thành viên Ban kiểm soát (phòng ban mã BKS) xác nhận giai đoạn Ban kiểm soát và TGĐ đã ký
  ["BKS", "Ban kiểm soát"],
  // Phòng ban riêng của tài khoản admin (khóa, không sửa/xóa được)
  ["ADMIN", "Admin"],
] as const;

/** Khối của phòng ban: [mã, tên, mã phòng ban]. Hiện có Phòng Dự án; các phòng khác thêm tại Danh mục → Khối */
const DIVISIONS = [
  ["PDA-PT", "Khối Phát triển dự án", "PDA"],
  ["PDA-TC", "Khối Thi công dự án", "PDA"],
] as const;

async function seedBase() {
  for (const [i, s] of STATUSES.entries()) {
    await prisma.documentStatus.upsert({
      where: { code: s.code },
      create: { ...s, order: i + 1, isSystem: true },
      update: { category: s.category, isSystem: true },
    });
  }
  for (const [gi, g] of ERROR_GROUPS.entries()) {
    const cat = await prisma.errorCategory.upsert({
      where: { code: g.code },
      create: { code: g.code, name: g.name, order: gi + 1, attributable: g.attributable },
      update: {},
    });
    for (const [ri, r] of g.reasons.entries()) {
      await prisma.errorReason.upsert({
        where: { code: `${g.code}${String(ri + 1).padStart(2, "0")}` },
        create: { code: `${g.code}${String(ri + 1).padStart(2, "0")}`, name: r, categoryId: cat.id, order: ri + 1 },
        update: {},
      });
    }
  }
  for (const [key, v] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.systemSetting.upsert({ where: { key }, create: { key, value: v.value, label: v.label }, update: { label: v.label } });
  }
  for (const [code, name] of DEPARTMENTS) {
    await prisma.department.upsert({ where: { code }, create: { code, name }, update: {} });
  }
  const dept = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.code, d.id]));
  for (const [code, name, d] of DIVISIONS) {
    await prisma.division.upsert({ where: { code }, create: { code, name, departmentId: dept[d] }, update: {} });
  }

  const TYPES: [string, string][] = [
    ["NTCV", "Biên bản nghiệm thu công việc"],
    ["NTVL", "Hồ sơ nghiệm thu vật liệu đầu vào"],
    ["BVTC", "Bản vẽ thi công / Shop drawing"],
    ["BPTC", "Biện pháp thi công"],
    ["PSKL", "Hồ sơ phát sinh khối lượng"],
    ["TTGD", "Hồ sơ thanh toán giai đoạn"],
    ["QTHD", "Hồ sơ quyết toán hợp đồng"],
    ["HDTP", "Hợp đồng thầu phụ / mua sắm"],
    ["DNVT", "Đề nghị cung cấp vật tư"],
    ["VBDI", "Văn bản đi / Công văn"],
  ];
  for (const [code, name] of TYPES) {
    await prisma.documentType.upsert({ where: { code }, create: { code, name }, update: {} });
  }

  await prisma.customField.upsert({
    where: { key: "contractValue" },
    create: { key: "contractValue", label: "Giá trị đề nghị (VNĐ)", type: "NUMBER", order: 1 },
    update: {},
  });
  await prisma.customField.upsert({
    where: { key: "packageCode" },
    create: { key: "packageCode", label: "Gói thầu", type: "TEXT", order: 2 },
    update: {},
  });

  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
  await prisma.user.upsert({
    where: { username: "admin" },
    create: {
      username: "admin", passwordHash: await bcrypt.hash(adminPass, 10), fullName: "Quản trị hệ thống",
      role: "ADMIN", dataScope: "ALL", departmentId: dept.ADMIN, position: "Quản trị viên",
    },
    update: {},
  });
  console.log("✔ Đã seed danh mục nền + tài khoản admin");
}

// ---------------------------------------------------------------------------
//  DỮ LIỆU MẪU - mô phỏng luồng nghiệp vụ thật qua engine workflow
// ---------------------------------------------------------------------------
async function seedSample() {
  const { performAction } = await import("../src/server/workflow");
  const { createDocument } = await import("../src/server/documents");

  const existing = await prisma.document.count({ where: { isSample: true } });
  if (existing > 0) {
    console.log(`Đã có ${existing} hồ sơ mẫu - bỏ qua (dùng "npm run db:reset" để tạo lại)`);
    return;
  }

  let seed = 20261125;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  const between = (a: number, b: number) => a + rnd() * (b - a);
  const DAY = 86_400_000;

  const dept = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.code, d.id]));
  const hash = await bcrypt.hash("Matkhau@123", 10);

  const PROJECTS: [string, string, string, string][] = [
    ["CT-HP01", "Chung cư Hải Phát Tower", "Công ty CP Đầu tư Hải Phát", "Hà Đông, Hà Nội"],
    ["CT-KCN02", "Nhà xưởng KCN Yên Phong II", "Công ty TNHH Điện tử Bắc Ninh", "Yên Phong, Bắc Ninh"],
    ["CT-TH03", "Trường THCS Nguyễn Trãi", "Ban QLDA quận Thanh Xuân", "Thanh Xuân, Hà Nội"],
    ["CT-BV04", "Bệnh viện Đa khoa tỉnh Hưng Yên - Khối B", "Sở Y tế Hưng Yên", "TP Hưng Yên"],
    ["CT-CAU05", "Cầu vượt nút giao Vành đai 3.5", "Ban QLDA Giao thông Hà Nội", "Nam Từ Liêm, Hà Nội"],
  ];
  for (const [code, name, investor, location] of PROJECTS) {
    await prisma.project.upsert({ where: { code }, create: { code, name, investor, location, startDate: new Date("2025-09-01") }, update: {} });
  }
  const projects = await prisma.project.findMany({ where: { code: { in: PROJECTS.map((p) => p[0]) } } });

  const CONTRACTORS: [string, string][] = [
    ["NT01", "Công ty CP Xây dựng Thành Công"], ["NT02", "Công ty TNHH Cơ điện Hưng Phát"], ["NT03", "Công ty CP Kết cấu thép Đông Á"],
    ["NT04", "Công ty TNHH Bê tông Việt Đức"], ["NT05", "Công ty CP Nhôm kính An Phú"], ["NT06", "Công ty TNHH PCCC Sao Việt"],
  ];
  for (const [code, name] of CONTRACTORS) await prisma.contractor.upsert({ where: { code }, create: { code, name }, update: {} });
  const contractors = await prisma.contractor.findMany({ orderBy: { code: "asc" } });
  // Gắn 2-3 NCC / thầu phụ cho mỗi dự án
  for (const [i, pr] of projects.entries()) {
    for (const c of [contractors[i % contractors.length], contractors[(i + 2) % contractors.length], contractors[(i + 4) % contractors.length]].slice(0, 2 + (i % 2))) {
      await prisma.projectPartner.upsert({ where: { projectId_contractorId: { projectId: pr.id, contractorId: c.id } }, create: { projectId: pr.id, contractorId: c.id }, update: {} });
    }
  }
  const partnersOf = Object.fromEntries(
    await Promise.all(projects.map(async (pr) => [pr.id, (await prisma.projectPartner.findMany({ where: { projectId: pr.id }, include: { contractor: true } })).map((x) => x.contractor)] as const)),
  );

  // [username, fullName, role, scope, dept, position, errorRate]
  const USERS: [string, string, "MANAGER" | "STAFF" | "VIEWER", "ALL" | "DEPARTMENT" | "PROJECT" | "OWN", string, string, number][] = [
    ["giamdoc", "Nguyễn Văn Hùng", "MANAGER", "ALL", "BGD", "Giám đốc", 0],
    ["truongpda", "Trần Thị Mai", "MANAGER", "ALL", "PDA", "Trưởng phòng Dự án", 0.2],
    ["truongpkt", "Lê Quang Minh", "MANAGER", "DEPARTMENT", "PKT", "Trưởng phòng Kỹ thuật", 0.2],
    ["chihuy1", "Phạm Đức Thắng", "MANAGER", "PROJECT", "BCH", "Chỉ huy trưởng", 0.3],
    ["ketoantruong", "Vũ Thị Lan", "MANAGER", "DEPARTMENT", "PKTOAN", "Kế toán trưởng", 0.15],
    ["nv.an", "Đỗ Minh An", "STAFF", "DEPARTMENT", "PDA", "Kỹ sư dự án", 0.25],
    ["nv.binh", "Hoàng Văn Bình", "STAFF", "DEPARTMENT", "BCH", "Kỹ sư hiện trường", 0.55],
    ["nv.chi", "Ngô Thị Chi", "STAFF", "DEPARTMENT", "PKT", "Kỹ sư QS", 0.35],
    ["nv.dung", "Bùi Tiến Dũng", "STAFF", "DEPARTMENT", "BCH", "Kỹ sư giám sát", 0.4],
    ["nv.ha", "Đặng Thu Hà", "STAFF", "DEPARTMENT", "PKTOAN", "Kế toán công trình", 0.3],
    ["nv.khoa", "Trịnh Đăng Khoa", "STAFF", "DEPARTMENT", "PVT", "Nhân viên vật tư", 0.45],
    ["nv.linh", "Mai Phương Linh", "STAFF", "OWN", "PDA", "Kỹ sư dự án", 0.2],
    ["xem", "Phan Thanh Tùng", "VIEWER", "PROJECT", "BGD", "Thư ký BGĐ", 0],
  ];
  const errRate: Record<string, number> = {};
  for (const [username, fullName, role, dataScope, d, position, rate] of USERS) {
    const u = await prisma.user.upsert({
      where: { username },
      create: { username, fullName, role, dataScope, departmentId: dept[d], position, passwordHash: hash, email: `${username.replace(".", "")}@congty.local` },
      update: {},
    });
    errRate[u.id] = rate;
  }
  // Cơ cấu Phòng Dự án: 1 Quản lý phòng ban, Phụ trách liên quan + nhân viên theo khối
  const div = Object.fromEntries((await prisma.division.findMany()).map((x) => [x.code, x.id]));
  await prisma.user.update({ where: { username: "truongpda" }, data: { isDeptManager: true, isRelatedPerson: false, divisionId: null } });
  await prisma.user.update({ where: { username: "nv.an" }, data: { isRelatedPerson: true, isDeptManager: false, divisionId: div["PDA-PT"] } });
  await prisma.user.update({ where: { username: "nv.linh" }, data: { isRelatedPerson: false, isDeptManager: false, divisionId: div["PDA-TC"] } });
  const users = await prisma.user.findMany({ where: { username: { in: USERS.map((u) => u[0]) } } });
  const byName = Object.fromEntries(users.map((u) => [u.username, u]));
  // Phân công công trình cho chỉ huy trưởng và người xem
  for (const p of projects.slice(0, 3)) {
    for (const un of ["chihuy1", "xem"]) {
      await prisma.projectMember.upsert({ where: { projectId_userId: { projectId: p.id, userId: byName[un].id } }, create: { projectId: p.id, userId: byName[un].id }, update: {} });
    }
  }

  const types = await prisma.documentType.findMany();
  const cats = await prisma.errorCategory.findMany({ include: { reasons: true } });
  const catByCode = Object.fromEntries(cats.map((c) => [c.code, c]));

  const staff = users.filter((u) => u.role === "STAFF");
  const now = Date.now();
  const toActor = (u: (typeof users)[number]) => ({ id: u.id, role: u.role, departmentId: u.departmentId });
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const sampleAdmin = { id: adminUser.id, role: adminUser.role, departmentId: adminUser.departmentId };

  const TITLES: Record<string, string[]> = {
    NTCV: ["Nghiệm thu cốt thép móng M{n}", "Nghiệm thu bê tông sàn tầng {n}", "Nghiệm thu cốp pha cột tầng {n}", "Nghiệm thu xây tường bao tầng {n}", "Nghiệm thu chống thấm sàn mái"],
    NTVL: ["Nghiệm thu thép D{n} lô {n}", "Nghiệm thu xi măng PCB40 đợt {n}", "Nghiệm thu gạch AAC đợt {n}", "Nghiệm thu cáp điện hạ thế lô {n}"],
    BVTC: ["Shop drawing kết cấu thép mái", "Bản vẽ thi công hệ MEP tầng {n}", "Bản vẽ biện pháp cẩu lắp", "Shop drawing nhôm kính mặt dựng"],
    BPTC: ["Biện pháp thi công đào đất hố móng", "Biện pháp thi công cọc khoan nhồi", "Biện pháp an toàn thi công trên cao", "Biện pháp thi công dầm cầu"],
    PSKL: ["Phát sinh khối lượng đào đá móng", "Phát sinh thay đổi thiết kế tầng {n}", "Phát sinh hạng mục chống thấm bổ sung"],
    TTGD: ["Hồ sơ thanh toán đợt {n}", "Đề nghị thanh toán khối lượng hoàn thành đợt {n}", "Thanh toán tạm ứng nhà thầu phụ đợt {n}"],
    QTHD: ["Quyết toán hợp đồng thầu phụ phần thô", "Quyết toán gói thầu cơ điện", "Quyết toán hợp đồng cung cấp bê tông"],
    HDTP: ["Hợp đồng thầu phụ hoàn thiện", "Hợp đồng mua thép xây dựng", "Hợp đồng thuê cẩu tháp"],
    DNVT: ["Đề nghị cấp vật tư tuần {n}", "Đề nghị mua thiết bị an toàn", "Đề nghị cấp vật tư hoàn thiện tầng {n}"],
    VBDI: ["Công văn đề nghị gia hạn tiến độ", "Báo cáo tuần {n} gửi CĐT", "Công văn xác nhận khối lượng"],
  };
  const ERR_BY_TYPE: Record<string, string[]> = {
    NTCV: ["KT", "KT", "ND", "QT", "PL"], NTVL: ["KT", "PL", "ND", "PL"], BVTC: ["KT", "KT", "ND", "QT"], BPTC: ["KT", "ND", "QT"],
    PSKL: ["TT", "TT", "KT", "ND", "KH"], TTGD: ["TT", "TT", "TT", "ND", "PL", "KH"], QTHD: ["TT", "TT", "PL", "ND"],
    HDTP: ["PL", "PL", "ND", "QT"], DNVT: ["ND", "QT", "KT"], VBDI: ["ND", "QT", "PL"],
  };

  // Phiếu trình ký mẫu: mỗi lần in nộp là một phiếu đã in (để trang Phiếu trình ký có số liệu)
  const year = new Date().getFullYear();
  let formNo = (await prisma.counter.findUnique({ where: { key: `ptk-${year}` } }))?.value ?? 0;
  const addForm = async (doc: { id: string; title: string }, preparer: (typeof users)[number], project: (typeof projects)[number], partner: string, resubmitNo: number, reason: string | null, at: Date) => {
    formNo++;
    const printCount = rnd() < 0.2 ? 2 : 1;
    await prisma.signingForm.create({
      data: {
        code: `PTK-${year}-${String(formNo).padStart(5, "0")}`, documentId: doc.id, resubmitNo, resubmitReason: reason, status: "PRINTED",
        createdById: preparer.id, createdAt: at, printedAt: at, printCount,
        content: {
          docTitle: doc.title, projectName: project.name, partnerName: partner, submitDate: at.toISOString().slice(0, 10),
          departmentName: deptNames[preparer.departmentId!] ?? "", otherContent: "", preparerName: preparer.fullName, relatedPersonName: "", managerName: "",
        },
        prints: { create: Array.from({ length: printCount }, (_, k) => ({ printedById: preparer.id, printedAt: new Date(at.getTime() + k * 10 * 60_000), isReprint: k > 0 })) },
      },
    });
  };
  const deptNames = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.id, d.name]));

  let created = 0;
  for (let i = 0; i < 170; i++) {
    const type = pick(types);
    const preparer = pick(staff);
    const project = pick(projects);
    const partners = partnersOf[project.id];
    const contractor = rnd() < 0.6 ? pick(partners) : null;
    const prepared = new Date(now - (rnd() < 0.3 ? between(1, 28) : between(28, 340)) * DAY);
    prepared.setHours(8 + Math.floor(rnd() * 8), Math.floor(rnd() * 60), 0, 0);
    const title = pick(TITLES[type.code]).replace(/\{n\}/g, () => String(1 + Math.floor(rnd() * 12)));
    const doc = await createDocument(
      {
        docNumber: rnd() < 0.85 ? `${String(i + 1).padStart(3, "0")}/${new Date(prepared).getFullYear()}/${type.code}-${project.code}` : null,
        title,
        typeId: type.id,
        projectId: project.id,
        contractorId: contractor?.id ?? null,
        departmentId: preparer.departmentId!,
        preparerId: preparer.id,
        submitterId: preparer.id,
        recipientId: null,
        preparedDate: prepared,
        priority: rnd() < 0.15 ? 1 : rnd() < 0.9 ? 2 : 3,
        notes: rnd() < 0.2 ? "Hồ sơ mẫu phục vụ kiểm thử" : null,
        customFields: ["TTGD", "QTHD", "PSKL"].includes(type.code) ? { contractValue: Math.round(between(0.2, 15) * 1e9), packageCode: `GT-${Math.ceil(rnd() * 9)}` } : null,
      },
      toActor(preparer),
      { isSample: true },
    );
    created++;

    let t = prepared.getTime() + between(0.5, 4) * DAY;
    if (t > now || rnd() < 0.04) continue; // còn đang soạn phiếu
    const act = async (input: Parameters<typeof performAction>[1]) => {
      // Dữ liệu mẫu: người lập in nộp; các giai đoạn do Quản trị viên xác nhận thay người có thẩm quyền
      const by = input.action === "advance" || input.action === "return" ? sampleAdmin : toActor(preparer);
      await performAction(doc.id, { ...input, at: new Date(t) } as never, by);
    };
    const partnerName = contractor?.name ?? project.investor ?? "";
    await act({ action: "submit", note: "In phiếu trình ký lần đầu" });
    await addForm(doc, preparer, project, partnerName, 0, null, new Date(t));

    let returns = 0;
    let done = false;
    while (!done) {
      // Phụ trách liên quan -> QL phòng ban ký duyệt -> Ban kiểm soát: người lập xác nhận từng giai đoạn
      let stopped = false;
      for (const stage of ["STAGE_MANAGER", "STAGE_BKS"] as const) {
        t += between(0.2, 2.5) * DAY;
        if (t > now) { stopped = true; break; }
        await act({ action: "advance", stage });
      }
      if (stopped) break;
      t += between(0.3, 4) * DAY;
      if (t > now) break;
      if (rnd() < 0.015) { await act({ action: "cancel", note: "Chủ đầu tư dừng hạng mục" }); break; }
      const pErr = (errRate[preparer.id] ?? 0.3) * (returns === 0 ? 1 : 0.45);
      if (rnd() < pErr && returns < 3) {
        const nErr = rnd() < 0.55 ? 1 : rnd() < 0.8 ? 2 : 3;
        const errors = Array.from({ length: nErr }, () => {
          const cat = catByCode[pick(ERR_BY_TYPE[type.code])];
          const reason = pick(cat.reasons);
          return {
            categoryId: cat.id,
            reasonId: reason.id,
            customReason: cat.code === "KH" && reason.name.includes("khác") ? "Bổ sung theo ý kiến cuộc họp giao ban" : null,
            description: `${reason.name} - ${title.toLowerCase()}`,
          };
        });
        await act({ action: "return", errors, requirement: "Ban kiểm soát yêu cầu chỉnh sửa, bổ sung và in ký lại" });
        returns++;
        t += (rnd() < 0.1 ? between(4, 9) : between(0.3, 3)) * DAY;
        if (t > now) break;
        const reasonText = `Chỉnh sửa theo ý kiến Ban kiểm soát lần ${returns}`;
        await act({ action: "submit", note: reasonText });
        await addForm(doc, preparer, project, partnerName, returns, reasonText, new Date(t));
        continue;
      }
      // Ban kiểm soát đã kiểm duyệt -> chờ TGĐ ký -> TGĐ đã ký
      await act({ action: "advance", stage: "STAGE_CEO" });
      t += between(0.2, 2) * DAY;
      if (t > now) break;
      await act({ action: "advance", stage: "CEO_SIGNED" });
      done = true;
    }
  }
  console.log(`✔ Đã tạo ${created} hồ sơ MẪU (isSample = true) kèm phiếu trình ký, giai đoạn và lần Ban kiểm soát trả`);
  console.log("  Tài khoản mẫu: giamdoc, truongpda, truongpkt, chihuy1, ketoantruong, nv.an, nv.binh, ... / Matkhau@123");
  await prisma.counter.upsert({ where: { key: `ptk-${year}` }, create: { key: `ptk-${year}`, value: formNo }, update: { value: formNo } });
}

seedBase()
  .then(() => (withSample ? seedSample() : undefined))
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
