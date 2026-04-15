import { defineConfig } from "tsup";

const peerExternal = ["fit-file-parser", "@garmin/fitsdk"];

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist",
    clean: true,
    target: "node18",
    splitting: false,
    external: peerExternal,
  },
  {
    entry: { dotfit: "src/cli/dotfit.ts" },
    format: ["cjs"],
    dts: false,
    outDir: "dist",
    clean: false,
    target: "node18",
    splitting: false,
    external: peerExternal,
    banner: {
      js: "#!/usr/bin/env node\n",
    },
    outExtension() {
      return { js: ".cjs" };
    },
  },
]);
