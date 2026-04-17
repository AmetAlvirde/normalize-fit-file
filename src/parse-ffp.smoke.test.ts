import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { bufferToArrayBuffer } from "./buffer";
import { sanitizeForSerialization, writeOutput } from "./normalize";
import { normalizeFFP, parseFitBuffer } from "./parse-ffp";

/** Set to a local `.fit` path to run this test (keep under gitignored dirs such as `sample-fits/`). */
const fixturePath = process.env.FIT_SMOKE_FIXTURE?.trim() ?? "";
const hasSmokeFixture = Boolean(fixturePath && existsSync(fixturePath));

describe("parseFitBuffer + normalizeFFP (smoke)", () => {
  test.skipIf(!hasSmokeFixture)(
    "parses FIT fixture and produces normalized data",
    async () => {
      const nodeBuf = await readFile(fixturePath);
      const raw = await parseFitBuffer(bufferToArrayBuffer(nodeBuf));
      const norm = normalizeFFP(raw);

      expect(norm).toBeTruthy();
      expect(norm).toHaveProperty("metadata");
      expect(norm).toHaveProperty("deviceInfo");
      expect(norm).toHaveProperty("session");
      expect(norm).toHaveProperty("laps");
      expect(norm).toHaveProperty("records");

      expect(Array.isArray(norm.deviceInfo)).toBe(true);
      expect(Array.isArray(norm.laps)).toBe(true);
      expect(Array.isArray(norm.records)).toBe(true);
      expect(norm.records.length).toBeGreaterThan(0);

      expect(norm.metadata).toBeTruthy();
      expect((norm.metadata as { timestamp?: unknown }).timestamp).not.toBeNull();
      expect((norm.metadata as { timestamp?: unknown }).timestamp).not.toBeUndefined();
    }
  );

  test.skipIf(!hasSmokeFixture)(
    "writes normalized fixture as YAML and parses back to the same structure",
    async () => {
      const nodeBuf = await readFile(fixturePath);
      const raw = await parseFitBuffer(bufferToArrayBuffer(nodeBuf));
      const norm = normalizeFFP(raw);

      const dir = await mkdtemp(join(tmpdir(), "fit-yaml-smoke-"));
      const yamlPath = join(dir, "normalized.yaml");
      try {
        await writeOutput(yamlPath, norm, "yaml");
        const text = await readFile(yamlPath, "utf-8");
        const parsed = yaml.load(text);
        expect(parsed).toEqual(sanitizeForSerialization(norm));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    }
  );
});
