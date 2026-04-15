/**
 * Second pass: Stryd (and similar) human-readable FIT developer **display labels** → camelCase.
 * Runs after [`renameRowKeys`](./ffp-garmin-field-names.ts) so FIT snake_case is already Garmin-style.
 *
 * Source of truth for known labels: `STRYD_LABEL_TO_CAMEL`. Extend when reviewing Stryd firmware releases.
 */

export const STRYD_LABEL_TO_CAMEL: Readonly<Record<string, string>> = {
  // Session (developer / display keys seen on fit-file-parser session objects)
  "Run Profile": "runProfile",

  // Record — explicit map; single-word Stryd metrics use `stryd*` where they could collide with FIT fields
  "Air Power": "airPower",
  Distance: "strydDistance",
  "Form Power": "formPower",
  Impact: "strydImpact",
  "Impact Loading Rate Balance": "impactLoadingRateBalance",
  "Leg Spring Stiffness": "legSpringStiffness",
  "Leg Spring Stiffness Balance": "legSpringStiffnessBalance",
  Speed: "strydSpeed",
  "Stryd Humidity": "strydHumidity",
  "Stryd Temperature": "strydTemperature",
  "Vertical Oscillation Balance": "verticalOscillationBalance",
};

const MULTI_WORD_DISPLAY = /\s/;

function shallowEqualValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  return String(a) === String(b);
}

/**
 * Turn a space-separated display label into camelCase (`"Air Power"` → `airPower`).
 * Empty or whitespace-only input returns the trimmed string (may be `""`).
 */
export function labelToCamelKey(label: string): string {
  const t = label.trim();
  if (!t) return t;
  const parts = t.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return "";
  let out = parts[0]!.toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    out += p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  return out;
}

export type RenameStrydRowKeysOptions = {
  /** Merged with `STRYD_LABEL_TO_CAMEL` (test hooks / local overrides). */
  extraMap?: Readonly<Record<string, string>>;
  /**
   * If true (default), keys not in the explicit map that contain whitespace are renamed with
   * `labelToCamelKey` only when the target key is not already set to a different value.
   */
  fallbackMultiWord?: boolean;
};

function mergedMap(
  extra: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> {
  if (!extra || Object.keys(extra).length === 0) return STRYD_LABEL_TO_CAMEL;
  return { ...STRYD_LABEL_TO_CAMEL, ...extra };
}

function resolveTargetKey(
  key: string,
  map: Readonly<Record<string, string>>,
  fallbackMultiWord: boolean
): string {
  if (key in map) return map[key]!;
  if (fallbackMultiWord && MULTI_WORD_DISPLAY.test(key)) {
    return labelToCamelKey(key);
  }
  return key;
}

/**
 * Shallow rename of display-label keys to camelCase. Collision policy matches pass 1:
 * sorted iteration; first write wins; duplicate equal values skipped; conflicting values keep first.
 */
export function renameStrydRowKeys(
  row: Record<string, unknown>,
  options?: RenameStrydRowKeysOptions
): Record<string, unknown> {
  const map = mergedMap(options?.extraMap);
  const fallbackMultiWord = options?.fallbackMultiWord !== false;
  const keys = Object.keys(row).sort();
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    const val = row[key];
    const nk = resolveTargetKey(key, map, fallbackMultiWord);
    if (nk === key) {
      if (!(key in out)) out[key] = val;
      continue;
    }

    if (!(nk in out)) {
      out[nk] = val;
      continue;
    }

    if (shallowEqualValues(out[nk], val)) {
      continue;
    }
  }

  return out;
}

/** Map second pass over an array of rows. */
export function renameStrydRowArray(
  rows: Record<string, unknown>[],
  options?: RenameStrydRowKeysOptions
): Record<string, unknown>[] {
  return rows.map((r) => renameStrydRowKeys(r, options));
}
