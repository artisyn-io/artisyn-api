-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'CURATOR_VERIFICATION_SUBMITTED';
ALTER TYPE "EventType" ADD VALUE 'CURATOR_VERIFICATION_APPROVED';
ALTER TYPE "EventType" ADD VALUE 'CURATOR_VERIFICATION_REJECTED';
ALTER TYPE "EventType" ADD VALUE 'CURATOR_VERIFICATION_DOCUMENT_UPLOADED';
ALTER TYPE "EventType" ADD VALUE 'CURATOR_VERIFICATION_VIEWED';

-- CreateTable
CREATE TABLE "curator_verification_applications" (
    "id" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curator_verification_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curator_verification_documents" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curator_verification_history" (
    "id" TEXT NOT NULL,
    "curatorId" TEXT NOT NULL,
    "applicationId" TEXT,
    "action" TEXT NOT NULL,
    "status" "VerificationStatus",
    "performedBy" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_verification_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curator_verification_applications_curatorId_idx" ON "curator_verification_applications"("curatorId");

-- CreateIndex
CREATE INDEX "curator_verification_applications_status_idx" ON "curator_verification_applications"("status");

-- CreateIndex
CREATE INDEX "curator_verification_applications_submittedAt_idx" ON "curator_verification_applications"("submittedAt");

-- CreateIndex
CREATE INDEX "curator_verification_applications_reviewedBy_idx" ON "curator_verification_applications"("reviewedBy");

-- CreateIndex
CREATE INDEX "curator_verification_documents_applicationId_idx" ON "curator_verification_documents"("applicationId");

-- CreateIndex
CREATE INDEX "curator_verification_documents_mediaId_idx" ON "curator_verification_documents"("mediaId");

-- CreateIndex
CREATE INDEX "curator_verification_history_curatorId_idx" ON "curator_verification_history"("curatorId");

-- CreateIndex
CREATE INDEX "curator_verification_history_applicationId_idx" ON "curator_verification_history"("applicationId");

-- CreateIndex
CREATE INDEX "curator_verification_history_action_idx" ON "curator_verification_history"("action");

-- CreateIndex
CREATE INDEX "curator_verification_history_createdAt_idx" ON "curator_verification_history"("createdAt");

-- AddForeignKey
ALTER TABLE "curator_verification_applications" ADD CONSTRAINT "curator_verification_applications_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "Curator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_verification_documents" ADD CONSTRAINT "curator_verification_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "curator_verification_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_verification_documents" ADD CONSTRAINT "curator_verification_documents_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_verification_history" ADD CONSTRAINT "curator_verification_history_curatorId_fkey" FOREIGN KEY ("curatorId") REFERENCES "Curator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_verification_history" ADD CONSTRAINT "curator_verification_history_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "curator_verification_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
