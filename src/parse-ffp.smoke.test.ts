import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { bufferToArrayBuffer } from "./buffer";
import { normalizeFFP, parseFitBuffer } from "./parse-ffp";

describe("parseFitBuffer + normalizeFFP (smoke)", () => {
  test("parses sample FIT and produces normalized data", async () => {
    const nodeBuf = await readFile("sample-fits/build-26.fit");
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
  });
});

