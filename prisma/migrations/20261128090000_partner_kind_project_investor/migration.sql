-- CreateEnum
CREATE TYPE "public"."PartnerKind" AS ENUM ('INVESTOR', 'SUPPLIER', 'SUBCONTRACTOR');

-- AlterTable
ALTER TABLE "public"."Contractor" ADD COLUMN     "kind" "public"."PartnerKind" NOT NULL DEFAULT 'SUPPLIER';

-- AlterTable
ALTER TABLE "public"."Project" ADD COLUMN     "investorId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "public"."Contractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
