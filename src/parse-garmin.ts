import { Decoder, Stream } from "@garmin/fitsdk";
import {
  type NormalizedFitData,
  downsampleRecords,
  objectToHybrid,
  parseSampleArg,
  writeOutput,
} from "./normalize";

const DEFAULT_FIT = "fits/build-26.fit";
const OUT_RAW = "output/garmin-sdk-raw.json";
const OUT_NORM = "output/garmin-sdk-normalized.json";

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

export function normalizeGarmin(rawData: unknown): NormalizedFitData {
  const root = firstRecord(rawData);
  const messages = root?.messages;
  if (!messages || typeof messages !== "object") {
    return {
      metadata: {},
      deviceInfo: [],
      session: {},
      laps: [],
      records: [],
    };
  }

  const msg = messages as Record<string, unknown[]>;

  const sessionMesgs = asObjectArray(msg.sessionMesgs);
  const lapMesgs = asObjectArray(msg.lapMesgs);
  const recordMesgs = asObjectArray(msg.recordMesgs);
  const fileIdMesgs = asObjectArray(msg.fileIdMesgs);
  const deviceInfoMesgs = asObjectArray(msg.deviceInfoMesgs);
  const activityMesgs = asObjectArray(msg.activityMesgs);
  const sportMesgs = asObjectArray(msg.sportMesgs);
  const softwareMesgs = asObjectArray(msg.softwareMesgs);
  const deviceAuxBattery = asObjectArray(msg.deviceAuxBatteryInfoMesgs);

  const session0 = sessionMesgs[0];
  const file0 = fileIdMesgs[0];
  const activity0 = activityMesgs[0];
  const sport0 = sportMesgs[0];

  const metadata = {
    ...objectToHybrid(file0),
    ...objectToHybrid(activity0),
    ...objectToHybrid(sport0),
    sport: session0?.sport ?? sport0?.sport,
    subSport: session0?.subSport ?? sport0?.subSport,
    name: session0?.name ?? activity0?.name,
    timestamp: session0?.timestamp ?? activity0?.timestamp,
    totalTimerTime: session0?.totalTimerTime,
    startTime: session0?.startTime,
  } as NormalizedFitData["metadata"];

  const deviceInfo: NormalizedFitData["deviceInfo"] = [
    ...fileIdMesgs.map((d, i) => ({
      _source: "fileId",
      _index: i,
      ...objectToHybrid(d),
    })),
    ...deviceInfoMesgs.map((d, i) => ({
      _source: "deviceInfo",
      _index: i,
      ...objectToHybrid(d),
    })),
    ...softwareMesgs.map((d, i) => ({
      _source: "software",
      _index: i,
      ...objectToHybrid(d),
    })),
    ...deviceAuxBattery.map((d, i) => ({
      _source: "deviceAuxBatteryInfo",
      _index: i,
      ...objectToHybrid(d),
    })),
  ];

  const session: NormalizedFitData["session"] = session0
    ? { ...objectToHybrid(session0) }
    : {};

  const laps: NormalizedFitData["laps"] = lapMesgs.map((lap, i) => ({
    lapIndex: i,
    ...objectToHybrid(lap),
  }));

  const records: NormalizedFitData["records"] = recordMesgs.map((r) =>
    objectToHybrid(r)
  ) as NormalizedFitData["records"];

  return {
    metadata,
    deviceInfo,
    session,
    laps,
    records,
  };
}

async function main() {
  const argv = process.argv.slice(2);
  const fitPath = argv[0] && !argv[0].startsWith("-") ? argv[0] : DEFAULT_FIT;
  const sampleN = parseSampleArg(argv);

  const buf = await Bun.file(fitPath).arrayBuffer();
  const stream = Stream.fromArrayBuffer(buf);
  const decoder = new Decoder(stream);

  const result = decoder.read({
    includeUnknownData: true,
    decodeMemoGlobs: true,
  });

  const rawPayload = {
    profileVersion: result.profileVersion,
    errors: result.errors,
    messages: result.messages,
  };

  await writeOutput(OUT_RAW, rawPayload);

  let normalized = normalizeGarmin(rawPayload);
  if (sampleN !== undefined) {
    normalized = {
      ...normalized,
      records: downsampleRecords(normalized.records, sampleN),
    };
  }

  await writeOutput(OUT_NORM, normalized);

  console.log("Garmin SDK parse complete");
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
  if (result.errors.length) {
    console.warn(`  Decoder reported ${result.errors.length} error(s)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
