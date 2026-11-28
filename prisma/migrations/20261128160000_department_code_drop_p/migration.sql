-- Mã phòng ban: các phòng có tên bắt đầu bằng "Phòng" bỏ chữ P ở đầu mã (vd PKT -> KT, PKTOAN -> KTOAN).
-- Mã phiếu trình ký dạng <Mã phòng>-YYYY-MM-NNNN. Chỉ đổi khi mã mới chưa bị phòng ban khác dùng.
UPDATE "public"."Department" AS d
SET "code" = substr(d."code", 2)
WHERE d."name" ILIKE 'Phòng %'
  AND d."code" LIKE 'P%'
  AND length(d."code") > 1
  AND NOT EXISTS (SELECT 1 FROM "public"."Department" AS o WHERE o."code" = substr(d."code", 2));
