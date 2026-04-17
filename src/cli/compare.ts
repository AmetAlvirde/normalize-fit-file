import {
  type NormalizedFitData,
  type RecordData,
  loadNormalized,
  writeOutput,
} from "../normalize";
import { parseCompareArgs } from "./fit-path";

const FLOAT_TOL = 0.001;

/**
 * Comparison report JSON uses keys derived from each input filename (basename without
 * extension). For example, `race-garmin.json` → label `race-garmin`, so field coverage
 * includes `race-garminOnly` / `race-ffpOnly`, and scalar mismatches look like
 * `{ key, race-garmin: …, race-ffp: …, reason }` instead of fixed `garmin` / `ffp` keys.
 *
 * Optional follow-up: reduce camelCase vs snake_case noise — see docs/followup-key-aliasing.md
 */

type Category = "metadata" | "deviceInfo" | "session" | "laps" | "records";

function collectKeys(obj: Record<string, unknown> | undefined): Set<string> {
  if (!obj) return new Set();
  return new Set(Object.keys(obj));
}

function unionKeysFromArray(
  arr: Record<string, unknown>[] | undefined
): Set<string> {
  const s = new Set<string>();
  if (!arr) return s;
  for (const row of arr) {
    for (const k of Object.keys(row)) s.add(k);
  }
  return s;
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

function interSets(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a].filter((k) => b.has(k)));
}

function toComparableNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d / 1000;
  }
  return null;
}

function valuesAgree(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" && typeof b === "number") {
    return Math.abs(a - b) <= FLOAT_TOL;
  }
  const na = toComparableNumber(a);
  const nb = toComparableNumber(b);
  if (na != null && nb != null) {
    return Math.abs(na - nb) <= FLOAT_TOL;
  }
  return String(a) === String(b);
}

function valueMismatchKind(a: unknown, b: unknown): string {
  const ta = a === null || a === undefined ? "nullish" : typeof a;
  const tb = b === null || b === undefined ? "nullish" : typeof b;
  if (ta !== tb) return `type:${ta}_vs_${tb}`;
  if (!valuesAgree(a, b)) return "value";
  return "match";
}

type FieldTypeInfo = { types: Set<string>; samples: unknown[] };

function recordFieldTypes(
  rows: Record<string, unknown>[],
  field: string,
  maxSamples = 3
): FieldTypeInfo {
  const types = new Set<string>();
  const samples: unknown[] = [];
  for (const row of rows) {
    if (!(field in row)) continue;
    const v = row[field];
    const t =
      v === null || v === undefined
        ? "nullish"
        : Array.isArray(v)
          ? "array"
          : typeof v;
    types.add(t);
    if (samples.length < maxSamples) samples.push(v);
  }
  return { types, samples };
}

function analyzeTimestampGaps(records: RecordData[]): {
  sortedTimes: number[];
  gapsSeconds: number[];
  maxGapSeconds: number;
} {
  const times: number[] = [];
  for (const r of records) {
    const t = toComparableNumber(r.timestamp);
    if (t != null) times.push(t);
  }
  times.sort((x, y) => x - y);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    gaps.push(times[i]! - times[i - 1]!);
  }
  const maxGap = gaps.length ? Math.max(...gaps) : 0;
  return { sortedTimes: times, gapsSeconds: gaps, maxGapSeconds: maxGap };
}

function compareCategoryScalars(
  rowA: Record<string, unknown>,
  rowB: Record<string, unknown>
): {
  sharedKeys: string[];
  mismatches: { key: string; a: unknown; b: unknown; reason: string }[];
} {
  const keysA = collectKeys(rowA);
  const keysB = collectKeys(rowB);
  const shared = [...keysA].filter((k) => keysB.has(k)).sort();
  const mismatches: {
    key: string;
    a: unknown;
    b: unknown;
    reason: string;
  }[] = [];
  for (const key of shared) {
    const va = rowA[key];
    const vb = rowB[key];
    if (!valuesAgree(va, vb)) {
      mismatches.push({
        key,
        a: va,
        b: vb,
        reason: valueMismatchKind(va, vb),
      });
    }
  }
  return { sharedKeys: shared, mismatches };
}

