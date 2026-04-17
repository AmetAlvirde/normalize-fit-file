import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import type { NormalizedFitData } from "../normalize";
import { runCompareCli } from "./compare";

function minimalFixture(overrides: {
  session?: Record<string, unknown>;
  records?: Record<string, unknown>[];
}): NormalizedFitData {
  return {
    metadata: { sport: "running" },
    deviceInfo: [],
    session: { ...overrides.session },
    laps: [
      {
        lapIndex: 0,
        timestamp: "2020-01-01T00:00:00.000Z",
      },
    ],
    records: overrides.records ?? [],
  };
}

describe("runCompareCli", () => {
  const origCwd = process.cwd();
  const origExit = process.exit;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "compare-cli-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(origCwd);
    process.exit = origExit;
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("writes JSON report with dynamic labels and detects differences", async () => {
    const aPath = join(tmpDir, "race-a.json");
    const bPath = join(tmpDir, "race-b.json");
    const fixtureA = minimalFixture({
      session: { avgHeartRate: 145 },
      records: [
        {
          timestamp: "2020-01-01T00:00:00.000Z",
          heartRate: 120,
          cadence: 90,
        },
        {
          timestamp: "2020-01-01T00:00:01.000Z",
          heartRate: 121,
          cadence: 91,
        },
      ],
    });
    const fixtureB = minimalFixture({
      session: { avgHeartRate: 148 },
      records: [
        {
          timestamp: "2020-01-01T00:00:00.000Z",
          heartRate: 120,
          power: 200,
        },
        {
          timestamp: "2020-01-01T00:00:01.000Z",
          heartRate: 125,
          power: 205,
        },
      ],
    });
    writeFileSync(aPath, JSON.stringify(fixtureA), "utf-8");
    writeFileSync(bPath, JSON.stringify(fixtureB), "utf-8");

    await runCompareCli([aPath, bPath]);

    const reportPath = join(tmpDir, "comparison-report.json");
    const raw = readFileSync(reportPath, "utf-8");
    const report = JSON.parse(raw) as Record<string, unknown>;

    expect(report.sources).toEqual({
      "race-a": aPath,
      "race-b": bPath,
    });

    const fc = report.fieldCoverage as Record<string, Record<string, unknown>>;
    expect(fc.metadata["race-aOnly"]).toEqual([]);
    expect(fc.metadata["race-bOnly"]).toEqual([]);
    expect(fc.session["race-aOnly"]).toEqual([]);
    expect(fc.session["race-bOnly"]).toEqual([]);
    expect(fc.records["race-aOnly"]).toEqual(["cadence"]);
    expect(fc.records["race-bOnly"]).toEqual(["power"]);

    const sessM = (
      (report.valueAgreement as Record<string, unknown>).session as Record<string, unknown>
    ).mismatches as { key: string; reason: string; "race-a": unknown; "race-b": unknown }[];
    const hr = sessM.find((m) => m.key === "avgHeartRate");
    expect(hr).toBeDefined();
    expect(hr!["race-a"]).toBe(145);
    expect(hr!["race-b"]).toBe(148);
  });

  test("reads YAML inputs and writes report", async () => {
    const aPath = join(tmpDir, "run-a.yaml");
    const bPath = join(tmpDir, "run-b.yaml");
    const fixtureA = minimalFixture({
      session: { avgHeartRate: 145 },
      records: [
        { timestamp: "2020-01-01T00:00:00.000Z", heartRate: 120 },
      ],
    });
    const fixtureB = minimalFixture({
      session: { avgHeartRate: 148 },
      records: [
        { timestamp: "2020-01-01T00:00:00.000Z", heartRate: 120 },
      ],
    });
    writeFileSync(aPath, yaml.dump(fixtureA), "utf-8");
    writeFileSync(bPath, yaml.dump(fixtureB), "utf-8");

    await runCompareCli([aPath, bPath]);

    const reportPath = join(tmpDir, "comparison-report.json");
    const report = JSON.parse(readFileSync(reportPath, "utf-8")) as Record<string, unknown>;
    expect(report.sources).toEqual({
      "run-a": aPath,
      "run-b": bPath,
    });
    const sessM = (
      (report.valueAgreement as Record<string, unknown>).session as Record<string, unknown>
    ).mismatches as { key: string }[];
    expect(sessM.some((m) => m.key === "avgHeartRate")).toBe(true);
  });

  test("writes YAML report when -o ends with .yaml", async () => {
    const aPath = join(tmpDir, "a.json");
    const bPath = join(tmpDir, "b.json");
    const base = minimalFixture({
      session: {},
      records: [{ timestamp: "2020-01-01T00:00:00.000Z", heartRate: 120 }],
    });
    writeFileSync(aPath, JSON.stringify(base), "utf-8");
    writeFileSync(bPath, JSON.stringify(base), "utf-8");

    const outPath = join(tmpDir, "custom-report.yaml");
    await runCompareCli([aPath, bPath, "-o", outPath]);

    const text = readFileSync(outPath, "utf-8");
    expect(text.trim().startsWith("generatedAt:")).toBe(true);
    const parsed = yaml.load(text) as Record<string, unknown>;
    expect(parsed.sources).toBeDefined();
  });

  test("exits with usage when fewer than two args", async () => {
    const codes: number[] = [];
    process.exit = ((c?: number) => {
      codes.push(c ?? 0);
      throw new Error("exit");
    }) as typeof process.exit;

    await expect(runCompareCli([])).rejects.toThrow("exit");
    expect(codes).toEqual([1]);

    codes.length = 0;
    await expect(runCompareCli(["only.json"])).rejects.toThrow("exit");
    expect(codes).toEqual([1]);
  });
});
