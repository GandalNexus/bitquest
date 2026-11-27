-- Optional contextual links on the LandingConfig singleton. All nullable
-- so an existing install keeps running unchanged ; the landing hides the
-- corresponding UI slots when a field is null / empty.
ALTER TABLE "LandingConfig"
  ADD COLUMN "contactEmail" TEXT,
  ADD COLUMN "twitterUrl"   TEXT,
  ADD COLUMN "nostrPubkey"  TEXT,
  ADD COLUMN "docsUrl"      TEXT;
