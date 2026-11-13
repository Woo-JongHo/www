import { describe, expect, test } from "bun:test";
import { identifyWwwArtifact, referencedWwwArtifacts, WWW_ARTIFACTS } from "../src/www-activity";

const workspace = "/projects/www";

describe("WWW 역할·스킬 정본 식별", () => {
  test("전용 역할 둘과 스킬 여섯을 정본 경로로 식별한다", () => {
    expect(WWW_ARTIFACTS.filter((artifact) => artifact.kind === "role")).toHaveLength(2);
    expect(WWW_ARTIFACTS.filter((artifact) => artifact.kind === "skill")).toHaveLength(6);
    for (const artifact of WWW_ARTIFACTS) {
      expect(identifyWwwArtifact(artifact.path, workspace)?.id).toBe(artifact.id);
      expect(identifyWwwArtifact(`${workspace}/${artifact.path}`, workspace)?.id).toBe(artifact.id);
    }
  });

  test("발견용 상대 링크·하위 작업 경로·Windows 구분자를 처리한다", () => {
    expect(identifyWwwArtifact(".agents/skills/www-build/SKILL.md", workspace)?.id).toBe("www-build");
    expect(identifyWwwArtifact("../agents/www/AGENT.md", workspace, `${workspace}/src`)?.id).toBe("www-dev");
    expect(identifyWwwArtifact("C:\\Project\\WWW\\AGENTS\\WWW\\AGENT.MD", "c:\\project\\www")?.id).toBe("www-dev");
  });

  test("저장소 밖·이름만 같은 파일·유사 접두 경로를 WWW 역할로 만들지 않는다", () => {
    for (const path of ["/other/agents/www/AGENT.md", "/projects/www-other/agents/www/AGENT.md", "/projects/www/agents/www-dev/AGENT.md", "/projects/www/notes/www-dev/AGENT.md", "../agents/www/AGENT.md", "AGENT.md"]) {
      expect(identifyWwwArtifact(path, workspace)).toBeNull();
    }
    expect(identifyWwwArtifact("agents/www/AGENT.md", workspace, "/other/repository")).toBeNull();
    expect(identifyWwwArtifact("/projects/www/agents/www/AGENT.md")).toBeNull();
    expect(identifyWwwArtifact("agents/www/AGENT.md")).toBeNull();
  });
});

describe("보수적인 문서 읽기 명령 참조", () => {
  test("실제 다중 파일 cat의 WWW 역할과 스킬 참조를 식별한다", () => {
    const command = "/bin/zsh -lc 'cat /Users/user/.codex/coding-guidelines.md AGENTS.md agents/www/AGENT.md skills/www/www-build/SKILL.md'";
    expect(referencedWwwArtifacts(command, workspace, workspace).map((artifact) => artifact.id)).toEqual(["www-dev", "www-build"]);
    expect(referencedWwwArtifacts('cat -- "agents/www-design/AGENT.md" ".agents/skills/www-verify/SKILL.md"', workspace).map((artifact) => artifact.id)).toEqual(["www-design-agent", "www-verify"]);
  });

  test("한 command 안 중복 정본 참조는 한 번이고 저장소 근거가 없으면 식별하지 않는다", () => {
    expect(referencedWwwArtifacts("cat agents/www/AGENT.md agents/www/AGENT.md", workspace)).toHaveLength(1);
    expect(referencedWwwArtifacts("cat agents/www/AGENT.md")).toEqual([]);
    expect(referencedWwwArtifacts("cat /other/agents/www/AGENT.md", workspace)).toEqual([]);
  });

  test("언급·검색·셸 확장·연쇄·리디렉션·손상된 인자를 읽기 명령으로 추정하지 않는다", () => {
    for (const command of [
      "echo cat agents/www/AGENT.md",
      "grep www-dev agents/www/AGENT.md",
      "cat agents/www/AGENT.md; echo done",
      "cat agents/www/AGENT.md && true",
      "cat agents/www/AGENT.md | head",
      "cat agents/www/AGENT.md > /tmp/out",
      "cat $(pwd)/agents/www/AGENT.md",
      'cat "$ROOT/agents/www/AGENT.md"',
      "cat agents/*/AGENT.md",
      "cat agents/www/AGENT.md !*",
      "cat agents/www/AGENT.md =cat",
      "cat agents/www/AGENT.md\u00a0not-a-separate-argument",
      "cat -n agents/www/AGENT.md",
      "cat 'agents/www/AGENT.md",
      "/bin/zsh -lc 'cat agents/www/AGENT.md' extra",
      "python3 -c 'print(\"cat agents/www/AGENT.md\")'",
      "cat <<EOF\nagents/www/AGENT.md\nEOF",
    ]) expect(referencedWwwArtifacts(command, workspace)).toEqual([]);
  });
});
