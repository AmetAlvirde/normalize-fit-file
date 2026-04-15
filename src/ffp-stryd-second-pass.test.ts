import { describe, expect, test } from "bun:test";
import { renameRowKeys } from "./ffp-garmin-field-names";
import {
  STRYD_LABEL_TO_CAMEL,
  labelToCamelKey,
  renameStrydRowKeys,
} from "./ffp-stryd-second-pass";

describe("labelToCamelKey", () => {
  test("multi-word display labels", () => {
    expect(labelToCamelKey("Air Power")).toBe("airPower");
    expect(labelToCamelKey("Impact Loading Rate Balance")).toBe(
      "impactLoadingRateBalance"
    );
  });

  test("normalizes spacing", () => {
    expect(labelToCamelKey("  Foo   Bar  ")).toBe("fooBar");
  });

  test("empty and whitespace", () => {
    expect(labelToCamelKey("")).toBe("");
    expect(labelToCamelKey("   ")).toBe("");
  });

  test("single word lowercases", () => {
    expect(labelToCamelKey("Hello")).toBe("hello");
  });
});

describe("STRYD_LABEL_TO_CAMEL", () => {
  test("known Stryd display labels map to expected camelCase", () => {
    expect(STRYD_LABEL_TO_CAMEL["Air Power"]).toBe("airPower");
    expect(STRYD_LABEL_TO_CAMEL["Run Profile"]).toBe("runProfile");
    expect(STRYD_LABEL_TO_CAMEL.Speed).toBe("strydSpeed");
    expect(STRYD_LABEL_TO_CAMEL.Distance).toBe("strydDistance");
  });
});

describe("renameStrydRowKeys", () => {
  test("maps explicit labels and preserves FIT-like keys", () => {
    const row = {
      heartRate: 120,
      "Air Power": 180,
      Speed: 3.5,
      distance: 1000,
    };
    expect(renameStrydRowKeys(row)).toEqual({
      heartRate: 120,
      airPower: 180,
      strydSpeed: 3.5,
      distance: 1000,
    });
  });

  test("does not clobber FIT speed when Stryd Speed is present", () => {
    const row = { speed: 2.5, Speed: 3.6 };
    const out = renameStrydRowKeys(row);
    expect(out.speed).toBe(2.5);
    expect(out.strydSpeed).toBe(3.6);
  });

  test("idempotent second pass", () => {
    const once = renameStrydRowKeys({
      "Air Power": 1,
      "Run Profile": "x",
    });
    const twice = renameStrydRowKeys(once);
    expect(twice).toEqual(once);
  });

  test("chained pass1 then pass2 on Stryd-style record", () => {
    const raw = {
      heart_rate: 100,
      "Form Power": 200,
      elapsed_time: 1,
    };
    const p1 = renameRowKeys(raw);
    const p2 = renameStrydRowKeys(p1);
    expect(p2).toEqual({
      heartRate: 100,
      formPower: 200,
      elapsedTime: 1,
    });
  });

  test("fallback multi-word unknown label when target is free", () => {
    const row = { "Future Stryd Metric": 42 };
    const out = renameStrydRowKeys(row);
    expect(out).toEqual({ futureStrydMetric: 42 });
  });

  test("collision with same target: first key in sort order wins", () => {
    const row = {
      "Future Stryd Metric": 2,
      futureStrydMetric: 1,
    };
    const out = renameStrydRowKeys(row);
    expect(out.futureStrydMetric).toBe(2);
  });

  test("extraMap for tests", () => {
    const row = { "Custom Label": 1 };
    const out = renameStrydRowKeys(row, {
      extraMap: { "Custom Label": "customLabel" },
    });
    expect(out).toEqual({ customLabel: 1 });
  });

  test("fallbackMultiWord false: unknown multi-word key unchanged", () => {
    const row = { "Unknown Metric Name": 1 };
    expect(renameStrydRowKeys(row, { fallbackMultiWord: false })).toEqual(row);
  });
});
