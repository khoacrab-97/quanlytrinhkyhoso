-- CreateEnum
CREATE TYPE "public"."SigningFormStatus" AS ENUM ('DRAFT', 'PRINTED');

-- CreateTable
CREATE TABLE "public"."SigningForm" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "resubmitNo" INTEGER NOT NULL DEFAULT 0,
    "resubmitReason" TEXT,
    "content" JSONB NOT NULL,
    "status" "public"."SigningFormStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "printedAt" TIMESTAMP(3),
    "printCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SigningForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SigningFormPrint" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "printedById" TEXT NOT NULL,
    "printedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isReprint" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SigningFormPrint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SigningForm_code_key" ON "public"."SigningForm"("code");

-- CreateIndex
CREATE INDEX "SigningForm_createdById_idx" ON "public"."SigningForm"("createdById");

-- CreateIndex
CREATE INDEX "SigningForm_printedAt_idx" ON "public"."SigningForm"("printedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SigningForm_documentId_resubmitNo_key" ON "public"."SigningForm"("documentId", "resubmitNo");

-- CreateIndex
CREATE INDEX "SigningFormPrint_formId_idx" ON "public"."SigningFormPrint"("formId");

-- AddForeignKey
ALTER TABLE "public"."SigningForm" ADD CONSTRAINT "SigningForm_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SigningForm" ADD CONSTRAINT "SigningForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SigningFormPrint" ADD CONSTRAINT "SigningFormPrint_formId_fkey" FOREIGN KEY ("formId") REFERENCES "public"."SigningForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SigningFormPrint" ADD CONSTRAINT "SigningFormPrint_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
