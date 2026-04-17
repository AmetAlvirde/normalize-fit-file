# normalize-fit-file

**normalize-fit-file** turns **Garmin FIT** (`.fit`) binaries into **JSON**: a
raw parse plus a **normalized** shape with Garmin-style field names,
**Stryd/vendor display labels mapped to camelCase** (fit-file-parser path), and
shared metadata/session/lap/record sections.

## Prerequisites

- **Node.js 18+** (for the published CLI and library).
- **[Bun](https://bun.sh)** (optional; used in this repo to run TypeScript dev
  scripts without a prior `build`).

From the repo root:

```bash
bun install
# or: pnpm install / npm install
```

## CLI (`normalize-fit-file` command)

After `npm install normalize-fit-file` (or pnpm/yarn/bun), **`fit-file-parser`
is installed automatically** as a dependency. **`@garmin/fitsdk`** is an
**optional dependency** (npm installs it when possible; it is only needed for
`parse-garmin` / `normalizeGarmin`). Then run:

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit
npx normalize-fit-file parse-garmin path/to/your/activity.fit
npx normalize-fit-file compare
```

- **`parse-ffp`** uses the bundled **`fit-file-parser`** dependency.
- **`parse-garmin`** uses **`@garmin/fitsdk`**, declared as an **optional dependency**
  of this package (npm tries to install it alongside `normalize-fit-file`).
- **`compare`** reads `output/garmin-sdk-normalized.json` and
  `output/fit-file-parser-normalized.json` (run both parsers first).

Use `npx normalize-fit-file help` (or `-h`, `--help`) for usage. **Bun** users
can run the same with `bunx normalize-fit-file …`.

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization
(`normalizeFFP` in [`src/parse-ffp.ts`](src/parse-ffp.ts); also exported
from the package root as a named export after `pnpm build`—see [`src/index.ts`](src/index.ts)):

**From the published package:**

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit
```

**In this repository** (Bun runs the router in TypeScript):

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

You must pass a path to a `.fit` file; running with no file exits with an error.
Keep personal activity files out of git (see `.gitignore`: e.g. `sample-fits/`, `fits/*.fit`).

The published npm package only contains **`dist/`**—use your own `.fit` paths
when running the CLI.

**Outputs** (written under `output/`):

| File                                     | Contents                                                                                                                                                                                                   |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `output/fit-file-parser-raw.json`        | Parser output (`sessions`, `laps`, `records`, `file_ids`, …) before your normalizers.                                                                                                                      |
| `output/fit-file-parser-normalized.json` | **`NormalizedFitData`**: `metadata`, `deviceInfo`, `session`, `laps`, `records` with Garmin-like camelCase keys and Stryd display labels normalized (see [stryd-fit-fields.md](docs/stryd-fit-fields.md)). |

**Large files:** downsample record rows for smaller JSON while debugging:

```bash
npx normalize-fit-file parse-ffp path/to/activity.fit --sample 10
# repo (Bun):
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see `--sample` / `-s` in [`src/cli/fit-path.ts`](src/cli/fit-path.ts) via `parseCliArgs`).

## Optional: Garmin SDK parse (reference / comparison)

For a second opinion or diffing against the official decoder:

```bash
npx normalize-fit-file parse-garmin path/to/your/activity.fit
# repo:
bun run parse:garmin -- path/to/your/activity.fit
```

A `.fit` path is required (same behavior as `parse-ffp`).

Outputs: `output/garmin-sdk-raw.json` and `output/garmin-sdk-normalized.json`.

After generating both normalized files, you can run:

```bash
npx normalize-fit-file compare
# repo:
bun run compare
```

This writes `output/comparison-report.json` (field coverage and value checks
between the two parsers). See [followup-key-aliasing.md](docs/followup-key-aliasing.md)
for how naming relates to comparisons.

## Use as a library (TypeScript / Node.js or Bun)

1. Install **`normalize-fit-file`** — **`fit-file-parser`** comes with it.
   **`@garmin/fitsdk`** is pulled in as an optional dependency when npm can install
   it; add it explicitly in your app if you need a specific version or if optional
   install was skipped.
2. Import from the package entry point:

   ```ts
   import {
     normalizeFFP,
     parseFitBuffer,
     type NormalizedFitData,
   } from "normalize-fit-file";
   ```

   **`normalizeFFP`** returns a **plain JavaScript object** (`NormalizedFitData`)
   you can read, spread, and assign to like any other JSON-shaped data:

   ```ts
   import { readFile } from "node:fs/promises";
   import {
     normalizeFFP,
     parseFitBuffer,
     type NormalizedFitData,
   } from "normalize-fit-file";

   const fitPath = "path/to/your/activity.fit";
   const fitFileBuffer = await readFile(fitPath);
   const arrayBuffer = fitFileBuffer.buffer.slice(
     fitFileBuffer.byteOffset,
     fitFileBuffer.byteOffset + fitFileBuffer.byteLength,
   ) as ArrayBuffer;

   const raw = await parseFitBuffer(arrayBuffer);
   const data: NormalizedFitData = normalizeFFP(raw);

   // Plain object: metadata, deviceInfo, session, laps, records
   console.log(data.records.length, data.session.totalTimerTime);
   const edited: NormalizedFitData = {
     ...data,
     session: { ...data.session /* add or override fields */ },
   };
   ```

   With **Bun**, you can skip the `Buffer` conversion:
   `await parseFitBuffer(await Bun.file(fitPath).arrayBuffer())`, then `normalizeFFP` as above.

3. Read the `.fit` file into an `ArrayBuffer`, parse with **`parseFitBuffer`** (or
   `FitParser`’s `parseAsync` with the same options), then pass the result to
   **`normalizeFFP(raw)`** — the result is the manipulable object shown above.
4. Types such as **`NormalizedFitData`** are exported from **`normalize-fit-file`** (see
   [`src/index.ts`](src/index.ts)).

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                                          | Purpose                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `npx normalize-fit-file parse-ffp <file.fit>`    | Published CLI: parse FIT → raw + normalized JSON (**path required**).               |
| `npx normalize-fit-file parse-garmin <file.fit>` | Published CLI: Garmin SDK parse (**path required**).                                |
| `npx normalize-fit-file compare`                 | Published CLI: compare normalized outputs in `output/`.                             |
| `bun run parse:ffp -- <file.fit>`                | Repo dev: same via Bun + `src/cli/normalize-fit-file.ts`.                           |
| `bun run parse:garmin -- <file.fit>`             | Repo dev: Garmin path.                                                              |
| `bun run compare`                                | Repo dev: compare.                                                                  |
| `bun test`                                       | Unit tests. Optional smoke: set `FIT_SMOKE_FIXTURE` to a local `.fit` (gitignored). |
| `pnpm run typecheck`                             | `tsc --noEmit`.                                                                     |
| `pnpm run build`                                 | Build `dist/` (library + `normalize-fit-file` CLI).                                 |

## Further reading

- [stryd-fit-fields.md](docs/stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](docs/followup-key-aliasing.md) — key naming vs compare tool.
