import FitParser from "fit-file-parser";
import { renameRowArray, renameRowKeys } from "./ffp-garmin-field-names";
import {
  type NormalizedFitData,
  downsampleRecords,
  objectToHybrid,
  parseSampleArg,
  writeOutput,
} from "./normalize";

/** Parsed FIT root shape returned by `fit-file-parser` v2 `parseAsync`. */
export type FfpParsedFit = Awaited<
  ReturnType<InstanceType<typeof FitParser>["parseAsync"]>
>;

const DEFAULT_FIT = "fits/build-26.fit";
const OUT_RAW = "output/fit-file-parser-raw.json";
const OUT_NORM = "output/fit-file-parser-normalized.json";

function asHybridRecord(
  obj: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!obj) return {};
  return objectToHybrid(obj);
}

function asObjectArray(
  v: unknown
): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (x): x is Record<string, unknown> => x != null && typeof x === "object"
  );
}

/**
 * Normalize fit-file-parser output into the shared schema.
 * Accepts the parser result; uses `Partial` at the boundary because some FIT files omit sections.
 */
export function normalizeFFP(rawData: Partial<FfpParsedFit>): NormalizedFitData {
  const root = rawData as unknown as Record<string, unknown>;

  const sessions = renameRowArray(asObjectArray(root.sessions));
  const laps = renameRowArray(asObjectArray(root.laps));
  const records = renameRowArray(asObjectArray(root.records));
  const fileIds = renameRowArray(asObjectArray(root.file_ids));
  const devices = renameRowArray(asObjectArray(root.device_infos));
  const sports = renameRowArray(asObjectArray(root.sports));

  const session0 = sessions[0];
  const file0 = fileIds[0];
  const sport0 = sports[0];

  const metadata = {
    ...asHybridRecord(file0),
    ...asHybridRecord(sport0),
    sport: session0?.sport ?? sport0?.sport,
    subSport: session0?.subSport ?? sport0?.subSport,
    name: session0?.name ?? root.name,
    timestamp: session0?.timestamp ?? file0?.timeCreated,
    totalTimerTime: session0?.totalTimerTime,
    startTime: session0?.startTime,
  } as NormalizedFitData["metadata"];

  const deviceInfo: NormalizedFitData["deviceInfo"] = [
    ...fileIds.map((d, i) => ({
      _source: "fileId",
      _index: i,
      ...objectToHybrid(d),
    })),
    ...devices.map((d, i) => ({
      _source: "deviceInfo",
      _index: i,
      ...objectToHybrid(d),
    })),
  ];

  if (root.software && typeof root.software === "object") {
    deviceInfo.push({
      _source: "software",
      _index: 0,
      ...objectToHybrid(
        renameRowKeys(root.software as Record<string, unknown>)
      ),
    });
  }

  const session: NormalizedFitData["session"] = session0
    ? { ...objectToHybrid(session0) }
    : {};

  const lapsNorm: NormalizedFitData["laps"] = laps.map((lap, i) => ({
    ...objectToHybrid(lap),
    lapIndex: typeof lap.lapIndex === "number" ? lap.lapIndex : i,
  }));

  const recordsNorm: NormalizedFitData["records"] = records.map((r) =>
    objectToHybrid(r)
  ) as NormalizedFitData["records"];

  return {
    metadata,
    deviceInfo,
    session,
    laps: lapsNorm,
    records: recordsNorm,
  };
}

async function parseFitBuffer(buffer: ArrayBuffer): Promise<FfpParsedFit> {
  const parser = new FitParser({ mode: "list", force: true });
  return parser.parseAsync(buffer);
}

async function main() {
  const argv = process.argv.slice(2);
  const fitPath = argv[0] && !argv[0].startsWith("-") ? argv[0] : DEFAULT_FIT;
  const sampleN = parseSampleArg(argv);

  const buf = await Bun.file(fitPath).arrayBuffer();
  const raw = await parseFitBuffer(buf);

  await writeOutput(OUT_RAW, raw);

  let normalized = normalizeFFP(raw);
  if (sampleN !== undefined) {
    normalized = {
      ...normalized,
      records: downsampleRecords(normalized.records, sampleN),
    };
  }

  await writeOutput(OUT_NORM, normalized);

  console.log("fit-file-parser parse complete");
  console.log(`  FIT: ${fitPath}`);
  console.log(`  Raw: ${OUT_RAW}`);
  console.log(`  Normalized: ${OUT_NORM}`);
  console.log(`  Records: ${normalized.records.length}${sampleN != null ? ` (sample every ${sampleN})` : ""}`);
  console.log(`  Laps: ${normalized.laps.length}`);
  console.log(`  Device rows: ${normalized.deviceInfo.length}`);
  const keys = (o: Record<string, unknown>) => Object.keys(o).length;
  console.log(
    `  Field counts — metadata: ${keys(normalized.metadata)}, session: ${keys(normalized.session)}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
