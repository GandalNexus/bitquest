/* Contrats d'API client BitQuest — partagés entre toutes les vues */

export interface LevelInfo {
  level: number;
  title: string;
  into: number;
  needed: number;
  next: number | null;
  pct: number;
}

export type Role = "APPRENTICE" | "EDITOR" | "ADMIN";

export interface PublicUser {
  id: string;
  pseudo: string;
  email: string | null;
  isGuest: boolean;
  xp: number;
  sats: number;
  satsEarnedTotal: number;
  streak: number;
  lastActiveDate: string | null;
  createdAt: string;
  role: Role;
  levelInfo: LevelInfo;
}

export interface BadgeInfo {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
  earnedAt?: string;
}

export interface MeEvent {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface MeResponse {
  user: PublicUser;
  badges: BadgeInfo[];
  events: MeEvent[];
  questsCompleted: { code: string; title: string; track: string; completedAt: string | null }[];
  allBadges: BadgeInfo[];
}

export interface QuestState {
  id: string;
  code: string;
  track: string;
  order: number;
  title: string;
  subtitle: string;
  description: string;
  requiredLevel: number;
  xpReward: number;
  satsReward: number;
  missionType: string;
  totalSections: number;
  totalQuiz: number;
  status: string;
  sectionsRead: number;
  quizBestScore: number;
  perfectQuiz: boolean;
  completedAt: string | null;
  locked: boolean;
  lockReason: string | null;
}

export interface TheorySection {
  title: string;
  body: string;
  keypoints: string[];
}

export interface QuestDetail {
  quest: {
    code: string;
    track: string;
    order: number;
    title: string;
    subtitle: string;
    description: string;
    intro: string;
    theorySections: TheorySection[];
    xpReward: number;
    satsReward: number;
    requiredLevel: number;
    missionType: string;
  };
  quiz: { id: string; type: "MCQ" | "TRUE_FALSE"; question: string; options: string[] }[];
  progress: {
    status: string;
    sectionsRead: number;
    quizBestScore: number;
    quizAttempts: number;
    missionAttempts: number;
    missionProof: Record<string, unknown> | null;
    completedAt: string | null;
  } | null;
  missionMeta: { brief: string | null; hint: string | null };
}

export interface MissionStartResponse {
  challenge: Record<string, unknown>;
  missionType: string;
  attemptsLeft: number;
  progress: unknown;
}

export interface QuizResult {
  index: number;
  isCorrect: boolean;
  correctIndex: number | null;
  correctBool: boolean | null;
  explanation: string;
}

export interface BadgeNotification {
  code: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

export interface QuizSubmitResponse {
  score: number;
  passed: boolean;
  perfect: boolean;
  alreadyPassed: boolean;
  results: QuizResult[];
  progress: QuestDetail["progress"];
  xp: { xpGained: number; leveledUp: boolean; newLevel: number; levelInfo: LevelInfo } | null;
  user: PublicUser;
  badges: BadgeNotification[];
}

export interface MissionSubmitResponse {
  success: boolean;
  feedback: string;
  proof?: Record<string, unknown>;
  attemptsLeft?: number;
  progress?: unknown;
  xp?: { xpGained: number; leveledUp: boolean; newLevel: number; levelInfo: LevelInfo } | null;
  bonusXp?: { xpGained: number; leveledUp: boolean; newLevel: number; levelInfo: LevelInfo } | null;
  sats?: {
    granted: number;
    fullReward: number;
    streakBonusPct: number;
    capped: boolean;
    streakBonus: number;
  } | null;
  user?: PublicUser;
  badges?: BadgeNotification[];
}

export interface ReadSectionResponse {
  progress: unknown;
  xp: { xpGained: number; leveledUp: boolean; newLevel: number; levelInfo: LevelInfo } | null;
  user: PublicUser;
}

export interface WalletResponse {
  balance: number;
  totalEarned: number;
  dailyUsed: number;
  dailyCap: number;
  transactions: {
    id: string;
    amount: number;
    type: string;
    description: string;
    createdAt: string;
  }[];
}

export interface AcademyCourseSummaryDTO {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  order: number;
  totalLessons: number;
  totalChapters: number;
  completedLessons: number;
  pct: number;
}

export interface AcademyLessonNodeDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  estimatedMinutes: number;
  order: number;
  completed: boolean;
}

export interface AcademyChapterNodeDTO {
  id: string;
  slug: string;
  title: string;
  summary: string;
  order: number;
  lessons: AcademyLessonNodeDTO[];
}

export interface AcademyCourseTreeDTO {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  coverIcon: string;
  totalLessons: number;
  completedLessons: number;
  pct: number;
  chapters: AcademyChapterNodeDTO[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  pseudo: string;
  isGuest: boolean;
  isBot: boolean;
  xp: number;
  sats: number;
  streak: number;
  badges: number;
  levelInfo: LevelInfo;
  isMe: boolean;
}

export type ProgressAction =
  | { action: "start" }
  | { action: "read_section"; sectionIndex: number }
  | { action: "quiz_submit"; answers: (number | boolean)[] }
  | { action: "mission_start" }
  | { action: "mission_submit"; answer: Record<string, unknown> };

/* ============ Client HTTP ============ */

const SESSION_KEY = "bitquest_session";
const CSRF_COOKIE = "bq_csrf";

export function loadStoredSession(): { userId: string; token: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.userId && parsed?.token) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function storeSession(userId: string, token: string) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, token }));
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