function compareRecordArrays(
  recA: RecordData[],
  recB: RecordData[],
  maxReport = 50
): {
  comparedPairs: number;
  valueMismatches: {
    index: number;
    field: string;
    a: unknown;
    b: unknown;
    reason: string;
  }[];
} {
  const valueMismatches: {
    index: number;
    field: string;
    a: unknown;
    b: unknown;
    reason: string;
  }[] = [];

  const n = Math.min(recA.length, recB.length);
  let compared = 0;
  for (let i = 0; i < n; i++) {
    const rowA = recA[i]!;
    const rowB = recB[i]!;
    const keys = new Set([...Object.keys(rowA), ...Object.keys(rowB)]);
    for (const key of keys) {
      if (!(key in rowA) || !(key in rowB)) continue;
      const va = rowA[key];
      const vb = rowB[key];
      if (!valuesAgree(va, vb)) {
        if (valueMismatches.length < maxReport) {
          valueMismatches.push({
            index: i,
            field: key,
            a: va,
            b: vb,
            reason: valueMismatchKind(va, vb),
          });
        }
      }
    }
    compared++;
  }
  return { comparedPairs: compared, valueMismatches };
}

function fieldCoverageRow(
  labelA: string,
  labelB: string,
  setA: Set<string>,
  setB: Set<string>
): Record<string, unknown> {
  const onlyA = `${labelA}Only`;
  const onlyB = `${labelB}Only`;
  return {
    [onlyA]: setDiff(setA, setB),
    [onlyB]: setDiff(setB, setA),
    both: [...setA].filter((k) => setB.has(k)).length,
  };
}

function mapScalarMismatches(
  mismatches: { key: string; a: unknown; b: unknown; reason: string }[],
  labelA: string,
  labelB: string
): Record<string, unknown>[] {
  return mismatches.map((m) => ({
    key: m.key,
    [labelA]: m.a,
    [labelB]: m.b,
    reason: m.reason,
  }));
}

function mapRecordMismatches(
  mismatches: {
    index: number;
    field: string;
    a: unknown;
    b: unknown;
    reason: string;
  }[],
  labelA: string,
  labelB: string
): Record<string, unknown>[] {
  return mismatches.map((m) => ({
    index: m.index,
    field: m.field,
    [labelA]: m.a,
    [labelB]: m.b,
    reason: m.reason,
  }));
}

