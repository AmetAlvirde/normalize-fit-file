import { readFile } from "node:fs/promises";
import {
  downsampleRecords,
  parseSampleArg,
  writeOutput,
} from "../normalize";
import { normalizeFFP, parseFitBuffer } from "../parse-ffp";

const DEFAULT_FIT = "fits/build-26.fit";
const OUT_RAW = "output/fit-file-parser-raw.json";
const OUT_NORM = "output/fit-file-parser-normalized.json";

function bufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength
  ) as ArrayBuffer;
}

async function main() {
  const argv = process.argv.slice(2);
  const fitPath = argv[0] && !argv[0].startsWith("-") ? argv[0] : DEFAULT_FIT;
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
