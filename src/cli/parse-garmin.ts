import { readFile } from "node:fs/promises";
import { Decoder, Stream } from "@garmin/fitsdk";
import {
  downsampleRecords,
  parseSampleArg,
  writeOutput,
} from "../normalize";
import { normalizeGarmin } from "../parse-garmin";

const DEFAULT_FIT = "fits/build-26.fit";
const OUT_RAW = "output/garmin-sdk-raw.json";
const OUT_NORM = "output/garmin-sdk-normalized.json";

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
  const buf = bufferToArrayBuffer(nodeBuf);
  const stream = Stream.fromArrayBuffer(buf);
  const decoder = new Decoder(stream);

  const result = decoder.read({
    includeUnknownData: true,
    decodeMemoGlobs: true,
  });

  const rawPayload = {
    profileVersion: result.profileVersion,
    errors: result.errors,
    messages: result.messages,
  };

  await writeOutput(OUT_RAW, rawPayload);

  let normalized = normalizeGarmin(rawPayload);
  if (sampleN !== undefined) {
    normalized = {
      ...normalized,
      records: downsampleRecords(normalized.records, sampleN),
    };
  }

  await writeOutput(OUT_NORM, normalized);

  console.log("Garmin SDK parse complete");
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
  if (result.errors.length) {
    console.warn(`  Decoder reported ${result.errors.length} error(s)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
