-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "catalogGrants" TEXT[] DEFAULT ARRAY[]::TEXT[];
