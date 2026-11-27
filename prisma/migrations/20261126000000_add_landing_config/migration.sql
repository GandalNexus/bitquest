-- Singleton LandingConfig consumed by the standalone `landing/` repo.
-- The admin space can mutate redirect URLs at any time.
CREATE TABLE "LandingConfig" (
  "id"           TEXT        PRIMARY KEY DEFAULT 'singleton',
  "bitquestUrl"  TEXT        NOT NULL,
  "bitlabUrl"    TEXT        NOT NULL,
  "githubOrgUrl" TEXT        NOT NULL DEFAULT 'https://github.com/GandalNexus',
  "verifyUrl"    TEXT        NOT NULL,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  "updatedBy"    TEXT
);

-- Insert the default row so GET /api/public/landing-config always returns
-- something — otherwise a fresh deploy would 404 and the landing would
-- silently fall back to its baked-in defaults (which is also OK).
INSERT INTO "LandingConfig" ("id", "bitquestUrl", "bitlabUrl", "verifyUrl", "updatedAt")
VALUES (
  'singleton',
  'https://www.bitquest.gandalnexus.xyz',
  'https://www.bitlab.gandalnexus.xyz',
  'https://www.bitquest.gandalnexus.xyz/verify',
  CURRENT_TIMESTAMP
);
