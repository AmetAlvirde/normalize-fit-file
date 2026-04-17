import { runCompareCli } from "./compare";
import { runParseFfpCli } from "./parse-ffp";
import { runParseGarminCli } from "./parse-garmin";

function printHelp(): void {
  console.log(`normalize-fit-file — FIT parse and compare utilities

Usage:
  normalize-fit-file parse-ffp <file.fit> [options]
  normalize-fit-file parse-garmin <file.fit> [options]
  normalize-fit-file compare <fileA> <fileB> [options]

Options (parse-ffp / parse-garmin):
  -f, --format <json|yaml>   Output format (default: json)
  -o, --output <path>        Output file or directory (default: ./<input-name>.<format>)
  -r, --raw                  Also write raw parser output
  -s, --sample <N>           Keep every Nth record
  -h, --help                 Show this help

Options (compare):
  -f, --format <json|yaml>   Report format (default: json; inferred from -o extension)
  -o, --output <path>        Report path (default: ./comparison-report.<format>)

The package bundles fit-file-parser for parse-ffp. parse-garmin uses @garmin/fitsdk (optional dependency; add it if not installed).
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
