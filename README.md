# normalize-fit-file

**normalize-fit-file** turns **FIT** (`.fit`) binaries from **Garmin**, **Stryd**
and other vendors into a **normalized** shape using **JSON, YAML, or plain objects**
and compares them systematically.

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
`parse-garmin` / `normalizeGarmin`).

### Subcommands

```bash
npx normalize-fit-file parse-ffp <file.fit> [options]
npx normalize-fit-file parse-garmin <file.fit> [options]
npx normalize-fit-file compare <fileA> <fileB> [options]
```

- **`parse-ffp`** uses the bundled **`fit-file-parser`** dependency.
- **`parse-garmin`** uses **`@garmin/fitsdk`**, declared as an **optional dependency**
  of this package (npm tries to install it alongside `normalize-fit-file`).
- **`compare`** loads two **already normalized** files (JSON or YAML), compares
  field coverage and scalar values, and writes a report. Report keys use
  **labels derived from each input filename** (basename without extension)—for
  example `race-garminOnly` / `race-ffpOnly` and per-field mismatch rows keyed
  by those labels (see the header comment in [`src/cli/compare.ts`](src/cli/compare.ts)).

Use `npx normalize-fit-file help` (or `-h`, `--help`) for usage. **Bun** users
can run the same with `bunx normalize-fit-file …`.

### Options: `parse-ffp` and `parse-garmin`

| Option                    | Meaning                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `-f`, `--format`          | Output format: **json** or **yaml** (default: **json**; can be inferred from `-o` when it is a file with `.json`, `.yaml`, or `.yml`).                                                                                         |
| `-o`, `--output` `<path>` | Output **file** or **directory**. If omitted, writes **`<basename>.<format>`** in the current working directory (`<basename>` comes from the `.fit` filename). If `-o` is a directory, writes **`<dir>/<basename>.<format>`**. |
| `-r`, `--raw`             | Also write **raw** parser output next to the normalized file: same path with **`-raw`** inserted before the extension (e.g. `activity.json` → `activity-raw.json`).                                                            |
| `-s`, `--sample` `<N>`    | Keep every **N**th record row (1-based: first kept, then every Nth).                                                                                                                                                           |

### Options: `compare`

| Option                    | Meaning                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `-f`, `--format`          | Report format: **json** or **yaml** (default: **json**; inferred from `-o` when it is a file with a matching extension).    |
| `-o`, `--output` `<path>` | Report **file** or **directory**. Default report path: **`./comparison-report.<format>`** in the current working directory. |

You must pass a `.fit` path to `parse-ffp` / `parse-garmin`; running without it exits with an error. **`compare` requires two positional paths** to normalized JSON/YAML files.

Keep personal activity files out of git (see `.gitignore`: e.g. `sample-fits/`, `fits/*.fit`).

The published npm package ships **`dist/`** only—use your own `.fit` paths when running the CLI.

## Parse your own FIT file (recommended path)

The default pipeline uses **fit-file-parser** plus normalization (`normalizeFFP` in
[`src/parse-ffp.ts`](src/parse-ffp.ts); exported from [`src/index.ts`](src/index.ts)):

