import { readFile } from "node:fs/promises";
import { Decoder, Stream } from "@garmin/fitsdk";
import {
  downsampleRecords,
  parseSampleArg,
  writeOutput,
} from "../normalize";
import { normalizeGarmin } from "../parse-garmin";
import { parseFitPath } from "./fit-path";

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
  const fitPath = parseFitPath(argv);
  if (fitPath == null) {
    console.error("Error: no .fit file path provided.");
    console.error("");
    console.error("Usage: bun run parse:garmin -- <file.fit> [--sample N]");
    console.error(
      "Example: bun run parse:garmin -- path/to/activity.fit --sample 10"
    );
    console.error(
      "This repo ships fits/build-26.fit for local testing; pass that path if you want to use it."
    );
    process.exit(1);
  }
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
