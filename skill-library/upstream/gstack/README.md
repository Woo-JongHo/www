> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# gstack

gstack은 Claude Code(및 다른 코딩 에이전트)를 가상 엔지니어링 팀으로 바꾼다. 제품을 재고하는 CEO, 아키텍처를 확정하는 엔지니어링 매니저, AI 슬롭을 잡아내는 디자이너, 프로덕션 버그를 찾는 리뷰어, 실제 브라우저를 여는 QA 리드, OWASP + STRIDE 감사를 수행하는 보안 책임자, PR을 배포하는 릴리스 엔지니어로 구성된다. 모든 슬래시 명령, 모든 Markdown, 모두 무료이며 MIT 라이선스다.

저는 [Y Combinator](https://www.ycombinator.com/)의 사장 겸 CEO인 [Garry Tan](https://x.com/garrytan)입니다. 이것은 제가 매일 사용하는 오픈 소스 소프트웨어 공장이며, 이 도구들은 모두가 사용할 수 있어야 하므로 공유합니다. 이야기, 생산성 수치, 그리고 제가 한 번에 10개의 스프린트를 운영하는 방법은 [Why gstack](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/why-gstack.md)에 있습니다.

포크하세요. 개선하세요. 여러분의 것으로 만드세요. 무료 오픈 소스 소프트웨어를 싫어하고 싶다면 그래도 괜찮지만, 먼저 써 보기를 바랍니다.

**대상 사용자:**
- **창업자와 CEO** — 특히 여전히 제품을 출시하고 싶은 기술적 리더
- **처음 사용하는 Claude Code 사용자** — 빈 프롬프트 대신 구조화된 역할
- **테크 리드와 스태프 엔지니어** — 모든 PR에 엄격한 검토, QA 및 릴리스 자동화

## gstack의 용도

- **한 명의 빌더를 위한 전체 팀의 판단.** 제품, 디자인, 엔지니어링, QA, 보안 및 릴리스 검토를 각각 전문 역할이 수행한다.
- **CI가 놓치는 것을 잡는다.** 테스트는 통과하지만 프로덕션에서 깨지는 버그를 출시 전에 찾는다.
- **신뢰할 수 있는 AI 작성 변경.** 모든 변경에는 테스트, 검토 및 둘 다의 증거가 따라오므로 모든 줄을 다시 읽지 않고 병합할 수 있다.
- **무료, 공개, 이식 가능.** MIT 라이선스이며 Claude Code와 다른 주요 코딩 에이전트에서 실행된다.

## 빠른 시작

1. gstack을 설치한다(두 번 붙여넣기, 약 30초 설정. 아래 참조).
2. `/office-hours`를 실행하고 만드는 것을 설명한다. 프레이밍에 이의를 제기하고 다른 스킬이 읽는 설계 문서를 작성한다.
3. 변경이 있는 모든 브랜치에서 `/review`를 실행한다. CI를 통과하지만 프로덕션에서 깨지는 버그를 찾아 명백한 것은 수정한다.
4. 스테이징 URL 또는 격리된 로컬 API, CLI, 작업이나 webhook에서 `/qa`를 실행한다. 실제 브라우저를 열어 버그를 재현하고 수정한다.

여기서 멈춘다. 이것이 자신에게 맞는지 알게 될 것이다. 전체 스프린트가 필요해지면 `/autoplan`은 계획을 처음부터 끝까지 검토하고 `/ship`은 테스트, 검토 및 PR을 수행한다.

## 설치 — 약 30초

**요구 사항:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Git](https://git-scm.com/), [Bun](https://bun.sh/) v1.4.2+(검증된 버전. 컴파일된 도구가 프로젝트의 `.env`를 읽게 되는 1.3.3 미만 Bun은 setup이 거부함), 그리고 Windows의 [Node.js](https://nodejs.org/)다. **macOS 권장:** 브라우저 스킬, `/make-pdf`, `/diagram`이 실제 로그인 세션으로 먼저 구동하는 [Aside](https://aside.com) 브라우저(macOS 15+)다. 이것이 없으면 `./setup`이 gstack 자체 번들 브라우저를 빌드한다. `/cso`에도 네이티브 툴체인이 필요하며, setup은 이를 알리고 툴체인이 없으면 사용할 수 없게 둔다. 소요 시간, `/cso` 전제 조건 및 setup이 등록하는 hook은 [docs/install.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/install.md)를 참조한다.

### 1단계: 컴퓨터에 설치

Claude Code를 열고 이것을 붙여넣는다. 나머지는 Claude가 수행한다.

> gstack 설치: **`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`**을 실행한 뒤, 모든 웹 탐색에 gstack의 /browse 스킬을 사용하고 mcp\_\_claude-in-chrome\_\_\* 도구는 절대 사용하지 말라고 적은 "gstack" 섹션을 CLAUDE.md에 추가한다. Claude Code는 설치된 스킬을 직접 나열하므로 섹션에 스킬 목록은 필요 없다. 그런 다음 팀원도 사용할 수 있도록 현재 프로젝트에 gstack을 추가할지 사용자에게 묻는다.

**받게 되는 업데이트:** 새 설치는 main의 모든 병합 대신 `stable` 채널, 즉 태그된 릴리스(월요일과 목요일, 최대 72시간에 한 번, 중요한 수정은 약 하루 내, 절대 일주일 이상 뒤처지지 않으며 검증된 보안 및 회귀 수정 포함)를 따른다. `./setup`은 컴퓨터에서 처음 실행될 때 이를 기록하고 출력한다. 클론 자체는 main의 최신 커밋에서 시작하며 업데이터는 checkout을 뒤로 이동시키지 않으므로, 이를 통과하는 다음 릴리스 시점에(며칠 내) 릴리스로 이동한다. gstack 기여자의 checkout(`bin/dev-setup`으로 표시됨, origin의 기본 `main`이 아닌 브랜치에 있거나 로컬 커밋을 가짐)과 Capy crew 머신(설치 관리자가 `main`을 기록함)은 대신 `main`을 따릅니다. stable이 기본값이 되기 전에 설정한 설치는 계속 `main`을 따릅니다. 전환하려면 `~/.claude/skills/gstack/bin/gstack-config set update_channel main`(모든 병합) 또는 `~/.claude/skills/gstack/bin/gstack-config set update_channel stable`(릴리스만)을 실행합니다. 자세한 내용: [docs/releases.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/releases.md#channels).

### 2단계: 팀 모드 — 공유 저장소 자동 업데이트(권장)

저장소 내부에서 이것을 붙여넣는다. 팀 모드로 전환하고 팀원이 gstack을 자동으로 받도록 저장소를 부트스트랩하며 변경을 커밋한다.

```bash
(cd ~/.claude/skills/gstack && ./setup --team) && ~/.claude/skills/gstack/bin/gstack-team-init required && git add .claude/ CLAUDE.md && git commit -m "require gstack for AI-assisted work"
```

저장소에 vendored 파일이 없고, 버전 드리프트도 없으며, 수동 업그레이드도 없다. 모든 Claude Code 세션은 빠른 자동 업데이트 검사로 시작한다(시간당 한 번으로 제한, 네트워크 실패에 안전, 완전히 조용함). 팀 모드는 `update_channel`이 `auto`일 때(따라서 stable이 기본값이 되기 전 설치에서도) main의 모든 병합이 아닌 `stable` 채널을 따른다. 즉 태그된 릴리스(월요일과 목요일, 최대 72시간에 한 번, 중요한 수정은 약 하루 내, 절대 일주일 이상 뒤처지지 않으며 검증된 보안 및 회귀 수정 포함)다. `gstack-config set update_channel main`은 대신 모든 병합을 따른다. [docs/releases.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/releases.md#channels)를 참조한다.

팀원을 막기보다 유도하고 싶다면 `required`를 `optional`로 바꾼다.

팀 모드의 `required` hook은 Node.js에서 실행되므로 모든 팀원에게 PATH의 Node.js가 필요하다([세부 사항](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/install.md#team-mode)). 나중에 gstack을 제거하려면 [docs/uninstall.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/uninstall.md)를 참조한다.

### 다른 AI 에이전트

gstack은 Claude보다 많은 에이전트에서 실행된다. 인자 없는 `./setup`은 Claude
Code에만 설치한다(OpenClaw, Hermes 또는 Dot 내부에서 실행하면 해당 하니스에
gstack 스킬도 등록한다. [docs/hosts.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/hosts.md#agent-harnesses) 참조).
`--host <name>`으로 다른 에이전트를 선택하거나, 이 컴퓨터에서 setup이 감지하는
모든 에이전트에 `--host auto`로 설치한다.

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/gstack
cd ~/gstack && ./setup --host auto      # or: ./setup --host codex
./setup --status                         # one row per install: host, tier, scope, version, path
```

명시적인 `--host X`는 X에만 설치하며 다른 에이전트의 설치를 절대 변경하지
않는다. `/gstack-upgrade`는 등록한 모든 설치를 새로 고치고, 호스트별로 한 줄을
표시하며 실패한 항목을 알려 준다.

티어: **full**은 실제 워크플로 실행으로 인증된다([호스트 인증](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/ADDING_A_HOST.md#certify-your-host) 참조). **experimental**은 설치되고 적합성 테스트를 통과하지만 아직 인증 실행이 없다. **instruction-only**는 아무것도 설치하지 않고 setup이 복사할 내용을 출력한다.

| 에이전트 | 티어 | 설치 | 첫 호출 | 안전 스킬 | 외부 검토 필요 사항 | 복구 |
|-------|------|---------|------------------|---------------|----------------------|--------|
| Claude Code | full | `--host claude`(기본값) | `/office-hours` | 강제됨(hook이 차단) | 로그인한 Codex CLI | `./setup --host claude` |
| OpenAI Codex CLI | experimental | `--host codex` → `${CODEX_HOME:-~/.codex}/skills/gstack-*/` | `gstack-office-hours`를 요청 | 권고, 차단하지 않음 | 로그인한 Claude Code CLI | `./setup --host codex` |
| OpenCode | experimental | `--host opencode` → `~/.config/opencode/skills/gstack-*/` + `/gstack-*` 명령 | `/gstack-office-hours` | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host opencode` |
| Cursor | experimental | `--host cursor` → `~/.cursor/skills/gstack-*/` | `gstack-office-hours`를 요청 | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host cursor` |
| Factory Droid | experimental | `--host factory` → `~/.factory/skills/gstack-*/` | `gstack-office-hours`를 요청 | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host factory` |
| Kiro | experimental | `--host kiro` → `~/.kiro/skills/gstack-*/` | `gstack-office-hours`를 요청 | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host kiro` |
| GitHub Copilot CLI | experimental | `--host copilot` → `~/.copilot/skills/gstack-*/` | `/gstack-office-hours` | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host copilot` |
| Antigravity CLI | experimental | `--host agy`(또는 `--host antigravity`) → `~/.gemini/antigravity-cli/skills/gstack-*/` | `/gstack-office-hours` | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host agy` |
| Gemini CLI | experimental | `--host gemini`(또는 `--host gemini-cli`) → `~/.gemini/skills/gstack-*/` | `gstack-office-hours`를 요청 | 권고, 차단하지 않음 | 로그인한 Codex CLI | `./setup --host gemini` |
| Slate | instruction-only | `--host slate`(Claude 설치를 가리킴. Slate는 `.claude/skills`를 읽음) | Claude 설치를 통해 `/office-hours` | 권고, 차단하지 않음 | — | `./setup --host claude` |
| OpenClaw | experimental | `--host openclaw`(OpenClaw의 skills 폴더에 5개 작업 스킬과 하나의 `gstack` 라우터 스킬, OpenClaw 내부에서 setup 실행 시 자동, [docs/OPENCLAW.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/OPENCLAW.md)의 ACP 경로) | 작업을 요청하면 에이전트가 일치하는 작업 스킬 또는 `gstack` 라우터를 엶 | 권고, 차단하지 않음 | — | `./setup --host openclaw` |
| Hermes | experimental | `--host hermes`(`$HERMES_HOME/skills/gstack`의 모든 스킬, Hermes 내부에서 setup 실행 시 자동) | 작업 또는 `/gstack-review`를 요청 | 권고, 차단하지 않음 | — | `./setup --host hermes` |
| GBrain (mod) | instruction-only | `--host gbrain`(brain-aware 변형은 GBrain 저장소에서 제공) | — | 권고, 차단하지 않음 | — | — |

호스트별 참고 사항(에이전트 하니스, Copilot, Antigravity, Gemini CLI, OpenClaw 및 ClawHub, Codex 동작 프로필과 모델 티어, 외부 검토 제공자, 디자인 바이너리 모델)은 [docs/hosts.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/hosts.md)에 있다. 규칙을 읽는 모든 에이전트(Zed, Amp, Jules)는 설치 없이 2KB [에이전트 요약](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/agents-digest/gstack-AGENTS.md)을 사용할 수 있다. 호스트 추가: [docs/ADDING_A_HOST.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/ADDING_A_HOST.md).

## 작동 모습 보기

```
You:    제 캘린더를 위한 일일 브리핑 앱을 만들고 싶어요.
You:    /office-hours
Claude: [고충을 묻는다 — 가정이 아닌 구체적 사례]

You:    여러 Google 캘린더, 오래된 정보의 이벤트, 잘못된 위치.
        준비에 너무 오래 걸리고 결과도 충분히 좋지 않아요...

Claude: 프레이밍에 이의를 제기하겠습니다. \"일일 브리핑
        앱\"이라고 했지만 실제로 설명한 것은 개인 비서
        AI입니다.
        [설명하고 있음을 깨닫지 못한 5가지 기능을 추출]
        [4가지 전제를 검토 — 동의, 반대 또는 조정]
        [노력 추정치가 있는 3가지 구현 접근법 생성]
        권장: 내일 가장 좁은 웨지를 출시하고 실제 사용에서
        배운다. 전체 비전은 3개월 프로젝트이므로 실제로 작동하는
        일일 브리핑부터 시작한다.
        [설계 문서 작성 → 후속 스킬에 자동으로 공급]

You:    /plan-ceo-review
        [설계 문서를 읽고, 범위에 이의를 제기하고, 10개 섹션 검토 실행]

You:    /autoplan
        [엔지니어링 단계: 데이터 흐름, 상태 머신, 오류 경로용 ASCII 다이어그램]
        [테스트 매트릭스, 실패 모드, 보안 문제]

You:    계획 승인. 계획 모드 종료.
        [11개 파일에 걸쳐 2,400줄 작성. 약 8분.]

You:    /review
        [자동 수정됨] 문제 2건. [질문] 경쟁 상태 → 수정 승인.

You:    /qa https://staging.myapp.com
        [실제 브라우저를 열고 플로를 클릭하며 버그를 찾아 수정]

You:    /ship
        테스트: 42 → 51(+9 신규). PR: github.com/you/app/pull/42
```

당신은 \"일일 브리핑 앱\"이라고 했다. 에이전트는 \"개인 비서 AI를 만들고 있다\"고 말했다. 기능 요청이 아니라 고충을 들었기 때문이다. 여덟 명령으로 처음부터 끝까지. 이것은 copilot이 아니다. 팀이다.

## 스프린트

gstack은 도구 모음이 아니라 프로세스다. 스킬은 스프린트가 진행되는 순서로 실행된다.

**생각 → 계획 → 구축 → 검토 → 테스트 → 출시 → 회고**

각 스킬은 다음 스킬에 입력을 제공한다. `/office-hours`는 `/plan-ceo-review`가 읽는 설계 문서를 작성한다. 대화형 `/autoplan` 실행의 엔지니어링 단계는 `/qa`가 이어받는 테스트 계획을 작성한다. `/review`는 `/ship`이 수정되었는지 검증하는 버그를 잡는다. 모든 단계가 앞선 내용을 알기 때문에 아무것도 누락되지 않는다.

| 스킬 | 담당 전문가 | 수행 내용 |
|-------|----------------|--------------|
| `/office-hours` | **YC Office Hours** | 여기서 시작한다. 코드 작성 전 제품을 재구성하는 여섯 가지 강제 질문. 프레이밍에 이의를 제기하고 전제를 검토하며 구현 대안을 생성한다. 설계 문서는 모든 후속 스킬에 입력된다. |
| `/plan-ceo-review` | **CEO / 창업자** | 문제를 다시 생각한다. 요청 안에 숨은 10점짜리 제품을 찾는다. 네 모드: Expansion, Selective Expansion, Hold Scope, Reduction. |
| `/plan-design-review` | **수석 디자이너** | 각 디자인 차원을 0~10점으로 평가하고 10점의 모습을 설명한 뒤, 거기에 도달하도록 계획을 편집한다. AI Slop 감지. 대화형이며 디자인 선택마다 AskUserQuestion 하나를 사용한다. |
| `/plan-devex-review` | **개발자 경험 리드** | 대화형 DX 검토: 개발자 페르소나를 탐색하고 경쟁사의 TTHW를 벤치마크하며 마법 같은 순간을 설계하고 마찰 지점을 단계별로 추적한다. 이를 읽는 에이전트의 오류 메시지를 점수화한다([agent-ready errors](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/agent-ready-errors.md)). 세 모드: DX EXPANSION, DX POLISH, DX TRIAGE. 20~45개의 강제 질문. |
| `/design-consultation` | **디자인 파트너** | 처음부터 완전한 디자인 시스템을 구축한다. 환경을 조사하고 창의적 위험을 제안하며 현실적인 제품 목업을 생성한다. 열린 DESIGN.md 형식으로 `DESIGN.md`를 작성하므로 impeccable, Google Stitch 및 이를 읽는 모든 도구가 한 파일을 공유한다. |
| `/review` | **스태프 엔지니어** | CI를 통과하지만 프로덕션에서 폭발하는 버그를 찾는다. 명백한 것은 자동 수정한다. 완전성 누락과 게이트 무결성을 표시한다. 완화된 테스트·timeout·snapshot·검사 억제 항목을 각각 이름을 명시해 사람의 판단에 전달한다. 권고적 단순화 렌즈는 과도하게 구축된 코드를 표시하지만 절대 차단하거나 자동 적용하지 않는다. |
| `/deslop-shared-libs` | **공유 코드 검토자** | 최근 작업에서 가치 있는 공유 코드 추출을 찾는다. 최대 다섯 기회를 비교하고 소스 증거, 신뢰성 향상 및 총 코드 절감과 함께 상위 세 개를 권고한다. 권고만 한다. |
| `/write-skill` | **스킬 편집자** | 비대해지지 않게 새 에이전트 스킬을 작성하거나 기존 스킬을 개선한다. 다섯 단계 편집 사다리(먼저 도구 수정, 모델이 이미 하는 일은 추가하지 않기, 덧붙이지 말고 줄 편집, 에이전트에 닿는 가장 낮은 수준, 이야기가 아닌 규칙), 단계별 크기와 지난 다이어트 이후 증가를 위한 `gstack-skill-bill`, 스킬이 언급하는 모든 gstack 명령과 flag가 여전히 존재하는지 확인하는 드리프트 검사, 전/후/스킬 없음 테스트로 증명한 전체 다이어트가 포함된다. |
| `/test-audit` | **테스트 감사자** | 보호하는 것보다 비용이 큰 기존 테스트를 훑는다. 소스 grep, 중복, assertion 없는 probe, 테스트 전용 export를 찾는다. 모든 후보에는 증거 카드가 붙으며, 배치를 승인하기 전에는 보고만 한다. |
| `/verify` | **빌드 루프** | 저장소 자체 검사(typecheck, lint, build)와 변경에 대해 `/ship`의 사전 게이트가 고를 테스트를 실행하고, 깨지는 것을 수정하며, green이 될 때까지 반복한 후 `/ship`에 인계한다. 저장소 명령 실행 전 한 번 묻고, 어떤 테스트도 다루지 않는 변경을 절대 green이라 하지 않는다. |
| `/design-review` | **코드를 작성하는 디자이너** | /plan-design-review와 같은 감사를 수행한 뒤 찾은 것을 수정한다. 원자적 커밋, 전후 스크린샷. impeccable이 설치되어 있으면 그 엔진이 먼저 실행되고 모든 기계적 발견에는 규칙 ID가 태그된다. |
| `/devex-review` | **DX 테스터** | 라이브 개발자 경험 감사. 실제로 온보딩을 테스트한다. 문서를 탐색하고, 시작하기 플로를 시도하고, TTHW를 측정하고, 에이전트가 마주치는 방식으로 CLI 오류를 발생시킨다(`gstack-error-capture`: 터미널 없음, 격리됨, 민감 정보 가림). `/plan-devex-review` 점수와 비교한다. 계획이 현실과 맞았는지 보여 주는 부메랑이다. |
| `/design-shotgun` | **디자인 탐색자** | \"선택지를 보여줘.\" AI 목업 변형 4~6개를 생성하고 브라우저에서 비교 보드를 열며 피드백을 수집하고 반복한다. 취향 메모리는 좋아하는 것을 학습한다. 무언가를 사랑하게 될 때까지 반복한 뒤 `/design-html`에 넘긴다. |
| `/design-html` | **디자인 엔지니어** | 목업을 실제로 작동하는 프로덕션 HTML로 바꾼다. Pretext 계산 레이아웃: 텍스트가 리플로우되고 높이가 조정되며 레이아웃이 동적이다. 30KB, 의존성 없음. React/Svelte/Vue를 감지한다. 디자인 유형별 스마트 API 라우팅(랜딩 페이지 대 대시보드 대 폼). impeccable 엔진을 사용할 수 있으면 슬롭 게이트를 한 번 통과한다. 출력은 데모가 아니라 출시 가능하다. |
| `/design-motion` | **모션 디자이너** | 승인된 목업, 완성된 페이지 또는 URL을 쇼케이스 루프로 바꾼다. 정확한 프레임을 재구축하고 빈 상태에서 로드하며, 각 비주얼에 하나의 이야기를 부여하고 가짜 시계로 결정론적 프레임을 녹화한다. seam, empty-beat, rest 및 overflow 검사를 통과하면 X용 MP4, 웹사이트 GIF, 800×500 GIF를 내보낸다. ffmpeg가 필요하다. |
| `/qa` | **QA 리드** | 브라우저, API, CLI, 작업 및 webhook 동작을 탐색한다. 버그를 재현하고 실패하는 회귀를 작성하며 원인을 수정하고 커밋 전 다시 검증한다. |
| `/qa-only` | **QA 보고자** | 재현 가능한 증거로 탐색하고 보고한다. 제품 코드나 테스트를 변경하지 않고 회귀 사례를 제안한다. |
| `/pair-agent` | **멀티 에이전트 코디네이터** | 모든 AI 에이전트와 gstack 자체 브라우저를 공유한다. 명령 하나, 붙여넣기 한 번이면 연결된다. OpenClaw, Hermes, Codex, Cursor 또는 curl할 수 있는 모든 것에서 작동한다. 각 에이전트는 자체 탭을 받는다. 모든 것을 볼 수 있도록 headed 모드를 자동 실행한다. 원격 에이전트를 위해 ngrok tunnel을 자동 시작한다. 범위가 지정된 token, 탭 격리, rate limiting, 활동 귀속. (번들 브라우저 즉 fallback engine에서 실행하며 Aside를 구동하는 에이전트는 자체 탭만 연다.) |
| `/cso` | **최고 보안 책임자** | 애플리케이션 모델, 뒷받침된 발견 사항, 독립적 이의 제기 및 명시적 범위를 갖춘 보안 감사. catalog profile 없이도 정적 평가는 가능하다. 일치하는 적격 profile이 있으면 포괄 모드가 Node/Bun, Python 및 Rails에 대해 격리된 runtime/scanner 실행과 검토 가능한 복구 후보를 추가한다. 적격 runtime 및 scanner 이미지는 linux/amd64와 linux/arm64용으로 게시된다. Docker가 없으면 감사는 정적 평가만 수행한다. runtime-test된 bundle은 별도의 외부 주장을 인증한다. 대상 코드가 테스트 프로세스를 제어하므로 프로젝트 테스트 완료는 `self_reported`로 남고, `tested`는 미래의 대상 독립적 완료 증인을 위해 예약된다. |
| `/ship` | **릴리스 엔지니어** | main을 동기화하고 테스트를 실행하며 변경 동작을 탐색하고 범위, 게이트 무결성 및 문서를 감사한 뒤 검증, push 및 PR 생성을 수행한다. |
| `/land-and-deploy` | **릴리스 엔지니어** | PR을 병합하고 CI와 배포를 기다리며 프로덕션 상태를 검증한다. \"approved\"에서 \"verified in production\"까지 하나의 명령. |
| `/modernize` | **오래된 PR 유지 관리자** | 노후 PR을 현재 base로 가져와 여전히 존재해야 하는지 말한다. MODERNIZE(rebase, `git range-diff` 증명, 관찰된 head에 고정된 lease로 push), REWORK(문제는 유효하지만 diff는 아님) 또는 CLOSE(권장하지만 허가 없이 절대 수행하지 않음)다. 텍스트뿐 아니라 의미의 충돌을 위해 base의 이동 범위를 읽는다. |
| `/canary` | **SRE** | 배포 후 모니터링 루프. 콘솔 오류, 성능 회귀 및 페이지 실패를 감시한다. |
| `/benchmark` | **성능 엔지니어** | 페이지 로드 시간, Core Web Vitals 및 리소스 크기를 기준선으로 잡는다. 모든 PR에서 전후를 비교한다. |
| `/ubicloud` | **원격 실행기** | 소유자 및 TTL 이름이 붙은 VM, reaper, quota 사전 점검, hang watchdog 및 저장소당 하나의 커밋된 verify를 사용하여 임시 16-vCPU Ubicloud VM에서 무거운 suite, build 또는 eval을 실행한다. |
| `/runaway-stopper` | **비용 감시자** | Capy에서 폭주하는 에이전트 thread와 subagent(자체 token 500M 또는 3일을 넘긴 상주 thread, 100M을 넘긴 subagent, 빈 wake, 끝없는 검토 라운드)를 찾아 깔끔한 지점에서 중지하고, 상주 thread를 handoff로 교대하며(crew thread는 병합되거나 닫힐 때까지 PR을 유지) 재발을 막는 기본값을 설정한다. `gstack-runaway scan`은 호스트 자체 thread 데이터를 읽을 뿐 절대 행동하지 않는다. |
| `/eval-plan` | **Eval 계획자** | 최초 유료 호출 전에 유료 eval을 사전 등록한다. 기준, arm, decoy 및 중지 규칙, 실제 입력에 대한 $0 stub-model dry run, 추정과 지출 표가 승인을 게이트하는 3개 항목 유료 pilot이 포함된다. |
| `/document-release` | **기술 문서 작성자** | 최종 검증과 게시 전에 모든 ship에서 변경된 동작을 프로젝트 문서와 대조해 감사한다. 독립 실행도 가능하다. 업데이트됨, 검토됨/최신 또는 차단된 문서와 남은 누락을 표시한다. |
| `/document-generate` | **문서 작성자** | Diataxis 프레임워크로 누락 문서를 처음부터 생성한다. 먼저 코드베이스를 조사한 뒤 코드와 실제로 일치하는 reference / how-to / tutorial / explanation 문서를 작성한다. 독립 호출하거나 범위 맵이 누락을 찾을 때 `/document-release`에서 연결해 호출할 수 있다. 더 알아보기: [tutorial](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/tutorial-document-generate.md) • [how-to](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/howto-document-a-shipped-feature.md) • [why Diataxis](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/explanation-diataxis-in-gstack.md). |
| `/retro` | **엔지니어링 매니저** | 팀 인식 주간 회고. 개인별 분석, 출시 연속 기록, 테스트 상태 추세, 성장 기회. `/retro global`은 모든 프로젝트와 AI 도구(Claude Code, Codex, Gemini, Kimi Code, OMP, Antigravity)에서 실행된다. |
| `/browse` | **QA 엔지니어** | 에이전트에 눈을 제공한다. 결정론적인 `aside repl` 스크립트로 먼저 사용자의 [Aside](https://aside.com) 브라우저를 구동하며 실제 세션·클릭·스크린샷을 사용한다. Aside가 없으면 gstack 자체 Chromium으로 대체한다. 실제 클릭과 명령당 약 100ms의 실행을 제공하며, `/open-gstack-browser`로 사이드바·봇 탐지 회피·자동 모델 라우팅을 갖춘 브라우저 창을 표시한다. 다른 모든 브라우저 스킬의 기반이다. |
| `/scrape` | **데이터 추출기** | 페이지의 실제 로그인 상태로 Aside 브라우저에서 웹 페이지의 구조화된 데이터(표, 목록, 가격)를 가져온다. fallback 브라우저에서는 `/skillify`가 플로를 다음번 약 200ms에 실행되는 영구 browser-skill로 바꾼다. |
| `/setup-browser-cookies` | **세션 관리자** | Chrome, Chromium, Brave, Edge, Windows 전용 Opera와 Opera GX 또는 macOS 전용 Comet과 Arc에서 선택한 cookie를 gstack 번들 브라우저로 복사한다. 프로필과 domain을 선택한다. 복사와 로그인 검증은 별개다. fallback 경로에서만 필요하며 Aside에는 이미 세션이 있다. |
| `/autoplan` | **검토 파이프라인** | 명령 하나로 검토된 계획을 만든다. 대화형 세션에서 인코딩된 결정 원칙을 갖고 각 스킬 고유 방식으로 CEO → design → DX → eng 검토를 실행하며(eng는 항상 마지막이므로 shipping gate가 최종 수정 계획을 검토함), 취향 결정만 승인 대상으로 표시한다. `gstack-autoplan`(Capy 기본값)이 구동하는 실행은 그 방식들 대신 검토자에게 짧은 체크리스트를 제공한다. lean 실행은 검토자 하나, `--full`은 단계당 하나다([각 실행이 로드하는 항목](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/skills.md#what-each-run-loads)). |
| `/spec` | **명세 작성자** | 모호한 의도를 다섯 단계(why, scope, 필수 code-reading을 포함한 technical, draft, file)로 정확하고 실행 가능한 명세로 바꾼다. 등록 전 외부 검토 품질 게이트(Codex에서는 Claude Code, 다른 하니스에서는 Codex, 7/10 미만 차단), fail-closed secret redaction, 기존 issue와 중복 제거, 팀 corpus recall용 `$GSTACK_STATE_ROOT/projects/$SLUG/specs/` 아카이브가 포함된다. `--execute`는 새 worktree에서 `claude -p`를 생성하고, `/ship`은 병합 시 원본 issue를 자동 종료한다. 계획 모드를 인식한다. |
| `/learn` | **메모리** | 세션 전반에서 gstack이 학습한 것을 관리한다. 프로젝트별 패턴, 함정 및 선호를 검토, 검색, 정리 및 내보내기한다. 학습은 세션에 걸쳐 축적되므로 시간이 지날수록 코드베이스에 대해 더 똑똑해진다. |
| `/make-pdf` | **출판 도구** | Markdown을 받아 출판 품질 문서를 출력한다. Mermaid와 excalidraw fence는 완전 오프라인으로 vector diagram으로 렌더링된다. 이미지는 페이지 크기에 맞춰지며 절대 잘리지 않고, 넓은 diagram은 자체 landscape 페이지를 얻는다. `--to html`은 자체 완결 파일 하나를, `--to docx`는 Word 문서를 출력한다. |
| `/diagram` | **다이어그램 작성기** | 영어를 받아 편집 가능한 diagram을 출력한다. mermaid source, excalidraw.com에서 열고 편집할 수 있는 `.excalidraw`(손그림 스타일), 렌더링된 SVG/PNG의 세 항목을 출력한다. 네트워크는 사용하지 않는다. markdown에 source를 포함하면 `/make-pdf`가 렌더링한다. |

동일한 `/qa`와 `/qa-only` 명령은 브라우저 없이 CLIs, APIs, jobs, workers 및 webhooks를 테스트한다: [웹 페이지 없는 QA](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/qa-without-a-webpage.md).

### 어떤 검토를 사용해야 하나?

| 구축 대상 | 계획 단계(코드 전) | 라이브 감사(출시 후) |
|-----------------|--------------------------|----------------------------|
| **최종 사용자**(UI, 웹 앱, 모바일) | `/plan-design-review` | `/design-review` |
| **개발자**(API, CLI, SDK, 문서) | `/plan-devex-review` | `/devex-review` |
| **아키텍처**(데이터 흐름, 성능, 테스트) | `/autoplan`(eng 단계) | `/review` |
| **위 모두** | `/autoplan`(CEO → design → DX → eng 실행, 적용할 것을 자동 감지, eng는 항상 마지막) | — |

### 고급 도구

| 스킬 | 수행 내용 |
|-------|-------------|
| `/codex` | **제2 의견** — OpenAI Codex CLI의 독립 코드 검토. 검토·이의 제기·상담 모드를 제공한다. Codex를 제외한 모든 하니스에서 사용 가능. |
| `/claude-code` | **제2 의견** — Claude Code의 독립 코드 검토. 검토, 이의 제기 및 상담 모드이며, 상담에는 세션 연속성이 있다. Claude Code를 제외한 모든 하니스에서 사용 가능. |
| `/careful` | **안전 가드레일** — 파괴적 명령(rm -rf, DROP TABLE, force-push) 전에 경고한다. 활성화하려면 \"be careful\"이라고 말한다. 모든 MEDIUM 경고를 재정의할 수 있지만 root/home 재귀 삭제와 기본 브랜치 force-push는 강제 거부된다. |
| `/freeze` | **편집 잠금** — 파일 편집을 하나의 디렉터리로 제한한다. 디버깅 중 범위 밖의 우발적 변경을 방지한다. |
| `/guard` | **완전 안전** — 하나의 명령으로 `/careful` + `/freeze`. 프로덕션 작업의 최대 안전성. |
| `/unfreeze` | **잠금 해제** — `/freeze` 경계를 제거한다. |
| `/open-gstack-browser` | **GStack 브라우저** — sidebar, anti-bot stealth, 자동 모델 라우팅(행동에는 Sonnet, 분석에는 Opus), 원클릭 cookie 가져오기, Claude Code 통합과 함께 gstack 자체 브라우저를 headed로 실행한다. 페이지를 정리하고, 스마트 스크린샷을 찍고, CSS를 편집하며, 정보를 터미널로 다시 전달한다. fallback engine의 보이는 모습이며, Aside가 열려 있으면 대신 그곳에서 에이전트의 탭을 본다. |
| `/setup-deploy` | **배포 구성자** — `/land-and-deploy`를 위한 일회성 설정. 플랫폼, 프로덕션 URL 및 배포 명령을 감지한다. |
| `/setup-gbrain` | **GBrain 온보딩** — 5분 이내에 zero에서 실행 중인 gbrain까지. 로컬 PGLite, 기존 URL의 Supabase 또는 Management API를 통한 새 Supabase 프로젝트 자동 프로비저닝. Claude Code용 MCP 등록 + 저장소별 신뢰 삼중항(read-write/read-only/deny). [전체 가이드](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/USING_GBRAIN_WITH_GSTACK.md). |
| `/sync-gbrain` | **Brain 최신 유지** — `gbrain sources add` + `gbrain sync --strategy code`로 이 저장소 코드를 gbrain에 다시 색인하고, CLAUDE.md의 `## GBrain Search Guidance` 블록을 새로 고치며, capability 검사가 실패하면 guidance를 자동 제거한다. `--incremental`(기본값), `--full`, `--dry-run`. 멱등적이며 재실행해도 안전하다. |
| `/gstack-upgrade` | **자체 업데이터** — gstack을 최신으로 업그레이드한다. 전역 설치와 vendored 설치를 감지하고 둘 다 동기화하며 변경 사항을 표시한다. |
| `/captain` | **Crew 컨트롤러**(Capy 전용: [Capy의 gstack](#capy%EC%9D%98-gstack)) — 하나의 컨트롤러에서 많은 코딩 에이전트를 실행한다. lane은 READY 블록을 보내고 절대 병합하지 않으며, 컨트롤러는 train을 통해 병합한다(호출 시 stamp, 예상 head로 검증 및 병합). digest를 유지하고, 고정 형식으로 승인을 전달하며, 매일 flaky-fix pass를 실행한다. `/crew`에도 응답한다. [팀 가이드](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/crew/docs/captain.md). |
| `/ios-qa` | **iOS 라이브 기기 QA(v1.43.0.0+)** — 앱에 내장된 `StateServer`를 통해 USB CoreDevice로 실제 iPhone 또는 iPad를 구동한다. Swift 소스를 읽고, typed `@Observable` accessor를 codegen하며, 에이전트 루프를 실행한다. 선택적 `--tailnet` flag는 Tailscale tailnet의 OpenClaw 또는 HTTP 가능 에이전트에 기기를 노출하므로 원격 에이전트가 하드웨어를 전혀 만지지 않고 iOS QA를 실행할 수 있다. capability-tier allowlist(observe/interact/mutate/restore), 기기별 세션 잠금, 감사 로그. |
| `/ios-fix`, `/ios-design-review`, `/ios-clean`, `/ios-sync` | iOS 버그 수정 루프, 디자이너 관점의 HIG 감사, debug-bridge 정리 및 accessor 재동기화. `docs/skills.md` 참조. 종단 간 안내: [docs/howto-ios-testing-with-gstack.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/howto-ios-testing-with-gstack.md). |

슬래시 명령 외에도 gstack은 독립 CLIs(`gstack-egress`, `gstack-context-bill`, `gstack-model-benchmark`, `gstack-pr-wait`, 검토 및 증거 ledger, iOS QA daemon)를 제공한다: [docs/standalone-binaries.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/standalone-binaries.md). fallback 브라우저의 사이트별 [domain skills](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/domain-skills.md)와 raw CDP escape hatch, 그리고 많은 스킬이 제공하는 [voice-input aliases](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/voice-input.md)에는 각각 별도 페이지가 있다.

**[각 스킬의 예제와 철학을 자세히 살펴보기 →](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/skills.md)**

## GBrain — 코딩 에이전트를 위한 영속 지식

[GBrain](https://github.com/garrytan/gbrain)은 AI 에이전트를 위한 영속 지식 베이스다. 에이전트가 세션 사이에 실제로 보관하는 메모리라고 생각하면 된다. GStack은 zero에서 \"실행 중이고, 에이전트가 호출할 수 있다\"까지 하나의 명령 경로를 제공한다.

```bash
/setup-gbrain
```

네 가지 설정 경로, 저장소별 신뢰 정책과 메모리 동기화의 요약: [docs/gbrain-quick-tour.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/gbrain-quick-tour.md). **전체 안내 — 모든 시나리오·플래그·실행 도우미·문제 해결 단계:** [USING_GBRAIN_WITH_GSTACK.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/USING_GBRAIN_WITH_GSTACK.md)

기타 참조: [docs/gbrain-sync.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/gbrain-sync.md)(sync 전용 가이드) • [docs/gbrain-sync-errors.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/gbrain-sync-errors.md)(오류 색인)

## Capy의 gstack

[Capy](https://capy.ai) 머신에서 `./setup`은 gstack의 crew 도구도 로드한다. 하나의 컨트롤러에서 많은 에이전트 thread를 실행하는 `/captain`, 검증된 pull request를 반영하는 merge queue, 각 병합을 검토·테스트된 head에 연결하는 receipt, `/ship`과 `/autoplan`의 지출 상한이다. 이들은 [crew/](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/crew/README.md)에 있으며 Capy에서만 로드되므로 다른 설치는 영향을 받지 않는다.

## 플랫폼 참고 사항

macOS와 Linux는 전체 지원을 받는다. Windows와 Gemini 모델은 최소 지원을 받는다. 설치와 핵심 스킬은 작동하지만 그 이상은 보장하지 않는다. [지원 티어](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/support-tiers.md)를 참조한다.

**macOS:** 모든 것이 실행된다. [Aside](https://aside.com) 브라우저(macOS 15+)가 열려 있고 로그인되어 있으면 브라우저 스킬, `/make-pdf`, `/diagram`은 이를 실제 세션과 함께 사용한다. 그렇지 않으면 `./setup`이 빌드하는 번들 브라우저를 사용한다. gstack은 Aside를 절대 설치하지 않는다.

**Linux:** 모든 것이 번들 브라우저에서 실행된다. Aside는 macOS 전용이므로 readiness probe가 한 번 `NEEDS_ASIDE: Linux`라고 표시하고 스킬은 gstack 자체 Chromium을 사용한다. Chromium이 설치되지만 호스트가 비특권 사용자 namespace를 차단해(Ubuntu 24.04+ AppArmor 기본값) 실행할 수 없으면 `GSTACK_CHROMIUM_NO_SANDBOX=1`을 설정한다.

**Windows 사용자:** gstack은 Git Bash 또는 WSL을 통해 Windows 11에서 작동한다. Aside는 macOS 전용이므로 Windows(및 Linux)에서는 브라우저 스킬, `/make-pdf`, `/diagram`이 항상 gstack 번들 브라우저를 사용한다. Bun 외에 Node.js가 필요하다. Bun에는 Windows의 Playwright pipe transport 관련 알려진 버그가 있다([bun#4253](https://github.com/oven-sh/bun/issues/4253)). browse server는 자동으로 Node.js로 fallback한다. `bun`과 `node`가 모두 PATH에 있는지 확인한다. 네이티브 `/cso`에는 PowerShell(PowerShell 7 `pwsh` 권장, Windows PowerShell 5.1은 fallback)과 Desktop development with C++ workload가 포함된 Visual Studio 2022 Build Tools도 필요하다. 없으면 setup은 해당 스킬을 명시적으로 사용할 수 없게 둔다. /cso는 선택 사항이다. 네이티브 helper의 build 또는 publish가 실패해도 setup은 완료하며, 실패한 단계와 log 경로 및 재시도 명령을 알려 주고 기존 helper가 있으면 유지한다(CI처럼 `GSTACK_STRICT_BUILD=1`은 이 실패를 치명적으로 만든다).

**알려진 문제: Windows Smart App Control**([#2595](https://github.com/garrytan/gstack/issues/2595)). gstack의 컴파일된 binary(`browse`, `find-browse`, `design`, `pdf`, `gstack-global-discover`)는 컴퓨터에서 빌드되고 서명되지 않으므로 Smart App Control이 켜진 Windows 11은 시작을 거부하며 Git Bash에는 `Permission denied`가 표시된다. setup은 이를 감지하고 차단된 binary 및 이를 필요로 하는 스킬을 명명하며, `gstack-doctor`는 이를 `blocked`로 보고한다. 현재 해결책은 WSL 내부에서 gstack을 실행하거나 Smart App Control을 끄는 것이다. 세부 사항: [troubleshooting](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/troubleshooting.md#windows-smart-app-control). sidebar terminal은 Windows에서 Consolas를 사용하므로 텍스트가 더 이상 벌어져 렌더링되지 않는다.

PowerShell에서 `.\setup.ps1`(`./setup`과 같은 인수)은 Git for Windows, Bun, Node.js가 PATH에 있는지 검사하고 빠진 항목에는 `winget` 명령을 출력하며, 그 외에는 Git Bash에서 `./setup`을 실행한다.

Developer Mode가 없는 Windows(MSYS2 / Git Bash)에서는 `ln -snf`가 `git pull`에 새로 고쳐지지 않는 고정 사본을 만들기 때문에 `setup`이 symlink 대신 파일 사본으로 fallback한다. 스킬 파일을 저장소와 일치시키도록 **모든 `git pull` 후 `cd ~/.claude/skills/gstack && ./setup`을 다시 실행한다.** `setup`은 이를 상기하는 한 줄 메모를 출력한다. Unix와 WSL은 symlink를 유지하므로 다시 실행할 필요가 없다.

## 문서

| 문서 | 다루는 내용 |
|-----|---------------|
| [Skill Deep Dives](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/skills.md) | 모든 스킬의 철학, 예시 및 워크플로(Greptile, CodeRabbit 및 다른 bot용 review-bot triage 포함) |
| [권장 하니스](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/crew/docs/recommended-harness.md) | zero에서 첫 병합 train까지의 gstack + Capy: 설치, Captain 및 Drive, train, 일일 flaky pass, 주 2회 릴리스, factory scorecard, Capy 전용 항목, 알려진 Capy 제한 |
| [gstack + Capy: 소프트웨어 공장](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/capy/README.md) | Capy Captains와 gstack으로 구축한 것, 구성 요소의 결합 방식, 측정한 전후, 팁 및 Garry의 사용 방법 |
| [Why gstack](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/why-gstack.md) | 이야기, 생산성 수치와 주의 사항, Karpathy의 실패 모드, 병렬 스프린트 |
| [설치 세부 사항](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/install.md) | 설정 시간, 세부 요구 사항, 팀 모드, setup이 등록하는 hook, 에이전트 하니스 등록 |
| [다른 에이전트](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/hosts.md) | 에이전트 하니스(OpenClaw, Hermes, dots, QM, Muse Code, Grok, 기타), OpenClaw와 ClawHub, 호스트별 참고 사항, Codex 프로필과 모델 티어, 외부 검토 제공자, 디자인 binary 모델 |
| [웹 페이지 없는 QA](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/qa-without-a-webpage.md) | CLIs, APIs, jobs, workers 및 webhooks의 `/qa`와 `/qa-only` |
| [독립 binary](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/standalone-binaries.md) | 독립 `gstack-*` CLIs(egress auditor, context bill, model benchmark, 검토 및 증거 ledger, iOS QA daemon) 및 CSO evaluation producer 계약 |
| [개인정보와 원격 측정](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/privacy.md) | 전송하는 것, 절대 전송하지 않는 것, update check, 외부 검토, egress receipt |
| [제거](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/uninstall.md) | 제거 스크립트와 수동 제거 |
| [다이어그램 및 문서 형식](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/howto-diagrams-and-formats.md) | PDF의 Mermaid/excalidraw fence, 이미지 크기 및 안전 기본값, `--to html\|docx`, `/diagram` triplet |
| [프론트엔드 미리 보기](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/howto-preview-a-frontend.md) | `/design-review --build`가 검사하는 canned API 답변이 있는 loopback preview, fixture, 상태 inventory 및 `gstack-design-build` receipt |
| [첫 프로덕션 배포](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/howto-bring-up-a-first-deploy.md) | `/setup-deploy`가 아직 배포된 것이 없다고 할 때의 조치: hosting, env와 secret, DNS, 작동 검사 후 `/setup-deploy`로 복귀 |
| [개발자의 철학](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/ETHOS.md) | 개발자 철학: 전체 범위 완수, 만들기 전 검색, 지식의 세 계층 |
| [GBrain 빠른 둘러보기](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/gbrain-quick-tour.md) | 네 가지 설정 경로, MCP 등록, 저장소별 신뢰 정책, 메모리 sync, Conductor env 변수 |
| [GStack에서 GBrain 사용](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/USING_GBRAIN_WITH_GSTACK.md) | `/setup-gbrain`의 모든 경로, flag, bin helper 및 문제 해결 단계 |
| [GBrain Sync](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/gbrain-sync.md) | 머신 간 메모리 설정, privacy 모드, 문제 해결 |
| [아키텍처](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/ARCHITECTURE.md) | 디자인 결정 및 시스템 내부 |
| [브라우저](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/BROWSER.md) | gstack이 Aside를 먼저 구동하는 방식(계약, cookbook, 렌더링, 조사), fallback engine 시작 시점 및 fallback의 전체 `$B` 명령 참조 |
| [기여](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/CONTRIBUTING.md) | 개발 설정, 테스트, 기여자 모드 및 개발 모드 |
| [기억할 만한 recall bridge](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/memorable-workflow-memory.md) | gstack을 통한 opt-in 제3자 워크플로 메모리: 두 가지 동의, gstack이 넘기고 증명할 수 있는 것, 제거, 문제 해결 |
| [문제 해결](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/troubleshooting.md) | 모든 `not run` / `unavailable` 메시지, 의미 및 수정 방법 |
| [Captain crew 운영](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/crew/docs/captain.md) | Capy의 하나의 컨트롤러와 다수 lane: drive layout, CREW.md, READY 계약, merge train, 승인, digest, 일일 flaky pass 및 template |
| [변경 로그](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/CHANGELOG.md) | 각 버전의 새 항목 |

## 개인정보와 원격 측정

opt-in하지 않으면 gstack은 사용 방식에 관한 어떤 것도 전송하지 않는다. telemetry는 기본적으로 꺼져 있으며 한 번 물어본다. update check(두세 번의 GitHub 요청: `git ls-remote`, `VERSION` fetch, 해당 version이 자신의 것과 같지만 `main`이 이동한 경우 compare-API 호출. telemetry가 켜져 있으면 gstack version과 OS도 보고함. 기본적으로 켜짐)는 `gstack-config set update_check false`로 끈다. 외부 검토(기본적으로 켜짐. 첫 실행 시 notice 출력)는 자신의 로그인으로 Codex 또는 Claude Code에 코드를 보내며 `gstack-config set codex_reviews disabled`로 끈다. 모든 오프머신 전송은 `gstack-egress list`로 감사할 수 있는 receipt를 기록한다. telemetry가 전달하는 정확한 field와 telemetry가 아닌 로컬 상태를 포함한 전체 설명: [docs/privacy.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/privacy.md).

## 문제 해결

**무엇이 잘못되었는지 모르겠나요?** doctor를 실행한다: `~/.claude/skills/gstack/bin/gstack-doctor`
(다른 host에서는 gstack checkout의 `./setup --status`가 doctor의 절대 경로로
끝난다). 스킬을 시작하거나 비용을 들이지 않고 검사별로 한 줄(설치, state root,
Bun, hook, Codex와 캐시된 model probe, artifact sync, browse bundle, 기타
컴파일 binary, /cso native helper, Claude Code, 가장 큰 session journal 및 최근
/autoplan guard code)을 출력한다. 각각 수정 명령과 함께 `ok`, `warn`,
`not configured` 또는 `fail`이다. `fail`일 때만 non-zero로 종료한다.
`--live`는 유료 Codex model 검사도 실행한다(짧은 호출 하나). 출력을 bug report에
붙여넣는다.

**메시지가 `not run`, `unavailable` 또는 수정 방법을 말하나요?**
[docs/troubleshooting.md](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/troubleshooting.md)에서 찾는다. gstack이 출력하는
모든 gate 메시지, 의미, 유지된 항목 및 수정 명령이 있다.

**Claude가 스킬을 볼 수 없다고 하나요?** 설치되어 있는지 확인하고(`ls ~/.claude/skills`)
Claude Code를 재시작한다. Claude Code는 설명과 함께 모든 설치된 스킬을 나열하므로
CLAUDE.md에 열거할 필요가 없다(붙여넣은 목록은 릴리스마다 오래된다). 프로젝트의
`CLAUDE.md`에는 탐색 규칙만 있으면 된다.

```
## gstack
모든 웹 탐색에 gstack의 /browse를 사용한다. mcp__claude-in-chrome__* 도구를 절대 사용하지 않는다.
```

오래된 설치 프롬프트가 CLAUDE.md에 \"Available skills:\" 줄을 남겼다면 삭제한다.

스킬이 표시되지 않음, 오래된 설치, Codex 스킬 설명, prefix 모드, 스킬 비활성화, Chromium 설치 문제: [빠른 답변](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/troubleshooting.md#quick-answers).

---

무료, MIT 라이선스, 오픈 소스. premium tier도 waitlist도 없다.

제가 소프트웨어를 구축하는 방법을 오픈 소스화했다. 포크해서 여러분의 것으로 만들 수 있다.

> **채용 중입니다.** AI 코딩 속도로 실제 제품을 출시하고 gstack을 더 견고하게 만드는 데 함께하고 싶나요?
> YC에서 함께 일하세요 — [ycombinator.com/software](https://ycombinator.com/software)
> 매우 경쟁력 있는 급여와 지분. San Francisco, Dogpatch District.

## 라이선스

MIT. 영원히 무료. 무언가를 구축하세요.
