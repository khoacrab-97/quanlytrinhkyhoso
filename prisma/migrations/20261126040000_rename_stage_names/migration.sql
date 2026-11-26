-- Đổi tên giai đoạn: Quản lý kiểm tra -> Phụ trách liên quan, Quản lý phòng -> Quản lý phòng ban
UPDATE "public"."DocumentStatus" SET "name" = 'Trình Phụ trách liên quan' WHERE "code" = 'STAGE_CHECK' AND "name" = 'Trình Quản lý kiểm tra';
UPDATE "public"."DocumentStatus" SET "name" = 'Quản lý phòng ban ký duyệt' WHERE "code" = 'STAGE_MANAGER' AND "name" = 'Quản lý phòng ký duyệt';
