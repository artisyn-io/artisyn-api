/*
  Warnings:

  - The `status` column on the `data_export_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DataExportRequestStatus" AS ENUM ('pending', 'processing', 'ready', 'expired', 'failed');

-- AlterTable
ALTER TABLE "data_export_requests" DROP COLUMN "status",
ADD COLUMN     "status" "DataExportRequestStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "data_export_requests_status_idx" ON "data_export_requests"("status");

-- CreateIndex
CREATE INDEX "privacy_settings_userId_idx" ON "privacy_settings"("userId");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_profiles_userId_idx" ON "user_profiles"("userId");
