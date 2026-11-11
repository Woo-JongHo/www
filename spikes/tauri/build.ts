import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "../..");
const out = join(import.meta.dir, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const result = await Bun.build({
  entrypoints: [join(root, "src/renderer.tsx"), join(import.meta.dir, "src/bridge.ts")],
  outdir: out,
  target: "browser",
  format: "iife",
  naming: "[name].[ext]",
  minify: false
});
if (!result.success) throw new AggregateError(result.logs, "Tauri UI build failed");
copyFileSync(join(root, "src/index.html"), join(out, "index.html"));
const htmlPath = join(out, "index.html");
writeFileSync(htmlPath, readFileSync(htmlPath, "utf8").replace('<script src="renderer.js">', '<script src="bridge.js"></script><script src="renderer.js">'));
