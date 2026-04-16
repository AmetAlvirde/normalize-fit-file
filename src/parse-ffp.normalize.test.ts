import { describe, expect, test } from "bun:test";
import { type FfpParsedFit, normalizeFFP } from "./parse-ffp";

describe("normalizeFFP (minimal shape)", () => {
  test("normalizes keys, metadata precedence, lapIndex defaulting, and device tagging", () => {
    const raw = {
      name: "Workout Name From Root",
      sessions: [
        {
          sport: "running",
          sub_sport: "trail",
          name: "Session Name",
          total_timer_time: 123,
          start_time: "2020-01-01T00:00:00Z",
          timestamp: "2020-01-01T00:10:00Z",
        },
      ],
      sports: [
        {
          sport: "running",
        },
      ],
      records: [
        {
          heart_rate: 100,
          "Air Power": 180,
        },
      ],
      laps: [
        {
          total_timer_time: 60,
        },
      ],
      file_ids: [
        {
          time_created: "2020-01-01T00:00:00Z",
        },
      ],
      device_infos: [
        {
          manufacturer: "garmin",
        },
      ],
    } as unknown as Partial<FfpParsedFit>;

    const norm = normalizeFFP(raw);

    expect(norm.metadata.sport).toBe("running");
    expect(norm.metadata.subSport).toBe("trail");
    expect(norm.metadata.name).toBe("Session Name");
    expect(norm.metadata.totalTimerTime).toBe(123);
    expect(norm.metadata.startTime).toBe("2020-01-01T00:00:00Z");
    expect(norm.metadata.timestamp).toBe("2020-01-01T00:10:00Z");

    expect(norm.records[0]).toMatchObject({
      heartRate: 100,
      airPower: 180,
    });

    expect(norm.laps[0]?.lapIndex).toBe(0);

    const sources = new Set(norm.deviceInfo.map(d => String(d._source)));
    expect(sources.has("fileId")).toBe(true);
    expect(sources.has("deviceInfo")).toBe(true);
  });
});
