/**
 * Tests pour `requireRoleSsr` et `getCurrentUser`.
 *
 * On mocke `next/headers.cookies()` et `src/lib/db` pour piloter la session
 * et la base sans démarrer de serveur.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const findUniqueMock = vi.fn();
const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => cookiesMock(),
}));

vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

// Imports post-mock
import { getCurrentUser, requireRoleSsr } from "./server";

function stubCookies(sessionToken: string | null) {
  cookiesMock.mockResolvedValueOnce({
    get: (name: string) =>
      name === "bq_session" && sessionToken !== null ? { value: sessionToken } : undefined,
  });
}

beforeEach(() => {
  findUniqueMock.mockReset();
  cookiesMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentUser", () => {
  it("retourne null si pas de cookie bq_session", async () => {
    stubCookies(null);
    const user = await getCurrentUser();
    expect(user).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("retourne l'utilisateur quand le cookie est valide", async () => {
    stubCookies("tok-abc");
    const fakeUser = { id: "u1", pseudo: "alice", role: "ADMIN", token: "tok-abc" };
    findUniqueMock.mockResolvedValueOnce(fakeUser);
    const user = await getCurrentUser();
    expect(user).toEqual(fakeUser);
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { token: "tok-abc" } });
  });

  it("retourne null si le token ne correspond à aucun utilisateur", async () => {
    stubCookies("bad");
    findUniqueMock.mockResolvedValueOnce(null);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });
});

describe("requireRoleSsr", () => {
  it("retourne unauthenticated si pas de session", async () => {
    stubCookies(null);
    const r = await requireRoleSsr("ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unauthenticated");
  });

  it("retourne forbidden si role insuffisant (APPRENTICE accède à ADMIN)", async () => {
    stubCookies("tok");
    findUniqueMock.mockResolvedValueOnce({ id: "u", pseudo: "p", role: "APPRENTICE", token: "tok" });
    const r = await requireRoleSsr("ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("forbidden");
      expect(r.user?.role).toBe("APPRENTICE");
    }
  });

  it("retourne forbidden si role insuffisant (EDITOR accède à ADMIN)", async () => {
    stubCookies("tok");
    findUniqueMock.mockResolvedValueOnce({ id: "u", pseudo: "p", role: "EDITOR", token: "tok" });
    const r = await requireRoleSsr("ADMIN");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("forbidden");
  });

  it("retourne ok si ADMIN demande ADMIN", async () => {
    stubCookies("tok");
    const u = { id: "u", pseudo: "a", role: "ADMIN", token: "tok" };
    findUniqueMock.mockResolvedValueOnce(u);
    const r = await requireRoleSsr("ADMIN");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.user.role).toBe("ADMIN");
  });

  it("retourne ok si ADMIN demande EDITOR (hiérarchie)", async () => {
    stubCookies("tok");
    const u = { id: "u", pseudo: "a", role: "ADMIN", token: "tok" };
    findUniqueMock.mockResolvedValueOnce(u);
    const r = await requireRoleSsr("EDITOR");
    expect(r.ok).toBe(true);
  });

  it("retourne ok si EDITOR demande APPRENTICE (hiérarchie)", async () => {
    stubCookies("tok");
    const u = { id: "u", pseudo: "a", role: "EDITOR", token: "tok" };
    findUniqueMock.mockResolvedValueOnce(u);
    const r = await requireRoleSsr("APPRENTICE");
    expect(r.ok).toBe(true);
  });
});
