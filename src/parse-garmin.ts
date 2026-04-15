import { type NormalizedFitData, objectToHybrid } from "./normalize";

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
