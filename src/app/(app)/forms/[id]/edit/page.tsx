"use client";
import { use } from "react";
import { useApi } from "@/lib/client";
import { FormEditor } from "@/components/FormEditor";
import type { SheetContent } from "@/components/SigningSheet";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";

export default function EditFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<{ form: { code: string; content: SheetContent; resubmitNo: number; resubmitReason: string | null }; state: { canEdit: boolean } }>(`/api/signing-forms/${id}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  if (!data.state.canEdit) return <ErrorBox error="Phiếu đã in hoặc bạn không có quyền sửa" />;
  return (
    <div>
      <PageHeader title={`Sửa phiếu ${data.form.code}`} subtitle="Chỉ phiếu chưa in mới được sửa" />
      <FormEditor id={id} initial={data.form.content} initialReason={data.form.resubmitReason} resubmitNo={data.form.resubmitNo} />
    </div>
  );
}
