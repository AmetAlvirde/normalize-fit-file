import { existsSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";

export type CliArgs = {
  fitPath: string;
  format: "json" | "yaml";
  output: string;
  raw: boolean;
  sample: number | undefined;
};

export type CompareArgs = {
  fileA: string;
  fileB: string;
  labelA: string;
  labelB: string;
  format: "json" | "yaml";
  output: string;
};

function labelFromPath(filePath: string): string {
  const base = basename(filePath);
  return base.replace(/\.[^.]+$/, "") || base;
}

function parseFormatValue(value: string): "json" | "yaml" {
  const v = value.toLowerCase();
  if (v === "json") return "json";
  if (v === "yaml") return "yaml";
  throw new Error(`Invalid --format value: ${value} (expected json or yaml)`);
}

function inferFormatFromOutputPath(outputPath: string): "json" | "yaml" | undefined {
  const lower = outputPath.toLowerCase();
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) return "yaml";
  if (lower.endsWith(".json")) return "json";
  return undefined;
}

function isOutputDirectory(outputPath: string): boolean {
  if (outputPath.endsWith("/") || outputPath.endsWith("\\")) return true;
  try {
    return existsSync(outputPath) && statSync(outputPath).isDirectory();
  } catch {
    return false;
  }
}

function readOptionValue(
  argv: string[],
  i: number,
  flagLabel: string
): { value: string; endIndex: number } {
  const token = argv[i]!;
  const eq = token.indexOf("=");
  if (eq !== -1) {
    const value = token.slice(eq + 1);
    if (value === "") throw new Error(`${flagLabel} requires a value`);
    return { value, endIndex: i };
  }
  const next = argv[i + 1];
  if (next == null || next.startsWith("-")) {
    throw new Error(`${flagLabel} requires a value`);
  }
  return { value: next, endIndex: i + 1 };
}

/**
 * Inserts `-raw` before the file extension (e.g. `a.json` → `a-raw.json`).
 * Paths without a usable extension get `-raw` appended.
 */
export function rawOutputPath(outputPath: string): string {
  const dot = outputPath.lastIndexOf(".");
  const base = dot === -1 ? outputPath : outputPath.slice(0, dot);
  const hasExtension =
    dot > 0 &&
    dot < outputPath.length - 1 &&
    base.length > 0 &&
    !base.endsWith("/") &&
    !base.endsWith("\\");
  if (!hasExtension) return `${outputPath}-raw`;
  return `${outputPath.slice(0, dot)}-raw${outputPath.slice(dot)}`;
}

/**
 * Parses parse-ffp / parse-garmin argv (subcommand args only, not full `process.argv`).
 */
export function parseCliArgs(argv: string[]): CliArgs {
  let formatExplicit: "json" | "yaml" | undefined;
  let outputOpt: string | undefined;
  let raw = false;
  let sample: number | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "-f" || a === "--format" || a.startsWith("-f=") || a.startsWith("--format=")) {
      const label = a.startsWith("--") ? "--format" : "-f";
      const { value, endIndex } = readOptionValue(argv, i, label);
      formatExplicit = parseFormatValue(value);
      i = endIndex;
      continue;
    }

    if (a === "-o" || a === "--output" || a.startsWith("-o=") || a.startsWith("--output=")) {
      const label = a.startsWith("--") ? "--output" : "-o";
      const { value, endIndex } = readOptionValue(argv, i, label);
      outputOpt = value;
      i = endIndex;
      continue;
    }

    if (a === "-r" || a === "--raw") {
      raw = true;
      continue;
    }

    if (a === "-s" || a === "--sample" || a.startsWith("-s=") || a.startsWith("--sample=")) {
      const label = a.startsWith("--") ? "--sample" : "-s";
      const { value, endIndex } = readOptionValue(argv, i, label);
      const n = Number(value);
      if (!Number.isFinite(n) || n < 1) {
        throw new Error(`Invalid --sample value: ${value}`);
      }
      sample = Math.floor(n);
      i = endIndex;
      continue;
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }

    positionals.push(a);
  }

  const fitPath = positionals[0];
  if (fitPath == null) {
    throw new Error("Missing FIT file path (positional argument)");
  }
  if (positionals.length > 1) {
    throw new Error(`Unexpected extra arguments: ${positionals.slice(1).join(" ")}`);
  }

  const base = basename(fitPath).replace(/\.fit$/i, "") || "activity";

  const inferredFromOutput =
    outputOpt != null && !isOutputDirectory(outputOpt)
      ? inferFormatFromOutputPath(outputOpt)
      : undefined;

  if (
    formatExplicit != null &&
    inferredFromOutput != null &&
    formatExplicit !== inferredFromOutput
  ) {
    throw new Error(
      `--format ${formatExplicit} conflicts with output file extension (inferred ${inferredFromOutput})`
    );
  }

  const format = formatExplicit ?? inferredFromOutput ?? "json";

  let output: string;
  if (outputOpt == null) {
    output = resolve(process.cwd(), `${base}.${format}`);
  } else if (isOutputDirectory(outputOpt)) {
    const dir = outputOpt.replace(/[/\\]+$/, "") || ".";
    output = resolve(process.cwd(), join(dir, `${base}.${format}`));
  } else {
    output = resolve(process.cwd(), outputOpt);
  }

  return { fitPath, format, output, raw, sample };
}

