-- Tách bước: Ban kiểm soát đã kiểm duyệt -> "Chờ TGĐ ký" -> TGĐ đã ký
UPDATE "public"."DocumentStatus" SET "order" = "order" + 1 WHERE "order" >= (SELECT "order" FROM "public"."DocumentStatus" WHERE "code" = 'CEO_SIGNED');
INSERT INTO "public"."DocumentStatus" ("id", "code", "name", "category", "color", "order", "isSystem", "active", "createdAt", "updatedAt")
SELECT 'status_stage_ceo', 'STAGE_CEO', 'Chờ TGĐ ký', 'REVIEWING', '#0ea5e9', "order" - 1, true, true, NOW(), NOW()
FROM "public"."DocumentStatus" WHERE "code" = 'CEO_SIGNED'
ON CONFLICT ("code") DO NOTHING;
