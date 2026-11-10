import { describe, it, expect } from "vitest";
import {
  SESSION_COOKIE,
  buildClearSessionCookie,
  buildSessionCookie,
  parseCookieHeader,
} from "./session";

describe("parseCookieHeader", () => {
  it("retourne {} pour header vide / null / undefined", () => {
    expect(parseCookieHeader(null)).toEqual({});
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader("")).toEqual({});
  });

  it("parse un cookie unique", () => {
    expect(parseCookieHeader("bq_session=abc")).toEqual({ bq_session: "abc" });
  });

  it("parse plusieurs cookies séparés par ;", () => {
    expect(parseCookieHeader("a=1; b=2; c=3")).toEqual({ a: "1", b: "2", c: "3" });
  });

  it("gère les espaces autour du nom et de la valeur", () => {
    expect(parseCookieHeader(" bq_session = tok ; x = y ")).toEqual({
      bq_session: "tok",
      x: "y",
    });
  });

  it("decode l'URL-encoding des valeurs", () => {
    expect(parseCookieHeader("t=hello%20world")).toEqual({ t: "hello world" });
  });

  it("ignore les segments sans =", () => {
    expect(parseCookieHeader("abc; d=e")).toEqual({ d: "e" });
  });

  it("supporte un = dans la valeur (base64 par ex.)", () => {
    expect(parseCookieHeader("t=abc==")).toEqual({ t: "abc==" });
  });
});

describe("buildSessionCookie", () => {
  it("contient le nom du cookie, le token encodé, HttpOnly, Path, SameSite", () => {
    const c = buildSessionCookie("mytoken123");
    expect(c).toContain(`${SESSION_COOKIE}=mytoken123`);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Path=/");
    expect(c).toContain("SameSite=Lax");
  });

  it("encode les caractères spéciaux du token", () => {
    const c = buildSessionCookie("a b");
    expect(c).toContain(`${SESSION_COOKIE}=a%20b`);
  });

  it("ajoute Max-Age si fourni", () => {
    const c = buildSessionCookie("t", { maxAgeSeconds: 3600 });
    expect(c).toContain("Max-Age=3600");
  });

  it("n'ajoute PAS Secure quand on force secure:false", () => {
    const c = buildSessionCookie("t", { secure: false });
    expect(c).not.toContain("Secure");
  });

  it("ajoute Secure quand on force secure:true", () => {
    const c = buildSessionCookie("t", { secure: true });
    expect(c).toContain("Secure");
  });
});

describe("buildClearSessionCookie", () => {
  it("fixe la valeur à vide + Max-Age=0", () => {
    const c = buildClearSessionCookie({ secure: false });
    expect(c).toContain(`${SESSION_COOKIE}=`);
    expect(c).toContain("Max-Age=0");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Path=/");
  });
});
