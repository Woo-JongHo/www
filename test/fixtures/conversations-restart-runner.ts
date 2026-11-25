import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const importFixture = `
  import { pathToFileURL } from "node:url";
  const [bundle, entry, ...args] = process.argv.slice(1);
  process.argv = [process.execPath, entry, ...args];
  await import(pathToFileURL(bundle).href);
`;

export async function runNodeFixture(entry: string, args: string[], timeout: number): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "www-native-bundle-"));
  try {
    const entryPath = join(import.meta.dir, entry);
    const build = await Bun.build({
      entrypoints: [entryPath],
      target: "node", format: "esm", outdir: directory, naming: "[name].mjs",
    });
    assert.ok(build.success, build.logs.map((log) => log.message).join("\n"));
    assert.equal(build.outputs.length, 1);
    const [bundle] = build.outputs;
    assert.ok(bundle);
    const result = spawnSync(process.env.npm_node_execpath || "node",
      ["--input-type=module", "-e", importFixture, bundle.path, entryPath, ...args],
      { shell: false, windowsHide: true, stdio: ["ignore", "inherit", "inherit"], timeout });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `Node ${entry} 실패 (${result.signal ?? result.status})`);
  } finally { await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); }
}

export function runConversationRestart(scenario: "conversations" | "native-lifecycle"): Promise<void> {
  return runNodeFixture("conversations-node-probe.ts", [scenario, join(import.meta.dir, "conversations-app-server.ts")], 9_500);
}
