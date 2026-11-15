import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Coins,
  FlaskConical,
  Github,
  Globe,
  Heart,
  Lightbulb,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "GandalNexus — Apprendre, pratiquer, posséder Bitcoin",
  description:
    "GandalNexus est un écosystème open-source Bitcoin : un parcours gamifié (BitQuest) et un laboratoire non-custodial (BitLab) pour apprendre, pratiquer et posséder vraiment. De l'Afrique vers le monde.",
};

const BITLAB_URL = process.env.NEXT_PUBLIC_BITLAB_URL ?? "http://localhost:3001";

const OBJECTIVES: Array<{ icon: LucideIcon; title: string; body: string }> = [
  {
    icon: BookOpen,
    title: "Démocratiser le savoir Bitcoin",
    body: "Des contenus pédagogiques rigoureux en FR, EN et Wolof, accessibles à toute personne qui a un navigateur — sans prérequis financier ni technique.",
  },
  {
    icon: Shield,
    title: "Souveraineté numérique",
    body: "Pas de custodian, pas de KYC pour apprendre. BitLab s'exécute dans ton navigateur : tes clés ne quittent jamais ton appareil.",
  },
  {
    icon: Target,
    title: "Preuves on-chain vérifiables",
    body: "Chaque quête BitQuest-BitLab s'ancre sur des faits cryptographiques vérifiables (TX, blocs, invoices, channels) — pas de badges de participation.",
  },
  {
    icon: Globe,
    title: "Communauté open-source",
    body: "Code source AGPL-3.0 (BitQuest) et MIT (BitLab). Contribuer est encouragé — docs, i18n, missions, sécurité.",
  },
];

const PROJECTS: Array<{
  icon: LucideIcon;
  name: string;
  tagline: string;
  description: string;
  features: string[];
  cta: { label: string; href: string };
  license: string;
  accent: string;
}> = [
  {
    icon: BookOpen,
    name: "BitQuest",
    tagline: "Apprends, pratique, gagne",
    description:
      "Plateforme pédagogique gamifiée : quêtes théoriques et pratiques, badges, satoshis-récompenses. Progresse du bloc 0 de Satoshi jusqu'au multisig Taproot.",
    features: [
      "5 pistes narratives (Initiation → Avancé)",
      "Quiz + missions pratiques par quête",
      "Préparation possible à des récompenses Lightning réelles",
      "Admin & Studio pour rédacteurs communautaires",
    ],
    cta: { label: "Entrer dans BitQuest", href: "/" },
    license: "AGPL-3.0",
    accent: "text-primary",
  },
  {
    icon: FlaskConical,
    name: "BitLab",
    tagline: "Laboratoire Bitcoin dans ton navigateur",
    description:
      "Deux nœuds LDK Lightning compilés en WebAssembly, un explorateur mempool, un forgeron de clés et un mineur simulé. 100 % local, 0 serveur custodial.",
    features: [
      "Nœuds Lightning réels (testnet/signet/regtest)",
      "Wallet HD non-custodial, clés dans IndexedDB",
      "Transactions brutes avec signature client",
      "Mode regtest pour tester sans Internet",
    ],
    cta: { label: "Ouvrir BitLab", href: BITLAB_URL },
    license: "MIT",
    accent: "text-emerald-500",
  },
];

/**
 * Fallback utilisé si la table TeamMember est vide (ex. post-déploiement
 * avant qu'un admin ne la peuple). Évite une page avec zéro équipe
 * affichée côté public. À retirer dès que la DB contient ≥ 1 membre
 * publié (vérifié dynamiquement dans `getPublishedMembers`).
 */
const FALLBACK_MEMBERS = [
  {
    initials: "AD",
    name: "Alhassane Diallo",
    role: "Lead ingénieur · architecte",
    contribution: "Design système, auth, protocole BitQuest ↔ BitLab",
    avatarUrl: null as string | null,
  },
  {
    initials: "GN",
    name: "Contributeurs GandalNexus",
    role: "Collective communautaire",
    contribution: "Pédagogie, i18n Wolof, missions, docs",
    avatarUrl: null as string | null,
  },
];

/** Charge les membres publiés depuis la DB ; retombe sur le fallback si vide. */
async function getPublishedMembers() {
  try {
    const rows = await db.teamMember.findMany({
      where: { publishedAt: { not: null } },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        role: true,
        contribution: true,
        initials: true,
        avatarUrl: true,
      },
    });
    if (rows.length === 0) return FALLBACK_MEMBERS;
    return rows;
  } catch {
    // Table absente (migration pas encore appliquée) → fallback silencieux.
    return FALLBACK_MEMBERS;
  }
}

const PRINCIPLES = [
  "Pas de monnaie fictive confondue avec du vrai Bitcoin — séparation stricte",
  "Pas de collecte de données utilisateur au-delà du strict nécessaire",
  "Pas de verrouillage : tu peux tout exporter, tout fork",
  "Chaque preuve on-chain est auditable par toi-même, en direct",
];

