import { DocumentForm } from "@/components/DocumentForm";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Thêm hồ sơ" };

export default function NewDocumentPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Thêm hồ sơ trình ký" subtitle="Mã hồ sơ được hệ thống tự sinh khi lưu" />
      <DocumentForm />
    </div>
  );
}
