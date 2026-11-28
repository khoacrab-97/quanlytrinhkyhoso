-- Mã phòng Dự án: PDA -> DA (mã phiếu trình ký dạng DA-2026-11-0001).
-- Chỉ đổi khi chưa có phòng ban mã DA.
UPDATE "public"."Department" SET "code" = 'DA' WHERE "code" = 'PDA' AND NOT EXISTS (SELECT 1 FROM "public"."Department" WHERE "code" = 'DA');
