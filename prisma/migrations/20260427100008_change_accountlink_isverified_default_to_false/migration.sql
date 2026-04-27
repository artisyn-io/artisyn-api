-- AlterAccountLinkIsVerifiedDefault
-- Changes the default value of isVerified column from true to false
-- Existing rows retain their current values; only new rows are affected

ALTER TABLE "account_links" ALTER COLUMN "isVerified" SET DEFAULT false;
