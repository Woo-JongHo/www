/**
 * @architecture arch.tooling.bundle
 * @implements RESP-TOOLING-BUNDLE
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeArchitecture } from "./scripts/generate-architecture.ts";
import { verifyMonitorBundle } from "./scripts/verification/chat007-inputs.ts";
import { buildInfo, ovisNoticePath } from "./scripts/release.ts";
const root = import.meta.dir    ;
const out  = join(root, "dist") ;
writeArchitecture(root);
const info = buildInfo(root);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
async function bundle(entry: string, target: "node" | "browser", format: "cjs" | "iife") {
  const result = await Bun.build({
    entrypoints : [join(root, "src", entry)] ,
    metafile: process.env.WWW_CHAT007_OBSERVE_INPUTS === "1",
    outdir      : out                        ,
    target                                   ,
    format                                   ,
    define: { __WWW_BUILD_INFO__: JSON.stringify(info) },
    minify   : false                           ,
    naming   : entry.replace(/\.tsx?$/, ".js") ,
    external : target === "node" ? ["electron"] : []
  });
  if (process.env.WWW_CHAT007_OBSERVE_INPUTS === "1") {
    if (!result.metafile) throw Error("AC-11 실제 번들 입력 누락");
    verifyMonitorBundle(root, result.metafile.inputs, result.metafile.outputs, entry);
  }
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${entry}`);
}
await bundle(  "main.ts"   ,  "node"  , "cjs" );
await bundle( "preload.ts" ,  "node"  , "cjs" );
await bundle("renderer.tsx", "browser", "iife");
copyFileSync(join(root, "src", "index.html"), join(out, "index.html"));
copyFileSync(join(root, "src", "native-activity.css"), join(out, "native-activity.css"));
copyFileSync(join(root, "src", "chat.css"), join(out, "chat.css"));
copyFileSync(join(root, "src", "agent-overview.css"), join(out, "agent-overview.css"));
copyFileSync(join(root, "src", "dashboard.css"), join(out, "dashboard.css"));
copyFileSync(join(root, "src", "session-tabs.css"), join(out, "session-tabs.css"));
copyFileSync(join(root, "src", "ecosystem.css"), join(out, "ecosystem.css"));
const policyDirectory = join(out, "agents", "www");
mkdirSync(policyDirectory, { recursive: true });
copyFileSync(join(root, "agents", "www", "review-policy.json"), join(policyDirectory, "review-policy.json"));
const notice = join(out, ovisNoticePath);
mkdirSync(dirname(notice), { recursive: true });
copyFileSync(join(root, "docs", ovisNoticePath), notice);
console.log(`built ${out}`);

writeFileSync(join(out, "build-info.json"), JSON.stringify(info));
