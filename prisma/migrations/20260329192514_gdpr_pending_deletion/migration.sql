CREATE TABLE "pending_deletions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_deletions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pending_deletions_userId_key" ON "pending_deletions"("userId");
CREATE UNIQUE INDEX "pending_deletions_token_key" ON "pending_deletions"("token");

ALTER TABLE "pending_deletions" ADD CONSTRAINT "pending_deletions_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