/**
 * Parses compare subcommand argv (two normalized files, optional -f/-o).
 */
export function parseCompareArgs(argv: string[]): CompareArgs {
  let formatExplicit: "json" | "yaml" | undefined;
  let outputOpt: string | undefined;
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;

    if (a === "-f" || a === "--format" || a.startsWith("-f=") || a.startsWith("--format=")) {
      const label = a.startsWith("--") ? "--format" : "-f";
      const { value, endIndex } = readOptionValue(argv, i, label);
      formatExplicit = parseFormatValue(value);
      i = endIndex;
      continue;
    }

    if (a === "-o" || a === "--output" || a.startsWith("-o=") || a.startsWith("--output=")) {
      const label = a.startsWith("--") ? "--output" : "-o";
      const { value, endIndex } = readOptionValue(argv, i, label);
      outputOpt = value;
      i = endIndex;
      continue;
    }

    if (a === "-r" || a === "--raw") {
      throw new Error(`Unknown option: ${a}`);
    }

    if (a === "-s" || a === "--sample" || a.startsWith("-s=") || a.startsWith("--sample=")) {
      throw new Error(`Unknown option: ${a.startsWith("--sample") ? "--sample" : "-s"}`);
    }

    if (a.startsWith("-")) {
      throw new Error(`Unknown option: ${a}`);
    }

    positionals.push(a);
  }

  if (positionals.length < 2) {
    throw new Error("Missing normalized file paths (need two positional arguments)");
  }
  if (positionals.length > 2) {
    throw new Error(`Unexpected extra arguments: ${positionals.slice(2).join(" ")}`);
  }

  const fileA = positionals[0]!;
  const fileB = positionals[1]!;
  const labelA = labelFromPath(fileA);
  const labelB = labelFromPath(fileB);

  const inferredFromOutput =
    outputOpt != null && !isOutputDirectory(outputOpt)
      ? inferFormatFromOutputPath(outputOpt)
      : undefined;

  if (
    formatExplicit != null &&
    inferredFromOutput != null &&
    formatExplicit !== inferredFromOutput
  ) {
    throw new Error(
      `--format ${formatExplicit} conflicts with output file extension (inferred ${inferredFromOutput})`
    );
  }

  const format = formatExplicit ?? inferredFromOutput ?? "json";

  let output: string;
  const defaultBase = "comparison-report";
  if (outputOpt == null) {
    output = resolve(process.cwd(), `${defaultBase}.${format}`);
  } else if (isOutputDirectory(outputOpt)) {
    const dir = outputOpt.replace(/[/\\]+$/, "") || ".";
    output = resolve(process.cwd(), join(dir, `${defaultBase}.${format}`));
  } else {
    output = resolve(process.cwd(), outputOpt);
  }

  return { fileA, fileB, labelA, labelB, format, output };
}
