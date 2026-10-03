ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailVerificationPurpose" TEXT DEFAULT 'email_verification',
  ADD COLUMN IF NOT EXISTS "passwordResetResendAt" TIMESTAMP(3);

-- Existing OTPs may have been stored in plaintext. Invalidate them rather
-- than attempting an unsafe conversion; users can request fresh codes.
UPDATE "User"
SET "emailVerificationCode" = NULL,
    "emailVerificationRevokedAt" = COALESCE("emailVerificationRevokedAt", NOW()),
    "emailVerificationPurpose" = 'email_verification'
WHERE "emailVerificationCode" IS NOT NULL;

-- Codes created before keyed hashing cannot safely remain usable.
UPDATE "password_code_resets"
SET "code" = repeat('0', 64),
    "expiresAt" = COALESCE("expiresAt", "createdAt"),
    "revokedAt" = COALESCE("revokedAt", NOW()),
    "purpose" = COALESCE("purpose", 'password_reset');

ALTER TABLE "password_code_resets"
  ALTER COLUMN "code" TYPE VARCHAR(64),
  ALTER COLUMN "code" SET NOT NULL,
  ALTER COLUMN "expiresAt" SET NOT NULL,
  ALTER COLUMN "purpose" SET DEFAULT 'password_reset',
  ALTER COLUMN "purpose" SET NOT NULL;