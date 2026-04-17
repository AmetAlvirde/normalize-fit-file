# Stryd display labels → camelCase (second pass)

## Purpose

fit-file-parser exposes some Stryd (and similar) **developer data** using
**human-readable object keys** (e.g. `"Air Power"`, `"Run Profile"`). After the
first pass maps standard FIT fields to Garmin-style
camelCase ([`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts)),
the second pass in [`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts)
renames those display labels to **stable camelCase** keys for a uniform JSON shape.

**Order:**
parse
→ pass 1 (FIT snake_case → camelCase)
→ pass 2 (Stryd labels → camelCase) → `NormalizedFitData`.

## Explicit map (maintain per firmware review)

The canonical list is `STRYD_LABEL_TO_CAMEL` in
[`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts). The table
below mirrors the current entries for documentation; **the source of truth
is the exported map in code.**

| Display label (FFP key)      | Normalized key               | Notes                                |
| ---------------------------- | ---------------------------- | ------------------------------------ |
| Run Profile                  | `runProfile`                 | Session-level                        |
| Air Power                    | `airPower`                   | Record                               |
| Distance                     | `strydDistance`              | Avoids collision with FIT `distance` |
| Form Power                   | `formPower`                  | Record                               |
| Impact                       | `strydImpact`                | Single-word vendor metric            |
| Impact Loading Rate Balance  | `impactLoadingRateBalance`   | Record                               |
| Leg Spring Stiffness         | `legSpringStiffness`         | Record                               |
| Leg Spring Stiffness Balance | `legSpringStiffnessBalance`  | Record                               |
| Speed                        | `strydSpeed`                 | Avoids collision with FIT `speed`    |
| Stryd Humidity               | `strydHumidity`              | Record                               |
| Stryd Temperature            | `strydTemperature`           | Record                               |
| Vertical Oscillation Balance | `verticalOscillationBalance` | Record                               |

## Fallback behavior

- **Multi-word keys** not listed in the map are renamed with `labelToCamelKey`
  (split on whitespace, camelCase) **only if** the target key is not already
  occupied by a conflicting value (same collision rules as pass 1).
- **Single-word** vendor keys are **not** guessed; add them to
  `STRYD_LABEL_TO_CAMEL` when discovered (avoids clobbering FIT fields like `speed`).

Disable fallback with `renameStrydRowKeys(row, { fallbackMultiWord: false })`
if you need map-only behavior.

## Maintenance (Stryd firmware / app updates)

If you want to help update this library when a new Stryd firmware is
published, please:

1. Export a FIT from a known activity after a Stryd firmware or ecosystem change.
2. Run `npx normalize-fit-file parse-ffp path/to/your/export.fit` (after build/install),
   or in this repo `bun run parse:ffp -- path/to/your/export.fit`, and
   inspect the **normalized output file** (by default **`<basename>.json`** in the
   current working directory, or the path you passed with `-o`)—and raw output if
   you used `-r`—for **new** display-string keys on session/lap/record rows.
3. Add entries to `STRYD_LABEL_TO_CAMEL` (use `stryd*` or another clear prefix
   when a label could collide with a standard FIT field).
4. Extend [`src/ffp-stryd-second-pass.test.ts`](../src/ffp-stryd-second-pass.test.ts)
   if you want regression coverage for new labels.
5. Update this table to match the map.

### Known Stryd tested firmware:

- **2.1.32.1.1**

## Related

- Optional compare-time key aliasing: [`docs/followup-key-aliasing.md`](followup-key-aliasing.md)
