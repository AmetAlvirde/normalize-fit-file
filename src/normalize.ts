import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/** Workout / file-level metadata (sport, timestamps, naming). */
export type WorkoutMetadata = {
  sport?: string | number;
  subSport?: string | number;
  name?: string;
  timestamp?: string | Date | number;
  totalTimerTime?: number;
  startTime?: string | Date | number;
} & Record<string, unknown>;

/** One device or source identifier row. */
export type DeviceInfo = {
  manufacturer?: string | number;
  product?: string | number;
  serialNumber?: string | number;
  softwareVersion?: string | number;
  batteryStatus?: string | number;
  deviceIndex?: string | number;
} & Record<string, unknown>;

/** Aggregated session totals and averages. */
export type SessionSummary = {
  totalDistance?: number;
  totalCalories?: number;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPower?: number;
  maxPower?: number;
  avgCadence?: number;
  maxCadence?: number;
  avgSpeed?: number;
  maxSpeed?: number;
  totalAscent?: number;
  totalDescent?: number;
} & Record<string, unknown>;

/** Single lap metrics. */
export type LapData = {
  lapIndex?: number;
  startTime?: string | Date | number;
  timestamp?: string | Date | number;
  totalElapsedTime?: number;
  totalTimerTime?: number;
  totalDistance?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  avgPower?: number;
  maxPower?: number;
} & Record<string, unknown>;

/** Per-timestamp record (HR, power, cadence, position, etc.). */
export type RecordData = {
  timestamp?: string | Date | number;
  heartRate?: number;
  power?: number;
  cadence?: number;
  speed?: number;
  distance?: number;
  altitude?: number;
  positionLat?: number;
  positionLong?: number;
  enhancedAltitude?: number;
  enhancedSpeed?: number;
} & Record<string, unknown>;

export type NormalizedFitData = {
  metadata: WorkoutMetadata;
  deviceInfo: DeviceInfo[];
  session: SessionSummary;
  laps: LapData[];
  records: RecordData[];
};

export type NormalizeMapper = (rawData: unknown) => NormalizedFitData;

/** Parse `--sample N` from argv. Returns undefined if absent or invalid. */
export function parseSampleArg(argv: string[]): number | undefined {
  const idx = argv.indexOf("--sample");
  if (idx === -1) return undefined;
  const n = Number(argv[idx + 1]);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid --sample value: ${argv[idx + 1] ?? "(missing)"}`);
  }
  return Math.floor(n);
}

/** Keep every Nth record (1-based: first is kept, then every Nth). */
export function downsampleRecords(
  records: RecordData[],
  sampleEveryN: number
): RecordData[] {
  if (sampleEveryN <= 1) return records;
  return records.filter((_, i) => i % sampleEveryN === 0);
}

const jsonReplacer = (_key: string, value: unknown) => {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
};

export async function writeOutput(
  filePath: string,
  data: unknown
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const text = JSON.stringify(data, jsonReplacer, 2);
  await writeFile(filePath, text, "utf-8");
}

/** Shallow clone object fields into a hybrid map (drops non-enumerable). */
export function objectToHybrid(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (obj == null) return {};
  return { ...obj };
}
