import FitParser from "fit-file-parser";
import {
  type NormalizedFitData,
  downsampleRecords,
  objectToHybrid,
  parseSampleArg,
  writeOutput,
} from "./normalize";

const DEFAULT_FIT = "fits/build-26.fit";
const OUT_RAW = "output/fit-file-parser-raw.json";
const OUT_NORM = "output/fit-file-parser-normalized.json";

function firstRecord(obj: unknown): Record<string, unknown> | undefined {
  if (obj == null) return undefined;
  if (typeof obj === "object" && !Array.isArray(obj)) {
    return obj as Record<string, unknown>;
  }
  return undefined;
}

function asObjectArray(v: unknown): Record<string, unknown>[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is Record<string, unknown> => x != null && typeof x === "object");
}

export function normalizeFFP(rawData: unknown): NormalizedFitData {
  const root = firstRecord(rawData);
  if (!root) {
    return {
      metadata: {},
      deviceInfo: [],
      session: {},
      laps: [],
      records: [],
    };
  }

  const sessions = asObjectArray(root.sessions);
  const laps = asObjectArray(root.laps);
  const records = asObjectArray(root.records);
  const fileIds = asObjectArray(root.file_ids);
  const devices = asObjectArray(root.device_infos);
  const sports = asObjectArray(root.sports);

  const session0 = sessions[0];
  const file0 = fileIds[0];
  const sport0 = sports[0];

  const metadata = {
    ...objectToHybrid(file0),
    ...objectToHybrid(sport0),
    sport: session0?.sport ?? sport0?.sport,
    subSport: session0?.sub_sport ?? sport0?.sub_sport,
    name: session0?.name ?? root.name,
    timestamp: session0?.timestamp ?? file0?.time_created,
    totalTimerTime: session0?.total_timer_time,
    startTime: session0?.start_time,
  } as NormalizedFitData["metadata"];

  const deviceInfo: NormalizedFitData["deviceInfo"] = [
    ...fileIds.map((d, i) => ({
      _source: "file_id",
      _index: i,
      ...objectToHybrid(d),
    })),
    ...devices.map((d, i) => ({
      _source: "device_info",
      _index: i,
      ...objectToHybrid(d),
    })),
  ];

  if (root.software && typeof root.software === "object") {
    deviceInfo.push({
      _source: "software",
      _index: 0,
      ...objectToHybrid(root.software as Record<string, unknown>),
    });
  }

  const session: NormalizedFitData["session"] = session0
    ? { ...objectToHybrid(session0) }
    : {};

  const lapsNorm: NormalizedFitData["laps"] = laps.map((lap, i) => ({
    lapIndex: typeof lap.lap_index === "number" ? lap.lap_index : i,
    ...objectToHybrid(lap),
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

function parseFitBuffer(buffer: ArrayBuffer): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const parser = new FitParser({ mode: "list", force: true });
    parser.parse(buffer, (err, data) => {
      if (err) {
        reject(new Error(`fit-file-parser: ${err}`));
        return;
      }
      resolve(data);
    });
  });
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