**From the published package:**

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit
```

This writes **`activity.json`** (or **`activity.yaml`** with `-f yaml`) in the **current directory** unless you set `-o`.

**YAML example:**

```bash
npx normalize-fit-file parse-ffp path/to/your/activity.fit -f yaml -o ./out/
```

**In this repository** (Bun runs the router in TypeScript):

```bash
bun run parse:ffp -- path/to/your/activity.fit
```

**Large files:** downsample record rows while debugging:

```bash
npx normalize-fit-file parse-ffp path/to/activity.fit --sample 10
# repo (Bun):
bun run parse:ffp -- path/to/activity.fit --sample 10
```

That keeps every 10th record (see [`parseCliArgs`](src/cli/fit-path.ts)).

## Optional: Garmin SDK parse (reference / comparison)

```bash
npx normalize-fit-file parse-garmin path/to/your/activity.fit
# repo:
bun run parse:garmin -- path/to/your/activity.fit
```

Use the same **`-f`**, **`-o`**, **`-r`**, and **`-s`** options as `parse-ffp`.

### Comparing two normalized files

After you have two normalized files (e.g. from Garmin SDK vs fit-file-parser),
pass **both paths** to **`compare`**:

```bash
npx normalize-fit-file compare ./garmin-sdk-normalized.json ./fit-file-parser-normalized.json
# repo:
bun run compare -- ./garmin-sdk-normalized.json ./fit-file-parser-normalized.json
```

Default report: **`./comparison-report.json`**. Example with explicit paths and YAML:

```bash
npx normalize-fit-file compare race-garmin.json race-ffp.yaml -o report.yaml
```

See [followup-key-aliasing.md](docs/followup-key-aliasing.md) for how key naming
relates to comparisons.

## Use as a library (TypeScript / Node.js or Bun)

1. Install **`normalize-fit-file`** — **`fit-file-parser`** comes with it.
   **`@garmin/fitsdk`** is pulled in as an optional dependency when npm can install
   it; add it explicitly in your app if you need a specific version or if optional
   install was skipped.

2. **Named exports** (see [`src/index.ts`](src/index.ts)) include parsing and normalization:
   - **`normalizeFFP`**, **`parseFitBuffer`**, **`normalizeGarmin`**
   - Types: **`NormalizedFitData`**, **`WorkoutMetadata`**, **`SessionSummary`**, **`LapData`**, **`RecordData`**, **`FfpParsedFit`**, etc.
   - **`downsampleRecords`**, **`objectToHybrid`**
   - Garmin / Stryd key helpers: **`renameRowKeys`**, **`renameRowArray`**, **`snakeToCamelKey`**, **`renameStrydRowKeys`**, **`renameStrydRowArray`**, **`STRYD_LABEL_TO_CAMEL`**, and related types

3. Typical import:

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

4. Read the `.fit` file into an `ArrayBuffer`, parse with **`parseFitBuffer`**, then pass the result to **`normalizeFFP(raw)`**.

Field naming pipeline:

1. Pass 1 — [`src/ffp-garmin-field-names.ts`](src/ffp-garmin-field-names.ts):
   FIT `snake_case` → Garmin-style camelCase.
2. Pass 2 — [`src/ffp-stryd-second-pass.ts`](src/ffp-stryd-second-pass.ts):
   Stryd (and similar) display strings → camelCase; explicit map in `STRYD_LABEL_TO_CAMEL`.

## Scripts (summary)

| Command                                                 | Purpose                                                                                        |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `npx normalize-fit-file parse-ffp <file.fit> [opts]`    | Published CLI: FIT → normalized JSON/YAML (**`.fit` path required**).                          |
| `npx normalize-fit-file parse-garmin <file.fit> [opts]` | Published CLI: Garmin SDK parse (**`.fit` path required**).                                    |
| `npx normalize-fit-file compare <fileA> <fileB> [opts]` | Published CLI: compare two normalized files → report (default `./comparison-report.<format>`). |
| `bun run parse:ffp -- <file.fit> [opts]`                | Repo dev: same via Bun + `src/cli/normalize-fit-file.ts`.                                      |
| `bun run parse:garmin -- <file.fit> [opts]`             | Repo dev: Garmin path.                                                                         |
| `bun run compare -- <fileA> <fileB> [opts]`             | Repo dev: compare (pass two normalized files).                                                 |
| `bun test`                                              | Unit tests. Optional smoke: set `FIT_SMOKE_FIXTURE` to a local `.fit` (gitignored).            |
| `pnpm run typecheck`                                    | `tsc --noEmit`.                                                                                |
| `pnpm run build`                                        | Build `dist/` (library + `normalize-fit-file` CLI).                                            |

## Further reading

- [stryd-fit-fields.md](docs/stryd-fit-fields.md) — Stryd label map and maintenance.
- [followup-key-aliasing.md](docs/followup-key-aliasing.md) — key naming vs compare tool.
