# normalize-fit-file — developer onboarding

**normalize-fit-file** turns **Garmin FIT** (`.fit`) binaries into **JSON**: a raw parse plus
a **normalized** shape with Garmin-style field names, **Stryd/vendor display
labels mapped to camelCase** (fit-file-parser path), and shared
metadata/session/lap/record sections.

## Prerequisites

- **Node.js 18+** for the published **`normalize-fit-file`** CLI and library.
- **[Bun](https://bun.sh)** (optional): this repo’s npm scripts use `bun run`
  to execute [`src/cli/normalize-fit-file.ts`](../src/cli/normalize-fit-file.ts) without compiling first.

From the repo root:

```bash
bun install
```

## CLI (`normalize-fit-file` command)

Consumers install **`normalize-fit-file`** and peer parser(s), then:

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit
npx normalize-fit-file parse-garmin path/to/your/activity.fit
npx normalize-fit-file compare
```

- **`parse-ffp`** needs **`fit-file-parser`** installed.
- **`parse-garmin`** needs **`@garmin/fitsdk`**.
- **`compare`** expects prior outputs under `output/` from both parsers.

`npx normalize-fit-file help` prints usage. **Bun:** `bunx normalize-fit-file …` runs the same binary.

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization
(`normalizeFFP` in [`src/parse-ffp.ts`](../src/parse-ffp.ts); also exported from the package root as a named export after `pnpm build`—see [`src/index.ts`](../src/index.ts)):

**Published package:**

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit
```

**This repository:**

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

You must pass a path to a `.fit` file; running the command with no file exits
with an error. Do not commit personal `.fit` files; use `.gitignore` (e.g. `sample-fits/`, `fits/*.fit`).
The published npm package only ships **`dist/`**—consumers always pass their own `.fit` path.

**Outputs** (written under `output/`):

| File                                     | Contents                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output/fit-file-parser-raw.json`        | Parser output (`sessions`, `laps`, `records`, `file_ids`, …) before your normalizers.                                                                                                                 |
| `output/fit-file-parser-normalized.json` | **`NormalizedFitData`**: `metadata`, `deviceInfo`, `session`, `laps`, `records` with Garmin-like camelCase keys and Stryd display labels normalized (see [stryd-fit-fields.md](stryd-fit-fields.md)). |

**Large files:** downsample record rows for smaller JSON while debugging:

```bash
npx normalize-fit-file parse-ffp path/to/activity.fit --sample 10
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see `parseSampleArg` in [`src/normalize.ts`](../src/normalize.ts)).

## Optional: Garmin SDK parse (reference / comparison)

For a second opinion or diffing against the official decoder:

```bash
npx normalize-fit-file parse-garmin path/to/your/activity.fit
bun run parse:garmin -- path/to/your/activity.fit
```

A `.fit` path is required (same as `parse:ffp`).

Outputs: `output/garmin-sdk-raw.json` and `output/garmin-sdk-normalized.json`.

After generating both normalized files, you can run:

```bash
npx normalize-fit-file compare
bun run compare
```

This writes `output/comparison-report.json` (field coverage and value checks
between the two parsers). See [followup-key-aliasing.md](followup-key-aliasing.md)
for how naming relates to comparisons.

## Use as a library (TypeScript / Node.js or Bun)

1. Install **`normalize-fit-file`** and the parser(s) you need as peer dependencies, e.g.
   `pnpm add normalize-fit-file fit-file-parser` (and/or `@garmin/fitsdk` for `normalizeGarmin`).
2. Import from the package entry point:

   ```ts
   import {
     normalizeFFP,
     parseFitBuffer,
     type NormalizedFitData,
   } from "normalize-fit-file";
   ```

3. Read the `.fit` file into an `ArrayBuffer`, parse with **`parseFitBuffer`** (or
   `FitParser`’s `parseAsync` with the same options), then pass the result to
   **`normalizeFFP(raw)`**.
4. Types such as **`NormalizedFitData`** are exported from **`normalize-fit-file`** (see
   [`src/index.ts`](../src/index.ts)).

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                              | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `npx normalize-fit-file parse-ffp <file.fit>`    | Published CLI; **path required**.                  |
| `npx normalize-fit-file parse-garmin <file.fit>` | Published CLI; **path required**.                  |
| `npx normalize-fit-file compare`                 | Published CLI; expects `output/*` normalized JSON. |
| `bun run parse:ffp -- <file.fit>`    | Repo dev (Bun + `normalize-fit-file.ts`).                      |
| `bun run parse:garmin -- <file.fit>` | Repo dev.                                          |
| `bun run compare`                    | Repo dev.                                          |
| `bun test`                           | Unit tests. Optional smoke: `FIT_SMOKE_FIXTURE` → local `.fit`. |
| `pnpm run typecheck`                 | `tsc --noEmit`.                                    |
| `pnpm run build`                     | `dist/` library + `normalize-fit-file.cjs` CLI.                |

## Further reading

- [stryd-fit-fields.md](stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](followup-key-aliasing.md) — key naming vs compare tool.
