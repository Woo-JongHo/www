import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { writeArchitecture } from "./scripts/generate-architecture.ts";
const root = import.meta.dir    ;
const out  = join(root, "dist") ;
writeArchitecture(root);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
async function bundle(entry: string, target: "node" | "browser", format: "cjs" | "iife") {
  const result = await Bun.build({
    entrypoints : [join(root, "src", entry)] ,
    outdir      : out                        ,
    target                                   ,
    format                                   ,
    minify   : false                           ,
    naming   : entry.replace(/\.tsx?$/, ".js") ,
    external : target === "node" ? ["electron"] : []
  });
  if (!result.success) throw new AggregateError(result.logs, `Failed to build ${entry}`);
}
await bundle(  "main.ts"   ,  "node"  , "cjs" );
await bundle( "preload.ts" ,  "node"  , "cjs" );
await bundle("renderer.tsx", "browser", "iife");
copyFileSync(join(root, "src", "index.html"), join(out, "index.html"));
copyFileSync(join(root, "src", "native-activity.css"), join(out, "native-activity.css"));
copyFileSync(join(root, "src", "chat.css"), join(out, "chat.css"));
copyFileSync(join(root, "src", "ecosystem.css"), join(out, "ecosystem.css"));
const policyDirectory = join(out, "agents", "www");
mkdirSync(policyDirectory, { recursive: true });
copyFileSync(join(root, "agents", "www", "review-policy.json"), join(policyDirectory, "review-policy.json"));
console.log(`built ${out}`);
