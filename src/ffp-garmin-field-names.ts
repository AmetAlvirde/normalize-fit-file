/**
 * Map fit-file-parser (snake_case) field names to Garmin SDK-style camelCase keys.
 * Pure string utilities — no runtime dependency on @garmin/fitsdk.
 */

/** Keys that must not use automatic snake→camel (handled elsewhere or invalid). */
const SNAKE_CASE_FIT_FIELD =
  /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/;

export type RenameRowKeysOptions = {
  /** Exact source key → target key (applied before automatic rename). */
  overrides?: Readonly<Record<string, string>>;
};

/**
 * Convert `foo_bar_baz` → `fooBarBaz`. Keys that are not plain snake_case FIT-style
 * tokens are returned unchanged (single words, Title Case, mixed case, leading `_`).
 */
export function snakeToCamelKey(key: string): string {
  if (!SNAKE_CASE_FIT_FIELD.test(key)) return key;
  const parts = key.split("_");
  let out = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!;
    if (p.length === 0) continue;
    out += p.charAt(0).toUpperCase() + p.slice(1);
  }
  return out;
}

function shallowEqualValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a == null || b == null) return a === b;
  return String(a) === String(b);
}

function targetKey(
  key: string,
  overrides: Readonly<Record<string, string>> | undefined
): string {
  if (overrides && key in overrides) {
    return overrides[key]!;
  }
  return snakeToCamelKey(key);
}

/**
 * Shallow rename of object keys toward Garmin-style names.
 *
 * **Collision:** If the target key already exists, the existing value wins (first write).
 * If the skipped rename would have duplicated the same value, the source snake_case
 * key is omitted. If values differ, the first retained value wins and the conflicting
 * source key is omitted when it would overwrite.
 */
export function renameRowKeys(
  row: Record<string, unknown>,
  options?: RenameRowKeysOptions
): Record<string, unknown> {
  const overrides = options?.overrides;
  const keys = Object.keys(row).sort();
  const out: Record<string, unknown> = {};

  for (const key of keys) {
    const val = row[key];
    const nk = targetKey(key, overrides);

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
    // Target occupied with different value: keep existing (Garmin-style wins).
  }

  return out;
}

/** Rename every row in an array (new objects). */
export function renameRowArray(
  rows: Record<string, unknown>[],
  options?: RenameRowKeysOptions
): Record<string, unknown>[] {
  return rows.map((r) => renameRowKeys(r, options));
}
