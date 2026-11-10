-- Phase email-verification : flag + token sur User
-- Les deux champs sont nullable, aucune donnée existante n'est migrée.
-- verificationToken unique pour pouvoir chercher par token.

ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "verificationToken" TEXT;

CREATE UNIQUE INDEX "User_verificationToken_key"
  ON "User"("verificationToken");
