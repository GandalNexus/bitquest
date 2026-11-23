import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Manifest = {
  name: string;
  short_name: string;
  start_url: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  shortcuts?: Array<{ name: string; url: string }>;
};

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
) as Manifest;

describe("public/manifest.webmanifest — LOT 80", () => {
  it("expose name et short_name", () => {
    expect(manifest.name).toMatch(/BitQuest/);
    expect(manifest.short_name).toBe("BitQuest");
  });

  it("start_url et display standalone (installable)", () => {
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("theme_color orange Bitcoin, background sombre", () => {
    expect(manifest.theme_color).toBe("#F7931A");
    expect(manifest.background_color).toBe("#0b0b14");
  });

  it("au moins une icône référencée", () => {
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons[0]!.src).toMatch(/^\//);
  });

  it("raccourcis vers dashboard/academy/verify", () => {
    const urls = (manifest.shortcuts ?? []).map((s) => s.url);
    expect(urls).toEqual(expect.arrayContaining(["/dashboard", "/academy", "/verify"]));
  });
});
