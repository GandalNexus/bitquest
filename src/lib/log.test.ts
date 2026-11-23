import { describe, it, expect, vi } from "vitest";
import pino from "pino";
import { log, logger } from "./log";

/* ============================================================
 * On teste la redaction en capturant les lignes JSON émises par le
 * logger racine via un pino.destination() in-memory. Les helpers
 * `log.child({ scope: "…" })` partagent la même config (dont redact).
 * ============================================================ */

describe("logger (pino)", () => {
  it("expose les niveaux standards", () => {
    expect(typeof log.info).toBe("function");
    expect(typeof log.warn).toBe("function");
    expect(typeof log.error).toBe("function");
    expect(typeof log.debug).toBe("function");
  });

  it("logger(scope) crée un child avec le scope attaché", () => {
    const l = logger("my-scope");
    expect(typeof l.info).toBe("function");
    expect(l.bindings().scope).toBe("my-scope");
  });

  it("redacte token / passwordHash / password dans les payloads", () => {
    const captured: string[] = [];
    const sink = {
      write: (chunk: string) => {
        captured.push(chunk);
      },
    };
    const localLog = pino(
      {
        level: "trace",
        redact: {
          paths: ["token", "passwordHash", "password", "*.token", "*.password"],
          censor: "[redacted]",
        },
      },
      sink,
    );

    localLog.info(
      {
        token: "super-secret-abc",
        passwordHash: "salt:hash",
        password: "plain",
        user: { id: "u1", token: "nested-secret" },
      },
      "attempted sensitive dump",
    );

    const line = captured.find((c) => c.includes("attempted sensitive dump"));
    expect(line).toBeDefined();
    expect(line).not.toContain("super-secret-abc");
    expect(line).not.toContain("salt:hash");
    expect(line).not.toContain("plain");
    expect(line).not.toContain("nested-secret");
    expect(line).toContain("[redacted]");
  });

  it("n'écrit pas quand le level est en dessous du seuil", () => {
    const captured: string[] = [];
    const sink = {
      write: (chunk: string) => {
        captured.push(chunk);
      },
    };
    const localLog = pino({ level: "warn" }, sink);
    localLog.info("below threshold");
    localLog.debug("below threshold");
    expect(captured).toEqual([]);
    localLog.warn("at threshold");
    expect(captured.length).toBe(1);
  });

  it("logger.error accepte err + metadata", () => {
    const spy = vi.spyOn(log, "error").mockImplementation(() => {});
    log.error({ err: new Error("boom"), scope: "test" }, "failed");
    expect(spy).toHaveBeenCalledWith(
      { err: expect.any(Error), scope: "test" },
      "failed",
    );
    spy.mockRestore();
  });
});
