-- AlterTable
ALTER TABLE "public"."Contractor" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "public"."DocumentType" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "public"."ErrorCategory" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "public"."ErrorReason" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "createdById" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contractor" ADD CONSTRAINT "Contractor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentType" ADD CONSTRAINT "DocumentType_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ErrorCategory" ADD CONSTRAINT "ErrorCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ErrorReason" ADD CONSTRAINT "ErrorReason_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
