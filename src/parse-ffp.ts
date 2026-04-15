import FitParser from "fit-file-parser";
import { renameRowArray, renameRowKeys } from "./ffp-garmin-field-names";
import { renameStrydRowArray, renameStrydRowKeys } from "./ffp-stryd-second-pass";
import { type NormalizedFitData, objectToHybrid } from "./normalize";

/** Parsed FIT root shape returned by `fit-file-parser` v2 `parseAsync`. */
export type FfpParsedFit = Awaited<
  ReturnType<InstanceType<typeof FitParser>["parseAsync"]>
>;

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

  const sessions = renameStrydRowArray(
    renameRowArray(asObjectArray(root.sessions))
  );
  const laps = renameStrydRowArray(renameRowArray(asObjectArray(root.laps)));
  const records = renameStrydRowArray(
    renameRowArray(asObjectArray(root.records))
  );
  const fileIds = renameStrydRowArray(
    renameRowArray(asObjectArray(root.file_ids))
  );
  const devices = renameStrydRowArray(
    renameRowArray(asObjectArray(root.device_infos))
  );
  const sports = renameStrydRowArray(
    renameRowArray(asObjectArray(root.sports))
  );

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
        renameStrydRowKeys(
          renameRowKeys(root.software as Record<string, unknown>)
        )
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

/** Parse a FIT file buffer with fit-file-parser (list mode). */
export async function parseFitBuffer(buffer: ArrayBuffer): Promise<FfpParsedFit> {
  const parser = new FitParser({ mode: "list", force: true });
  return parser.parseAsync(buffer);
}
