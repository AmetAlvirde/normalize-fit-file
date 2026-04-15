# Key naming: FFP vs Garmin

## Primary layer (implemented)

Standard FIT fields from **fit-file-parser** are renamed to **Garmin SDK-style**
camelCase in [`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts),
applied inside [`normalizeFFP`](../src/parse-ffp.ts) for sessions, laps,
records, file IDs, device infos, sports, and software rows.

New normalized output should already align keys with
[`normalizeGarmin`](../src/parse-garmin.ts) wherever both parsers expose the
same field under snake_case vs camelCase.

## Optional: compare-time aliasing

You can still teach [`compare.ts`](../src/cli/compare.ts) to normalize keys before
`fieldCoverage` / `valueAgreement` if you need to diff **older** saved JSON
that predates the mapper. For current pipelines, this is unnecessary.

## Developer / vendor fields (optional follow-up)

**Current choice (minimal):** Keys that are not plain snake_case FIT
tokens—e.g. human-readable vendor labels (`"Air Power"`, `"Run Profile"`)—are
left as fit-file-parser exposes them. They do not automatically match Garmin’s
`developerFields` structure.

**Stronger parity (future):** Pack those fields into the same shape as the
Garmin SDK’s `developerFields` using fixture-driven mappings
(device/vendor specific).

## Semantic differences (not key aliasing)

Comparison may still report value mismatches for the same key (e.g. semicircle
vs degree lat/long, enum string formatting). Those require separate
value/coordinate normalization, not field renaming.
