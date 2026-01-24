/*
  Warnings:

  - You are about to drop the column `created_at` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `mime_type` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `original_name` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `media` table. All the data in the column will be lost.
  - You are about to drop the column `user_id` on the `media` table. All the data in the column will be lost.
  - Added the required column `mimeType` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originalName` to the `media` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `media` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('API_CALL', 'USER_SIGNUP', 'USER_LOGIN', 'ARTISAN_CREATED', 'ARTISAN_UPDATED', 'ARTISAN_VIEWED', 'CONTACT_INFO_ACCESSED', 'LISTING_ENGAGEMENT', 'REVIEW_CREATED', 'TIP_SENT', 'CATEGORY_VIEWED', 'SEARCH_PERFORMED', 'ERROR_OCCURRED');

-- DropForeignKey
ALTER TABLE "media" DROP CONSTRAINT "media_user_id_fkey";

-- DropIndex
DROP INDEX "media_created_at_idx";

-- DropIndex
DROP INDEX "media_tags_idx";

-- DropIndex
DROP INDEX "media_user_id_idx";

-- AlterTable
ALTER TABLE "media" DROP COLUMN "created_at",
DROP COLUMN "mime_type",
DROP COLUMN "original_name",
DROP COLUMN "updated_at",
DROP COLUMN "user_id",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "originalName" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "tags" DROP DEFAULT;

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "anonymizedUserId" TEXT,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "responseTime" INTEGER,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "referrer" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_aggregations" (
    "id" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "eventType" "EventType" NOT NULL,
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "avgResponseTime" DOUBLE PRECISION,
    "uniqueUsers" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_aggregations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_eventType_idx" ON "analytics_events"("eventType");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_anonymizedUserId_idx" ON "analytics_events"("anonymizedUserId");

-- CreateIndex
CREATE INDEX "analytics_events_endpoint_idx" ON "analytics_events"("endpoint");

-- CreateIndex
CREATE INDEX "analytics_aggregations_periodType_idx" ON "analytics_aggregations"("periodType");

-- CreateIndex
CREATE INDEX "analytics_aggregations_periodStart_idx" ON "analytics_aggregations"("periodStart");

-- CreateIndex
CREATE INDEX "analytics_aggregations_eventType_idx" ON "analytics_aggregations"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_aggregations_periodType_periodStart_eventType_key" ON "analytics_aggregations"("periodType", "periodStart", "eventType");

-- CreateIndex
CREATE INDEX "media_userId_idx" ON "media"("userId");

-- CreateIndex
CREATE INDEX "media_provider_idx" ON "media"("provider");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
