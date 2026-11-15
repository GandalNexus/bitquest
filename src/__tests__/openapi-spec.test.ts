import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

const SPEC_PATH = resolve(process.cwd(), "public/openapi.yaml");

type OpenApiDoc = {
  openapi: string;
  info: { title: string; version: string; license: { name: string } };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown> };
};

const doc = yaml.load(readFileSync(SPEC_PATH, "utf8")) as OpenApiDoc;

describe("public/openapi.yaml — LOT 79", () => {
  it("est OpenAPI 3.1+", () => {
    expect(doc.openapi.startsWith("3.1")).toBe(true);
  });

  it("déclare le titre et la licence AGPL", () => {
    expect(doc.info.title).toMatch(/BitQuest/);
    expect(doc.info.license.name).toBe("AGPL-3.0-only");
  });

  it.each([
    "/api/certificates/verify",
    "/api/version",
    "/.well-known/nostr.json",
    "/api/health",
  ])("documente la route publique %s", (path) => {
    expect(doc.paths[path]).toBeDefined();
    expect(doc.paths[path]!.get).toBeDefined();
  });

  it("expose les schémas de réponse principaux", () => {
    const schemas = Object.keys(doc.components.schemas);
    for (const name of [
      "CertificatePayload",
      "VerifyOkResponse",
      "VerifyErrorResponse",
      "VersionResponse",
      "NostrInfoResponse",
      "HealthReport",
    ]) {
      expect(schemas).toContain(name);
    }
  });
});
