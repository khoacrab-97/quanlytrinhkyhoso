-- Đổi cách gọi mốc Quản lý phòng ban: "Đã xác nhận" -> "Đã phê duyệt" (dữ liệu timeline đã ghi)
UPDATE "public"."DocumentActivity" SET "handlerName" = REPLACE("handlerName", 'Quản lý Phòng ban - Đã xác nhận', 'Quản lý phòng ban - Đã phê duyệt') WHERE "handlerName" LIKE '%Quản lý Phòng ban - Đã xác nhận%';
UPDATE "public"."DocumentActivity" SET "content" = REPLACE("content", 'Quản lý Phòng ban - Đã xác nhận', 'Quản lý phòng ban - Đã phê duyệt') WHERE "content" LIKE '%Quản lý Phòng ban - Đã xác nhận%';
UPDATE "public"."DocumentStatusHistory" SET "note" = REPLACE("note", 'Quản lý Phòng ban - Đã xác nhận', 'Quản lý phòng ban - Đã phê duyệt') WHERE "note" LIKE '%Quản lý Phòng ban - Đã xác nhận%';
