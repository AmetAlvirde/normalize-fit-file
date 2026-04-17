import { describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseCliArgs, rawOutputPath } from "./fit-path";

describe("rawOutputPath", () => {
  test("inserts -raw before extension", () => {
    expect(rawOutputPath("/tmp/activity.json")).toBe("/tmp/activity-raw.json");
    expect(rawOutputPath("race.yaml")).toBe("race-raw.yaml");
    expect(rawOutputPath("C:\\out\\x.yml")).toBe("C:\\out\\x-raw.yml");
  });

  test("appends -raw when there is no extension", () => {
    expect(rawOutputPath("/tmp/out")).toBe("/tmp/out-raw");
  });
});

describe("parseCliArgs", () => {
  const cwd = process.cwd();

  test("missing fit path throws", () => {
    expect(() => parseCliArgs([])).toThrow(/Missing FIT file path/);
    expect(() => parseCliArgs(["-f", "json"])).toThrow(/Missing FIT file path/);
  });

  test("extracts positional fit path and default output in CWD", () => {
    const args = parseCliArgs(["./data/ride.fit"]);
    expect(args.fitPath).toBe("./data/ride.fit");
    expect(args.format).toBe("json");
    expect(args.output).toBe(resolve(cwd, "ride.json"));
    expect(args.raw).toBe(false);
    expect(args.sample).toBeUndefined();
  });

  test("-f yaml and --format yaml", () => {
    expect(parseCliArgs(["a.fit", "-f", "yaml"]).format).toBe("yaml");
    expect(parseCliArgs(["a.fit", "--format", "yaml"]).format).toBe("yaml");
    expect(parseCliArgs(["a.fit", "--format=yaml"]).format).toBe("yaml");
    expect(parseCliArgs(["a.fit", "-f=yaml"]).format).toBe("yaml");
  });

  test("-o file and --output with = syntax", () => {
    const a = parseCliArgs(["x.fit", "-o", "out/race.json"]);
    expect(a.output).toBe(resolve(cwd, "out/race.json"));
    expect(a.format).toBe("json");
    const b = parseCliArgs(["x.fit", "--output=out/race.yaml"]);
    expect(b.output).toBe(resolve(cwd, "out/race.yaml"));
    expect(b.format).toBe("yaml");
  });

  test("-o directory trailing slash joins basename", () => {
    const args = parseCliArgs(["/abs/activity.fit", "-o", "exports/"]);
    expect(args.output).toBe(resolve(cwd, "exports", "activity.json"));
    expect(args.format).toBe("json");
  });

  test("-o existing directory path joins basename", () => {
    const dir = join(cwd, "_parse_cli_args_tmp_dir");
    mkdirSync(dir, { recursive: true });
    try {
      const args = parseCliArgs(["thing.fit", "-o", dir]);
      expect(args.output).toBe(resolve(dir, "thing.json"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("format inferred from -o file extension beats default", () => {
    expect(parseCliArgs(["a.fit", "-o", "z.yaml"]).format).toBe("yaml");
    expect(parseCliArgs(["a.fit", "-o", "z.yml"]).format).toBe("yaml");
  });

  test("explicit --format conflicts with -o extension", () => {
    expect(() => parseCliArgs(["a.fit", "-o", "x.yaml", "-f", "json"])).toThrow(
      /conflicts with output file extension/
    );
    expect(() => parseCliArgs(["a.fit", "-f", "yaml", "-o", "x.json"])).toThrow(
      /conflicts with output file extension/
    );
  });

  test("--raw / -r", () => {
    expect(parseCliArgs(["a.fit", "--raw"]).raw).toBe(true);
    expect(parseCliArgs(["a.fit", "-r"]).raw).toBe(true);
  });

  test("--sample and -s with = syntax", () => {
    expect(parseCliArgs(["a.fit", "--sample", "3"]).sample).toBe(3);
    expect(parseCliArgs(["a.fit", "-s", "10"]).sample).toBe(10);
    expect(parseCliArgs(["a.fit", "--sample=5"]).sample).toBe(5);
    expect(parseCliArgs(["a.fit", "-s=2"]).sample).toBe(2);
  });

  test("invalid --format throws", () => {
    expect(() => parseCliArgs(["a.fit", "-f", "xml"])).toThrow(/Invalid --format/);
  });

  test("invalid --sample throws", () => {
    expect(() => parseCliArgs(["a.fit", "--sample", "0"])).toThrow(/Invalid --sample/);
    expect(() => parseCliArgs(["a.fit", "-s=abc"])).toThrow(/Invalid --sample/);
  });

  test("unknown option throws", () => {
    expect(() => parseCliArgs(["a.fit", "--verbose"])).toThrow(/Unknown option/);
  });

  test("extra positional throws", () => {
    expect(() => parseCliArgs(["a.fit", "b.fit"])).toThrow(/Unexpected extra arguments/);
  });

  test("flags after positional are allowed", () => {
    const args = parseCliArgs(["a.fit", "-f", "yaml", "-r"]);
    expect(args.fitPath).toBe("a.fit");
    expect(args.format).toBe("yaml");
    expect(args.raw).toBe(true);
    expect(args.output).toBe(resolve(cwd, "a.yaml"));
  });
});
