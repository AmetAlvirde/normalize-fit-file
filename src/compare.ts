import { readFile } from "node:fs/promises";
import {
  type NormalizedFitData,
  type RecordData,
  writeOutput,
} from "./normalize";

const GARMIN_NORM = "output/garmin-sdk-normalized.json";
const FFP_NORM = "output/fit-file-parser-normalized.json";
const REPORT_OUT = "output/comparison-report.json";

const FLOAT_TOL = 0.001;

type Category = "metadata" | "deviceInfo" | "session" | "laps" | "records";

function loadNormalized(path: string): Promise<NormalizedFitData> {
  return readFile(path, "utf-8").then((t) => JSON.parse(t) as NormalizedFitData);
}

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
  g: Record<string, unknown>,
  f: Record<string, unknown>
): {
  sharedKeys: string[];
  mismatches: { key: string; garmin: unknown; ffp: unknown; reason: string }[];
} {
  const gk = collectKeys(g);
  const fk = collectKeys(f);
  const shared = [...gk].filter((k) => fk.has(k)).sort();
  const mismatches: {
    key: string;
    garmin: unknown;
    ffp: unknown;
    reason: string;
  }[] = [];
  for (const key of shared) {
    const a = g[key];
    const b = f[key];
    if (!valuesAgree(a, b)) {
      mismatches.push({
        key,
        garmin: a,
        ffp: b,
        reason: valueMismatchKind(a, b),
      });
    }
  }
  return { sharedKeys: shared, mismatches };
}

function compareRecordArrays(
  gRec: RecordData[],
  fRec: RecordData[],
  maxReport = 50
): {
  comparedPairs: number;
  valueMismatches: {
    index: number;
    field: string;
    garmin: unknown;
    ffp: unknown;
    reason: string;
  }[];
} {
  const valueMismatches: {
    index: number;
    field: string;
    garmin: unknown;
    ffp: unknown;
    reason: string;
  }[] = [];

  const n = Math.min(gRec.length, fRec.length);
  let compared = 0;
  for (let i = 0; i < n; i++) {
    const gr = gRec[i]!;
    const fr = fRec[i]!;
    const keys = new Set([...Object.keys(gr), ...Object.keys(fr)]);
    for (const key of keys) {
      if (!(key in gr) || !(key in fr)) continue;
      const a = gr[key];
      const b = fr[key];
      if (!valuesAgree(a, b)) {
        if (valueMismatches.length < maxReport) {
          valueMismatches.push({
            index: i,
            field: key,
            garmin: a,
            ffp: b,
            reason: valueMismatchKind(a, b),
          });
        }
      }
    }
    compared++;
  }
  return { comparedPairs: compared, valueMismatches };
}

