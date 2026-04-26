-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "APIKeyStatus" AS ENUM ('active', 'revoked', 'expired');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "JobStatus" AS ENUM ('ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "status" "APIKeyStatus" NOT NULL DEFAULT 'active',
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedEndpoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_key" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_key_idx" ON "api_keys"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "api_keys_status_idx" ON "api_keys"("status");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "api_keys"
    ADD CONSTRAINT "api_keys_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Job" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Job_applicationId_key" ON "Job"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_listingId_idx" ON "Job"("listingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_applicationId_idx" ON "Job"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_applicantId_idx" ON "Job"("applicantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Job"
    ADD CONSTRAINT "Job_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Artisan"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Job"
    ADD CONSTRAINT "Job_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
    ALTER TABLE "Job"
    ADD CONSTRAINT "Job_applicantId_fkey"
    FOREIGN KEY ("applicantId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
