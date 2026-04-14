# Follow-up: canonical key aliasing (optional)

After the `fit-file-parser` 2.3.3 upgrade, comparison reports may still show many `garminOnly` / `ffpOnly` fields that are **naming mirrors** (camelCase vs snake_case) rather than missing data.

**Suggested separate change (not part of the upgrade PR):**

1. Add a small map from FFP/Garmin field names to a canonical name in `normalizeFFP` / `normalizeGarmin`, or
2. Teach `compare.ts` to normalize keys before `fieldCoverage` and `valueAgreement`.

This reduces noise when choosing a library or validating parsers.
