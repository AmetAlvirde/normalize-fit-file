# DotFit

DotFit turns **Garmin FIT** (`.fit`) binaries into **JSON**: a raw parse plus
a **normalized** shape with Garmin-style field names, **Stryd/vendor display
labels mapped to camelCase** (fit-file-parser path), and shared
metadata/session/lap/record sections.

## Prerequisites

- **Node.js 18+** (for the published CLI and library).
- **[Bun](https://bun.sh)** (optional; used in this repo to run TypeScript dev
  scripts without a prior `build`).

From the repo root:

```bash
bun install
# or: pnpm install / npm install
```

## CLI (`dotfit` command)

After `npm install dotfit` (or pnpm/yarn/bun), install the peer parser(s) you
need, then run:

```bash
npx dotfit parse-ffp path/to/your/activity.fit
npx dotfit parse-garmin path/to/your/activity.fit
npx dotfit compare
```

- **`parse-ffp`** requires **`fit-file-parser`** as a dependency.
- **`parse-garmin`** requires **`@garmin/fitsdk`**.
- **`compare`** reads `output/garmin-sdk-normalized.json` and `output/fit-file-parser-normalized.json` (run both parsers first).

Use `npx dotfit help` (or `-h`, `--help`) for usage. **Bun** users can run the
same with `bunx dotfit …`.

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization
(`normalizeFFP` in [`src/parse-ffp.ts`](src/parse-ffp.ts); also exported
from the package entry `dotfit` after `pnpm build`):

**From the published package:**

```bash
npx dotfit parse-ffp path/to/your/activity.fit
```

**In this repository** (Bun runs the router in TypeScript):

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

You must pass a path to a `.fit` file; running with no file exits with an error.
The **git repository** includes **`fits/build-26.fit`** as a sample for local
testing and maintainer workflows; pass that path explicitly, or run
**`bun run parse:ffp:sample`** (Garmin: **`parse:garmin:sample`**).

The published npm package only contains **`dist/`**, so that sample file is
not installed with `npm install dotfit`—use your own `.fit` or clone the
repo if you want the sample.

**Outputs** (written under `output/`):

| File                                     | Contents                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output/fit-file-parser-raw.json`        | Parser output (`sessions`, `laps`, `records`, `file_ids`, …) before your normalizers.                                                                                                                      |
| `output/fit-file-parser-normalized.json` | **`NormalizedFitData`**: `metadata`, `deviceInfo`, `session`, `laps`, `records` with Garmin-like camelCase keys and Stryd display labels normalized (see [stryd-fit-fields.md](docs/stryd-fit-fields.md)). |

**Large files:** downsample record rows for smaller JSON while debugging:

```bash
npx dotfit parse-ffp path/to/activity.fit --sample 10
# repo (Bun):
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see `parseSampleArg` in [`src/normalize.ts`](src/normalize.ts)).

## Optional: Garmin SDK parse (reference / comparison)

For a second opinion or diffing against the official decoder:

```bash
npx dotfit parse-garmin path/to/your/activity.fit
# repo:
bun run parse:garmin -- path/to/your/activity.fit
```

A `.fit` path is required (same behavior as `parse-ffp`). Use **`bun run parse:garmin:sample`** in the repo to run against `fits/build-26.fit`.

Outputs: `output/garmin-sdk-raw.json` and `output/garmin-sdk-normalized.json`.

After generating both normalized files, you can run:

```bash
npx dotfit compare
# repo:
bun run compare
```

This writes `output/comparison-report.json` (field coverage and value checks
between the two parsers). See [followup-key-aliasing.md](docs/followup-key-aliasing.md)
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
   [`src/index.ts`](src/index.ts)).

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                              | Purpose                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `npx dotfit parse-ffp <file.fit>`    | Published CLI: parse FIT → raw + normalized JSON (**path required**). |
| `npx dotfit parse-garmin <file.fit>` | Published CLI: Garmin SDK parse (**path required**).                  |
| `npx dotfit compare`                 | Published CLI: compare normalized outputs in `output/`.               |
| `bun run parse:ffp -- <file.fit>`    | Repo dev: same via Bun + `src/cli/dotfit.ts`.                         |
| `bun run parse:ffp:sample`           | Repo: sample `fits/build-26.fit`.                                     |
| `bun run parse:garmin -- <file.fit>` | Repo dev: Garmin path.                                                |
| `bun run parse:garmin:sample`        | Repo: sample FIT.                                                     |
| `bun run compare`                    | Repo dev: compare.                                                    |
| `bun test`                           | Unit tests.                                                           |
| `pnpm run typecheck`                 | `tsc --noEmit`.                                                       |
| `pnpm run build`                     | Build `dist/` (library + `dotfit` CLI).                               |

## Further reading

- [docs/README.md](docs/README.md) — developer onboarding (duplicate detail).
- [stryd-fit-fields.md](docs/stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](docs/followup-key-aliasing.md) — key naming vs compare tool.
