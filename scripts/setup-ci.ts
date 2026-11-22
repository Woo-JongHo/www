/**
 * @architecture arch.tooling.bundle
 * @implements RESP-TOOLING-BUNDLE
 * 공개 headless 엔진을 읽기 전용으로 검증하고 새 CI 설정에 연결한다.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (existsSync(join(root, ".www/development.local.json"))) throw Error("기존 개발 설정을 덮어쓰지 않습니다.");
const installation = process.env.BOXBOX_CI_ROOT;
if (!installation) throw Error("BOXBOX_CI_ROOT에 공식 BoxBox 0.2.8 설치 디렉터리가 필요합니다. docs/RELEASING.md를 확인하세요.");
const base     = realpathSync(installation                                   ) ;
const launcher = join        (base, "plugin/scripts/boxbox.mjs"              ) ;
const runtime  = join        (base, "plugin/runtime.json"                    ) ;
const cli      = join        (base, "runtime/node_modules/boxbox/dist/cli.js") ;
for (const file of [launcher, runtime, cli]) if (!existsSync(file)) throw Error(`공식 BoxBox 설치 파일 누락: ${file}`);
const sha = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const expected = "2bd10f87c24e4b9a31476a66203b804808d8c86b83bc44d7fa6e1bba37d189d0";
if (sha(readFileSync(cli)) !== expected) throw Error("BoxBox 0.2.8 CLI pin 불일치");
const version: unknown = JSON.parse(readFileSync(join(dirname(cli), "../package.json"), "utf8"));
if (!version || typeof version !== "object" || !("version" in version) || version.version !== "0.2.8") throw Error("BoxBox package 버전 불일치");
const installed: unknown = JSON.parse(readFileSync(runtime, "utf8"));
if (!installed || typeof installed !== "object" || !("node" in installed) || typeof installed.node !== "string" || !("cli" in installed) || installed.cli !== cli) throw Error("설치 runtime Node/CLI 연결 불일치");
const node = installed.node;
if (realpathSync(node) !== realpathSync(process.execPath)) throw Error("CI와 runtime Node가 다릅니다.");
const nodeVersion = execFileSync(node, ["--version"], { encoding: "utf8" }).trim();
if (nodeVersion !== "v22.22.3") throw Error("CI Node 22.22.3이 필요합니다.");
const files = [".boxbox/examples.jsonl", ".boxbox/conventions.jsonl", ".boxbox/decisions.jsonl", ".boxbox/rules/json-scalar-fields.md"];
const registry = Object.fromEntries(files.map((file) => [file, sha(readFileSync(join(root, file)))]));
mkdirSync(join(root, ".www"), { recursive: true });
writeFileSync(join(root, ".www/development.local.json"), JSON.stringify({ boxboxNode: node, boxboxLauncher: launcher, architectureCanonical: { runtime, cli, cliSha256: expected, version: "0.2.8", nodeVersion, registry } }, null, 2), { flag: "wx" });
console.log("공식 BoxBox 설치와 저장소의 기존 승인 근거를 CI 설정에 연결했습니다.");
