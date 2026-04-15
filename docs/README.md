# DotFit — developer onboarding

DotFit turns **Garmin FIT** (`.fit`) binaries into **JSON**: a raw parse plus
a **normalized** shape with Garmin-style field names, **Stryd/vendor display
labels mapped to camelCase** (fit-file-parser path), and shared
metadata/session/lap/record sections.

## Prerequisites

- **Node.js 18+** for the published **`dotfit`** CLI and library.
- **[Bun](https://bun.sh)** (optional): this repo’s npm scripts use `bun run`
  to execute [`src/cli/dotfit.ts`](../src/cli/dotfit.ts) without compiling first.

From the repo root:

```bash
bun install
```

## CLI (`dotfit` command)

Consumers install **`dotfit`** and peer parser(s), then:

```bash
npx dotfit parse-ffp path/to/your/activity.fit
npx dotfit parse-garmin path/to/your/activity.fit
npx dotfit compare
```

- **`parse-ffp`** needs **`fit-file-parser`** installed.
- **`parse-garmin`** needs **`@garmin/fitsdk`**.
- **`compare`** expects prior outputs under `output/` from both parsers.

`npx dotfit help` prints usage. **Bun:** `bunx dotfit …` runs the same binary.

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization
(`normalizeFFP` in [`src/parse-ffp.ts`](../src/parse-ffp.ts); also exported from the package root as `dotfit` after `pnpm build`):

**Published package:**

```bash
npx dotfit parse-ffp path/to/your/activity.fit
```

**This repository:**

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

You must pass a path to a `.fit` file; running the command with no file exits
with an error. The **git repository** includes **`fits/build-26.fit`** as a
sample for local testing and maintainer workflows; pass that path explicitly, or
run **`bun run parse:ffp:sample`** (Garmin: **`parse:garmin:sample`**). The
published npm package only ships **`dist/`**, so the sample is not present
after `npm install dotfit`—bring your own `.fit` or clone the repo to use it.

**Outputs** (written under `output/`):

| File                                     | Contents                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output/fit-file-parser-raw.json`        | Parser output (`sessions`, `laps`, `records`, `file_ids`, …) before your normalizers.                                                                                                                 |
| `output/fit-file-parser-normalized.json` | **`NormalizedFitData`**: `metadata`, `deviceInfo`, `session`, `laps`, `records` with Garmin-like camelCase keys and Stryd display labels normalized (see [stryd-fit-fields.md](stryd-fit-fields.md)). |

**Large files:** downsample record rows for smaller JSON while debugging:

```bash
npx dotfit parse-ffp path/to/activity.fit --sample 10
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see `parseSampleArg` in [`src/normalize.ts`](../src/normalize.ts)).

## Optional: Garmin SDK parse (reference / comparison)

For a second opinion or diffing against the official decoder:

```bash
npx dotfit parse-garmin path/to/your/activity.fit
bun run parse:garmin -- path/to/your/activity.fit
```

A `.fit` path is required (same as `parse:ffp`). Use **`bun run parse:garmin:sample`** for `fits/build-26.fit`.

Outputs: `output/garmin-sdk-raw.json` and `output/garmin-sdk-normalized.json`.

After generating both normalized files, you can run:

```bash
npx dotfit compare
bun run compare
```

This writes `output/comparison-report.json` (field coverage and value checks
between the two parsers). See [followup-key-aliasing.md](followup-key-aliasing.md)
for how naming relates to comparisons.

## Use as a library (TypeScript / Node.js or Bun)

1. Install **`dotfit`** and the parser(s) you need as peer dependencies, e.g.
   `pnpm add dotfit fit-file-parser` (and/or `@garmin/fitsdk` for `normalizeGarmin`).
2. Import from the package entry point:

   ```ts
   import {
     normalizeFFP,
     parseFitBuffer,
     type NormalizedFitData,
   } from "dotfit";
   ```

3. Read the `.fit` file into an `ArrayBuffer`, parse with **`parseFitBuffer`** (or
   `FitParser`’s `parseAsync` with the same options), then pass the result to
   **`normalizeFFP(raw)`**.
4. Types such as **`NormalizedFitData`** are exported from **`dotfit`** (see
   [`src/index.ts`](../src/index.ts)).

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](../src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](../src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                              | Purpose                                            |
| ------------------------------------ | -------------------------------------------------- |
| `npx dotfit parse-ffp <file.fit>`    | Published CLI; **path required**.                  |
| `npx dotfit parse-garmin <file.fit>` | Published CLI; **path required**.                  |
| `npx dotfit compare`                 | Published CLI; expects `output/*` normalized JSON. |
| `bun run parse:ffp -- <file.fit>`    | Repo dev (Bun + `dotfit.ts`).                      |
| `bun run parse:ffp:sample`           | Repo: `fits/build-26.fit`.                         |
| `bun run parse:garmin -- <file.fit>` | Repo dev.                                          |
| `bun run parse:garmin:sample`        | Repo: sample FIT.                                  |
| `bun run compare`                    | Repo dev.                                          |
| `bun test`                           | Unit tests.                                        |
| `pnpm run typecheck`                 | `tsc --noEmit`.                                    |
| `pnpm run build`                     | `dist/` library + `dotfit.cjs` CLI.                |

## Further reading

- [stryd-fit-fields.md](stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](followup-key-aliasing.md) — key naming vs compare tool.
