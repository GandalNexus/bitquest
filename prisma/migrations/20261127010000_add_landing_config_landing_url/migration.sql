-- `landingUrl` : URL du hub public (repo GandalNexus/landing) consommée
-- par le bouton « Nexus » dans les deux apps. Ajout additif avec default
-- pour que les rows existantes continuent à fonctionner.
ALTER TABLE "LandingConfig"
  ADD COLUMN "landingUrl" TEXT NOT NULL DEFAULT 'https://gandalnexus.com';
