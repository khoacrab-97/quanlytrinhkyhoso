"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormEditor } from "@/components/FormEditor";
import { PageHeader } from "@/components/ui";

function Inner() {
  const sp = useSearchParams();
  return <FormEditor presetDocumentId={sp.get("documentId") ?? undefined} />;
}

export default function NewFormPage() {
  return (
    <div>
      <PageHeader title="Tạo phiếu trình ký" subtitle="Điền nội dung theo mẫu Phiếu phê duyệt và kiểm tra → xem trước → in" />
      <Suspense><Inner /></Suspense>
    </div>
  );
}
