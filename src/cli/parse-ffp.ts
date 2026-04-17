import { readFile } from "node:fs/promises";
import { bufferToArrayBuffer } from "../buffer";
import { downsampleRecords, writeOutput } from "../normalize";
import { normalizeFFP, parseFitBuffer } from "../parse-ffp";
import { parseCliArgs, rawOutputPath } from "./fit-path";

export async function runParseFfpCli(argv: string[]): Promise<void> {
  let args;
  try {
    args = parseCliArgs(argv);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Error: ${msg}`);
    console.error("");
    console.error(
      "Usage: normalize-fit-file parse-ffp <file.fit> [-f json|yaml] [-o path] [-r] [-s N]"
    );
    console.error(
      "Example: normalize-fit-file parse-ffp path/to/activity.fit --sample 10 --raw"
    );
    process.exit(1);
  }

  const nodeBuf = await readFile(args.fitPath);
  const raw = await parseFitBuffer(bufferToArrayBuffer(nodeBuf));

  let rawPath: string | undefined;
  if (args.raw) {
    rawPath = rawOutputPath(args.output);
    await writeOutput(rawPath, raw, args.format);
  }

  let normalized = normalizeFFP(raw);
  if (args.sample !== undefined) {
    normalized = {
      ...normalized,
      records: downsampleRecords(normalized.records, args.sample),
    };
  }

  await writeOutput(args.output, normalized, args.format);

  console.log("fit-file-parser parse complete");
  console.log(`  FIT: ${args.fitPath}`);
  if (rawPath != null) {
    console.log(`  Raw: ${rawPath}`);
  }
  console.log(`  Normalized: ${args.output}`);
  console.log(
    `  Records: ${normalized.records.length}${args.sample != null ? ` (sample every ${args.sample})` : ""}`
  );
  console.log(`  Laps: ${normalized.laps.length}`);
  console.log(`  Device rows: ${normalized.deviceInfo.length}`);
  const keys = (o: Record<string, unknown>) => Object.keys(o).length;
  console.log(
    `  Field counts — metadata: ${keys(normalized.metadata)}, session: ${keys(normalized.session)}`
  );
}
