import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { verifyMonitorScriptRequests } from "./chat007-inputs.ts";
import { monitorContract, monitorLoader, monitorInputs, monitorPhases, validMonitorTrace } from "./chat007-contract.ts";

if (process.argv[2] === "--observed-run") {
  const env = { ...process.env, WWW_CHAT007_OBSERVE_INPUTS: "1" };
  execFileSync(process.execPath, ["run", "--preload", "./" + monitorLoader, "./build.ts"], {
    env: { ...env, WWW_CHAT007_SCRIPT_PHASE: "build" }, stdio: ["ignore", "ignore", "inherit"],
  });
  const nodeOptions = [process.env.NODE_OPTIONS, "--import=" + pathToFileURL(path.resolve(monitorLoader)).href].filter(Boolean).join(" ");
  const actual = execFileSync("node", ["scripts/verify-native-activity.ts", "--chat007-monitor"], {
    env: { ...env, NODE_OPTIONS: nodeOptions, WWW_CHAT007_SCRIPT_PHASE: "node" }, encoding: "utf8", timeout: 120000,
  });
  if (actual.trim() !== JSON.stringify(monitorContract.observations)) throw Error("AC-11 실제 화면 관찰 불일치: " + actual);
  process.stdout.write(actual);
} else {
  const dir = mkdtempSync(path.join(os.tmpdir(), "www-monitor-imports-"));
  try {
    const file = path.join(dir, "scripts.jsonl");
    const actual = execFileSync(process.execPath, ["run", "--preload", "./" + monitorLoader, "./" + monitorContract.verifier, "--observed-run"], {
      env: { ...process.env, WWW_CHAT007_SCRIPT_ROOT: process.cwd(), WWW_CHAT007_SCRIPT_TRACE: file, WWW_CHAT007_SCRIPT_PHASE: "verifier" },
      encoding: "utf8", timeout: 150000,
    });
    const observed = new Map<string, Set<string>>();
    for (const line of readFileSync(file, "utf8").trim().split("\n")) {
      const [phase, entry] = JSON.parse(line);
      if (!observed.has(phase)) observed.set(phase, new Set());
      if (entry === null) continue;
      if (typeof entry !== "string" || !monitorInputs.some(input => entry === input || entry.startsWith(input + "/"))) throw Error("등록 범위 밖의 실행 모듈: " + entry);
      if (entry.startsWith("scripts/") || (phase === "fixture" && entry.startsWith("test/fixtures/"))) observed.get(phase)!.add(entry);
    }
    const scripts = Object.fromEntries(monitorPhases.filter(p => observed.has(p)).map(p => [p, [...observed.get(p)!].sort()]));
    if (!validMonitorTrace(scripts)) throw Error("실행 단계의 스크립트 관찰 누락: " + JSON.stringify(scripts));
    verifyMonitorScriptRequests(process.cwd(), [...new Set(monitorPhases.filter(phase => phase !== "build-data").flatMap(phase => scripts[phase]))]);
    console.log(JSON.stringify({ values: JSON.parse(actual), scripts }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
