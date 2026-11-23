/** Chat/007 AC-11의 실제 Electron 화면에서 직접 비교할 표시 순서·문구·상태다. */
export const monitorContract = {
  workId: "work-eed41da3-f22e-4fb9-b9df-9a1a7d76c44f", criterion: "AC-11",
  verifier: "scripts/verification/chat007-monitor.ts",
  observations: {
    agent: "WWW Agent", sidebar: ["spec:명세", "design:설계", "build:구현", "diagnose:진단", "verify:검증"],
    detail: [
      ["www-dev", "개발 접수·통합", "agents/www/AGENT.md", "관측 없음"],
      ["www-design-agent", "화면·디자인 인계", "agents/www-design/AGENT.md", "관측 없음"],
      ["www-spec", "요구·수용 기준", "skills/www/www-spec/SKILL.md", "요청됨"],
      ["www-design", "구조·검증 설계", "skills/www/www-design/SKILL.md", "읽기 명령 관측"],
      ["www-build", "허용된 구현", "skills/www/www-build/SKILL.md", "읽기 완료"],
      ["www-diagnose", "원인 진단", "skills/www/www-diagnose/SKILL.md", "관측 없음"],
      ["www-verify", "동작·근거 검증", "skills/www/www-verify/SKILL.md", "관측 없음"],
      ["www-commit", "커밋·게시 절차", "skills/www/www-commit/SKILL.md", "관측 없음"],
    ],
    applicationEvidence: "문서 읽기 관측을 실제 역할·스킬 적용 완료로 표시하지 않습니다.",
  },
};
export const monitorInputs = ["src", "scripts", "test/fixtures/activity-app-server.ts", "test/fixtures/fake-app-server.ts", "test/package.json", "test/fixtures/package.json", "package-lock.json", "package.json", "tsconfig.json",
  "docs/architecture", "docs/specs/chat.md", ...monitorContract.observations.detail.map(row => row[2]), "agents/www/review-policy.json",
  "build.ts", "tsconfig.tools.json", "bunfig.toml"].sort();
export const monitorCriterion = "기본 사이드바는 WWW Agent와 spec·design·build·diagnose·verify 다섯 스킬을 표시한다. 상세 모니터는 두 역할과 여섯 스킬의 정의를 보여주고 요청·문서 읽기·읽기 명령 관측·실제 적용 확인을 구별한다.";

export const monitorPhases = ["verifier", "build", "build-data", "node", "fixture", "main.ts", "preload.ts", "renderer.tsx"] as const;
export type MonitorTrace = Record<typeof monitorPhases[number], string[]>;
export const monitorLoader = "scripts/verification/chat007-loader.ts";
export function validMonitorTrace(value: unknown): value is MonitorTrace {
  if (!value || typeof value !== "object") return false;
  const trace = value as MonitorTrace;
  if (JSON.stringify(Object.keys(trace).sort()) !== JSON.stringify([...monitorPhases].sort())) return false;
  for (const phase of monitorPhases) {
    const paths = trace[phase];
    if (!Array.isArray(paths) || paths.length > 180 || paths.some(file => typeof file !== "string" || !(/^scripts\/(?:[\w-]+\/)*[\w.-]+\.(?:[cm]?[jt]sx?|json)$/.test(file) || (phase === "build-data" && /^scripts\/(?:[\w-]+\/)+$/.test(file)) || (phase === "fixture" && ["test/fixtures/activity-app-server.ts", "test/fixtures/fake-app-server.ts"].includes(file))))) return false;
    if (JSON.stringify(paths) !== JSON.stringify([...new Set(paths)].sort())) return false;
  }
  return trace.verifier.includes(monitorLoader) && trace.verifier.includes(monitorContract.verifier)
    && trace.build.includes(monitorLoader) && trace.build.length > 1
    && trace.node.includes(monitorLoader) && trace.node.includes("scripts/verify-native-activity.ts")
    && trace["build-data"].length > 0
    && trace.fixture.includes(monitorLoader) && trace.fixture.includes("test/fixtures/activity-app-server.ts") && trace.fixture.includes("test/fixtures/fake-app-server.ts")
    && trace["main.ts"].length > 0;
}

export function monitorSourceInputs(trace: MonitorTrace) {
  const files = new Set(monitorInputs.filter(input => input !== "scripts"));
  for (const script of Object.values(trace).flat()) {
    files.add(script.endsWith("/") ? script.slice(0, -1) : script);
    if (!script.startsWith("scripts/") || script.endsWith("/")) continue;
    const parts = script.split("/");
    for (let depth = 1; depth < parts.length; depth++) {
      const dir = parts.slice(0, depth).join("/");
      files.add(dir + "/package.json");
      files.add(dir + "/tsconfig.json");
    }
  }
  return [...files].sort();
}
