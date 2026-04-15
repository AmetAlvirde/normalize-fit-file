# DotFit — developer onboarding

DotFit turns **Garmin FIT** (`.fit`) binaries into **JSON**: a raw parse plus
a **normalized** shape with Garmin-style field names, optional Stryd label
normalization, and shared metadata/session/lap/record sections.

## Prerequisites

- **[Bun](https://bun.sh)** (the CLI scripts use `bun run`).

From the repo root:

```bash
bun install
```

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization
(`normalizeFFP` in [`src/parse-ffp.ts`](../src/parse-ffp.ts)):

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

If you omit the path, the default sample file `fits/build-26.fit` is used.

**Outputs** (written under `output/`):

| File                                     | Contents                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output/fit-file-parser-raw.json`        | Parser output (`sessions`, `laps`, `records`, `file_ids`, …) before your normalizers.                                                                                                                 |
| `output/fit-file-parser-normalized.json` | **`NormalizedFitData`**: `metadata`, `deviceInfo`, `session`, `laps`, `records` with Garmin-like camelCase keys and Stryd display labels normalized (see [stryd-fit-fields.md](stryd-fit-fields.md)). |

**Large files:** downsample record rows for smaller JSON while debugging:

```bash
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see `parseSampleArg` in [`src/normalize.ts`](../src/normalize.ts)).

## Optional: Garmin SDK parse (reference / comparison)

For a second opinion or diffing against the official decoder:

```bash
bun run parse:garmin -- path/to/your/activity.fit
```

Outputs: `output/garmin-sdk-raw.json` and `output/garmin-sdk-normalized.json`.

After generating both normalized files, you can run:

```bash
bun run compare
```

This writes `output/comparison-report.json` (field coverage and value checks
between the two parsers). See [followup-key-aliasing.md](followup-key-aliasing.md)
for how naming relates to comparisons.

## Use as a library (TypeScript)

1. Copy or depend on this package and import **`normalizeFFP`**
   from [`src/parse-ffp.ts`](../src/parse-ffp.ts) (or expose it via your own entry point).
2. Read the `.fit` file into an `ArrayBuffer`, call
   `FitParser`’s `parseAsync` (same options as in `parseFitBuffer`), then pass
   the result to **`normalizeFFP(raw)`**.
3. Types: **`NormalizedFitData`** and related types live
   in [`src/normalize.ts`](../src/normalize.ts).

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `bun run parse:ffp`    | Parse FIT → raw + normalized JSON (recommended).                        |
| `bun run parse:garmin` | Parse FIT with `@garmin/fitsdk` → raw + normalized JSON.                |
| `bun run compare`      | Compare the two normalized outputs (expects existing `output/*` files). |
| `bun test`             | Unit tests.                                                             |
| `bun run typecheck`    | `tsc --noEmit`.                                                         |

## Further reading

- [stryd-fit-fields.md](stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](followup-key-aliasing.md) — key naming vs compare tool.