export default async function GandalNexusLandingPage() {
  const members = await getPublishedMembers();
  return (
    <div className="relative min-h-screen bg-background">
      <div aria-hidden className="starfield pointer-events-none" />

      {/* Topbar légère */}
      <header className="relative z-10 border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-y-2 gap-x-3 px-4 py-3">
          <Link href="/gandalnexus" className="flex items-center gap-2 font-display font-bold">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <span>
              Gandal<span className="text-primary">Nexus</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <Link href="/">BitQuest</Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
              <a href={BITLAB_URL} rel="noopener">
                BitLab
              </a>
            </Button>
            <Button asChild size="sm" className="px-2 sm:px-3">
              <Link href="/">
                Commencer
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:py-24">
        <div className="flex flex-col items-center text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 bg-primary/5 text-primary">
            <Sparkles className="h-3 w-3" aria-hidden />
            Écosystème Bitcoin open-source · de l&apos;Afrique vers le monde
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-6xl">
            Apprendre, pratiquer, <span className="text-primary">posséder</span> Bitcoin.
          </h1>
          <p className="mt-6 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            GandalNexus rend Bitcoin accessible, vérifiable et souverain : un parcours
            gamifié pour comprendre, un laboratoire dans ton navigateur pour pratiquer, et
            une communauté pour avancer. Zéro custodian, zéro paywall pour apprendre.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/">
                <BookOpen className="h-5 w-5" aria-hidden />
                Lancer BitQuest
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={BITLAB_URL} rel="noopener">
                <FlaskConical className="h-5 w-5" aria-hidden />
                Explorer BitLab
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="relative z-10 border-y bg-muted/30">
        <div className="mx-auto w-full max-w-4xl px-4 py-12 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Notre mission</h2>
          <p className="mt-4 text-pretty text-sm text-muted-foreground sm:text-base">
            Bitcoin est la plus grande rupture monétaire depuis des siècles — mais la
            barrière à l&apos;entrée (vocabulaire, fausses promesses, risques réels)
            laisse trop de monde à la porte. GandalNexus construit un pont : apprendre
            sans dogme, pratiquer sans risque, et comprendre pourquoi la souveraineté
            numérique vaut la peine qu&apos;on prenne le temps.
          </p>
        </div>
      </section>

      {/* Projets */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Nos deux projets</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pensés pour fonctionner ensemble, séparables à la demande.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {PROJECTS.map((p) => {
            const Icon = p.icon;
            return (
              <Card key={p.name} className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ${p.accent}`}>
                        <Icon className="h-5 w-5" aria-hidden />
                      </div>
                      <div>
                        <CardTitle className="font-display text-xl">{p.name}</CardTitle>
                        <CardDescription>{p.tagline}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {p.license}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    {p.cta.href.startsWith("http") ? (
                      <a href={p.cta.href} rel="noopener">
                        {p.cta.label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </a>
                    ) : (
                      <Link href={p.cta.href}>
                        {p.cta.label}
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </Link>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Objectifs */}
      <section className="relative z-10 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">Nos objectifs</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Quatre convictions qui guident chaque décision produit.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {OBJECTIVES.map((o) => {
              const Icon = o.icon;
              return (
                <Card key={o.title} className="h-full">
                  <CardHeader className="pb-3">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" aria-hidden />
                    </div>
                    <CardTitle className="text-base">{o.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{o.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Principes */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-4 py-16">
        <div className="mb-6 text-center">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Nos principes</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Des règles non-négociables qu&apos;on applique dans le code.
          </p>
        </div>
        <ul className="space-y-3">
          {PRINCIPLES.map((p) => (
            <li
              key={p}
              className="flex items-start gap-3 rounded-md border bg-card/60 p-3 text-sm"
            >
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Équipe */}
      <section className="relative z-10 border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <div className="mb-8 text-center">
            <h2 className="font-display text-2xl font-bold sm:text-3xl">L&apos;équipe</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Une petite équipe sénégalaise + une communauté de contributeurs mondiaux.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {members.map((m, idx) => {
              const key = "id" in m && typeof m.id === "string" ? m.id : `fallback-${idx}`;
              return (
              <Card key={key}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {m.avatarUrl ? (
                      <Image
                        src={m.avatarUrl}
                        alt=""
                        width={56}
                        height={56}
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div
                        aria-hidden
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 font-display text-lg font-bold text-primary"
                      >
                        {m.initials}
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{m.name}</CardTitle>
                      <CardDescription>{m.role}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{m.contribution}</p>
                </CardContent>
              </Card>
              );
            })}
          </div>
          <div className="mt-8 rounded-md border border-primary/20 bg-primary/5 p-4 text-center text-sm">
            <Users className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden />
            Tu veux contribuer ? Rejoins la communauté GandalNexus : relecture
            pédagogique, traduction Wolof, audit sécurité, mission builder — chaque
            PR compte.
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <Lightbulb className="mx-auto mb-4 h-10 w-10 text-primary" aria-hidden />
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          Prêt·e à posséder du Bitcoin — vraiment ?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Commence par comprendre. Puis signe ta première transaction depuis ton
          propre navigateur. Pas de budget, pas de risque, pas d&apos;excuse.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/">
              <Coins className="h-5 w-5" aria-hidden />
              Démarrer BitQuest
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={BITLAB_URL} rel="noopener">
              <FlaskConical className="h-5 w-5" aria-hidden />
              Lancer BitLab
            </a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t bg-card/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" aria-hidden />
            <span>
              GandalNexus · open-source · fait avec rigueur depuis Dakar
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              rel="noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Github className="h-4 w-4" aria-hidden />
              GitHub
            </a>
            <Link href="/" className="hover:text-foreground">
              BitQuest
            </Link>
            <a href={BITLAB_URL} rel="noopener" className="hover:text-foreground">
              BitLab
            </a>
            <Link href="/verify" className="hover:text-foreground">
              Vérifier un certificat
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
