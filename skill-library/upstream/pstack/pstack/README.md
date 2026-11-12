> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# pstack

저는 [poteto](https://x.com/poteto)입니다. 사장이나 CEO는 아니지만 Meta, Netflix, Cursor에서 수백만 줄의 코드를 다뤘습니다. React 코어 팀에서도 React Compiler를 만들고 유지하는 일을 돕고 있습니다.

AI가 조잡한 코드를 너무 많이 쓴다는 인식이 커지고 있습니다. 저도 동의합니다. 조잡한 결과물을 만드는 스무 명짜리 팀처럼 출시하고 싶지는 않습니다. 품질 없는 처리량은 제가 추구하는 목표가 아닙니다. 빠르게 가고 싶다면 먼저 깊이 파고드세요.

**pstack은 이에 대한 제 답입니다.** 제가 Cursor에서 매일 고품질 코드를 출시할 때 사용하는 바로 그 스킬들입니다. Cursor를 진짜 엔지니어링 팀으로 바꿉니다. 목표는 코드 줄 수를 최대화하는 것이 아니라 오히려 그 반대입니다. pstack은 더 적지만 더 품질 좋은 코드를 작성하도록 돕습니다.

**pstack은 두려움 없는 병렬 작업을 제공합니다.** 한 에이전트로 깊이 파고들어 검증 가능한 좋은 코드를 작성한다고 믿을 수 있어야 자신 있게 병렬화할 수 있습니다. `poteto-mode`로 여러 에이전트를 시작하고, 각자의 작업에 엄격한 엔지니어링 원칙을 적용하리라고 믿으세요.

**Cursor는 각 환경의 장점을 함께 제공합니다.** 모든 최첨단 모델에는 강점과 약점이 있습니다. pstack에서는 어떤 모델이든 사용하세요. 실제로 제 스킬 중 다수는 모델마다 고유한 강점을 활용하는 다중 모델 워크플로를 사용합니다.

포크하고, 개선하고, 자신에게 맞게 바꾸세요. PR을 환영합니다!

## 설치

```bash
/add-plugin pstack
```

Claude Code에서는 다음과 같이 합니다.

```bash
/plugin marketplace add cursor/plugins
/plugin install pstack@cursor-plugins
```

Claude Code는 제3자 마켓플레이스의 자동 업데이트를 기본으로 꺼 두므로 pstack은 설치한 버전으로 유지됩니다. 켜려면 `/plugin`을 실행하고 **marketplaces** 탭을 연 다음 `cursor-plugins`를 선택하고 **enable auto-update**를 고르세요. 한 번 수동으로 업데이트하려면 `claude plugin update pstack@cursor-plugins`를 실행하세요.

Claude Code는 플러그인 명령과 에이전트에 접두사를 붙이므로 `/poteto-mode`는 `/pstack:poteto-mode`가 됩니다. 나머지 모든 Cursor 이름은 [Claude Code 어댑터](./docs/harness/claude-code.md)에 대응표가 있습니다. Claude Code에서 `/pstack:setup-pstack`은 선택한 모델을 `~/.claude/rules/pstack-models.md`에 기록하며, Bugbot이나 Automations처럼 Cursor 전용 기능이 필요한 단계는 한 줄 메모와 함께 건너뜁니다.

Claude Code는 저장소 루트의 [`harness/pstack/`](https://github.com/cursor/plugins/tree/main/harness/pstack)에서 이 README와 가이드를 포함한 pstack의 생성된 사본을 설치합니다. pstack을 변경한 뒤에는 저장소 루트에서 `node scripts/generate-pstack-harness-trees.mjs`를 실행하고 결과를 커밋하세요. 생성된 사본이 오래된 상태라면 CI가 실패합니다.

## 시작하기

두 단계면 됩니다.

1. [`/setup-pstack`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/setup-pstack/SKILL.md)을 실행하고 추론 예산과 사용할 모델을 선택하세요.
2. 엄밀함이 필요한 일을 할 때마다 [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)를 사용하세요.

처음인가요? [pstack 가이드](./docs/guide/README.md)는 설정과 프롬프트 작성부터 검증과 야간 실행까지 첫 실제 작업을 안내합니다. 막혔거나 어떤 스킬이 맞는지 모르겠다면 [`/poteto-help`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-help/SKILL.md)에 물어보세요.

이것이 전부입니다. 다른 스킬은 상황에 따라 필요하며 모드 스킬이 필요할 때 대신 사용합니다. 기본 모드는 모델의 강점에 따라 작업을 나눕니다. 코드 위임 작업(기능, 리팩터링, 버그 수정, 성능 개선, 지표 개선 반복)은 Grok으로 보내고 가장 어려운 변경, 산문, 판단은 Opus 5.5로 보냅니다. 기본 패널은 Opus 5.5 / Grok입니다. [`/setup-pstack`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/setup-pstack/SKILL.md)에서 모두 바꿀 수 있습니다.

## 사용법

작업을 시작할 때 [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)를 사용하세요. 요청을 읽고 플레이북 가운데 하나를 고른 뒤 단계에 필요할 때 다른 스킬을 실행합니다.

작업을 입력하기 전에 `/` 메뉴에서 `/poteto-mode`를 선택하면 Cursor가 메시지에 스킬을 첨부합니다.

### [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)만 사용하세요

이 스킬이 주된 지름길입니다. 에이전트가 엄격한 엔지니어링 작업을 해야 할 때마다 저는 이를 사용합니다. 23개의 플레이북이 포함되어 있습니다.

```
/poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even when idle. repro
first, then fix and verify.
```

```
/poteto-mode i'm going to bed. land the stack even if ci flakes. i want everything merged by
morning.
```

<details>
<summary>23개 플레이북 전체</summary>

| 플레이북 | 용도 |
|---|---|
| [조사](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/investigation.md) | 읽기 전용 질문입니다. X는 어떻게 동작하는지, Y는 왜 이렇게 만들었는지, 확실한지 묻습니다. |
| [버그 수정](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/bug-fix.md) | 결함을 재현하고 근본 원인을 찾은 뒤 런타임 증거와 함께 수정합니다. |
| [성능](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/perf-issue.md) | 측정된 지연을 추적하고 기준값과 비교해 개선합니다. |
| [지표 개선 반복](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/hillclimb.md) | 목표를 향해 지표 하나를 지속적이고 과학적으로 개선합니다. 가설을 반복하며 전후를 측정하고 수용된 개선마다 커밋 하나를 만듭니다. |
| [런타임 포렌식](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/runtime-forensics.md) | 계측을 통해 현재 발생하는 증상(누수, 유휴 CPU 반복 점유, 결함)을 진단합니다. |
| [트레이스 포렌식](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/trace-forensics.md) | 수집된 프로파일링 자료(cpuprofile, trace, spindump, 힙 스냅샷)를 진단합니다. |
| [기능](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/feature.md) | 이름 붙인 데이터 형태를 바탕으로 새롭거나 변경된 동작을 구현합니다. |
| [리팩터링](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/refactoring.md) | 동작을 보존하면서 구조나 형태를 변경합니다. |
| [프로토타입](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/prototype.md) | 설계나 동작을 저렴하게 결정하기 위한 일회용 초안을 만들거나, 관찰을 통해 경험적으로 갈리는 선택지를 결정합니다. |
| [시각적 동일성](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/visual-parity.md) | 두 구현의 UI를 픽셀 단위로 정확하게 일치시킵니다. |
| [스킬 작성](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/authoring-a-skill.md) | SKILL.md를 작성하거나 편집합니다. |
| [평가](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/eval.md) | 스킬이나 프롬프트 변경이 에이전트 동작에 주는 영향을 블라인드 방식으로 검사합니다. |
| [PR 돌보기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/babysit.md) | 충돌, 검토 스레드, CI를 처리해 PR이나 스택을 병합 준비 상태로 만듭니다. |
| [출시](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/shipping.md) | 통과한 스택을 독립적으로 검증한 다음, 연속된 검증 구간을 아래부터 위로 반영합니다. 기본으로 GitHub를 통하고 가능하면 origin을 사용합니다. |
| [자율 실행](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/autonomous-run.md) | 긴 작업을 멈추지 않고 완료까지 이끕니다. |
| [오케스트레이션](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/orchestrate.md) | 하나의 조정 채팅에 맡긴 상시 프로젝트입니다. 여러 날, 여러 개의 쌓인 PR, 하위 에이전트 집단을 다룹니다. |
| [autopilot-full](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/autopilot-full.md) | PR마다 소유자 한 명을 두고 독립적인 PR들을 병합까지 실행합니다. 스웜이 코드 준비가 끝난 각 head를 검증하며, 이후 패치가 바뀔 때마다 새 검사를 수행합니다. |
| [autopilot-stack](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/autopilot-stack.md) | 병합하지 않는 autopilot-full입니다. 운영자가 검토하고 반영할 PR들을 구현하고 검증하며, 실제로 기반으로 삼는 PR 위에만 새 PR을 쌓습니다. |
| [세션 이어받기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/session-pickup.md) | 이전 에이전트가 진행하던 작업을 재개하거나 인계받습니다. |
| [안전하게 일시 중지](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/pause-safely.md) | 나중에 재개할 수 있도록 진행 중인 작업을 깔끔하게 중단합니다. |
| [다단계 계획](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/multi-phase-plan.md) | 여러 단계나 쌓인 PR에 걸친 작업입니다. |
| [worktree 정리](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/worktree-cleanup.md) | 안전 검사를 거쳐 병합되거나 버려진 worktree와 오래된 iOS 시뮬레이터를 정리해 디스크를 회수합니다. |
| [PR 열기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/opening-a-pr.md) | 순서가 있는 작은 커밋에서 준비된 PR을 엽니다. Conventional Commits 제목과 브리핑 형식 본문을 사용합니다. 다른 모든 플레이북이 끝날 때 호출됩니다. |

</details>



호출하면 다음과 같이 동작합니다.

1. 작업에 맞는 [플레이북](https://github.com/cursor/plugins/tree/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks)을 고르고, 처음 항목에 그 단계를 그대로 복사한 할 일 목록을 엽니다.
2. 단계가 실행되면 다른 스킬로 라우팅합니다.
3. 결과를 사용하는 사람과 유지보수자를 기준으로 군더더기 없는 답변을 작성합니다.

전체 규칙과 플레이북은 [`skills/poteto-mode/SKILL.md`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)에 있습니다.

여러 턴에 걸쳐 [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)를 켜 두려면 `/` 메뉴에서 선택하고 Enter 대신 Option+Enter(Mac) 또는 Alt+Enter(Windows)를 누르세요. 그러면 Cursor의 에이전트 창과 CLI에서 제공하는 [사용자 지정 모드](https://cursor.com/docs/skills#using-a-skill-as-a-custom-mode)가 됩니다. 모드를 종료할 때까지 매 턴 맥락에 남습니다. 일반 Enter는 메시지 하나에만 첨부합니다.

[`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)는 Cursor의 `/loop` 명령과 매우 잘 어울립니다. 엄밀함을 희생하지 않고도 Cursor를 여러 시간 동안 작업하게 할 수 있습니다.

## 스킬

[`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)는 단계에 필요하면 이들 대부분을 대신 실행합니다(`how`, `why`, `architect`, `arena`, `swarm`, `interrogate`, `unslop`, `no-comments`, `technical-writing`, `tdd`와 원칙들). 아래 표는 직접 사용하고 싶을 때 참고하세요.

```
/how do we cancel runs? do we have an n+1 when we look up every run to cancel?
```

```
/interrogate review this pr.
```

<details>
<summary>모든 스킬</summary>

| 스킬 | 사용할 때 |
|---|---|
| [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md) | 사소하지 않은 모든 작업의 기본 진입점입니다. |
| [`/poteto-help`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-help/SKILL.md) | pstack이 처음이거나 어떤 스킬, 플레이북, 원칙이 맞는지 모를 때 사용합니다. 하려는 일을 파악하고 그 부분에 답한 다음 입력할 프롬프트를 건넵니다. `/poteto-help`를 입력했을 때만 실행됩니다. |
| [`/in-your-own-words`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/in-your-own-words/SKILL.md) | 에이전트가 시작하기 전에 목표와 문제를 다시 설명하게 하고 싶을 때 사용합니다. `/in-your-own-words`를 입력했을 때만 실행됩니다. |
| [`/sharpen`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/sharpen/SKILL.md) | 보내기 전에 프롬프트를 더 넓지 않고 더 깊게 만들고 싶을 때 사용합니다. 최고의 전문가가 요청받지 않아도 할 일, 출발점으로 삼을 원자료, 방법과 도구, 결과가 옳다는 외부 검사를 짚습니다. 선택의 여지는 열어 둔 채 다시 쓴 프롬프트를 반환하며 작업 자체는 수행하지 않습니다. `/sharpen`을 입력했을 때만 실행됩니다. |
| [`/how`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/how/SKILL.md) | 하위 시스템이 어떻게 동작하는지 차근차근 설명받고 싶을 때 사용합니다. |
| [`/why`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/why/SKILL.md) | 왜 이렇게 만들었는지 알고 싶을 때 사용합니다. 실행 시 사용 가능한 MCP를 찾고 각 증거 범주(소스 제어, 이슈 트래커, 장문 문서, 실시간 채팅, 인프라 관측, 오류 추적, 분석 웨어하우스)를 병렬로 조회합니다. |
| [`/recall`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/recall/SKILL.md) | 작업을 시작하거나 재개하면서 특정 주제의 최근 맥락을 자신의 채팅 이력과 공유 기록에서 재구성해 간결한 현재 상태 브리핑으로 받고 싶을 때 사용합니다. |
| [`/ketchup`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/ketchup/SKILL.md) | 마지막 메시지 이후 이 채팅에서 바뀐 내용을 평이한 말과 작은 그림으로 알고 싶을 때 사용합니다. 답변이 길어지더라도 여러분을 기다리는 모든 항목을 나열하고 답변만으로 결정할 수 있게 합니다. |
| [`/ketchup-video`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/ketchup-video/SKILL.md) | `/ketchup`의 진행 상황을 자막 달린 짧은 슬라이드 동영상으로 받고, 결정을 기다리는 사항을 아래 텍스트로 보고 싶을 때 사용합니다. |
| [`/blast-radius`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/blast-radius/SKILL.md) | 작아 보이는 변경이 다른 무엇을 망가뜨릴 수 있는지 알고 싶을 때 사용합니다. 안전한 근거가 되는 사실 하나를 주장으로 끝내지 않고 코드 실행으로 입증합니다. |
| [`/architect`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/architect/SKILL.md) | 함수 경계를 넘는 코드를 작성하기 전에 호출자의 사용 방식, 타입, 모듈 형태를 먼저 정하고 싶을 때 사용합니다. |
| [`/arena`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/arena/SKILL.md) | 같은 일에 N개의 병렬 시도를 한 뒤 각각의 장점을 모으고 싶을 때 사용합니다. |
| [`/swarm`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/swarm/SKILL.md) | 서로 다른 부분이나 경쟁 시도에 N명의 병렬 작업자를 배치한 다음 통합 보고서 하나를 받고 싶을 때 사용합니다. |
| [`/interrogate`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/interrogate/SKILL.md) | diff를 두고 서로 다른 모델들이 이를 깨뜨리도록 시도하게 하되, 실행으로 입증된 발견만 남기고 싶을 때 사용합니다. |
| [`/automate-me`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/automate-me/SKILL.md) | 실제로 작업해 온 방식에서 자신의 `-mode` 스킬 초안을 만들고 싶을 때 사용합니다. |
| [`/make-bot-ui`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/make-bot-ui/SKILL.md) | 버튼이 웹훅으로 Grok Bot을 깨우는 페이지나 대시보드가 필요할 때 사용합니다. 발신자 키 인계와 Tailscale을 포함합니다. |
| [`/setup-pstack`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/setup-pstack/SKILL.md) | pstack이 역할별로 사용할 모델을 선택하고 싶을 때 사용합니다. 모델을 감지하고 구성 규칙을 작성합니다. |
| [`/reflect`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/reflect/SKILL.md) | 긴 작업을 반영한 후 그 방법을 스킬 수정으로 기록하고 싶을 때 사용합니다. |
| [`/correct`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/correct/SKILL.md) | 에이전트의 같은 실수를 반복해서 바로잡고 있을 때 사용합니다. 이력에서 실수 유형을 찾아 효과가 있는 가장 높은 수준(아키텍처, 그다음 타입·린트·CI, 그다음 테스트, 문서는 마지막)에서 수정하고 각 규칙과 이를 강제하는 장치를 짝지은 표를 유지합니다. |
| [`/teach`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/teach/SKILL.md) | 변경이나 하위 시스템을 단순히 요약받는 것이 아니라 실제로 이해하고 싶을 때 사용합니다. how와 why를 실행하고 다이어그램을 하나씩 쌓아 가며 평이한 설명 하나로 엮습니다. |
| [`/tdd`](./skills/tdd/SKILL.md) | 버그를 수정하며 저렴한 로컬 테스트 경로가 있을 때 사용합니다. 먼저 실패하는 테스트를 작성한 다음 수정합니다. |
| [`/benchmark-checklist`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/benchmark-checklist/SKILL.md) | 벤치마크를 실행했거나 속도 향상 또는 회귀를 측정했을 때 사용합니다. 보고하거나 행동하기 전에 수치의 제한 요소, 조정 상태, 오류, 반복 실행, 전체 흐름의 관련성을 검토합니다. |
| [`/no-comments`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/no-comments/SKILL.md) | 검토 전에 주석을 제거합니다. Comment Sicko를 생성하고, 수용한 발견을 수정하며, 주장된 제약을 구조에 표현할 방법을 제안합니다. |
| [`/typescript-best-practices`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/typescript-best-practices/SKILL.md) | TypeScript를 읽거나 편집할 때 사용합니다. 타입 시스템 규율 원칙을 구문 수준에 연결합니다. |
| [`/figure-it-out`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/figure-it-out/SKILL.md) | 포함된 플레이북 중 맞는 것이 없을 때 사용합니다. 작업을 위한 엄밀하고 감사 가능한 플레이북을 설계합니다. |
| [`/show-me-your-work`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/show-me-your-work/SKILL.md) | 검토 가능한 결정 이력이 필요할 때 사용합니다. 커밋할 수 있는 TSV에 결정을 기록합니다. |
| [`/create-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-verification-skill/SKILL.md) | 프로젝트에 앱 동작을 스크립트로 입증할 방법이 없을 때 사용합니다. 언어나 플랫폼에 관계없이 기능 지도를 갖춘 프로젝트 로컬 검증 스킬을 생성합니다. |
| [`/maintain-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-verification-skill/SKILL.md) | 검증 스킬의 기능 지도가 앱에서 어긋났을 때 사용합니다. 소스 조사와 실제 실행 한 차례를 수행하며, 입증된 수정은 최대 PR 하나로 제한합니다. |
| [`/create-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-formal-verification-skill/SKILL.md) | 테스트가 경쟁 상태, 재시도, 상태 머신, 파서 또는 안전하지 않은 코드를 깨뜨리는 사례에 도달하지 못할 때 사용합니다. 맞는 도구로 속성 하나를 검증하고 변경할 때마다 다시 검사할 프로젝트 로컬 스킬을 생성합니다. |
| [`/maintain-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-formal-verification-skill/SKILL.md) | 형식 검증 대상 코드가 마지막 검사 이후 바뀌었을 때 사용합니다. 모델, 하네스 또는 속성을 코드에 맞게 갱신하고 다시 실행한 다음, 각 실패가 검증의 뒤처짐인지 코드 버그인지 밝힙니다. |
| [`/statechart`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/statechart/SKILL.md) | 동작의 소유자가 명세를 읽는 대신 동작을 볼 필요가 있을 때 사용합니다. TLA+ 모델을 검사하고 사용자가 보는 내용을 Mermaid 상태 차트로 그린 다음, 규칙을 어기는 각 상태를 표시하고 각 상태로 가는 최단 경로를 제시합니다. |
| [`/unslop`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/unslop/SKILL.md) | 글을 다듬을 때 사용합니다. AI가 쓴 흔적을 제거합니다. |
| [`/bro`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/bro/SKILL.md) | 마지막 메시지를 전문용어 없이 일상적인 사람의 말로 다시 설명받고 싶을 때 사용합니다. |
| [`/technical-writing`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/technical-writing/SKILL.md) | 문서, RFC, README, PR 설명, 커밋 메시지를 위한 다층 문서 표준(Diátaxis + Google 개발자 문체 + STE + Global English)입니다. |

</details>



### 예시

대개 작업 시작 시 [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)를 입력하고 플레이북으로 라우팅하게 둡니다. 다른 스킬은 단계에서 필요할 때 실행됩니다. 몇몇 스킬은 제가 직접 사용합니다.


<details>
<summary>모든 예시</summary>

```
bug fix:           /poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even
                   when idle. repro first, then fix and verify.
perf:              /poteto-mode a big list takes a second or two to load even though we virtualize.
                   run a cpu trace and tell me why.
feature:           /poteto-mode build a small feature behind a feature flag. verify it really works.
prototype:         /poteto-mode build two prototypes of the markdown renderer so we can compare.
                   spawn an agent for each.
multi-phase:       /poteto-mode open source these skills as a plugin. nothing internal leaks, work
                   in a temp dir, show me the dependency graph first.
overnight run:     /poteto-mode i'm going to bed. land the stack even if ci flakes. i want
                   everything merged by morning.
babysit:           /poteto-mode check on pr 123. anything outstanding?
visual parity:     /poteto-mode the row spacing is too tall when this flag is on. the second image
                   is correct. repro and fix until it matches.
figure it out:     /poteto-mode i'm stepping away. migrate every caller from the synchronous store
                   to the new async one, keeping behavior identical. i want to trust it was done
                   right when i'm back.
how:               /how do we cancel runs? do we have an n+1 when we look up every run to cancel?
why:               /why is this feature flag not on yet?
architect:         design this instrumentation to be high signal with no false positives. /architect
                   this first.
arena:             /arena take my prompt to the arena verbatim. i want to compare their proposals
                   with yours.
swarm:             /swarm check every package under packages/ against its check.sh. one worker per
                   package. one report.
interrogate:       /interrogate review this pr.
tdd:               /tdd implement
unslop:            can we unslop and tighten the new changes?
reflect:           /reflect that took too long. capture what we learned so the next run doesn't
                   repeat it.
correct:           /correct
show-me-your-work: /show-me-your-work keep a decision trail i can review when i'm back.
automate-me:       /automate-me
help:              /poteto-help which skill should i use to review this branch?
```

</details>

## `poteto-agent`와 Comment Sicko 하위 에이전트

[`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)는 이를 받은 채팅에서 실행됩니다. 그 채팅이 플레이북, 할 일 목록, 모든 하위 에이전트 생성을 소유합니다.

pstack은 실행 중 생성하는 위임 작업의 래퍼로 [`subagent_type: "poteto-agent"`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/agents/poteto-agent.md)도 제공합니다. 이 에이전트는 어떤 작업이든 시작하기 전에 인라인 원칙 색인을 포함한 `poteto-mode` 전체를 읽습니다. `generalPurpose`로 대체하면 이 읽기를 건너뛰어 방향이 어긋납니다. 플레이북 자체를 실행하도록 `poteto-agent`를 생성하지 마세요.

[`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)와 [`subagent_type: "poteto-agent"`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/agents/poteto-agent.md)는 같은 래퍼를 거칩니다.

pstack은 `subagent_type: "comment-sicko"`로 사용할 수 있는 읽기 전용 주석 검토자 [Comment Sicko](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/agents/comment-sicko.md)도 제공합니다. 보통 직접 호출하지 말고 [`/no-comments`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/no-comments/SKILL.md)를 통해 호출하세요.

## 원칙

짧은 스킬 24개가 각각 원칙 하나를 담습니다. `poteto-mode`는 이들의 색인을 인라인으로 두고 작업을 시작할 때 읽습니다. 독립 파일은 다른 스킬이 원칙을 이름으로 참조하고 색인이 각 원칙의 전체 규칙을 가리킬 수 있도록 존재합니다.

<details>
<summary>24개 원칙 전체</summary>

| 원칙 | 분류 | 규칙 |
|---|---|---|
| [laziness-protocol](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-laziness-protocol/SKILL.md) | 핵심 | 삭제와 문제를 해결하는 최소 변경을 우선합니다. |
| [foundational-thinking](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-foundational-thinking/SKILL.md) | 핵심 | 로직 작성 전에 적용합니다. 핵심 타입과 데이터 구조를 선택하고, 뼈대와 기능 작업의 순서를 정하며, 동시 실행 주체가 무엇을 공유하는지 묻습니다. 데이터 구조를 올바르게 잡아 이후 코드가 명확해지게 합니다. |
| [redesign-from-first-principles](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-redesign-from-first-principles/SKILL.md) | 핵심 | 요구사항을 나중에 덧붙이지 말고 첫날부터 근본 가정이었던 것처럼 재설계합니다. |
| [attack-the-premise](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-attack-the-premise/SKILL.md) | 핵심 | 하나의 전제를 공유한 수정 두 개 이상이 같은 게이트에서 실패했을 때 적용합니다. 같은 전제를 가정한 또 다른 수정을 작성하기 전에 전제를 적고 직접 검사합니다. |
| [subtract-before-you-add](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-subtract-before-you-add/SKILL.md) | 핵심 | 죽은 요소, 중복 검증기, 껍데기 참조를 먼저 제거한 다음 단순해진 기반 위에 만듭니다. |
| [minimize-reader-load](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-minimize-reader-load/SKILL.md) | 핵심 | 질문과 답 사이의 계층과 독자가 머릿속에 유지해야 하는 숨은 상태를 셉니다. 호출자가 하나인 래퍼를 합치고 변경 가능한 범위를 줄입니다. |
| [outcome-oriented-execution](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-outcome-oriented-execution/SKILL.md) | 핵심 | 명시적인 단계 경계를 가진 계획된 재작성과 마이그레이션에 적용합니다. 목표 아키텍처로 수렴하며, 버릴 호환성 코드로 중간 상태를 매끄럽게 유지하지 않습니다. |
| [experience-first](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-experience-first/SKILL.md) | 핵심 | 구현 편의보다 사용자의 즐거움을 선택하고, 거친 기능을 많이 내놓기보다 잘 다듬은 기능을 적게 출시합니다. |
| [exhaust-the-design-space](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-exhaust-the-design-space/SKILL.md) | 핵심 | 확정하기 전에 경쟁하는 프로토타입 2~3개를 만들어 나란히 비교합니다. |
| [build-the-lever](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-build-the-lever/SKILL.md) | 핵심 | 일괄 작업뿐 아니라 사소하지 않은 모든 편집, 마이그레이션, 분석, 검사에 적용합니다. 손으로 작업하는 대신 작업을 수행하거나 입증하는 도구(코드 변환기, 스크립트, 생성기 또는 하위 에이전트가 따르는 스킬)를 만듭니다. 검토자가 다시 실행할 수 있는 도구 자체가 산출물입니다. |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | 아키텍처 | 도메인을 흩어진 조건문 대신 구조로 표현합니다. |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | 아키텍처 | 보호 로직을 시스템 경계(CLI, 설정, 네트워크, 외부 API)에 집중합니다. 내부 타입을 신뢰하고 비즈니스 로직을 순수 함수에 둡니다. |
| [type-system-discipline](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-type-system-discipline/SKILL.md) | 아키텍처 | 잘못된 상태를 표현할 수 없게 하고, 의미가 있는 기본형에 브랜드를 붙이고, 경계에서 외부 데이터를 파싱하고, 변형을 빠짐없이 처리하고, 권위 있는 스키마에서 도출합니다. |
| [make-operations-idempotent](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-make-operations-idempotent/SKILL.md) | 아키텍처 | 앞선 실행이 일부만 수행됐더라도 같은 최종 상태로 수렴합니다. |
| [migrate-callers-then-delete-legacy-apis](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | 아키텍처 | 호환 계층을 보존하지 말고 같은 작업 묶음에서 호출자를 옮기고 기존 API를 삭제합니다. |
| [separate-before-serializing-shared-state](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-separate-before-serializing-shared-state/SKILL.md) | 아키텍처 | 먼저 공유를 제거합니다. 공유 작성자 하나가 실제 불변 조건일 때만 구조적으로 직렬화합니다. |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | 검증 | 작업 후 완료를 선언하기 전에 적용합니다. 대리 지표, 자기 보고, "컴파일된다"가 아니라 실제 산출물(기능 실행, 실제 값 읽기, diff 검사)을 대상으로 검증합니다. |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | 검증 | 각 증상을 시스템이 처음 잘못된 지점까지 거슬러 올라가 그곳에서 수정합니다. 가드가 다루는 상태가 정당한 경우에만 가드는 수정책입니다. |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | 검증 | 여러 단계 작업(일괄 순회, 마이그레이션, 유사한 편집의 연속)과 커밋 및 PR을 쌓는 방식에 적용합니다. 각각 검증 가능한 상태로 끝나는 작은 단위로 나누고, 다음 단위 전에 각 단위를 검사하며, 순서 자체가 검토자에게 증명이 되도록 전달합니다. |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | 검증 | 테스트를 작성하거나 변경하거나 유지할 때 적용합니다. 코드 사용자가 관찰할 수 있는 것을 단언하여 그 동작이 망가지면 실패하고 내부만 바뀌면 계속 통과하게 합니다. |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | 검증 | 측정한 수치(속도 향상, 회귀, 처리량, 지연, 평가 결과)를 신뢰하거나 보고하거나 행동에 옮기기 전에 적용합니다. 무엇이 그 수치를 제한하는지 찾고, 자신이 생각한 작업과 다른 것을 측정했을 가능성을 배제합니다. |
| [guard-the-context-window](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-guard-the-context-window/SKILL.md) | 위임 | 대량 작업은 하위 에이전트로 보내고 주 대화에는 원시 데이터 대신 요약을 유지합니다. |
| [never-block-on-the-human](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-never-block-on-the-human/SKILL.md) | 위임 | 진행하고 결과를 제시한 뒤 사람이 사후에 방향을 바로잡게 합니다. 확인은 되돌릴 수 없는 행동에 한정합니다. |
| [encode-lessons-in-structure](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-encode-lessons-in-structure/SKILL.md) | 메타 | 텍스트를 더 쓰는 대신 린트, 메타데이터 플래그, 런타임 검사 또는 스크립트로 규칙을 표현합니다. |

</details>

## 여기에 포함되지 않은 것

`poteto-mode`가 참조하지만 포함하지 않는 것이 몇 가지 있습니다.

- `/deslop`과 `deslop` 스킬은 `cursor-team-kit` 플러그인에 포함됩니다.
- `control-cli`(CLI와 TUI용)와 `control-ui`(브라우저, Electron, 웹용)도 `cursor-team-kit`에 포함됩니다.
- `/create-skill`은 Cursor 내장 기능입니다. Cursor는 PR을 지켜보는 내장 `/autopilot`도 제공합니다. `poteto-mode` 안에서는 PR 상태 요청을 대신 [PR 돌보기 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/babysit.md)으로 보냅니다.

전체 구성이 필요하다면 pstack과 함께 `cursor-team-kit`을 설치하세요.

## 계획 스킬은 왜 없나요?

Cursor에는 이미 pstack과 매우 잘 어울리는 훌륭한 계획 모드가 있습니다. 하지만 개인적으로 저는 계획을 믿지 않습니다. 가장 좋은 명세는 코드입니다. 계획을 만들고 싶다면 [`/poteto-mode`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/SKILL.md)가 다루지만 기본 동작은 아닙니다.

## 자신에게 맞게 바꾸기

`poteto-mode`는 제 방식입니다. 여러분이 꼭 같은 방식을 원하지는 않을 수 있습니다.

[`/automate-me`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/automate-me/SKILL.md)를 입력하세요. 최근 대화 기록을 분석하고 실제로 작업한 방식에서 `<your-name>-mode` 스킬 초안을 만든 뒤 그 아래에서 pstack을 통해 라우팅합니다. pstack을 기반으로 유지하면서 `poteto-mode` 옆에 자신만의 라우팅 스킬을 얻게 됩니다.

모델도 구성할 수 있습니다. [`/setup-pstack`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/setup-pstack/SKILL.md)을 입력하세요. 접근 가능한 모델을 감지하고 각 역할(코드, 판단, 검토 패널)을 모델에 대응시키는 작은 상시 적용 규칙을 작성합니다. 모든 스킬이 이 규칙을 읽고 규칙이 없으면 합리적인 기본값으로 돌아가므로 원하는 부분만 재정의하면 됩니다.

기본값이 바뀌어도 변경 전에 작성된 규칙은 여전히 이전 기본값을 고정합니다. 해당 역할의 줄이나 파일을 삭제한 다음 `/setup-pstack`을 다시 실행하세요. 다시 실행해도 모델이 기본값과 다른 역할은 모두 유지됩니다.

## 자동화

pstack은 비활성 상태의 [benny 자동화 팩](https://github.com/cursor/plugins/tree/63912a91d52c43946f974f2aaf661334a6116a82/pstack/automations/benny)도 제공합니다. benny는 Slack 이슈 보고를 분류한 다음, 확인된 버그를 실제 UI 증거와 함께 재현하고 수정합니다. 파일은 슬래시 스킬로 등록되지 않습니다.

설정하려면 Cursor에 [`FOR_AGENTS.md`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/automations/benny/FOR_AGENTS.md)를 가리켜 주세요. 설정은 팩을 대상 저장소의 `.cursor/automations/benny/`로 복사하고 공유 스킬을 위해 그곳에서 pstack을 활성화하며 사용자 구성은 복사된 팩 외부에 유지합니다. benny는 Cursor Automations에서 실행되므로 Cursor 전용입니다.

## 라이선스

MIT
