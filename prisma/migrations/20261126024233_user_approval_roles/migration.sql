-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeptManager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRelatedPerson" BOOLEAN NOT NULL DEFAULT false;
