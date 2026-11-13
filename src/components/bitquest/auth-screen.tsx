"use client";

import { useMemo, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Coins, FlaskConical, Loader2, LogIn, Target, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api, type PublicUser } from "@/lib/bitquest/client";
import { useBitQuest } from "@/lib/bitquest/store";
import {
  buildBitlabSsoRedirectUrl,
  isSafeReturnTo,
} from "@/lib/auth/return-to";
import { OrbiteMark, BitQuestWordmark } from "./brand";
import { useT } from "@/i18n/locale-provider";
import { LanguageSwitch } from "@/i18n/language-switch";

const FEATURES = [
  { icon: BookOpen, keyword: "Apprends", label: "Parcours pédagogiques" },
  { icon: Target, keyword: "Pratique", label: "Missions BitLab" },
  { icon: Coins, keyword: "Gagne", label: "Satoshis récompensés" },
] as const;

export function AuthScreen() {
  const setSession = useBitQuest((s) => s.setSession);
  const { toast } = useToast();
  const t = useT();
  const searchParams = useSearchParams();

  const returnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo");
    return raw && isSafeReturnTo(raw) ? raw : null;
  }, [searchParams]);
  // Login ouvert par défaut quand on est en retour de SSO BitLab —
  // l'utilisateur a probablement déjà un compte (si direct access).
  const [registerPseudo, setRegisterPseudo] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [tab, setTab] = useState(returnTo ? "login" : "register");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const succeed = (user: PublicUser, token: string) => {
    setSession(user.id, token);
    // Si on arrive avec un returnTo valide (retour SSO BitLab),
    // on relance le flow SSO : BitQuest détectera son cookie de session
    // fraîchement posé et redirigera vers BitLab avec un launch_token.
    // On skip le toast (moins pertinent, l'utilisateur va quitter la page).
    if (returnTo && typeof window !== "undefined") {
      window.location.replace(buildBitlabSsoRedirectUrl(returnTo));
      return;
    }
    toast({
      title: `Bienvenue dans BitQuest, ${user.pseudo} !`,
      description: user.isGuest
        ? "Mode invité activé — ta progression est conservée sur cet appareil."
        : "Ton aventure Bitcoin commence maintenant : apprends, pratique, gagne.",
    });
  };

  const returnToHost = useMemo(() => {
    if (!returnTo) return null;
    try {
      return new URL(returnTo).host;
    } catch {
      return null;
    }
  }, [returnTo]);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const pseudo = registerPseudo.trim();
    if (pseudo.length < 3 || pseudo.length > 20) {
      setError("Choisis un pseudo de 3 à 20 caractères.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(registerEmail.trim())) {
      setError("Entre une adresse e-mail valide.");
      return;
    }
    if (registerPassword.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth({
        action: "register",
        pseudo,
        email: registerEmail.trim(),
        password: registerPassword,
      });
      succeed(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!loginEmail.trim() || !loginPassword) {
      setError("Renseigne ton e-mail et ton mot de passe.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.auth({
        action: "login",
        email: loginEmail.trim(),
        password: loginPassword,
      });
      succeed(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.auth({ action: "guest" });
      succeed(res.user, res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessaie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Champ d'étoiles + nébuleuse orange (mode Nuit Web3) */}
      <div aria-hidden className="starfield" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(247,147,26,0.10),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(232,114,12,0.06),transparent_45%)]"
      />

      {/* ===== Switch de langue ===== */}
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitch />
      </div>

      {/* ===== Bandeau retour SSO BitLab ===== */}
      {returnTo && (
        <div
          role="status"
          aria-live="polite"
          className="relative z-10 mx-auto mt-4 flex w-full max-w-lg items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground backdrop-blur"
        >
          <FlaskConical className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">{t("auth.returnTo.banner")}</strong>
            {returnToHost && (
              <span className="text-muted-foreground">
                {" · "}
                {returnToHost}
              </span>
            )}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        </div>
      )}

      {/* ===== Contenu principal ===== */}
      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-8 px-4 py-10">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-5 text-center"
        >
          <div className="relative" aria-hidden>
            {/* Anneaux décoratifs — l'orbite qui met la communauté en mouvement */}
            <div className="absolute -inset-4 rounded-full border border-primary/20" />
            <div className="absolute -inset-8 rounded-full border border-dashed border-primary/10" />
            <OrbiteMark className="h-20 w-20 text-foreground drop-shadow-[0_0_24px_rgba(247,147,26,0.35)]" />
          </div>
          <div className="space-y-2.5">
            <BitQuestWordmark className="text-4xl sm:text-5xl" />
            <p className="font-display text-base font-semibold tracking-widest text-primary sm:text-lg">
              Apprends. Pratique. Gagne.
            </p>
            <p className="max-w-md text-balance text-sm text-muted-foreground sm:text-base">
              La quête éducative pour maîtriser Bitcoin et le Lightning Network — open-source, de
              l&apos;Afrique vers le monde.
            </p>
          </div>
          <ul
            className="flex flex-wrap items-center justify-center gap-2"
            aria-label="Fonctionnalités de BitQuest"
          >
            {FEATURES.map((f) => (
              <li
                key={f.keyword}
                className="flex items-center gap-1.5 rounded-full border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur"
              >
                <f.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                <span className="font-semibold text-foreground">{f.keyword}</span>
                <span aria-hidden>·</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </motion.header>

        {/* Carte d&apos;authentification */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full"
        >
          <Card className="rounded-xl shadow-lg">
            <CardHeader>
              <CardTitle className="font-display tracking-wide">Rejoins l&apos;orbite</CardTitle>
              <CardDescription>Crée ton compte, connecte-toi ou explore en mode invité.</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={tab}
                onValueChange={(v) => {
                  setTab(v);
                  setError(null);
                }}
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="register">{t("auth.tab.register")}</TabsTrigger>
                  <TabsTrigger value="login">{t("auth.tab.login")}</TabsTrigger>
                  <TabsTrigger value="guest">{t("auth.tab.guest")}</TabsTrigger>
                </TabsList>

                {/* --- Inscription --- */}
                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="mt-2 space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="register-pseudo">Pseudo</Label>
                      <Input
                        id="register-pseudo"
                        name="pseudo"
                        autoComplete="username"
                        placeholder="satHunter"
                        minLength={3}
                        maxLength={20}
                        required
                        className="h-11"
                        value={registerPseudo}
                        onChange={(e) => setRegisterPseudo(e.target.value)}
                        disabled={loading}
                        aria-describedby="register-pseudo-hint"
                      />
                      <p id="register-pseudo-hint" className="text-xs text-muted-foreground">
                        De 3 à 20 caractères — c&apos;est ton nom d&apos;aventurier.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">E-mail</Label>
                      <Input
                        id="register-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@exemple.com"
                        required
                        className="h-11"
                        value={registerEmail}
                        onChange={(e) => setRegisterEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">Mot de passe</Label>
                      <Input
                        id="register-password"
                        name="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Au moins 6 caractères"
                        minLength={6}
                        required
                        className="h-11"
                        value={registerPassword}
                        onChange={(e) => setRegisterPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <UserPlus className="h-4 w-4" aria-hidden />
                      )}
                      {t("auth.submit.register")}
                    </Button>
                  </form>
                </TabsContent>

                {/* --- Connexion --- */}
                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="mt-2 space-y-4" noValidate>
                    <div className="space-y-2">
                      <Label htmlFor="login-email">E-mail</Label>
                      <Input
                        id="login-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="tu@exemple.com"
                        required
                        className="h-11"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">Mot de passe</Label>
                      <Input
                        id="login-password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Ton mot de passe"
                        required
                        className="h-11"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <Button type="submit" size="lg" className="h-11 w-full" disabled={loading}>
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <LogIn className="h-4 w-4" aria-hidden />
                      )}
                      {t("auth.submit.login")}
                    </Button>
                  </form>
                </TabsContent>

                {/* --- Invité --- */}
                <TabsContent value="guest">
                  <div className="mt-2 space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Explore BitQuest sans compte : ta progression est conservée sur cet appareil. Le mode
                      invité est limité (pas de synchronisation entre appareils), mais il donne accès à
                      l&apos;ensemble des quêtes, badges et récompenses pédagogiques.
                    </p>
                    {error && (
                      <p role="alert" className="text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="h-11 w-full"
                      onClick={handleGuest}
                      disabled={loading}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                      {t("auth.submit.guest")}
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </main>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 pb-6 text-center text-xs text-muted-foreground">
        BitQuest · open-source — de l&apos;Afrique vers le monde · Sandbox Testnet
      </footer>
    </div>
  );
}
