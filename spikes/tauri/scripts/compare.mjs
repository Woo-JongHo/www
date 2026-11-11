import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const evidence = join(root, ".www/evidence/tauri-comparison.json");
const electronApp = join(root, ".www/packages/WWW-Electron-darwin-arm64/WWW-Electron.app");
const tauriApp = join(root, "spikes/tauri/src-tauri/target/release/bundle/macos/WWW Tauri Comparison.app");
const run = (file, args) => execFileSync(file, args, { cwd: root, encoding: "utf8" }).trim();
const bytes = (path) => {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) return 0;
  return stat.isDirectory() ? readdirSync(path).reduce((sum, name) => sum + bytes(join(path, name)), 0) : stat.size;
};
const lines = (paths, extensions) => paths.reduce((total, path) => {
  const stat = lstatSync(path);
  if (stat.isDirectory()) return total + lines(readdirSync(path).map((name) => join(path, name)), extensions);
  if (!extensions.some((extension) => path.endsWith(extension))) return total;
  return total + readFileSync(path, "utf8").split("\n").length;
}, 0);

const result = {
  recordedAt: new Date().toISOString(),
  host: { platform: platform(), release: release(), arch: arch() },
  versions: {
    node: process.version,
    electron: run("node", ["-p", "require('./node_modules/electron/package.json').version"]),
    rustc: run(join(process.env.HOME, ".cargo/bin/rustc"), ["--version"]),
    cargo: run(join(process.env.HOME, ".cargo/bin/cargo"), ["--version"]),
    tauriCli: run(join(root, "spikes/tauri/node_modules/.bin/tauri"), ["--version"])
  },
  workload: "Production release bundles; deterministic fake app-server protocol is covered by npm run test:comparison.",
  repetitions: { bundleSize: 1, sourceLineCount: 1, startupAndMemory: 0 },
  bundles: {
    electron: { path: electronApp, bytes: bytes(electronApp), webview: "bundled Chromium" },
    tauri: { path: tauriApp, bytes: bytes(tauriApp), webview: "shared macOS WKWebView, not included in app bytes" }
  },
  implementationLines: {
    existingElectronBackend: lines([join(root, "src/main.ts"), join(root, "src/preload.ts"), join(root, "src/rpc.ts")], [".ts"]),
    tauriBackendAndBridge: lines([join(root, "spikes/tauri/src-tauri/src"), join(root, "spikes/tauri/src/bridge.ts")], [".rs", ".ts"])
  },
  startup: { status: "not measured", reason: "No instrumentation currently proves React rendered/usable state across both native shells." },
  memory: { status: "not measured", reason: "No reliable automated accounting of Electron renderer/GPU and shared WKWebView helper process trees was available; parent RSS is intentionally not reported." }
};
mkdirSync(dirname(evidence), { recursive: true });
writeFileSync(evidence, `${JSON.stringify(result, null, 2)}\n`);
console.log(evidence);
