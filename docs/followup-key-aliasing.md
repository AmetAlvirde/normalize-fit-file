# Key naming: FFP vs Garmin

## Primary layers (implemented)

**Pass 1 — standard FIT fields:** fit-file-parser’s snake_case keys are renamed to
**Garmin SDK–style camelCase** in
[`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts), applied inside
[`normalizeFFP`](../src/parse-ffp.ts) for sessions, laps, records, file IDs,
device infos, sports, and software rows.

**Pass 2 — Stryd / vendor display labels:** Human-readable keys such as
`"Air Power"` and `"Run Profile"` are converted to **stable camelCase** in
[`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts) (explicit map
`STRYD_LABEL_TO_CAMEL`, optional multi-word fallback; see
[stryd-fit-fields.md](stryd-fit-fields.md)). Pass 2 runs **after** pass 1 on the
same row arrays.

Together, normalized FFP output should align with
[`normalizeGarmin`](../src/parse-garmin.ts) wherever both parsers expose the
same conceptual field (allowing for remaining semantic/value differences).

## Compare CLI: basename-derived keys (current behavior)

The [`compare`](../src/cli/compare.ts) command takes **two normalized file paths**.
The report does **not** use fixed keys like `garmin` / `ffp`. Instead, each input’s
**basename without extension** becomes a **label** (see the module comment in
`compare.ts`). Field coverage uses keys such as `<labelA>Only` / `<labelB>Only`,
and scalar mismatch rows repeat those labels as dynamic property names for the two
values being compared.

## Optional: compare-time aliasing

You can still teach [`compare.ts`](../src/cli/compare.ts) to normalize keys before
`fieldCoverage` / `valueAgreement` if you need to diff **older** saved JSON
that predates these mappers. For current pipelines, this is unnecessary.

## Garmin `developerFields` shape (future / stronger parity)

**Current behavior:** Rows stay **flat** key/value objects with camelCase names.
Vendor metrics are **not** reorganized into the same nested structure as the
Garmin SDK’s `developerFields` (that would be device- and profile-specific).

**Stronger parity (future):** Pack those fields into the same shape as the
Garmin SDK’s `developerFields` using fixture-driven mappings
(device/vendor specific).

## Semantic differences (not key aliasing)

Comparison may still report value mismatches for the same key (e.g. semicircle
vs degree lat/long, enum string formatting). Those require separate
value/coordinate normalization, not field renaming.