async function main() {
  const garmin = await loadNormalized(GARMIN_NORM);
  const ffp = await loadNormalized(FFP_NORM);

  const metaG = collectKeys(garmin.metadata);
  const metaF = collectKeys(ffp.metadata);
  const sessG = collectKeys(garmin.session);
  const sessF = collectKeys(ffp.session);
  const lapG = unionKeysFromArray(garmin.laps);
  const lapF = unionKeysFromArray(ffp.laps);
  const recG = unionKeysFromArray(garmin.records);
  const recF = unionKeysFromArray(ffp.records);
  const devG = unionKeysFromArray(garmin.deviceInfo);
  const devF = unionKeysFromArray(ffp.deviceInfo);

  const fieldCoverage: Record<
    Category,
    {
      garminOnly: string[];
      ffpOnly: string[];
      both: number;
    }
  > = {
    metadata: {
      garminOnly: setDiff(metaG, metaF),
      ffpOnly: setDiff(metaF, metaG),
      both: [...metaG].filter((k) => metaF.has(k)).length,
    },
    session: {
      garminOnly: setDiff(sessG, sessF),
      ffpOnly: setDiff(sessF, sessG),
      both: [...sessG].filter((k) => sessF.has(k)).length,
    },
    laps: {
      garminOnly: setDiff(lapG, lapF),
      ffpOnly: setDiff(lapF, lapG),
      both: [...lapG].filter((k) => lapF.has(k)).length,
    },
    records: {
      garminOnly: setDiff(recG, recF),
      ffpOnly: setDiff(recF, recG),
      both: [...recG].filter((k) => recF.has(k)).length,
    },
    deviceInfo: {
      garminOnly: setDiff(devG, devF),
      ffpOnly: setDiff(devF, devG),
      both: [...devG].filter((k) => devF.has(k)).length,
    },
  };

  const metaCmp = compareCategoryScalars(garmin.metadata, ffp.metadata);
  const sessCmp = compareCategoryScalars(garmin.session, ffp.session);

  const recCmp = compareRecordArrays(garmin.records, ffp.records);

  const gapG = analyzeTimestampGaps(garmin.records);
  const gapF = analyzeTimestampGaps(ffp.records);

  const sharedRecordKeys = [...interSets(recG, recF)].sort();
  const missingFieldRates = {
    garmin: fieldPresenceRates(garmin.records, sharedRecordKeys),
    ffp: fieldPresenceRates(ffp.records, sharedRecordKeys),
  };

  const typeQuality: {
    category: Category;
    field: string;
    garminTypes: string[];
    ffpTypes: string[];
    note: string;
  }[] = [];

  const checkTypes = (
    cat: Category,
    gRows: Record<string, unknown>[],
    fRows: Record<string, unknown>[],
    keys: Set<string>
  ) => {
    for (const field of [...keys].sort()) {
      const tg = recordFieldTypes(gRows, field);
      const tf = recordFieldTypes(fRows, field);
      const gStr = [...tg.types].sort().join("|");
      const fStr = [...tf.types].sort().join("|");
      if (gStr !== fStr) {
        let note = "types differ";
        const gNum = tg.types.has("number");
        const fStrT = tf.types.has("string");
        const fNum = tf.types.has("number");
        const gStrT = tg.types.has("string");
        if ((gNum && fStrT) || (fNum && gStrT)) {
          note = "numeric_vs_string_enum_like";
        }
        typeQuality.push({
          category: cat,
          field,
          garminTypes: [...tg.types].sort(),
          ffpTypes: [...tf.types].sort(),
          note,
        });
      }
    }
  };

  checkTypes(
    "metadata",
    [garmin.metadata],
    [ffp.metadata],
    interSets(metaG, metaF)
  );
  checkTypes(
    "session",
    [garmin.session],
    [ffp.session],
    interSets(sessG, sessF)
  );
  checkTypes("laps", garmin.laps, ffp.laps, interSets(lapG, lapF));
  checkTypes(
    "records",
    garmin.records,
    ffp.records,
    interSets(recG, recF)
  );
  checkTypes(
    "deviceInfo",
    garmin.deviceInfo,
    ffp.deviceInfo,
    interSets(devG, devF)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    sources: { garmin: GARMIN_NORM, ffp: FFP_NORM },
    floatTolerance: FLOAT_TOL,
    fieldCoverage,
    valueAgreement: {
      metadata: {
        sharedKeys: metaCmp.sharedKeys.length,
        mismatches: metaCmp.mismatches,
      },
      session: {
        sharedKeys: sessCmp.sharedKeys.length,
        mismatches: sessCmp.mismatches,
      },
      records: {
        comparedIndexPairs: recCmp.comparedPairs,
        sampleMismatches: recCmp.valueMismatches,
      },
    },
    recordCompleteness: {
      garmin: {
        count: garmin.records.length,
        timestampCount: gapG.sortedTimes.length,
        maxGapSeconds: gapG.maxGapSeconds,
        medianGapSeconds: median(gapG.gapsSeconds),
      },
      ffp: {
        count: ffp.records.length,
        timestampCount: gapF.sortedTimes.length,
        maxGapSeconds: gapF.maxGapSeconds,
        medianGapSeconds: median(gapF.gapsSeconds),
      },
      countDelta: garmin.records.length - ffp.records.length,
      sharedRecordKeys,
      missingFieldRates,
    },
    dataTypeQuality: typeQuality,
    summary: {
      garminMetadataFields: metaG.size,
      ffpMetadataFields: metaF.size,
      garminRecordFields: recG.size,
      ffpRecordFields: recF.size,
      typeMismatchesReported: typeQuality.length,
      sessionScalarMismatches: sessCmp.mismatches.length,
      metadataScalarMismatches: metaCmp.mismatches.length,
    },
  };

  await writeOutput(REPORT_OUT, report);

  console.log("Comparison complete\n");
  console.log("Field coverage (unique keys per category)");
  console.log(
    "  metadata — both:",
    fieldCoverage.metadata.both,
    "| garmin only:",
    fieldCoverage.metadata.garminOnly.length,
    "| ffp only:",
    fieldCoverage.metadata.ffpOnly.length
  );
  console.log(
    "  session  — both:",
    fieldCoverage.session.both,
    "| garmin only:",
    fieldCoverage.session.garminOnly.length,
    "| ffp only:",
    fieldCoverage.session.ffpOnly.length
  );
  console.log(
    "  records  — both:",
    fieldCoverage.records.both,
    "| garmin only:",
    fieldCoverage.records.garminOnly.length,
    "| ffp only:",
    fieldCoverage.records.ffpOnly.length
  );
  console.log(
    "  laps     — both:",
    fieldCoverage.laps.both,
    "| garmin only:",
    fieldCoverage.laps.garminOnly.length,
    "| ffp only:",
    fieldCoverage.laps.ffpOnly.length
  );
  console.log(
    "  device   — both:",
    fieldCoverage.deviceInfo.both,
    "| garmin only:",
    fieldCoverage.deviceInfo.garminOnly.length,
    "| ffp only:",
    fieldCoverage.deviceInfo.ffpOnly.length
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
    "  counts — garmin:",
    garmin.records.length,
    "ffp:",
    ffp.records.length,
    "delta:",
    report.recordCompleteness.countDelta
  );
  console.log(
    "  max timestamp gap (s) — garmin:",
    gapG.maxGapSeconds.toFixed(3),
    "ffp:",
    gapF.maxGapSeconds.toFixed(3)
  );
  console.log(
    "  shared record keys (for presence):",
    sharedRecordKeys.join(", ")
  );
  console.log("\nData type quality (fields with differing types)");
  console.log("  fields reported:", typeQuality.length);
  console.log("\nReport written to", REPORT_OUT);
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

// Extend Set prototype for union - actually I used metaG.union which doesn't exist on Set in JS

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
