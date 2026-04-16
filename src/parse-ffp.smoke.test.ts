import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { bufferToArrayBuffer } from "./buffer";
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
});