export async function runCompareCli(argv: string[]): Promise<void> {
  let args;
  try {
    args = parseCompareArgs(argv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}`);
    console.error("");
    console.error(
      "Usage: normalize-fit-file compare <fileA> <fileB> [-f json|yaml] [-o path]"
    );
    console.error(
      "Example: normalize-fit-file compare race-garmin.json race-ffp.yaml -o report.yaml"
    );
    process.exit(1);
  }

  const { labelA, labelB, format, output } = args;
  const onlyA = `${labelA}Only`;
  const onlyB = `${labelB}Only`;
  const typesAKey = `${labelA}Types`;
  const typesBKey = `${labelB}Types`;

  const dataA = await loadNormalized(args.fileA);
  const dataB = await loadNormalized(args.fileB);

  const metaA = collectKeys(dataA.metadata);
  const metaB = collectKeys(dataB.metadata);
  const sessA = collectKeys(dataA.session);
  const sessB = collectKeys(dataB.session);
  const lapA = unionKeysFromArray(dataA.laps);
  const lapB = unionKeysFromArray(dataB.laps);
  const recA = unionKeysFromArray(dataA.records);
  const recB = unionKeysFromArray(dataB.records);
  const devA = unionKeysFromArray(dataA.deviceInfo);
  const devB = unionKeysFromArray(dataB.deviceInfo);

  const fieldCoverage: Record<Category, Record<string, unknown>> = {
    metadata: fieldCoverageRow(labelA, labelB, metaA, metaB),
    session: fieldCoverageRow(labelA, labelB, sessA, sessB),
    laps: fieldCoverageRow(labelA, labelB, lapA, lapB),
    records: fieldCoverageRow(labelA, labelB, recA, recB),
    deviceInfo: fieldCoverageRow(labelA, labelB, devA, devB),
  };

  const metaCmp = compareCategoryScalars(dataA.metadata, dataB.metadata);
  const sessCmp = compareCategoryScalars(dataA.session, dataB.session);

  const recCmp = compareRecordArrays(dataA.records, dataB.records);

  const gapA = analyzeTimestampGaps(dataA.records);
  const gapB = analyzeTimestampGaps(dataB.records);

  const sharedRecordKeys = [...interSets(recA, recB)].sort();
  const missingFieldRates: Record<string, Record<string, number>> = {
    [labelA]: fieldPresenceRates(dataA.records, sharedRecordKeys),
    [labelB]: fieldPresenceRates(dataB.records, sharedRecordKeys),
  };

  const typeQuality: Record<string, unknown>[] = [];

  const checkTypes = (
    cat: Category,
    rowsA: Record<string, unknown>[],
    rowsB: Record<string, unknown>[],
    keys: Set<string>
  ) => {
    for (const field of [...keys].sort()) {
      const tA = recordFieldTypes(rowsA, field);
      const tB = recordFieldTypes(rowsB, field);
      const strA = [...tA.types].sort().join("|");
      const strB = [...tB.types].sort().join("|");
      if (strA !== strB) {
        let note = "types differ";
        const aNum = tA.types.has("number");
        const bStr = tB.types.has("string");
        const bNum = tB.types.has("number");
        const aStr = tA.types.has("string");
        if ((aNum && bStr) || (bNum && aStr)) {
          note = "numeric_vs_string_enum_like";
        }
        typeQuality.push({
          category: cat,
          field,
          [typesAKey]: [...tA.types].sort(),
          [typesBKey]: [...tB.types].sort(),
          note,
        });
      }
    }
  };

  checkTypes("metadata", [dataA.metadata], [dataB.metadata], interSets(metaA, metaB));
  checkTypes("session", [dataA.session], [dataB.session], interSets(sessA, sessB));
  checkTypes("laps", dataA.laps, dataB.laps, interSets(lapA, lapB));
  checkTypes("records", dataA.records, dataB.records, interSets(recA, recB));
  checkTypes(
    "deviceInfo",
    dataA.deviceInfo,
    dataB.deviceInfo,
    interSets(devA, devB)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sources: { [labelA]: args.fileA, [labelB]: args.fileB },
    floatTolerance: FLOAT_TOL,
    fieldCoverage,
    valueAgreement: {
      metadata: {
        sharedKeys: metaCmp.sharedKeys.length,
        mismatches: mapScalarMismatches(metaCmp.mismatches, labelA, labelB),
      },
      session: {
        sharedKeys: sessCmp.sharedKeys.length,
        mismatches: mapScalarMismatches(sessCmp.mismatches, labelA, labelB),
      },
      records: {
        comparedIndexPairs: recCmp.comparedPairs,
        sampleMismatches: mapRecordMismatches(recCmp.valueMismatches, labelA, labelB),
      },
    },
    recordCompleteness: {
      [labelA]: {
        count: dataA.records.length,
        timestampCount: gapA.sortedTimes.length,
        maxGapSeconds: gapA.maxGapSeconds,
        medianGapSeconds: median(gapA.gapsSeconds),
      },
      [labelB]: {
        count: dataB.records.length,
        timestampCount: gapB.sortedTimes.length,
        maxGapSeconds: gapB.maxGapSeconds,
        medianGapSeconds: median(gapB.gapsSeconds),
      },
      countDelta: dataA.records.length - dataB.records.length,
      sharedRecordKeys,
      missingFieldRates,
    },
    dataTypeQuality: typeQuality,
    summary: {
      [`${labelA}MetadataFields`]: metaA.size,
      [`${labelB}MetadataFields`]: metaB.size,
      [`${labelA}RecordFields`]: recA.size,
      [`${labelB}RecordFields`]: recB.size,
      typeMismatchesReported: typeQuality.length,
      sessionScalarMismatches: sessCmp.mismatches.length,
      metadataScalarMismatches: metaCmp.mismatches.length,
    },
  };

  await writeOutput(output, report, format);

  const fcMeta = fieldCoverage.metadata;
  const fcSess = fieldCoverage.session;
  const fcRec = fieldCoverage.records;
  const fcLaps = fieldCoverage.laps;
  const fcDev = fieldCoverage.deviceInfo;

  console.log("Comparison complete\n");
  console.log("Field coverage (unique keys per category)");
  console.log(
    "  metadata — both:",
    fcMeta.both,
    "|",
    labelA,
    "only:",
    (fcMeta[onlyA] as string[]).length,
    "|",
    labelB,
    "only:",
    (fcMeta[onlyB] as string[]).length
  );
  console.log(
    "  session  — both:",
    fcSess.both,
    "|",
    labelA,
    "only:",
    (fcSess[onlyA] as string[]).length,
    "|",
    labelB,
    "only:",
    (fcSess[onlyB] as string[]).length
  );
  console.log(
    "  records  — both:",
    fcRec.both,
    "|",
    labelA,
    "only:",
    (fcRec[onlyA] as string[]).length,
    "|",
    labelB,
    "only:",
    (fcRec[onlyB] as string[]).length
  );
  console.log(
    "  laps     — both:",
    fcLaps.both,
    "|",
    labelA,
    "only:",
    (fcLaps[onlyA] as string[]).length,
    "|",
    labelB,
    "only:",
    (fcLaps[onlyB] as string[]).length
  );
  console.log(
    "  device   — both:",
    fcDev.both,
    "|",
    labelA,
    "only:",
    (fcDev[onlyA] as string[]).length,
    "|",
    labelB,
    "only:",
    (fcDev[onlyB] as string[]).length
  );
  console.log("\nValue agreement (scalars)");
  console.log(
    "  metadata mismatches:",
    metaCmp.mismatches.length,
    "/ shared keys:",
    metaCmp.sharedKeys.length
  );
  console.log(
    "  session mismatches:",
    sessCmp.mismatches.length,
    "/ shared keys:",
    sessCmp.sharedKeys.length
  );
  console.log(
    "  record value mismatches (capped):",
    recCmp.valueMismatches.length,
    "| index-aligned rows:",
    recCmp.comparedPairs
  );
  console.log("\nRecord completeness");
  console.log(
    "  counts —",
    labelA + ":",
    dataA.records.length,
    labelB + ":",
    dataB.records.length,
    "delta:",
    report.recordCompleteness.countDelta
  );
  console.log(
    "  max timestamp gap (s) —",
    labelA + ":",
    gapA.maxGapSeconds.toFixed(3),
    labelB + ":",
    gapB.maxGapSeconds.toFixed(3)
  );
  console.log(
    "  shared record keys (for presence):",
    sharedRecordKeys.join(", ")
  );
  console.log("\nData type quality (fields with differing types)");
  console.log("  fields reported:", typeQuality.length);
  console.log("\nReport written to", output);
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

function fieldPresenceRates(
  rows: Record<string, unknown>[],
  keys: string[]
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!rows.length) {
    for (const k of keys) out[k] = 0;
    return out;
  }
  for (const key of keys) {
    const n = rows.filter((r) => key in r && r[key] != null).length;
    out[key] = n / rows.length;
  }
  return out;
}
