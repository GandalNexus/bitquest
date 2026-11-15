/**
 * Tests du wrapper Sentry — LOT 31.
 * On teste uniquement le no-op quand SENTRY_DSN est absent, car on ne
 * veut pas instrumenter Sentry en dev/test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMock = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: (scope: { setTag: ReturnType<typeof vi.fn> }) => void) => {
    const scope = { setTag: vi.fn() };
    cb(scope);
  }),
}));
vi.mock("@sentry/nextjs", () => sentryMock);

let originalDsn: string | undefined;
let originalPubDsn: string | undefined;

beforeEach(() => {
  originalDsn = process.env.SENTRY_DSN;
  originalPubDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  delete process.env.SENTRY_DSN;
  delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  sentryMock.captureException.mockReset();
  sentryMock.captureMessage.mockReset();
  sentryMock.withScope.mockClear();
});

afterEach(() => {
  if (originalDsn === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = originalDsn;
  if (originalPubDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
  else process.env.NEXT_PUBLIC_SENTRY_DSN = originalPubDsn;
  vi.resetModules();
});

describe("captureBusinessWarning", () => {
  it("no-op si SENTRY_DSN absent (dev/CI)", async () => {
    // `sentryEnabled` est figé à l'import — on importe DANS le test
    // pour que le state env soit celui de beforeEach.
    const { captureBusinessWarning } = await import("./sentry");
    captureBusinessWarning("test", { scope: "x" }, { k: "v" });
    expect(sentryMock.withScope).not.toHaveBeenCalled();
    expect(sentryMock.captureMessage).not.toHaveBeenCalled();
  });

  it("appelle Sentry avec tags + level=warning si DSN présent", async () => {
    process.env.SENTRY_DSN = "https://dev@example.com/1";
    vi.resetModules();
    const { captureBusinessWarning } = await import("./sentry");
    captureBusinessWarning("ln failure", { scope: "ln", outcome: "KO" }, { amountMsat: 100 });
    expect(sentryMock.withScope).toHaveBeenCalledOnce();
    expect(sentryMock.captureMessage).toHaveBeenCalledOnce();
    const call = sentryMock.captureMessage.mock.calls[0];
    expect(call[0]).toBe("ln failure");
    expect(call[1]).toEqual({ level: "warning", extra: { amountMsat: 100 } });
  });

  it("silence une erreur interne Sentry (ne jette jamais)", async () => {
    process.env.SENTRY_DSN = "https://dev@example.com/1";
    vi.resetModules();
    sentryMock.withScope.mockImplementationOnce(() => {
      throw new Error("sentry down");
    });
    const { captureBusinessWarning } = await import("./sentry");
    expect(() =>
      captureBusinessWarning("boom", { scope: "x" }, {}),
    ).not.toThrow();
  });
});
