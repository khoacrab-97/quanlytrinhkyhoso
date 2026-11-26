"use client";
import { use } from "react";
import { useApi } from "@/lib/client";
import { toInputDate } from "@/lib/dates";
import { DocumentForm } from "@/components/DocumentForm";
import { ErrorBox, PageHeader, Spinner } from "@/components/ui";

type D = {
  doc: {
    code: string; docNumber: string | null; title: string; typeId: string; projectId: string; contractorId: string | null; departmentId: string; preparerId: string;
    submitterId: string | null; recipientId: string | null; preparedDate: string; priority: number; notes: string | null; customFields: Record<string, unknown> | null;
  };
  perms: { edit: boolean };
};

export default function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useApi<D>(`/api/documents/${id}`);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Spinner />;
  if (!data.perms.edit) return <ErrorBox error="Bạn không có quyền chỉnh sửa hồ sơ này" />;
  const d = data.doc;
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={`Chỉnh sửa hồ sơ ${d.code}`} subtitle="Mọi thay đổi được ghi lại trong lịch sử hồ sơ. Trạng thái hồ sơ thay đổi qua các thao tác xử lý." />
      <DocumentForm
        id={id}
        initial={{
          docNumber: d.docNumber ?? "", title: d.title, typeId: d.typeId, projectId: d.projectId, contractorId: d.contractorId ?? "", departmentId: d.departmentId,
          preparerId: d.preparerId, submitterId: d.submitterId ?? "", recipientId: d.recipientId ?? "", preparedDate: toInputDate(d.preparedDate),
          priority: d.priority, notes: d.notes ?? "", customFields: d.customFields ?? {},
        }}
      />
    </div>
  );
}
