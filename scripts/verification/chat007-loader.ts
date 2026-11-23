/** 검증 프로세스가 실제 로드하는 저장소 스크립트를 기록한다. */
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import * as modules from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(process.env.WWW_CHAT007_SCRIPT_ROOT ?? process.cwd());
const installed = realpathSync(path.join(root, "node_modules")) + path.sep;
const trace = process.env.WWW_CHAT007_SCRIPT_TRACE;
const entry = path.relative(root, path.resolve(process.argv[1] ?? "")).split(path.sep).join("/");
const phase = entry.startsWith("test/fixtures/") ? "fixture" : process.env.WWW_CHAT007_SCRIPT_PHASE;
if (!trace || !phase) throw Error("실행 단계와 추적 원문이 필요합니다.");
function observe(file: string) {
  if (file.startsWith(installed)) return;
  appendFileSync(trace!, JSON.stringify([phase, path.relative(root, file).split(path.sep).join("/")]) + "\n");
}
observe(fileURLToPath(import.meta.url));
if (process.versions.bun) {
  Bun.plugin({ name: "chat007-script-inputs", setup(builder) {
    builder.onLoad({ filter: /^(?!.*[/\\]node_modules[/\\]).+/ }, args => {
      const loader = path.extname(args.path).slice(1);
      if (loader !== "ts" && loader !== "tsx" && loader !== "js" && loader !== "json") throw Error("관찰하지 못한 Bun 로더: " + args.path);
      observe(realpathSync(args.path));
      return { contents: readFileSync(args.path, "utf8"), loader };
    });
  } });
} else if (!process.versions.electron) {
  modules.registerHooks({ load(url, context, next) {
    const result = next(url, context);
    if (url.startsWith("file:")) observe(realpathSync(fileURLToPath(url)));
    return result;
  } });
}
