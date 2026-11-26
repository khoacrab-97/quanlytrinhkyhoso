-- CreateTable
CREATE TABLE "public"."ProjectPartner" (
    "projectId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,

    CONSTRAINT "ProjectPartner_pkey" PRIMARY KEY ("projectId","contractorId")
);

-- AddForeignKey
ALTER TABLE "public"."ProjectPartner" ADD CONSTRAINT "ProjectPartner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProjectPartner" ADD CONSTRAINT "ProjectPartner_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "public"."Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================
-- Chuyển trạng thái hệ thống sang quy trình 4 giai đoạn cố định:
--   Trình Quản lý kiểm tra > Quản lý phòng ký duyệt > Ban kiểm soát > TGĐ đã ký
--   (Ban kiểm soát trả về -> phải in ký lại, quay về giai đoạn đầu)
-- Đổi mã tại chỗ để giữ nguyên lịch sử; trạng thái bị gộp được chuyển tham chiếu rồi xóa.
-- DB mới (bảng rỗng): các lệnh dưới không ảnh hưởng, seed sẽ tạo trạng thái mới.
-- =============================================================
UPDATE "public"."DocumentStatus" SET "code" = 'STAGE_CHECK',   "name" = 'Trình Quản lý kiểm tra',     "category" = 'SUBMITTED', "order" = 2, "color" = '#3b82f6' WHERE "code" = 'SUBMITTED';
UPDATE "public"."DocumentStatus" SET "code" = 'STAGE_MANAGER', "name" = 'Quản lý phòng ký duyệt',     "category" = 'REVIEWING', "order" = 3, "color" = '#6366f1' WHERE "code" = 'CHECKING';
UPDATE "public"."DocumentStatus" SET "code" = 'STAGE_BKS',     "name" = 'Ban kiểm soát',              "category" = 'REVIEWING', "order" = 4, "color" = '#8b5cf6' WHERE "code" = 'WAITING_APPROVAL';
UPDATE "public"."DocumentStatus" SET "code" = 'BKS_RETURNED',  "name" = 'BKS trả về - chờ in ký lại', "category" = 'RETURNED',  "order" = 6, "color" = '#ef4444' WHERE "code" = 'RETURNED';
UPDATE "public"."DocumentStatus" SET "code" = 'CEO_SIGNED',    "name" = 'TGĐ đã ký',                  "category" = 'COMPLETED', "order" = 5, "color" = '#16a34a' WHERE "code" = 'COMPLETED';
UPDATE "public"."DocumentStatus" SET "name" = 'Đang soạn phiếu', "order" = 1 WHERE "code" = 'PREPARING';
UPDATE "public"."DocumentStatus" SET "order" = 7 WHERE "code" = 'CANCELLED';

CREATE TEMP TABLE "_status_merge" ("old" TEXT, "new" TEXT);
INSERT INTO "_status_merge" VALUES ('WAITING_SUBMIT', 'PREPARING'), ('RESUBMITTED', 'STAGE_CHECK'), ('REVISING', 'BKS_RETURNED'), ('APPROVED', 'CEO_SIGNED');

UPDATE "public"."Document" d SET "statusId" = n."id"
  FROM "_status_merge" m JOIN "public"."DocumentStatus" o ON o."code" = m."old" JOIN "public"."DocumentStatus" n ON n."code" = m."new"
  WHERE d."statusId" = o."id";
UPDATE "public"."DocumentStatusHistory" h SET "toStatusId" = n."id"
  FROM "_status_merge" m JOIN "public"."DocumentStatus" o ON o."code" = m."old" JOIN "public"."DocumentStatus" n ON n."code" = m."new"
  WHERE h."toStatusId" = o."id";
UPDATE "public"."DocumentStatusHistory" h SET "fromStatusId" = n."id"
  FROM "_status_merge" m JOIN "public"."DocumentStatus" o ON o."code" = m."old" JOIN "public"."DocumentStatus" n ON n."code" = m."new"
  WHERE h."fromStatusId" = o."id";
UPDATE "public"."DocumentActivity" a SET "statusId" = n."id"
  FROM "_status_merge" m JOIN "public"."DocumentStatus" o ON o."code" = m."old" JOIN "public"."DocumentStatus" n ON n."code" = m."new"
  WHERE a."statusId" = o."id";
DELETE FROM "public"."DocumentStatus" WHERE "code" IN (SELECT "old" FROM "_status_merge")
  AND EXISTS (SELECT 1 FROM "public"."DocumentStatus" n JOIN "_status_merge" m ON n."code" = m."new" WHERE m."old" = "DocumentStatus"."code");
DROP TABLE "_status_merge";

-- Bỏ hạn xử lý: không còn tính quá hạn
UPDATE "public"."Document" SET "dueDate" = NULL;
DELETE FROM "public"."Notification" WHERE "type" LIKE 'ALERT\_%';
DELETE FROM "public"."SystemSetting" WHERE "key" LIKE 'alert.%' OR "key" = 'return.defaultFixDays';
