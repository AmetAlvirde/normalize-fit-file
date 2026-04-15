/**
 * First positional CLI argument that is not `--sample` or its numeric value.
 */
export function parseFitPath(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--sample") {
      i += 1;
      continue;
    }
    if (!a.startsWith("-")) {
      return a;
    }
  }
  return undefined;
}
