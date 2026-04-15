import { runCompareCli } from "./compare";
import { runParseFfpCli } from "./parse-ffp";
import { runParseGarminCli } from "./parse-garmin";

function printHelp(): void {
  console.log(`dotfit — FIT parse and compare utilities

Usage:
  dotfit parse-ffp <file.fit> [--sample N]
  dotfit parse-garmin <file.fit> [--sample N]
  dotfit compare

Install peer dependencies as needed: fit-file-parser (parse-ffp), @garmin/fitsdk (parse-garmin).
`);
}

async function main(): Promise<void> {
  const sub = process.argv[2];
  const rest = process.argv.slice(3);

  if (sub == null || sub === "help" || sub === "-h" || sub === "--help") {
    printHelp();
    process.exit(0);
  }

  if (sub === "parse-ffp") {
    await runParseFfpCli(rest);
    return;
  }
  if (sub === "parse-garmin") {
    await runParseGarminCli(rest);
    return;
  }
  if (sub === "compare") {
    await runCompareCli(rest);
    return;
  }

  console.error(`Unknown command: ${sub}\n`);
  printHelp();
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
