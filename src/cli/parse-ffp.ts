import { readFile } from "node:fs/promises";
import { bufferToArrayBuffer } from "../buffer";
import {
  downsampleRecords,
  parseSampleArg,
  writeOutput,
} from "../normalize";
import { normalizeFFP, parseFitBuffer } from "../parse-ffp";
import { parseFitPath } from "./fit-path";

const OUT_RAW = "output/fit-file-parser-raw.json";
const OUT_NORM = "output/fit-file-parser-normalized.json";

export async function runParseFfpCli(argv: string[]): Promise<void> {
  const fitPath = parseFitPath(argv);
  if (fitPath == null) {
    console.error("Error: no .fit file path provided.");
    console.error("");
    console.error("Usage: normalize-fit-file parse-ffp <file.fit> [--sample N]");
    console.error(
      "Example: normalize-fit-file parse-ffp path/to/activity.fit --sample 10"
    );
    process.exit(1);
  }
  const sampleN = parseSampleArg(argv);

  const nodeBuf = await readFile(fitPath);
  const raw = await parseFitBuffer(bufferToArrayBuffer(nodeBuf));

  await writeOutput(OUT_RAW, raw);

  let normalized = normalizeFFP(raw);
  if (sampleN !== undefined) {
    normalized = {
      ...normalized,
      records: downsampleRecords(normalized.records, sampleN),
    };
  }

  await writeOutput(OUT_NORM, normalized);

  console.log("fit-file-parser parse complete");
  console.log(`  FIT: ${fitPath}`);
  console.log(`  Raw: ${OUT_RAW}`);
  console.log(`  Normalized: ${OUT_NORM}`);
  console.log(
    `  Records: ${normalized.records.length}${sampleN != null ? ` (sample every ${sampleN})` : ""}`
  );
  console.log(`  Laps: ${normalized.laps.length}`);
  console.log(`  Device rows: ${normalized.deviceInfo.length}`);
  const keys = (o: Record<string, unknown>) => Object.keys(o).length;
  console.log(
    `  Field counts — metadata: ${keys(normalized.metadata)}, session: ${keys(normalized.session)}`
  );
}
