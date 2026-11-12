import { statSync } from "node:fs";
import { resolveProviderInvocation } from "../scripts/workflow/adapters/windows-command.ts";

export function resolveNativeCodex(configured = process.env.WWW_CODEX_BIN): string {
  const command = resolveProviderInvocation({ command: configured || "codex", args: [] }).command;
  if (process.platform === "win32") {
    let valid = false;
    try { valid = command.toLowerCase().endsWith(".exe") && statSync(command).isFile(); }
    catch { /* 명시 경로의 부재도 연결 오류로 전달한다. */ }
    if (!valid) throw new Error("Codex 네이티브 exe를 찾지 못했습니다. 설치 또는 WWW_CODEX_BIN 설정을 확인하세요.");
  }
  return command;
}
