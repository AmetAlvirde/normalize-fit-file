import { describe, expect, test } from "bun:test";
import { renameRowKeys, snakeToCamelKey } from "./ffp-garmin-field-names";

describe("snakeToCamelKey", () => {
  test("converts multi-segment snake_case", () => {
    expect(snakeToCamelKey("total_timer_time")).toBe("totalTimerTime");
    expect(snakeToCamelKey("avg_heart_rate")).toBe("avgHeartRate");
    expect(snakeToCamelKey("sub_sport")).toBe("subSport");
    expect(snakeToCamelKey("start_position_lat")).toBe("startPositionLat");
  });

  test("single segment unchanged", () => {
    expect(snakeToCamelKey("sport")).toBe("sport");
    expect(snakeToCamelKey("timestamp")).toBe("timestamp");
  });

  test("non-snake keys unchanged", () => {
    expect(snakeToCamelKey("Air Power")).toBe("Air Power");
    expect(snakeToCamelKey("heartRate")).toBe("heartRate");
    expect(snakeToCamelKey("_leading")).toBe("_leading");
    expect(snakeToCamelKey("")).toBe("");
  });

  test("numeric segments", () => {
    expect(snakeToCamelKey("field_1")).toBe("field1");
  });
});

describe("renameRowKeys", () => {
  test("renames shallow snake_case keys", () => {
    const row = {
      heart_rate: 120,
      position_lat: 1,
      elapsed_time: 1.5,
    };
    expect(renameRowKeys(row)).toEqual({
      heartRate: 120,
      positionLat: 1,
      elapsedTime: 1.5,
    });
  });

  test("preserves Title Case vendor keys", () => {
    const row = { heart_rate: 100, "Form Power": 200 };
    expect(renameRowKeys(row)).toEqual({
      heartRate: 100,
      "Form Power": 200,
    });
  });

  test("overrides apply before automatic rename", () => {
    const row = { custom_field: 1 };
    expect(
      renameRowKeys(row, { overrides: { custom_field: "customField" } })
    ).toEqual({ customField: 1 });
  });

  test("collision same value: no duplicate keys", () => {
    const row = {
      heart_rate: 100,
      heartRate: 100,
    };
    const out = renameRowKeys(row);
    expect(out.heartRate).toBe(100);
    expect(Object.keys(out).sort()).toEqual(["heartRate"]);
  });

  test("collision different value: first sorted key wins target", () => {
    const row = {
      heart_rate: 99,
      heartRate: 100,
    };
    const out = renameRowKeys(row);
    expect(out.heartRate).toBe(100);
  });
});
