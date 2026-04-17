import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import yaml from "js-yaml";

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

/** Keep every Nth record (1-based: first is kept, then every Nth). */
export function downsampleRecords(
  records: RecordData[],
  sampleEveryN: number
): RecordData[] {
  if (sampleEveryN <= 1) return records;
  return records.filter((_, i) => i % sampleEveryN === 0);
}

/** Recursively prepare values for JSON/YAML (bigint → number, Date → ISO string). */
export function sanitizeForSerialization(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === "bigint") return Number(data);
  if (data instanceof Date) return data.toISOString();
  if (typeof data !== "object") return data;
  if (Array.isArray(data)) {
    return data.map(sanitizeForSerialization);
  }
  const obj = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    out[key] = sanitizeForSerialization(obj[key]);
  }
  return out;
}

export async function writeOutput(
  filePath: string,
  data: unknown,
  format: "json" | "yaml" = "json"
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  const sanitized = sanitizeForSerialization(data);
  const text =
    format === "json"
      ? JSON.stringify(sanitized, null, 2)
      : yaml.dump(sanitized);
  await writeFile(filePath, text, "utf-8");
}

/** Load normalized FIT data from JSON or YAML (extension-based). */
export async function loadNormalized(path: string): Promise<NormalizedFitData> {
  const text = await readFile(path, "utf-8");
  const lower = path.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return yaml.load(text) as NormalizedFitData;
  }
  return JSON.parse(text) as NormalizedFitData;
}

/** Shallow clone object fields into a hybrid map (drops non-enumerable). */
export function objectToHybrid(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (obj == null) return {};
  return { ...obj };
}
