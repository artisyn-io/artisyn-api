-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EventType" ADD VALUE 'LOGIN_FAILED';
ALTER TYPE "EventType" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "EventType" ADD VALUE 'ADMIN_ACTION';

-- CreateIndex
CREATE INDEX "analytics_events_eventType_createdAt_idx" ON "analytics_events"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_anonymizedUserId_eventType_createdAt_idx" ON "analytics_events"("anonymizedUserId", "eventType", "createdAt");