/** Lit la valeur d'un cookie côté document (readable seulement). */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const target = `${name}=`;
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(target)) {
      return decodeURIComponent(trimmed.slice(target.length));
    }
  }
  return null;
}

async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const session = loadStoredSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  // Back-compat : envoie les headers legacy tant que la session localStorage existe.
  if (session) {
    headers["x-gn-user-id"] = session.userId;
    headers["x-gn-token"] = session.token;
  }
  // CSRF sur les mutations (si cookie disponible — sinon le serveur fera confiance aux headers legacy).
  const method = init?.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  const res = await fetch(path, {
    method,
    headers,
    credentials: "include", // envoie bq_session (HttpOnly) et bq_csrf (readable)
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Erreur réseau");
  }
  return data as T;
}

export const api = {
  auth: (body: { action: "register" | "login" | "guest" } & Record<string, unknown>) =>
    request<{ user: PublicUser; token: string }>("/api/auth", { method: "POST", body }),
  me: () => request<MeResponse>("/api/me"),
  quests: () => request<{ quests: QuestState[] }>("/api/quests"),
  quest: (code: string) => request<QuestDetail>(`/api/quests/${code}`),
  progress: (code: string, body: ProgressAction) =>
    request<Record<string, unknown>>(`/api/quests/${code}/progress`, { method: "POST", body }),
  quizSubmit: (code: string, answers: (number | boolean)[]) =>
    request<QuizSubmitResponse>(`/api/quests/${code}/progress`, {
      method: "POST",
      body: { action: "quiz_submit", answers },
    }),
  missionStart: (code: string) =>
    request<MissionStartResponse>(`/api/quests/${code}/progress`, {
      method: "POST",
      body: { action: "mission_start" },
    }),
  missionSubmit: (code: string, answer: Record<string, unknown>) =>
    request<MissionSubmitResponse>(`/api/quests/${code}/progress`, {
      method: "POST",
      body: { action: "mission_submit", answer },
    }),
  readSection: (code: string, sectionIndex: number) =>
    request<ReadSectionResponse>(`/api/quests/${code}/progress`, {
      method: "POST",
      body: { action: "read_section", sectionIndex },
    }),
  startQuest: (code: string) =>
    request<Record<string, unknown>>(`/api/quests/${code}/progress`, {
      method: "POST",
      body: { action: "start" },
    }),
  wallet: () => request<WalletResponse>("/api/wallet"),
  leaderboard: () => request<{ entries: LeaderboardEntry[] }>("/api/leaderboard"),
  academyCourses: () => request<{ courses: AcademyCourseSummaryDTO[] }>("/api/academy/courses"),
  academyCourse: (slug: string) =>
    request<{ course: AcademyCourseTreeDTO }>(`/api/academy/courses/${slug}`),
  completeLesson: (lessonId: string) =>
    request<{ alreadyCompleted: boolean; completedAt: string }>(
      `/api/academy/lessons/${lessonId}/complete`,
      { method: "POST", body: {} },
    ),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST", body: {} }),
  todayChallenge: () =>
    request<{
      challenge: {
        id: string;
        date: string;
        title: string;
        prompt: string;
        xpReward: number;
        satsReward: number;
        completed: boolean;
        completedAt: string | null;
      } | null;
    }>("/api/challenges/today"),
  completeChallenge: () =>
    request<{
      ok: true;
      alreadyCompleted: boolean;
      xpGained: number;
      satsGranted: number;
      satsCapped: boolean;
    }>("/api/challenges/complete", { method: "POST", body: {} }),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    request<{ ok: true; token: string }>("/api/me/password", { method: "POST", body }),
  deleteAccount: (body: { confirmation: "DELETE"; currentPassword?: string }) =>
    request<{ ok: true }>("/api/me/delete", { method: "POST", body }),
};

/* ============ Formats ============ */

export function formatSats(n: number): string {
  return n.toLocaleString("fr-FR");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export const TRACK_LABELS: Record<string, string> = {
  INITIATION: "Initiation",
  INTERMEDIATE: "Intermédiaire",
  ADVANCED: "Avancé",
  SPECIAL: "Événement",
};
