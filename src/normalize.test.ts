import { describe, expect, test } from "bun:test";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import yaml from "js-yaml";
import { sanitizeForSerialization, writeOutput } from "./normalize";

describe("sanitizeForSerialization", () => {
  test("converts bigint to number", () => {
    expect(sanitizeForSerialization(10n)).toBe(10);
  });

  test("converts Date to ISO string", () => {
    const d = new Date("2024-01-15T12:00:00.000Z");
    expect(sanitizeForSerialization(d)).toBe("2024-01-15T12:00:00.000Z");
  });

  test("leaves null, undefined, and plain primitives", () => {
    expect(sanitizeForSerialization(null)).toBeNull();
    expect(sanitizeForSerialization(undefined)).toBeUndefined();
    expect(sanitizeForSerialization("x")).toBe("x");
    expect(sanitizeForSerialization(3.14)).toBe(3.14);
    expect(sanitizeForSerialization(true)).toBe(true);
  });

  test("walks nested objects and arrays", () => {
    const input = {
      n: 1n,
      when: new Date("2020-06-01T00:00:00.000Z"),
      nested: { x: 2n, items: [3n, { d: new Date("2021-01-01T00:00:00.000Z") }] },
    };
    expect(sanitizeForSerialization(input)).toEqual({
      n: 1,
      when: "2020-06-01T00:00:00.000Z",
      nested: {
        x: 2,
        items: [3, { d: "2021-01-01T00:00:00.000Z" }],
      },
    });
  });

  test("empty object and array", () => {
    expect(sanitizeForSerialization({})).toEqual({});
    expect(sanitizeForSerialization([])).toEqual([]);
  });
});

describe("writeOutput", () => {
  test("writes valid JSON", async () => {
    const dir = join(process.cwd(), `_norm_test_${Date.now()}`);
    const path = join(dir, "out.json");
    try {
      await writeOutput(path, { a: 1n, t: new Date("2024-03-01T00:00:00.000Z") }, "json");
      const text = await readFile(path, "utf-8");
      expect(JSON.parse(text)).toEqual({ a: 1, t: "2024-03-01T00:00:00.000Z" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("default format is json", async () => {
    const dir = join(process.cwd(), `_norm_test_default_${Date.now()}`);
    const path = join(dir, "out.json");
    try {
      await writeOutput(path, { ok: true });
      const text = await readFile(path, "utf-8");
      expect(JSON.parse(text)).toEqual({ ok: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("writes valid YAML that round-trips", async () => {
    const dir = join(process.cwd(), `_norm_test_yaml_${Date.now()}`);
    const path = join(dir, "out.yaml");
    const payload = {
      meta: { id: 1n },
      when: new Date("2024-05-10T08:00:00.000Z"),
      rows: [{ v: 2n }],
    };
    try {
      await writeOutput(path, payload, "yaml");
      const text = await readFile(path, "utf-8");
      const parsed = yaml.load(text) as Record<string, unknown>;
      expect(parsed).toEqual({
        meta: { id: 1 },
        when: "2024-05-10T08:00:00.000Z",
        rows: [{ v: 2 }],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
