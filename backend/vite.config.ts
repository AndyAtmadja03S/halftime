import { builtinModules } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf-8"),
) as { dependencies?: Record<string, string> };

const nodeBuiltins = [
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  ssr: {
    target: "node",
    noExternal: true,
  },
  build: {
    target: "node20",
    outDir: "dist",
    ssr: true,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js",
    },
    rollupOptions: {
      external: [...nodeBuiltins, ...Object.keys(pkg.dependencies ?? {})],
      output: { codeSplitting: false },
    },
  },
});
