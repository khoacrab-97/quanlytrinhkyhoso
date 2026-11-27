"use client";
// Danh mục quản lý: Công trình/dự án, Loại hồ sơ, CĐT/NCC/thầu phụ, Nhóm lỗi, Nguyên nhân trả hồ sơ.
// Quản trị viên: toàn quyền. Người được ủy quyền: chỉ thấy và thêm mới các danh mục được giao.
// Phòng ban, Khối, Trạng thái, Trường mở rộng nằm ở Quản trị hệ thống.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useCan, useMe } from "@/components/AppShell";
import { CatalogTable } from "@/components/CatalogManager";
import { DELEGABLE_CATALOGS } from "@/lib/constants";
import { ErrorBox, PageHeader, Tabs } from "@/components/ui";

function CatalogsInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const isAdmin = useCan()("catalog.manage");
  const tabs = Object.entries(DELEGABLE_CATALOGS).filter(([k]) => isAdmin || me.catalogGrants.includes(k));
  const entity = tabs.some(([k]) => k === sp.get("tab")) ? sp.get("tab")! : tabs[0]?.[0];
  if (!entity) return <ErrorBox error="Bạn chưa được ủy quyền danh mục nào" />;
  return (
    <div>
      <PageHeader title="Danh mục quản lý" subtitle={isAdmin ? "Dữ liệu dùng chung, liên kết với toàn bộ các module — tránh nhập lặp lại" : "Bạn được ủy quyền thêm mới các danh mục dưới đây. Sửa, ngừng dùng, xóa do Quản trị viên thực hiện."} />
      <Tabs value={entity} onChange={(t) => router.replace(`/catalogs?tab=${t}`)} tabs={tabs.map(([value, label]) => ({ value, label }))} />
      <CatalogTable key={entity} entity={entity} canEdit={isAdmin} />
    </div>
  );
}

export default function CatalogsPage() {
  return <Suspense><CatalogsInner /></Suspense>;
}
