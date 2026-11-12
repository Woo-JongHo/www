> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# Agent Skills

**AI 코딩 에이전트를 위한 운영 수준의 엔지니어링 스킬.**

스킬은 선임 엔지니어가 소프트웨어를 만들 때 사용하는 워크플로, 품질 관문, 모범 사례를 담습니다. 개발의 모든 단계에서 AI 에이전트가 이를 일관되게 따르도록 묶었습니다.

<a href="https://trendshift.io/repositories/25200" target="_blank"><img src="https://trendshift.io/api/badge/repositories/25200" alt="addyosmani%2Fagent-skills | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>

![Addy's Agent Skills](https://addyosmani.com/assets/images/addys-agent-skills.jpg)

```
  정의            계획           구축           검증           검토            출시
 ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
 │아이디어│ ──▶ │ 명세 │ ───▶ │ 코드 │ ───▶ │테스트│ ───▶ │  QA  │ ───▶ │출시  │
 │구체화│      │  PRD │      │ 구현 │      │디버그│      │관문  │      │운영  │
 └──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘
  /spec          /plan          /build        /test         /review       /ship
```

---

## 명령

개발 수명 주기에 대응하는 슬래시 명령 9개입니다. 각 명령은 적절한 스킬을 자동으로 활성화합니다.

| 수행할 작업 | 명령 | 핵심 원칙 |
|-------------------|---------|---------------|
| 만들 대상 정의 | `/spec` | 코드보다 명세 먼저 |
| 구현 방법 계획 | `/plan` | 작고 원자적인 과제 |
| 점진적 구현 | `/build` | 한 번에 한 조각씩 |
| 동작 입증 | `/test` | 테스트가 증거 |
| 품질 기준 설정 | `/constraints` | 한 번 결정하고 모든 곳에서 강제 |
| 병합 전 검토 | `/review` | 코드 건전성 개선 |
| 웹 성능 감사 | `/webperf` | 최적화보다 측정 먼저 |
| 코드 단순화 | `/code-simplify` | 기교보다 명확성 |
| 운영 환경에 출시 | `/ship` | 빠를수록 안전 |

Claude Code에서는 플러그인 명령으로 설치됩니다. `/review`처럼 내장 명령과 이름이 같다면 네임스페이스를 붙인 `/agent-skills:review` 형식을 사용합니다.

명세를 만든 뒤 수동 단계를 줄이고 싶나요? **`/build auto`**는 한 번의 승인된 실행으로 계획을 생성하고 모든 과제를 구현합니다. 계획을 한 번 승인하면 이후에는 자율적으로 실행합니다. 사람이 과제 *사이*에 개입하는 절차를 줄이는 것이며 검증은 유지합니다. 모든 과제는 여전히 테스트 주도로 진행되고 각각 커밋되며, 실패하거나 위험한 단계에서는 멈춥니다.

수행하는 작업에 따라서도 스킬이 자동 활성화됩니다. API를 설계하면 `api-and-interface-design`이, UI를 만들면 `frontend-ui-engineering`이 실행되는 식입니다.

---

## 빠른 시작

**가장 빠른 방법 — 어떤 에이전트든 명령 하나로.** 공개 [skills CLI](https://github.com/vercel-labs/skills)는 Claude Code, Cursor, Codex, Copilot, Cline 등 70개 이상의 에이전트에 설치합니다.

```bash
npx skills add addyosmani/agent-skills            # install all 25 skills
npx skills add addyosmani/agent-skills --list     # browse before installing
```

또는 스킬을 개별적으로 설치합니다.

```bash
npx skills add addyosmani/agent-skills --skill code-review-and-quality   # five-axis review before merge
npx skills add addyosmani/agent-skills --skill interview-me              # requirements interrogation, one question at a time
npx skills add addyosmani/agent-skills --skill test-driven-development   # red-green-refactor, enforced
```

> **스킬 하나만 설치하나요?** 스킬별 `npx` 설치는 저장소 최상위의
> `references/` 디렉터리를 제외하고 `skills/<name>/`만 복사합니다. 스킬 자체는
> 작동하지만 보충 자료인 공용 체크리스트 경로는 사용할 수 없습니다.
> 저장소 전체 통합을 사용하거나, 저장소를 복제하거나, 필요한 체크리스트를
> 설치된 스킬 안의 `references/` 디렉터리로 복사하세요. 이 이식성 문제는
> [#361](https://github.com/addyosmani/agent-skills/issues/361)에서 추적합니다.

기본 통합 방식을 선호한다면 아래에서 도구를 선택하세요.

<details>
<summary><b>Claude Code (권장)</b></summary>

**마켓플레이스 설치:**

```
/plugin marketplace add addyosmani/agent-skills
/plugin install agent-skills@addy-agent-skills
```

> **SSH 오류가 발생하나요?** 마켓플레이스는 SSH로 저장소를 복제합니다. GitHub에 SSH 키를 설정하지 않았다면 [SSH 키를 추가](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/adding-a-new-ssh-key-to-your-github-account)하거나, 마켓플레이스 추가 단계에서 전체 HTTPS URL을 사용해 HTTPS 복제를 강제하세요.
> ```bash
> /plugin marketplace add https://github.com/addyosmani/agent-skills.git
> /plugin install agent-skills@addy-agent-skills
> ```
>
> Windows 또는 macOS에서 `/plugin install`이 여전히 `git@github.com: Permission denied (publickey)`로 실패한다면, 하위 프로세스의 복제에서 GitHub SSH URL을 HTTPS로 바꾸도록 Git을 한 번 설정하는 것이 권장 해결책입니다.
> ```bash
> git config --global url."https://github.com/".insteadOf git@github.com:
> ```

**로컬 / 개발:**

```bash
git clone https://github.com/addyosmani/agent-skills.git
claude --plugin-dir /path/to/agent-skills
```

</details>

<details>
<summary><b>Cursor</b></summary>

워크플로 스킬은 `.cursor/skills/` 아래에 두고(`agent-skills/skills/`에서 동기화), 짧은 정책은 `.cursor/rules/*.mdc`에 둡니다. 스킬 전체를 규칙에 붙여 넣지 마세요. 두 디렉터리는 프로젝트 안에 있으며, 이 저장소에는 `.cursor/` 폴더가 포함되어 있지 않습니다. [docs/cursor-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/cursor-setup.md)를 참고하세요.

</details>

<details>
<summary><b>Antigravity CLI</b></summary>

스킬과 하위 에이전트를 위한 기본 플러그인으로 설치합니다. 영향을 받는 Antigravity CLI 릴리스에서는 레거시 명령 TOML이 변환되었다고 표시되지만 래퍼 명령이 검색되지 않습니다. 기반 스킬을 네임스페이스 이름으로 직접 호출하세요. [docs/antigravity-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/antigravity-setup.md#lifecycle-workflows-and-command-compatibility)를 참고하세요.

**저장소에서 설치:**

```bash
agy plugin install https://github.com/addyosmani/agent-skills.git
```

**로컬 복제본에서 설치:**

```bash
git clone https://github.com/addyosmani/agent-skills.git
agy plugin install ./agent-skills
```

</details>

<details>
<summary><b>Gemini CLI</b></summary>

자동 검색되는 기본 스킬로 설치하거나, 지속적인 컨텍스트를 위해 `GEMINI.md`에 추가합니다. [docs/gemini-cli-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/gemini-cli-setup.md)를 참고하세요.

**저장소에서 설치:**

```bash
gemini skills install https://github.com/addyosmani/agent-skills.git --path skills
```

**로컬 복제본에서 설치:**

```bash
gemini skills install ./agent-skills/skills/
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Windsurf 규칙 설정에 스킬 내용을 추가합니다. [docs/windsurf-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/windsurf-setup.md)를 참고하세요.

</details>

<details>
<summary><b>OpenCode</b></summary>

스킬을 `.opencode/skills/`(또는 `~/.config/opencode/skills/`)로 복사하고 프로젝트 로컬 `AGENTS.md`를 추가한 뒤, 내장 `skill` 도구로 에이전트가 실행하도록 합니다. 선택적인 슬래시 명령은 `.opencode/commands/` 아래에 추가할 수 있습니다.

[docs/opencode-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/opencode-setup.md)를 참고하세요.

</details>

<details>
<summary><b>GitHub Copilot</b></summary>

`agents/`의 에이전트 정의를 Copilot 페르소나로 사용하고, 스킬 내용은 `.github/copilot-instructions.md`에 둡니다. 수명 주기 슬래시 명령(`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`)은 Claude Code 명령이어서 Copilot에는 나타나지 않습니다. 대신 스킬을 이름으로(`/spec-driven-development`, …) 호출하세요. [docs/copilot-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/copilot-setup.md)를 참고하세요.

독립 실행형 `copilot` CLI를 사용하나요? 플러그인으로 설치하세요. [docs/copilot-cli-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/copilot-cli-setup.md)를 참고하세요.

</details>

<details>
  <summary><b>Kiro IDE & CLI </b></summary>
  Kiro 스킬은 ".kiro/skills/" 아래에 있으며 프로젝트 또는 전역 수준으로 저장할 수 있습니다. Kiro는 Agents.md도 지원합니다. Kiro 문서 https://kiro.dev/docs/skills/ 를 참고하세요.
</details>

<details>
<summary><b>Codex</b></summary>

기본 Codex 플러그인으로 설치합니다(Codex CLI v0.122+).

```bash
codex plugin marketplace add addyosmani/agent-skills
codex plugin add agent-skills@agent-skills
```

첫 번째 명령은 마켓플레이스를 등록하고, 두 번째는 플러그인을 설치합니다. Codex는 `.codex-plugin/plugin.json`을 통해 최상위 `skills/` 디렉터리를 직접 읽습니다. 설치 후에는 채팅에서 `@`로 스킬을 호출합니다(예: `@spec-driven-development`). 로컬 설치와 문제 해결은 [docs/codex-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/codex-setup.md)를 참고하세요.

</details>

<details>
<summary><b>Command Code</b></summary>

내장 `cmd skills` 명령으로 기본 설치합니다. Command Code는 저장소를 복제하고 모든 `SKILL.md`를 찾아 `.commandcode/skills/`에 설치합니다.

```bash
cmd skills add addyosmani/agent-skills            # pick skills to install (project)
cmd skills add addyosmani/agent-skills --global   # install for all projects (~/.commandcode/skills/)
cmd skills add addyosmani/agent-skills -s spec-driven-development  # install a specific skill
```

설치된 스킬은 `/spec-driven-development`처럼 TUI 슬래시 메뉴에 나타납니다. [docs/commandcode-setup.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/commandcode-setup.md)를 참고하세요.

</details>

<details>
<summary><b>기타 에이전트</b></summary>

스킬은 일반 Markdown이므로 시스템 프롬프트나 지침 파일을 받는 모든 에이전트에서 작동합니다. [docs/getting-started.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/getting-started.md)를 참고하세요. 팩을 설치하지만 위에 나열되지 않은 호스트는 [docs/other-hosts.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/other-hosts.md)에 있습니다.

</details>



---

## 도입

이미 설치했나요? 팩을 도입하는 방식은 코드베이스에 따라 달라집니다. **[도입 안내](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/adoption-guide.md)**는 신규 프로젝트에서 첫날부터 전체 수명 주기를 적용하는 방식과, 기존 코드베이스에서 검증을 우선하며 점진적으로 도입하는 두 경로를 설명합니다.

---

## 전체 25개 스킬

위 명령들은 진입점입니다. 팩에는 수명 주기 스킬 24개와 `using-agent-skills` 메타 스킬을 합쳐 총 25개가 있습니다. 각 스킬은 단계, 검증 관문, 합리화 반박 표를 갖춘 구조적인 워크플로입니다. 어떤 스킬이든 직접 참조할 수도 있습니다.

### 메타 - 적용할 스킬 찾기

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [using-agent-skills](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/using-agent-skills/SKILL.md) | 들어오는 작업을 적절한 스킬 워크플로에 연결하고 공통 운영 규칙을 정의 | 세션을 시작하거나 적용할 스킬을 결정할 때 |

### 정의 - 만들 대상 명확화

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [interview-me](skills/interview-me/SKILL.md) | 사용자가 원해야 한다고 생각하는 것 대신 실제 원하는 것을 알아내도록, 약 95% 확신에 이를 때까지 한 번에 한 질문씩 인터뷰 | 요청이 불명확하거나 사용자가 "interview me" / "grill me"를 호출할 때 |
| [idea-refine](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/idea-refine/SKILL.md) | 구조적인 발산·수렴 사고로 모호한 아이디어를 구체적인 제안으로 전환 | 탐색이 필요한 대략적인 구상이 있을 때 |
| [spec-driven-development](skills/spec-driven-development/SKILL.md) | 코드 작성 전에 목표, 명령, 구조, 코드 스타일, 테스트, 경계를 다루는 PRD 작성 | 새 프로젝트, 기능 또는 큰 변경을 시작할 때 |
| [constraint-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/constraint-driven-development/SKILL.md) | 합리적인 기본 임계값으로 품질 기준을 인터뷰하고 CONSTRAINTS.md를 작성하며 검사 비용에 따라 배치하고, 통과를 위해 검사나 테스트를 끄는 에이전트 감지 | 명문화된 기준이 없거나 에이전트가 사람이 읽을 수 있는 것보다 많이 생성할 때 |

### 계획 - 작업 분해

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [planning-and-task-breakdown](skills/planning-and-task-breakdown/SKILL.md) | 명세를 수용 기준과 의존 순서가 있는 작고 검증 가능한 과제로 분해 | 명세가 있고 구현 가능한 단위가 필요할 때 |

### 구축 - 코드 작성

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [incremental-implementation](skills/incremental-implementation/SKILL.md) | 얇은 수직 조각으로 구현·테스트·검증·커밋. 기능 플래그, 안전한 기본값, 롤백하기 쉬운 변경 | 둘 이상의 파일에 영향을 주는 모든 변경 |
| [test-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/test-driven-development/SKILL.md) | Red-Green-Refactor, 테스트 피라미드(80/15/5), 테스트 크기, DRY보다 DAMP, Beyonce Rule, 브라우저 테스트 | 로직을 구현하거나 버그를 수정하거나 동작을 바꿀 때 |
| [context-engineering](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/context-engineering/SKILL.md) | 규칙 파일, 컨텍스트 패킹, MCP 통합으로 적절한 시점에 적절한 정보를 에이전트에 제공 | 세션 시작, 과제 전환 또는 출력 품질 저하 시 |
| [source-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/source-driven-development/SKILL.md) | 모든 프레임워크 결정을 공식 문서에 근거지음. 검증하고 출처를 인용하며 미검증 사항을 표시 | 어떤 프레임워크나 라이브러리에서든 권위 있는 출처를 인용한 코드가 필요할 때 |
| [doubt-driven-development](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/doubt-driven-development/SKILL.md) | 진행 중인 사소하지 않은 모든 결정을 새 컨텍스트에서 반대 관점으로 검토. CLAIM → EXTRACT → DOUBT → RECONCILE → STOP, 선택적으로 사용자가 승인한 교차 모델 상향 검토 | 위험이 크거나(운영, 보안, 되돌릴 수 없음), 낯선 코드를 다루거나, 자신 있는 출력도 나중 디버깅보다 지금 검증하는 편이 저렴할 때 |
| [frontend-ui-engineering](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/frontend-ui-engineering/SKILL.md) | 컴포넌트 구조, 디자인 시스템, 상태 관리, 반응형 설계, WCAG 2.1 AA 접근성 | 사용자 인터페이스를 만들거나 수정할 때 |
| [api-and-interface-design](skills/api-and-interface-design/SKILL.md) | 계약 우선 설계, 하이럼의 법칙, 단일 버전 규칙, 오류 의미 체계, 경계 검증 | API, 모듈 경계 또는 공개 인터페이스를 설계할 때 |

### 검증 - 동작 입증

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [browser-testing-with-devtools](skills/browser-testing-with-devtools/SKILL.md) | DOM 검사, 콘솔 로그, 네트워크 추적, 성능 프로파일링 등 실제 런타임 데이터를 위한 Chrome DevTools MCP | 브라우저에서 실행되는 대상을 만들거나 디버깅할 때 |
| [debugging-and-error-recovery](skills/debugging-and-error-recovery/SKILL.md) | 재현, 위치 특정, 축소, 수정, 방어의 5단계 분류. 즉시 중단 규칙과 안전한 대안 | 테스트 실패, 빌드 오류 또는 예상과 다른 동작 시 |

### 검토 - 병합 전 품질 관문

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [code-review-and-quality](skills/code-review-and-quality/SKILL.md) | 5축 검토, 변경 크기(약 100줄), 심각도 레이블(Nit/Optional/FYI), 검토 속도 규범, 분할 전략 | 모든 변경을 병합하기 전 |
| [code-simplification](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/code-simplification/SKILL.md) | 체스터턴의 울타리, 500 규칙, 정확한 동작을 보존하는 복잡성 감소 | 코드는 작동하지만 필요 이상으로 읽기 어렵거나 유지보수가 힘들 때 |
| [security-and-hardening](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/security-and-hardening/SKILL.md) | OWASP Top 10 예방, 인증 패턴, 비밀 관리, 의존성 감사, 3단계 경계 체계 | 사용자 입력, 인증, 데이터 저장 또는 외부 통합을 다룰 때 |
| [performance-optimization](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/performance-optimization/SKILL.md) | 측정 우선 접근. Core Web Vitals 목표, 프로파일링 절차, 번들 분석, 안티패턴 탐지 | 성능 요구사항이 있거나 회귀가 의심될 때 |

### 출시 - 확신을 갖고 배포

| 스킬 | 역할 | 사용 시점 |
|-------|-------------|----------|
| [git-workflow-and-versioning](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/git-workflow-and-versioning/SKILL.md) | 트렁크 기반 개발, 원자적 커밋, 변경 크기(약 100줄), 저장 지점으로서의 커밋 패턴 | 모든 코드 변경 시(항상) |
| [ci-cd-and-automation](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/ci-cd-and-automation/SKILL.md) | Shift Left, 빠를수록 안전, 기능 플래그, 품질 관문 파이프라인, 실패 피드백 순환 | 빌드·배포 파이프라인을 설정하거나 수정할 때 |
| [deprecation-and-migration](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/deprecation-and-migration/SKILL.md) | 코드를 부채로 보는 관점, 강제·권고 폐기, 마이그레이션 패턴, 좀비 코드 제거 | 구시스템 제거, 사용자 이전 또는 기능 종료 시 |
| [documentation-and-adrs](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/documentation-and-adrs/SKILL.md) | 아키텍처 결정 기록, API 문서, 인라인 문서화 기준. *이유*를 기록 | 아키텍처 결정, API 변경 또는 기능 출시 시 |
| [observability-and-instrumentation](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/observability-and-instrumentation/SKILL.md) | 구조화된 로깅, RED 메트릭, OpenTelemetry 추적, 증상 기반 알림. 구축하면서 계측 | 텔레메트리를 추가하거나 운영 환경에서 실행되는 것을 출시할 때 |
| [shipping-and-launch](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/skills/shipping-and-launch/SKILL.md) | 출시 전 체크리스트, 기능 플래그 수명 주기, 단계적 배포, 롤백 절차, 모니터링 설정 | 운영 배포를 준비할 때 |

---

## 에이전트 페르소나

목적에 맞는 검토를 위해 미리 구성한 전문가 페르소나입니다.

| 에이전트 | 역할 | 관점 |
|-------|------|-------------|
| [code-reviewer](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/agents/code-reviewer.md) | 시니어 스태프 엔지니어 | "스태프 엔지니어가 승인할 만한가?"를 기준으로 하는 5축 코드 검토 |
| [test-engineer](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/agents/test-engineer.md) | QA 전문가 | 테스트 전략, 커버리지 분석, Prove-It 패턴 |
| [security-auditor](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/agents/security-auditor.md) | 보안 엔지니어 | 취약점 탐지, 위협 모델링, OWASP 평가 |
| [web-performance-auditor](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/agents/web-performance-auditor.md) | 웹 성능 엔지니어 | Quick/Deep 모드와 메트릭 정직성 규칙을 갖춘 Core Web Vitals 감사. `/webperf`로 실행 |

결정 행렬, 오케스트레이션 규칙, 페르소나와 스킬·슬래시 명령의 조합 방법은 [docs/agents.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/agents.md)를 참고하세요.

---

## 참조 체크리스트

필요할 때 스킬이 가져오는 빠른 참조 자료입니다.

| 참조 | 다루는 내용 |
|-----------|--------|
| [definition-of-done.md](references/definition-of-done.md) | 과제별 수용 기준과 구별되는, 모든 변경이 충족해야 하는 프로젝트 공통 상시 기준 |
| [testing-patterns.md](references/testing-patterns.md) | 테스트 구조, 이름 지정, 모킹, React/API/E2E 예시, 안티패턴(JavaScript/TypeScript) |
| [security-checklist.md](references/security-checklist.md) | 커밋 전 검사, 인증·인가, 입력 검증, 헤더, CORS, OWASP Top 10 |
| [performance-checklist.md](references/performance-checklist.md) | Core Web Vitals 목표, 프런트엔드·백엔드 체크리스트, 측정 명령 |
| [accessibility-checklist.md](references/accessibility-checklist.md) | 키보드 탐색, 스크린 리더, 시각 디자인, ARIA, 테스트 도구 |
| [observability-checklist.md](references/observability-checklist.md) | 온콜 질문, 구조화된 로깅, RED/USE 메트릭, 추적, 증상 기반 알림, 출시 전 관문 |
| [orchestration-patterns.md](references/orchestration-patterns.md) | 권장 다중 페르소나 오케스트레이션 패턴, 안티패턴, "페르소나는 페르소나를 호출하지 않는다" 규칙 |

---

## 스킬의 작동 방식

모든 스킬은 일관된 구조를 따릅니다.

```
┌─────────────────────────────────────────────────┐
│  SKILL.md                                       │
│                                                 │
│  ┌─ 프런트매터 ──────────────────────────────┐  │
│  │ name: lowercase-hyphen-name               │  │
│  │ description: [task] 수행을 에이전트에게 안내.│  │
│  │              사용 시점…                   │  │
│  └───────────────────────────────────────────┘  │
│  개요             → 이 스킬이 하는 일           │
│  사용 시점        → 실행 조건                    │
│  절차             → 단계별 워크플로              │
│  합리화           → 변명 + 반박                  │
│  위험 신호        → 문제가 있다는 징후           │
│  검증             → 증거 요구 사항               │
└─────────────────────────────────────────────────┘
```

**핵심 설계 선택:**

- **설명보다 절차.** 스킬은 에이전트가 읽는 참조 문서가 아니라 따라야 할 워크플로입니다. 각각 단계, 체크포인트, 종료 기준이 있습니다.
- **합리화 반박.** 모든 스킬에는 에이전트가 단계를 건너뛰려고 흔히 쓰는 변명(예: "테스트는 나중에 추가하겠다")과 문서화된 반박을 담은 표가 있습니다.
- **검증은 타협할 수 없습니다.** 모든 스킬은 테스트 통과, 빌드 출력, 런타임 데이터 같은 증거 요구사항으로 끝납니다. "맞는 것 같다"로는 충분하지 않습니다.
- **점진적 공개.** 진입점은 `SKILL.md`입니다. 보충 참조 자료는 필요할 때만 불러 토큰 사용량을 최소화합니다.

---

## 프로젝트 구조

이식 가능한 핵심은 공유 디렉터리에 둡니다. 호스트별 경로는 브랜드 별칭이 아니라 기본 검색 규약입니다. 이름을 바꾸거나 합치면 그 정확한 위치를 검색하는 도구가 작동하지 않습니다.

| 계층 / 소비자 | 저장소 경로 | 목적 |
|---|---|---|
| 공용 워크플로 핵심 | `skills/` (스킬 25개) | 모든 통합에서 쓰는 이식 가능한 `SKILL.md` 워크플로 |
| 공용 검토 자료 | `agents/` (페르소나 4개), `references/` (체크리스트 7개) | 저장소 전체 설치에 포함되는 전문가 검토자와 팩 공통 체크리스트 |
| Claude Code 어댑터 | `.claude/commands/` (명령 9개), `.claude-plugin/`, `hooks/` | 슬래시 명령 래퍼, 마켓플레이스 메타데이터, 수명 주기 훅 |
| Gemini CLI 어댑터 | `.gemini/commands/` (명령 9개) | Gemini 기본 TOML 명령 래퍼 |
| Antigravity CLI 어댑터 | `commands/` (명령 9개), `plugin.json` | 레거시 TOML 래퍼와 최상위 플러그인 매니페스트. [알려진 래퍼 제약](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/antigravity-setup.md#lifecycle-workflows-and-command-compatibility) 참고 |
| Codex 어댑터 | `.codex-plugin/`, `.agents/plugins/` | Codex 플러그인 메타데이터와 마켓플레이스 등록. Codex는 `skills/`를 직접 소비 |
| GitHub Copilot CLI 어댑터 | `plugin.json` | 최상위 플러그인 메타데이터. Copilot CLI는 규약에 따라 `skills/`를 검색하며 수명 주기 래퍼는 등록하지 않음 |
| 기여자 도구 | `scripts/` (스크립트 13개), `evals/` (사례 파일 25개), `.github/workflows/` | 검증, 라우팅 평가, CI |
| 문서 | `docs/` | 공통 안내와 도구별 설정 안내 |

저장소에 어댑터 디렉터리가 없는 도구는 공용 `skills/` 핵심을 해당 도구의 기본 위치에 설치하거나 복사합니다. [빠른 시작](#빠른-시작)에는 지원 호스트별 설정 안내 링크가 있습니다.

---

## Agent Skills가 필요한 이유

AI 코딩 에이전트는 기본적으로 가장 짧은 경로를 택하며, 이는 명세, 테스트, 보안 검토, 소프트웨어의 신뢰성을 지탱하는 관행을 생략하는 경우가 많습니다. Agent Skills는 선임 엔지니어가 운영 코드에 적용하는 것과 같은 규율을 강제하는 구조적인 워크플로를 제공합니다.

각 스킬에는 어렵게 얻은 엔지니어링 판단이 담겨 있습니다. *언제* 명세를 쓰고, *무엇을* 테스트하며, *어떻게* 검토하고, *언제* 출시할지에 관한 판단입니다. 범용 프롬프트가 아니라 운영 품질의 작업과 프로토타입 수준의 작업을 가르는, 분명한 관점을 갖춘 절차 중심 워크플로입니다.

스킬에는 [Software Engineering at Google](https://abseil.io/resources/swe-book)과 Google의 [엔지니어링 관행 안내](https://google.github.io/eng-practices/)에서 가져온 개념을 비롯해 Google 엔지니어링 문화의 모범 사례가 녹아 있습니다. API 설계에는 하이럼의 법칙, 테스트에는 Beyonce Rule과 테스트 피라미드, 코드 검토에는 변경 크기와 검토 속도 규범, 단순화에는 체스터턴의 울타리, Git 워크플로에는 트렁크 기반 개발, CI/CD에는 Shift Left와 기능 플래그가 있으며, 코드를 부채로 다루는 전용 폐기 스킬도 있습니다. 추상적인 원칙에 머무르지 않고 에이전트가 따르는 단계별 워크플로에 직접 들어 있습니다.

---

## 다른 도구와의 비교

[Superpowers](https://github.com/obra/superpowers)나 [Matt Pocock의 스킬](https://github.com/mattpocock/skills)과 어떻게 다른지 궁금한가요? 세 도구의 구성 차이와 각각의 사용 시점을 솔직하게 나란히 비교한 **[docs/comparison.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/comparison.md)**를 참고하세요. 통제된 [일대일 비교 실험](https://www.linkedin.com/pulse/superpowers-vs-agent-skills-faster-shipping-safer-reasoning-om-mishra-dzakf/) 링크도 포함됩니다.

---

## 기여

스킬은 **구체적**이고(모호한 조언 대신 실행 가능한 단계), **검증 가능**하며(증거 요구사항이 있는 명확한 종료 기준), **실전 검증**을 거쳤고(실제 워크플로 기반), **최소한**이어야 합니다(에이전트를 안내하는 데 필요한 내용만).

형식 명세는 [docs/skill-anatomy.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/skill-anatomy.md), 기여 지침은 [CONTRIBUTING.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/CONTRIBUTING.md)를 참고하세요. 이식 가능한 `SKILL.md` frontmatter를 깨뜨리지 않고 모델 라우팅, 도구 제한, 기타 에이전트별 런타임 제어를 적용하는 방법은 [docs/advanced-per-agent-configuration.md](https://github.com/addyosmani/agent-skills/blob/301b02b12bff98e4688e6984af6556802322bbde/docs/advanced-per-agent-configuration.md)에 있습니다.

---

## 팀

agent-skills의 제작·유지보수 참여자입니다.

| | 이름 | GitHub | 역할 |
|---|------|--------|------|
| <img src="https://github.com/addyosmani.png?size=120" width="60" height="60" alt="Addy Osmani"> | **Addy Osmani** | [@addyosmani](https://github.com/addyosmani) | 제작자 |
| <img src="https://github.com/federicobartoli.png?size=120" width="60" height="60" alt="Federico Bartoli"> | **Federico Bartoli** | [@federicobartoli](https://github.com/federicobartoli) | 협력자 |
| <img src="https://github.com/nucliweb.png?size=120" width="60" height="60" alt="Joan León"> | **Joan León** | [@nucliweb](https://github.com/nucliweb) | 협력자 |

---

## 라이선스

MIT - 프로젝트, 팀, 도구에서 이 스킬들을 사용하세요.
