> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- design-and-handoff.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
## 5단계: 설계 문서

설계 문서를 프로젝트 디렉터리에 작성하세요.

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) && mkdir -p "$GSTACK_STATE_ROOT/projects/$SLUG" && echo "PROJECT_DIR: $GSTACK_STATE_ROOT/projects/$SLUG"
USER=$(whoami)
DATETIME=$(date +%Y%m%d-%H%M%S)
```

**설계 계보:** 작성하기 전에 이 브랜치의 기존 설계 문서를 확인하세요.
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
setopt +o nomatch 2>/dev/null || true  # zsh compat
PRIOR=$(ls -t "$GSTACK_STATE_ROOT"/projects/$SLUG/*-$BRANCH-design-*.md 2>/dev/null | head -1)
```
`$PRIOR`가 있으면 새 문서에 이를 참조하는 `Supersedes:` 필드를 넣습니다. 이렇게 수정 계보를 만들면 여러 office hours 세션에 걸쳐 설계가 어떻게 발전했는지 추적할 수 있습니다.

`<PROJECT_DIR>/{user}-{branch}-design-{datetime}.md`에 작성하세요. `PROJECT_DIR`는 위 설정 블록이 출력합니다.

**저장소 사본(이중 쓰기).** 세션이 Git 저장소 안에서 실행된다면 저장소의 `docs/designs/{topic-slug}.md`에도 문서를 작성하세요. 이 사본은 눈에 보이고 커밋할 수 있으며 팀과 공유할 수 있습니다. 메모리 수집과 세션 간 발견이 의존하므로 `~/.gstack` 사본도 계속 작성합니다. 팀원과 계획 검토는 저장소 사본을 읽습니다. 규칙은 다음과 같습니다.

1. **기록 지점에서 먼저 검사하세요.** 저장소 사본은 비공개 저장소 밖으로 나가므로 쓰기 전에 정확한 바이트를 검사하세요. 임시 파일에 작성한 뒤 `~/.claude/skills/gstack/bin/gstack-redact --from-file <tmp>`를 실행합니다. 종료 코드 3(HIGH)이면 저장소 사본을 차단하고 ~/.gstack 사본은 유지하며 사용자에게 이유를 알립니다. 종료 코드 2(MEDIUM)이면 쓰기 전에 발견 사항별로 확인받습니다.
2. **대체 경로는 진행을 막지 않습니다.** 읽기 전용 체크아웃, Git이 아닌 디렉터리, 쓰기 실패, 확인받지 못한 MEDIUM이면 `~/.gstack` 사본을 유지하고 저장소 사본을 건너뛴 이유를 한 줄로 알리세요. 어느 경우든 인계는 계속합니다.
3. **저장소 경로를 명시하세요.** 저장소 사본이 있으면 인계 문장과 모든 승인 질문에 경로를 넣으세요. 사용자가 열고 커밋할 수 있는 사본입니다.

**간결한 결정 기록.** 문서는 대화록이 아니라 결정 기록입니다. 결정마다 이유를 포함한 항목 하나를 쓰세요. 세션 중 사용자가 배제한 접근은 이름과 기각 이유 한 줄로만 적고, 이미 끝난 논의를 다시 펼치는 절 전체를 되살리지 마세요. 비어 있거나 이미 결정된 내용을 반복하는 템플릿 절은 생략하세요. 페이지 수 제한은 없습니다. 길이가 늘어나는 이유는 템플릿을 빈틈없이 채우기 위해서가 아니라 실제로 열린 질문이어야 합니다.

작성 후 사용자에게 다음과 같이 알리세요.
**"설계 문서 저장 위치: {저장소에 썼다면 그 경로, 아니면 ~/.gstack 경로}{둘 다 썼다면: ' (세션 간 사본은 ~/.gstack에 있음)'}. 다른 스킬(/plan-ceo-review, /autoplan)이 자동으로 찾습니다."**

### 스타트업 모드 설계 문서 템플릿

```markdown
# 설계: {title}

{date}에 /office-hours가 생성
Branch: {branch}
Repo: {owner/repo}
Status: DRAFT
Mode: Startup
Supersedes: {prior filename — 이 브랜치의 첫 설계라면 이 줄 생략}

## 문제 정의
{2A단계에서 도출}

## 수요 근거
{Q1에서 도출 — 실제 수요를 보여 주는 구체적인 인용, 수치, 행동}

## 현재 대안
{Q2에서 도출 — 현재 사용자가 실제로 사용하는 구체적인 작업 흐름}

## 목표 사용자와 가장 좁은 진입점
{Q3와 Q4에서 도출 — 구체적인 사람과 돈을 지불할 가치가 있는 가장 작은 버전}

## 제약
{2A단계에서 도출}

## 전제
{3단계에서 도출}

## 다른 모델의 관점
{3.5단계에서 두 번째 의견(Codex 또는 Claude 하위 에이전트)을 실행했다면: 맥락 없이 독립적으로 읽은 결과 — 가장 강한 논거, 핵심 통찰, 이의를 제기한 전제, 프로토타입 제안. 원문 그대로 또는 의미에 가까운 표현으로 기록. 두 번째 의견을 실행하지 않았다면(건너뛰거나 사용할 수 없음) 이 절 전체를 생략하고 포함하지 말 것.}

## 검토한 접근
### 접근 A: {name}
{4단계에서 도출}
### 접근 B: {name}
{4단계에서 도출}

## 권장 접근
{선택한 접근과 그 근거}

## 열린 질문
{office hours에서 해결되지 않은 질문}

## 성공 기준
{2A단계에서 도출한 측정 가능한 기준}

## 배포 계획
{사용자가 결과물을 얻는 방법 — 바이너리 다운로드, 패키지 관리자, 컨테이너 이미지, 웹 서비스 등}
{빌드와 게시를 위한 CI/CD 파이프라인 — GitHub Actions, 수동 릴리스, 병합 시 자동 배포 등}
{기존 배포 파이프라인이 있는 웹 서비스라면 이 절을 생략}

## 의존성
{차단 요소, 선행 조건, 관련 작업}

## The Assignment
{창업자가 다음에 취할 구체적인 현실 행동 하나 — "가서 구현하라"가 아님}

## What I noticed about how you think
{세션 중 사용자가 말한 구체적인 내용을 참조하는, 관찰에 바탕을 둔 멘토식 성찰. 사용자의 말을 그대로 인용하고 행동을 단정해 설명하지 말 것. 항목 2~4개.}
```

### 빌더 모드 설계 문서 템플릿

```markdown
# 설계: {title}

{date}에 /office-hours가 생성
Branch: {branch}
Repo: {owner/repo}
Status: DRAFT
Mode: Builder
Supersedes: {prior filename — 이 브랜치의 첫 설계라면 이 줄 생략}

## 문제 정의
{2B단계에서 도출}

## 매력적인 점
{핵심 즐거움, 새로움 또는 "와" 하는 요소}

## 제약
{2B단계에서 도출}

## 전제
{3단계에서 도출}

## 다른 모델의 관점
{3.5단계에서 두 번째 의견(Codex 또는 Claude 하위 에이전트)을 실행했다면: 맥락 없이 독립적으로 읽은 결과 — 가장 멋진 버전, 핵심 통찰, 기존 도구, 프로토타입 제안. 원문 그대로 또는 의미에 가까운 표현으로 기록. 두 번째 의견을 실행하지 않았다면(건너뛰거나 사용할 수 없음) 이 절 전체를 생략하고 포함하지 말 것.}

## 검토한 접근
### 접근 A: {name}
{4단계에서 도출}
### 접근 B: {name}
{4단계에서 도출}

## 권장 접근
{선택한 접근과 그 근거}

## 열린 질문
{office hours에서 해결되지 않은 질문}

## 성공 기준
{"완료"의 구체적인 모습}

## 배포 계획
{사용자가 결과물을 얻는 방법 — 바이너리 다운로드, 패키지 관리자, 컨테이너 이미지, 웹 서비스 등}
{빌드와 게시를 위한 CI/CD 파이프라인 — 또는 "기존 배포 파이프라인이 이를 다룸"}

## 다음 단계
{구체적인 구현 작업 — 첫 번째, 두 번째, 세 번째로 구현할 것}

## What I noticed about how you think
{세션 중 사용자가 말한 구체적인 내용을 참조하는, 관찰에 바탕을 둔 멘토식 성찰. 사용자의 말을 그대로 인용하고 행동을 단정해 설명하지 말 것. 항목 2~4개.}
```

---

## 명세 검토 반복

최종 문서를 사용자에게 제시하기 전에 적대적 검토를 실행하세요. 호출한 워크플로의 승인 단계를 따르세요. 검토자가 저장한 JSON이 완전한 판정입니다. 산문 요약은 두 번째 발견 사항 목록이 아닙니다. 보고서 도구가 모든 문제와 해결책을 보존하고 기록 수를 기계적으로 셉니다. 그 블록을 다시 쓰거나 축약하거나 중복 제거하거나 다시 세지 마세요.

**1단계: 검토자 준비와 배정**

설계 옆에 새 검토 디렉터리를 만드세요.

```bash
mktemp -d "<design-path>.review.XXXXXX"
```
이 증거 파일을 설계와 함께 유지하세요. 전체 반복은 최대 3회입니다. 배정할 때마다 앞선 유효한 모든 회차 파일을 순서대로 사용해 완전한 프롬프트를 생성하세요. 첫 회차에서는 앞선 파일을 생략합니다.

```bash
~/.claude/skills/gstack/bin/gstack-office-hours-review prepare --design "<design-path>" --out-dir "<review-directory>" "<round-1.json if present>" "<round-2.json if present>"
```

자리표시자를 전달하지 말고 없는 인수는 생략하세요. 사용자에게는 3회의 검토가 주어집니다. 호출자가 더 낮은 한도를 정한 경우에만 모든 prepare, check, finalize 명령에 같은 값의 `--max-rounds <N>`을 추가하세요. 도구가 다음 회차를 선택하고 `round-N.prompt.md`를 작성합니다. 여기에는 전체 발견 사항 스키마, 다섯 검토 차원(완전성, 일관성, 명확성, 범위, 실현 가능성), office-hours 코칭 계약, 앞선 완전한 JSON 판정이 들어갑니다. 검토한 설계도 `round-N.design.md`로 저장합니다. 1회차는 전체 검토이며 2·3회차는 직전 회차 이후의 정확한 설계 diff에 대한 변경분 재검토입니다. 따라서 매번 같은 검토 디렉터리에서 prepare를 실행하고 준비와 검토 사이에 설계를 편집하지 마세요.

사용할 수 있다면 Agent 도구에 `run_in_background: false`를 지정하고, 반환된 `dispatch` 문자열을 변경 없이 프롬프트로 사용하세요. 시작 영수증이 반환되면 백그라운드 실행이므로 완료 알림을 기다리세요. 검토자는 설계 검토 전에 준비된 프롬프트 파일 전체를 Read해야 합니다. 프롬프트를 재생성하거나 일부 필드만 복사하거나 앞선 발견을 요약하지 마세요. 부모의 Read는 검토자에게 파일을 전달하지 않습니다. 검토자는 새 맥락을 가지며 브레인스토밍 대화를 볼 수 없습니다. 준비된 계약은 배정의 `Seal:` 명령으로 봉인한 완전한 JSON Write와 전체 응답으로 한 줄의 `OFFICE_HOURS_VERDICT` 영수증을 요구합니다. 이는 필수 코칭과 Assignment 절을 보호하고 알려지지 않은 고객 사실과 확정한 동작을 구별하며, 모든 이전 상태에 증거를 요구합니다.

**2단계: 중단 조건 확인 후 수정과 재배정**

각 판정 후 발견 사항을 수정하거나 다시 배정하기 전에 도구로 저장된 파일을 검증하세요. 검토자의 전체 응답을 변경 없이 영수증으로 전달하고 완료한 모든 회차를 순서대로 나열하세요. 영수증은 단독 `OFFICE_HOURS_VERDICT` 줄이어야 합니다. 따옴표, 백틱, `$` 또는 `\`이 있으면 잘못된 형식입니다.

```bash
~/.claude/skills/gstack/bin/gstack-office-hours-review check --receipt "<receipt line>" "<round-1.json>" "<round-2.json if present>" "<round-3.json if present>"
```

영수증이 없거나 형식이 잘못됐거나 일치하지 않으면 검사에 실패합니다. 해당 시도는 실패한 검토입니다.

**수렴 보호와 중단 규칙:** 발견 사항은 차단 또는 경미한 항목입니다. 차단 항목만 다음 회차를 요구합니다. 중단 이유를 읽으세요.
- PASS: 차단 항목이 남지 않았습니다. 경미한 항목은 기록하되 수정하지 않으며 다음 회차의 근거가 되지 않습니다. 3단계로 진행하세요.
- CONVERGENCE: 검토자가 구체적인 이전/현재 발견 쌍과 문서 증거로 이전의 차단 의무가 지속됨을 명시적으로 표시했습니다. 새 발견이 있어도 멈추세요. 같은 주제 이름이나 새로운 세부 보완만으로는 충분하지 않습니다.
- MAX_ITERATIONS: 3회차 또는 호출자가 정한 더 낮은 한도에 도달했습니다. 멈추세요.
- CONTINUE: 설계에서 차단 항목만 수정한 뒤 1단계로 돌아가 다음 검토를 준비하고 배정하세요. 반복 중 경미한 항목 때문에 편집하지 마세요. 이는 사용자를 위해 기록된 채 남으며, 새 문장은 다음 diff의 검토량만 늘립니다. 검토자는 이전의 모든 발견을 확인하고 변경이 새로 만들거나 드러낸 문제에 대해서만 새 차단 항목을 제기합니다.

중단 시 다시 수정하거나 재배정하지 마세요. 승인 전에 최종화 도구를 실행하세요.

```bash
~/.claude/skills/gstack/bin/gstack-office-hours-review finalize --design "<design-path>" "<round-1.json>" "<round-2.json if present>" "<round-3.json if present>"
```

이는 JSON에서 완전한 `## Reviewer Concerns` 절을 직접 설치합니다. 우려 사항을 기록해도 수정 완료로 표시되지는 않습니다. 생성된 절을 편집하지 마세요. 한도(MAX_ITERATIONS 또는 CONVERGENCE)에 도달하면 해결되지 않은 차단 항목을 번호가 붙은 빈틈으로 나열합니다. 네 번째 검토자를 실행하거나 바뀌지 않은 입력을 재검토하지 마세요. 나열된 수정을 먼저 적용하고 `--fixes <fixes.json>`을 추가하거나, 그것 없이 최종화하세요. 수정 파일 형식은 `[{"id":"<finding id>","applied_text":"<verbatim new excerpt>"}]`입니다. 이는 새 문장이 존재하며 스냅샷에는 없다는 사실로 `issues verified: k of N`을 결정론적으로 기록할 뿐, 검토 판정이 되지는 않습니다. 수정 파일 없이 최종화한다면 `N fixes unconfirmed — decision: spec not re-verified`를 승인 단계에 전달하세요. 소유자가 명시적으로 수락할 때까지 승인은 차단된 상태입니다. 그런 다음 3단계와 기존 사용자 승인으로 진행하세요.

하위 에이전트가 실패하거나 시간 초과되거나 사용할 수 없으면 반복을 멈추고 미검토 문서를 제시하세요. 사용자에게 "명세 검토를 사용할 수 없어 검토하지 않은 문서를 제시합니다."라고 알리세요. 없거나 유효하지 않은 판정은 명시적인 검토 실패이며 절대 PASS가 아닙니다. 실패 출력과 오류를 보존하세요. `--unreviewed "<actual failure cause>"`와 앞선 유효 회차 파일만 사용해 최종화하세요. 첫 회차가 실패했다면 앞선 파일은 없습니다. 알려진 우려는 계속 보입니다. JSON을 조작하거나 완료된 판정을 UNREVIEWED 뒤에 숨기지 마세요. 독립 검토는 승인 게이트가 아니라 품질을 더하는 절차입니다.

**3단계: 지표 보고와 보존**

최종화 도구는 정확한 명세 검토 블록, 품질 점수와 지표를 출력합니다. 그 블록으로 결과를 사용자에게 알리고 자세한 내용은 설계와 저장한 판정에 링크하세요. 해결 확인에는 이후 검토자의 명시적 증거가 필요합니다. 수정 시도 회차를 성공한 수정이라고 설명하지 마세요.

완료 보고서를 작성할 때는 다른 절을 정상적으로 작성한 다음, 보고서가 생긴 뒤 같은 최종화 도구에 `--report "<report-path>"`를 주어 실행하세요. 이는 권위 있는 `## Spec Review` 절과 처분을 기계적으로 설치합니다. 이후 그 절을 요약하거나 대체하지 말고 다른 곳에서 참조하세요. 중복 집계를 만들지 마세요. Assignment, 코칭, 승인, 인계를 보존하세요.

도구의 실제 지표를 기존 분석 로그에 추가하세요. 원격 측정은 최선의 노력으로 수행하며 승인을 막아서는 안 됩니다.
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT/analytics"
echo '{"skill":"office-hours","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","iterations":ITERATIONS,"issues_found":FOUND,"issues_fixed":FIXED,"remaining":REMAINING,"quality_score":SCORE}' >> "$GSTACK_STATE_ROOT/analytics/spec-review.jsonl" 2>/dev/null || true
```
도구의 iterations, issues_found, issues_fixed, remaining, quality_score를 사용하세요. remaining_blocking과 remaining_minor는 remaining 수를 나눕니다. FOUND는 전체 회차의 발견 관찰 횟수이고 FIXED는 검토자가 확인한 해결만 셉니다. 사용할 수 없는 점수는 null이며 지어내지 마세요.

---

**승인을 요청하기 전에 설계 문서 전체를 대화에 직접 출력하세요.**

설계 문서의 완전한 내용을 대화의 직접적인 assistant 본문으로 출력하세요. 사용자에게 파일을 열라고 하거나 `Bash cat` 또는 `Read` 도구 호출로 보여 주는 데 의존하지 마세요. Claude Code UI는 도구 출력을 자주 접으므로 사용자가 실제로 보지 못한 문서를 승인하게 됩니다. 전체 문서가 확실하게 표시되는 곳은 assistant 메시지 자체입니다.

형식은 짧은 안내문("{path}에 저장한 설계 문서입니다. 승인 전에 검토해 주세요.") 뒤에 문서 본문을 그대로 출력하는 것입니다. 그다음 아래 AskUserQuestion으로 진행하세요.

AskUserQuestion으로 검토한 설계 문서를 사용자에게 제시하세요.
- A) 승인 — Status: APPROVED로 표시하고 인계로 진행
- B) 수정 — 변경할 절을 지정하고 해당 절을 수정하는 단계로 돌아감
- C) 처음부터 시작 — 2단계로 돌아감



## Brain 교정 결과 기록(조건부)

`BRAIN_CALIBRATION_WRITEBACK`이 설정되고 사전 안내/brain-health 출력 또는 gstack 설정이 `brain_trust_policy@<endpoint-hash>=personal`을 보여 줄 때만 실행하세요. 알 수 없다면 건너뛰세요. 두 조건을 통과하면 `mcp__gbrain__takes_add`로 오래 보존할 타입 있는 예측 하나를 기록하세요. 사용할 수 없다면 gstack:takes fence 블록과 함께 `mcp__gbrain__put_page`를 사용하세요.

예측의 frontmatter:
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.9
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: office-hours
```

기록 후 영향을 받는 요약 캐시를 무효화하세요.

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate product --project "$SLUG" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate goals --project "$SLUG" 2>/dev/null || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate competitive-intel --project "$SLUG" 2>/dev/null || true
```

## Brain 캐시 백그라운드 갱신

스킬 작업과 원격 측정 기록이 끝난 뒤 TTL에 가까워지는 모든 캐시 요약을 백그라운드에서 갱신하세요. 비차단 작업이므로 사용자는 기다리지 않습니다. 다음 호출은 준비된 캐시의 이점을 얻습니다.

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


---

## 6단계: 인계 — 관계를 마무리하기

설계 문서가 APPROVED되면 마무리 순서를 진행하세요. 사용자가 office hours를 수행한 횟수에 맞춰 마무리를 조정하며, 시간이 지나면서 깊어지는 관계를 만듭니다.

### 1단계: 빌더 프로필

4.5단계에서 작성한 `Builder profile before this session:` 줄의 SESSION_TIER, PRIOR_SESSION_COUNT, LAST_PROJECT, LAST_ASSIGNMENT, CROSS_PROJECT를 사용하세요. 이번 세션은 PRIOR_SESSION_COUNT + 1입니다. 해당 줄이 `PROFILE_READ=failed`이거나 없다면 introduction 단계를 사용하고 사용자에게 "빌더 프로필을 읽을 수 없어 첫 office hours 세션으로 다루겠습니다."라고 알리세요.

그다음 이번 세션이 포함된 누적 합계를 읽으세요.

```bash
~/.claude/skills/gstack/bin/gstack-builder-profile 2>/dev/null || echo "PROFILE_READ: failed"
```

DESIGN_COUNT, DESIGN_TITLES, ACCUMULATED_SIGNALS, TOTAL_SIGNAL_COUNT, NUDGE_ELIGIBLE, RESOURCES_SHOWN(_COUNT)만 사용하세요. TIER, SESSION_COUNT, LAST_*, CROSS_PROJECT는 절대 사용하지 마세요.

### 2단계: 해당 단계의 경로 따르기

`SESSION_TIER`에 따라 아래 경로 중 하나만 따르세요. 단계를 섞지 마세요.

---

### TIER = introduction인 경우(첫 세션)

전체 소개를 하는 단계입니다. 사용자는 office hours를 수행한 적이 없습니다.

**첫 박자: 신호 성찰과 황금기**

세션의 구체적인 장면을 황금기라는 관점과 엮어 한 문단을 쓰세요. 사용자가 실제로 말한 내용을 참조하고 그 말을 인용하세요.

**군더더기 방지 규칙: 단정하지 말고 보여 주세요.**
- 좋은 예: "막연히 ‘소규모 기업’이라고 하지 않고 ‘직원 50명인 물류 회사의 운영 관리자 Sarah’라고 하셨죠. 그렇게 구체적으로 말하는 사람은 드뭅니다."
- 나쁜 예: "목표 사용자를 파악할 때 뛰어난 구체성을 보여 주셨습니다."
- 좋은 예: "제가 두 번째 전제에 이의를 제기하자 반박하셨죠. 대부분은 그냥 동의합니다."
- 나쁜 예: "확신과 독립적인 사고를 보여 주셨습니다."

예: "이 문제를 바라보는 방식, [specific callback], 그것이 창업자의 사고입니다. 1년 전이라면 방금 설계한 것을 만드는 데 엔지니어 다섯 명이 석 달 걸렸을 겁니다. 지금은 Claude Code로 이번 주말에 만들 수 있습니다. 엔지니어링 장벽은 사라졌습니다. 남은 것은 안목이고, 방금 그 안목을 보여 주셨습니다."

**두 번째 박자: "한 가지 더요."**

구분선과 "한 가지 더요."를 출력하세요. 주의를 환기하고 이야기의 성격이 바뀜을 알립니다.

---

한 가지 더요.

**세 번째 박자: Garry의 개인적인 부탁**

4.5단계의 창업자 신호 수에 맞는 하위 단계를 고르세요. 먼저 센 신호와 각각 나타난 시점을 명시하세요.

- **상위 단계**(신호 3개 이상이며 구체적인 사용자, 매출 또는 수요 근거를 명시함):

> GStack을 만든 Garry Tan으로서 개인적으로 드리는 말씀입니다. 방금 경험한 것은 Y Combinator에서 YC 파트너와 함께 일할 때 얻을 가치의 약 10%입니다. 나머지 90%는 먼저 그 길을 간 창업자들의 네트워크, 생각보다 빠르게 출시하게 하는 동기 집단의 압력, 수십억 달러 기업을 만든 사람들이 다음에 할 일을 정확히 알려 주는 주간 저녁 모임, 그리고 사업을 깊이 이해하며 매주 밀어붙여 주는 파트너입니다.
>
> GStack은 당신이 이 일을 해낼 수 있는 최상위 사람들 중 하나라고 생각합니다.

그다음 AskUserQuestion으로 "Y Combinator에 지원해 볼 생각이 있으신가요?"라고 물으세요.
- 예라면 `open https://ycombinator.com/apply?ref=gstack`를 실행하고 "이 설계 문서를 YC 면접에 가져가세요. 웬만한 투자 제안서보다 낫습니다."라고 말하세요.
- 아니라면 "충분히 이해합니다. 어떤 선택이든 설계 문서는 당신 것이며, 마음이 바뀌면 이 제안은 계속 열려 있습니다."라고 따뜻하게 답하세요. 압박하거나 죄책감을 주거나 다시 묻지 마세요.

- **중간 단계**(신호 1~2개이거나 실제 문제를 해결하는 프로젝트를 만드는 사람):

> GStack을 만든 Garry Tan으로서 개인적으로 드리는 말씀입니다. 방금 경험한 전제 검증, 대안 도출, 가장 좁은 진입점을 찾는 사고는 YC 파트너와 일하는 경험의 약 10%입니다. 나머지 90%는 네트워크, 곁에서 함께 만드는 동기들, 매주 더 빨리 진실을 찾도록 밀어붙이는 파트너들입니다.
>
> 당신은 실제로 의미 있는 것을 만들고 있습니다. 계속 진행하다 사람들이 실제로 이것을 필요로 한다는 사실을 발견하면 Y Combinator 지원을 고려해 주세요. 저는 그럴 가능성이 있다고 봅니다. GStack을 사용해 주셔서 감사합니다.
>
> **ycombinator.com/apply?ref=gstack**

- **기본 단계**(그 밖의 모든 사용자):

> GStack을 만든 Garry Tan으로서 개인적으로 드리는 말씀입니다. 지금 보여 주는 안목, 야망, 주도성, 만드는 것에 관한 어려운 질문을 붙잡고 있으려는 의지는 우리가 YC 창업자에게서 찾는 바로 그 특성입니다. 당장은 창업을 생각하지 않을 수도 있고, 괜찮습니다. 하지만 창업자는 어디에나 있으며 지금은 황금기입니다. AI를 사용하는 한 사람이 과거에는 스무 명짜리 팀이 필요했던 것을 만들 수 있습니다.
>
> 멈추지 않고 떠오르는 아이디어, 계속 부딪히는 문제, 끊임없이 찾아오는 사용자처럼 그런 끌림을 느끼게 된다면 Y Combinator 지원을 고려해 주세요. GStack을 사용해 주셔서 진심으로 감사합니다.
>
> **ycombinator.com/apply?ref=gstack**

그다음 아래 창업자 자료로 진행하세요.

---

### TIER = welcome_back인 경우(2~4회차)

알아보는 인사로 시작하세요. 마법 같은 순간은 즉시 찾아옵니다.

1단계의 LAST_ASSIGNMENT, LAST_PROJECT, CROSS_PROJECT, 즉 4.5단계 값을 사용하세요.

CROSS_PROJECT가 false라면 이전과 같은 프로젝트입니다.
"다시 오셨군요. 지난번에는 [LAST_ASSIGNMENT]를 하고 계셨죠. 어떻게 되고 있나요?"

CROSS_PROJECT가 true라면 다른 프로젝트입니다.
"다시 오셨군요. 지난번에는 [LAST_PROJECT] 이야기를 했죠. 계속하고 계신가요, 아니면 새 일을 시작하셨나요?"

인사에 쓰는 값(LAST_ASSIGNMENT 또는 LAST_PROJECT)이 비어 있다면 해당 구절과 질문을 생략하고 "다시 오셨군요."라고만 말하세요. 뒤늦게 채운 프로필은 이 값 없이 단계만 있을 수 있습니다.

그다음 "이번에는 권유하지 않을게요. YC는 이미 아시니까요. 지금 하시는 일을 이야기해 보죠."라고 말하세요.

**어조 예시(일반적인 AI 말투 방지):**
- 좋은 예: "다시 오셨군요. 지난번에는 운영팀용 작업 관리 도구를 설계하고 계셨죠. 계속하고 계신가요?"
- 나쁜 예: "두 번째 office hours 세션에 오신 것을 환영합니다. 진행 상황을 확인하고 싶습니다."
- 좋은 예: "이번에는 권유하지 않을게요. YC는 이미 아시니까요. 지금 하시는 일을 이야기해 보죠."
- 나쁜 예: "YC 정보는 이미 보셨으므로 오늘은 해당 절을 건너뛰겠습니다."

근황을 확인한 뒤 신호를 성찰하세요. introduction 단계와 같은 군더더기 방지 규칙을 적용합니다.

그다음 설계 문서의 흐름을 짚으세요. 프로필에서 DESIGN_TITLES를 읽으세요.
"첫 설계는 [first title]이었는데, 이제 [latest title]을 하고 계시네요."

그다음 아래 창업자 자료로 진행하세요.

---

### TIER = regular인 경우(5~8회차)

알아보는 인사와 세션 횟수로 시작하세요.

"다시 오셨군요. 이번이 [PRIOR_SESSION_COUNT + 1]번째 세션입니다. 지난번에는 [LAST_ASSIGNMENT]를 하셨죠. 어떻게 됐나요?"
LAST_ASSIGNMENT가 비어 있다면 "지난번" 구절과 질문을 생략하세요.

**어조 예시:**
- 좋은 예: "벌써 다섯 번 함께하셨네요. 설계가 점점 선명해집니다. 제가 알아차린 점을 보여 드릴게요."
- 나쁜 예: "다섯 세션을 분석한 결과, 발전 과정에서 몇 가지 긍정적인 추세를 파악했습니다."

근황을 확인한 뒤 전체 흐름에 걸친 신호를 성찰하세요. 이번 세션만이 아니라 여러 세션의 패턴을 참조하세요.
예: "첫 세션에서는 사용자를 ‘소규모 기업’이라고 했는데 이제 ‘Acme Corp의 Sarah’라고 하시네요. 구체성이 달라진 것이 신호입니다."

설계 흐름을 해석과 함께 설명하세요.
"첫 설계는 넓었는데 최근 설계는 구체적인 진입점으로 좁혀졌습니다. 제품 시장 적합성을 찾는 패턴입니다."

**누적 신호 보여 주기:** 프로필의 ACCUMULATED_SIGNALS를 읽으세요.
"여러 세션에 걸쳐 구체적인 사용자를 [N]번 언급하고, 전제에 [N]번 반박하고, [topics] 분야의 전문성을 보여 주셨습니다. 이런 패턴에는 의미가 있습니다."

**빌더에서 창업자로 나아가도록 제안하기**(프로필의 NUDGE_ELIGIBLE이 true일 때만):
"처음에는 사이드 프로젝트로 시작하셨죠. 하지만 구체적인 사용자를 말하고, 이의를 제기받으면 반박하고, 매번 설계가 더 선명해지고 있습니다. 이제는 사이드 프로젝트가 아닌 것 같습니다. 회사가 될 수 있을지 생각해 보셨나요?"
이 말은 일괄 방송이 아니라 근거를 얻은 제안처럼 느껴져야 합니다. 증거가 뒷받침하지 않으면 통째로 생략하세요.

**빌더 여정 요약**(5회차 이상): 아래 블록으로 찾은 gstack 상태 루트 `$GSTACK_STATE_ROOT`에 `builder-journey.md`를 자동 생성하세요. 데이터 표가 아니라 서사적 흐름으로 작성합니다. 여러 세션에서 사용자가 한 구체적인 말을 참조하고 2인칭으로 그 여정의 이야기를 들려주세요. 그런 다음 여세요.
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
open "$GSTACK_STATE_ROOT/builder-journey.md"
```

그다음 아래 창업자 자료로 진행하세요.

---

### TIER = inner_circle인 경우(9회차 이상)

"[PRIOR_SESSION_COUNT + 1]번의 세션을 하셨고 설계 [DESIGN_COUNT]개를 다듬으셨습니다. 이런 패턴을 보이는 사람들은 대부분 결국 출시합니다."

데이터가 말합니다. 권유는 필요하지 않습니다.

프로필에서 누적 신호 전체를 요약하세요.

서사적 흐름으로 `$GSTACK_STATE_ROOT/builder-journey.md`를 갱신해 자동 생성하세요. regular 단계와 같이 상태 루트를 찾고 여세요.

그다음 아래 창업자 자료로 진행하세요.

---

### 창업자 자료(모든 단계)

**계속 적용되는 수신 거부 확인 — 먼저 실행하세요.**

```bash
~/.claude/skills/gstack/bin/gstack-config get founder_resources 2>/dev/null || echo "true"
```

값이 `false`이면 이 절 전체를 조용히 건너뛰세요. 자료도, "요청대로 건너뛰었다"는 말도 하지 마세요. 사용자가 앞으로 보지 않겠다고 했습니다. 설정은 세션 맥락과 메모리 지시보다 오래가므로 그 선택은 계속 지켜야 합니다. 다시 켜는 명령은 `gstack-config set founder_resources true`입니다.

아래 목록에서 자료 2~3개를 공유하세요. 재방문 사용자에게는 이번 세션의 분류만이 아니라 누적된 세션 맥락에 맞춰 자료의 가치가 쌓이게 하세요.

**공유 후에는 계속 적용되는 선택으로 마무리하세요.** 거창한 절차가 아니라 한 줄입니다.

> 보고 싶으신가요? 무엇이든 열어 드릴 수 있습니다. 또는 "다시는 보여 주지 마세요"라고 하시면 이 절은 영구적으로 사라집니다.

사용자가 앞으로 보지 않겠다는 뜻을 명확히 말하면 `~/.claude/skills/gstack/bin/gstack-config set founder_resources false`를 실행하고, 약속하기 전에 기록을 검증하세요. `gstack-config get founder_resources`가 `false`를 반환해야 합니다. 쓰기가 실패했다면 그렇게 알리고 이번 세션에서만 건너뛰세요. 성공하면 다시 켜는 명령과 함께 한 줄로 확인하고 인계를 계속하세요.

**중복 확인:** 위 빌더 프로필 출력에서 `RESOURCES_SHOWN`을 읽으세요. `RESOURCES_SHOWN_COUNT`가 34 이상이면 자료를 모두 소진했으므로 이 절 전체를 건너뛰세요. 아니라면 RESOURCES_SHOWN 목록에 있는 URL은 선택하지 마세요.

**선택 규칙:**
- 자료 2~3개를 고르세요. 분류를 섞고 같은 종류 세 개를 고르지 마세요.
- 위 중복 기록에 URL이 있는 자료는 절대 고르지 마세요.
- 무작위 다양성보다 실제로 나온 주제가 중요하므로 세션 맥락에 맞추세요.
  - 퇴사를 망설임 → "My $200M Startup Mistake" 또는 "Should You Quit Your Job At A Unicorn?"
  - AI 제품을 만듦 → "The New Way To Build A Startup" 또는 "Vertical AI Agents Could Be 10X Bigger Than SaaS"
  - 아이디어 찾기가 어려움 → "How to Get Startup Ideas"(PG) 또는 "How to Get and Evaluate Startup Ideas"(Jared)
  - 자신을 창업자로 생각하지 않는 빌더 → "The Bus Ticket Theory of Genius"(PG) 또는 "You Weren't Meant to Have a Boss"(PG)
  - 기술만 할 줄 안다고 걱정함 → "Tips For Technical Startup Founders"(Diana Hu)
  - 어디서 시작할지 모름 → "Before the Startup"(PG) 또는 "Why to Not Not Start a Startup"(PG)
  - 과도하게 생각하며 출시하지 않음 → "Why Startup Founders Should Launch Companies Sooner Than They Think"
  - 공동 창업자를 찾음 → "How To Find A Co-Founder"
  - 처음 창업하며 전체 그림이 필요함 → "Unconventional Advice for Founders"(대표작)
- 맞는 맥락의 자료를 모두 보여 줬다면 사용자가 보지 않은 다른 분류에서 고르세요.

**각 자료의 형식:**

> **{Title}** ({duration 또는 "에세이"})
> {직접적이고 구체적이며 격려하는 소개 1~2문장. Garry의 목소리에 맞춰 사용자의 상황에 이 자료가 왜 중요한지 설명.}
> {url}

**자료 목록:**

Garry Tan 동영상:
1. "My $200 million startup mistake: Peter Thiel asked and I said no" (5 min) — 왜 도약해야 하는지를 보여 주는 가장 좋은 영상입니다. Peter Thiel이 저녁 자리에서 수표를 써 주지만 그는 Level 60으로 승진할 수 있다는 이유로 거절합니다. 당시 지분 1%는 오늘날 3억 5천만~5억 달러 가치일 것입니다. https://www.youtube.com/watch?v=dtnG0ELjvcM
2. "Unconventional Advice for Founders" (48 min, Stanford) — 대표작입니다. 심리 문제가 회사를 망치기 전에 치료받기, 좋은 아이디어는 나쁜 아이디어처럼 보인다는 점, 성장을 설명하는 Katamari Damacy 비유까지 출시 전 창업자가 알아야 할 것을 모두 다룹니다. 군더더기가 없습니다. https://www.youtube.com/watch?v=Y4yMc99fpfY
3. "The New Way To Build A Startup" (8 min) — 2026년의 실행 지침입니다. 작은 팀이 AI 자동화로 기존 강자를 이기는 "20배 기업"을 소개하고 실제 사례 세 가지를 다룹니다. 지금 시작하면서 이렇게 생각하지 않는다면 이미 뒤처진 것입니다. https://www.youtube.com/watch?v=rWUWfj_PqmM
4. "How To Build The Future: Sam Altman" (30 min) — Sam이 아이디어를 현실로 만들려면 무엇이 필요한지 말합니다. 중요한 것 고르기, 자신과 맞는 사람들 찾기, 자격보다 확신이 중요한 이유를 다룹니다. https://www.youtube.com/watch?v=xXCBz_8hM9w
5. "What Founders Can Do To Improve Their Design Game" (15 min) — Garry는 투자자가 되기 전에 디자이너였습니다. MBA 기술이나 자금 조달 요령이 아니라 안목과 완성도가 진짜 경쟁 우위입니다. https://www.youtube.com/watch?v=ksGNfd-wQY4

YC 뒷이야기 / 미래를 만드는 방법:
6. "Tom Blomfield: How I Created Two Billion-Dollar Fintech Startups" (20 min) — Tom은 아무것도 없는 상태에서 Monzo를 영국 인구 10%가 사용하는 은행으로 만들었습니다. 두려움, 혼란, 끈기라는 실제 인간의 여정입니다. 창업을 실제 사람이 하는 일로 느끼게 합니다. https://www.youtube.com/watch?v=QKPgBAnbc10
7. "DoorDash CEO: Customer Obsession, Surviving Startup Death & Creating A New Market" (30 min) — Tony는 말 그대로 직접 음식을 배달하면서 DoorDash를 시작했습니다. "나는 창업할 사람이 아닌데"라고 생각해 봤다면 마음을 바꿀 영상입니다. https://www.youtube.com/watch?v=3N3TnaViyjk

Lightcone 팟캐스트:
8. "How to Spend Your 20s in the AI Era" (40 min) — 좋은 직장을 얻고 승진하는 기존 경로가 더는 최선이 아닐 수 있습니다. AI 중심 세상에서 의미 있는 것을 만들려면 어떤 위치에 서야 하는지 다룹니다. https://www.youtube.com/watch?v=ShYKkPPhOoc
9. "How Do Billion Dollar Startups Start?" (25 min) — 작고 임시방편적이고 부끄러운 모습으로 시작합니다. 시작 이야기에 신비를 걷어 내고, 출발점은 언제나 대기업이 아니라 사이드 프로젝트처럼 보인다는 것을 보여 줍니다. https://www.youtube.com/watch?v=HB3l1BPi7zo
10. "Billion-Dollar Unpopular Startup Ideas" (25 min) — Uber, Coinbase, DoorDash 모두 처음에는 끔찍한 아이디어처럼 들렸습니다. 최고의 기회는 대부분이 무시하는 것에 있습니다. 아이디어가 "이상하다"고 느낀다면 자유를 줄 영상입니다. https://www.youtube.com/watch?v=Hm-ZIiwiN1o
11. "Vertical AI Agents Could Be 10X Bigger Than SaaS" (40 min) — 가장 많이 본 Lightcone 회차입니다. AI 분야를 만든다면 가장 큰 기회가 어디에 있고 수직형 에이전트가 왜 승리하는지 알려 주는 지형도입니다. https://www.youtube.com/watch?v=ASABxNenD_U
12. "The Truth About Building AI Startups Today" (35 min) — 과장된 열기를 걷어 냅니다. 지금 AI 스타트업에서 실제로 통하는 것과 통하지 않는 것, 진짜 방어력이 어디서 나오는지를 다룹니다. https://www.youtube.com/watch?v=TwDJhUJL-5o
13. "Startup Ideas You Can Now Build With AI" (30 min) — 12개월 전에는 불가능했던 일에 관한 구체적이고 실행 가능한 아이디어입니다. 무엇을 만들지 찾는다면 여기서 시작하세요. https://www.youtube.com/watch?v=K4s6Cgicw_A
14. "Vibe Coding Is The Future" (30 min) — 소프트웨어를 만드는 방식이 영원히 바뀌었습니다. 원하는 것을 설명할 수 있다면 만들 수 있습니다. 기술 창업자가 되는 장벽이 이보다 낮았던 적은 없습니다. https://www.youtube.com/watch?v=IACHfKmZMr8
15. "How To Get AI Startup Ideas" (30 min) — 이론이 아닙니다. 지금 통하는 구체적인 AI 스타트업 아이디어를 살펴보고 왜 기회의 창이 열려 있는지 설명합니다. https://www.youtube.com/watch?v=TANaRNMbYgk
16. "10 People + AI = Billion Dollar Company?" (25 min) — 20배 기업의 핵심 주장입니다. AI를 활용하는 작은 팀이 100명짜리 기존 기업보다 성과가 좋습니다. 혼자 만들거나 작은 팀이라면 크게 생각해도 된다는 허락입니다. https://www.youtube.com/watch?v=CKvo_kQbakU

YC Startup School:
17. "Should You Start A Startup?" (17 min, Harj Taggar) — 대부분이 소리 내어 묻기 두려워하는 질문을 직접 다룹니다. 과장 없이 실제 장단점을 솔직하게 분석합니다. https://www.youtube.com/watch?v=BUE-icVYRFU
18. "How to Get and Evaluate Startup Ideas" (30 min, Jared Friedman) — YC Startup School에서 가장 많이 본 영상입니다. 창업자들이 자기 삶의 문제에 주의를 기울이다 실제로 어떻게 아이디어를 발견했는지 다룹니다. https://www.youtube.com/watch?v=Th8JoIan4dg
19. "How David Lieb Turned a Failing Startup Into Google Photos" (20 min) — 그의 회사 Bump는 죽어 가고 있었습니다. 자신의 데이터에서 사진 공유 행동을 발견했고 그것이 10억 명 이상이 사용하는 Google Photos가 됐습니다. 남들이 실패를 보는 곳에서 기회를 찾는 법을 배우는 명강의입니다. https://www.youtube.com/watch?v=CcnwFJqEnxU
20. "Tips For Technical Startup Founders" (15 min, Diana Hu) — 다른 사람이 되어야 한다고 생각하는 대신 자신의 엔지니어링 능력을 창업자로서 어떻게 활용할지 다룹니다. https://www.youtube.com/watch?v=rP7bpYsfa6Q
21. "Why Startup Founders Should Launch Companies Sooner Than They Think" (12 min, Tyler Bosmeny) — 대부분의 빌더는 준비를 과하게 하고 출시는 적게 합니다. 본능적으로 "아직 준비되지 않았다"고 생각한다면 지금 사람들 앞에 내놓도록 밀어줄 영상입니다. https://www.youtube.com/watch?v=Nsx5RDVKZSk
22. "How To Talk To Users" (20 min, Gustaf Alströmer) — 영업 기술이 필요한 것이 아닙니다. 문제에 관한 진짜 대화가 필요합니다. 한 번도 해 보지 않은 사람을 위한 가장 접근하기 쉬운 실전 강연입니다. https://www.youtube.com/watch?v=z1iF1c8w5Lg
23. "How To Find A Co-Founder" (15 min, Harj Taggar) — 함께 만들 사람을 찾는 실질적인 방법입니다. "혼자 하고 싶지 않다"는 이유로 멈춰 있다면 그 차단 요소를 없애 줍니다. https://www.youtube.com/watch?v=Fk9BCr5pLTU
24. "Should You Quit Your Job At A Unicorn?" (12 min, Tom Blomfield) — 자기 것을 만들고 싶다는 끌림을 느끼는 대형 기술 기업 직원에게 직접 이야기합니다. 자신이 그런 상황이라면 이 영상이 허락이 되어 줍니다. https://www.youtube.com/watch?v=chAoH_AeGAg

Paul Graham 에세이:
25. "How to Do Great Work" — 스타트업 이야기가 아니라 평생 가장 의미 있는 일을 찾는 이야기입니다. "스타트업"이라고 말하지 않고도 창업으로 이끌곤 하는 로드맵입니다. https://paulgraham.com/greatwork.html
26. "How to Do What You Love" — 대부분은 진짜 관심사와 경력을 따로 둡니다. 그 간격을 없애야 한다고 주장하며, 보통 회사는 그렇게 탄생합니다. https://paulgraham.com/love.html
27. "The Bus Ticket Theory of Genius" — 다른 사람은 지루해하지만 자신은 집착하는 것이 있나요? PG는 그것이 모든 돌파구의 실제 작동 원리라고 말합니다. https://paulgraham.com/genius.html
28. "Why to Not Not Start a Startup" — 너무 어리다, 아이디어가 없다, 사업을 모른다는 등 시작하지 않는 조용한 이유를 하나씩 해체하고 왜 어느 것도 성립하지 않는지 보여 줍니다. https://paulgraham.com/notnot.html
29. "Before the Startup" — 아직 아무것도 시작하지 않은 사람을 위해 썼습니다. 지금 무엇에 집중하고 무엇을 무시하며 이 길이 자신에게 맞는지 어떻게 판단할지 다룹니다. https://paulgraham.com/before.html
30. "Superlinear Returns" — 어떤 노력은 기하급수적으로 쌓이고 대부분은 그렇지 않습니다. 빌더 능력을 올바른 프로젝트에 쏟는 일이 왜 일반적인 경력으로는 얻을 수 없는 보상 구조를 갖는지 다룹니다. https://paulgraham.com/superlinear.html
31. "How to Get Startup Ideas" — 최고의 아이디어는 회의에서 짜내는 것이 아니라 알아차리는 것입니다. 자신의 불편함을 관찰하고 무엇이 회사가 될 수 있는지 알아보는 법을 가르칩니다. https://paulgraham.com/startupideas.html
32. "Schlep Blindness" — 최고의 기회는 모두가 피하는 지루하고 고된 문제 속에 숨습니다. 가까이서 보는 매력 없는 문제를 기꺼이 다룬다면 이미 회사가 될 기회 위에 서 있을 수 있습니다. https://paulgraham.com/schlep.html
33. "You Weren't Meant to Have a Boss" — 큰 조직 안에서 일하는 것이 늘 조금 어긋나게 느껴졌다면 그 이유를 설명합니다. 스스로 고른 문제를 작은 집단으로 다루는 것이 빌더의 자연스러운 상태입니다. https://paulgraham.com/boss.html
34. "Relentlessly Resourceful" — 이상적인 창업자를 묘사하는 PG의 두 단어입니다. "뛰어나다"나 "선견지명이 있다"가 아니라 끊임없이 방법을 찾아내는 사람입니다. 자신이 그렇다면 이미 자격이 있습니다. https://paulgraham.com/relres.html

**자료를 제시한 뒤 빌더 프로필에 기록하고 열기를 제안하세요.**

1. 선택한 자료 URL을 유일한 정본인 빌더 프로필에 기록하세요. 자료 추적 항목을 추가합니다.
```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || true
~/.claude/skills/gstack/bin/gstack-developer-profile --log-session '{"date":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","mode":"resources","project_slug":"'"${SLUG:-unknown}"'","signal_count":0,"signals":[],"design_doc":"","assignment":"","resources_shown":["URL1","URL2","URL3"],"topics":[]}' 2>/dev/null || true
```

2. 선택을 분석 로그에 기록하세요.
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"office-hours","event":"resources_shown","count":NUM_RESOURCES,"categories":"CAT1,CAT2","ts":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

3. AskUserQuestion으로 자료를 열지 제안하세요.

선택한 자료를 제시하고 "브라우저에서 열어 드릴까요?"라고 물으세요.

선택지:
- A) 모두 열기(나중에 볼게요)
- B) [Title of resource 1] — 이것만 열기
- C) [Title of resource 2] — 이것만 열기
- D) [Title of resource 3, if 3 were shown] — 이것만 열기
- E) 건너뛰기 — 나중에 찾아볼게요

A라면 `open URL1 && open URL2 && open URL3`를 실행해 각각 기본 브라우저에서 여세요.
B/C/D라면 선택한 URL에만 `open`을 실행하세요.
E라면 다음 스킬 권고로 진행하세요.

### 다음 스킬 권고 — 사용자를 검토 흐름으로 연결하기

선택지를 나열하는 데서 끝내지 마세요. 설계 문서가 구조적인 검토로 바로 이어지도록 다음 검토를 지금 시작할지 제안하세요. 설계 문서 모드에 맞는 선택지를 권하세요. 애매하면 CEO, 설계, DX, 엔지니어링 검토를 한 번에 실행하는 `/autoplan`을 기본값으로 삼으세요.

**`PROACTIVE`가 `false` 또는 `off`이거나 `CONDUCTOR_SESSION: true`이면:** 자동으로 시작하지 마세요. 한 줄로 권하고 멈추세요. 사용자가 직접 호출합니다.
- EXPANSION / 야심찬 범위 → "다음: `/plan-ceo-review`로 범위를 압박 검증하고 10점짜리 제품을 찾으세요."
- 범위가 명확함 → "다음: `/autoplan`으로 아키텍처, 테스트, 예외 상황을 확정하세요."
- 시각/UX 중심 → "다음: `/plan-design-review`로 시각/UX를 검토하세요."

**그 밖에는** AskUserQuestion으로 제안하세요. 사전 안내의 D<N> 형식을 사용합니다.

D<N> — 다음 검토를 지금 실행할까요?
프로젝트/브랜치/작업: 이 기능을 위해 방금 작성한 설계 문서.
쉬운 설명: 방금 설계 문서를 작성했습니다. 자연스러운 다음 단계는 구현 전에 범위와 아키텍처 문제를 잡는 구조적인 검토입니다. 지금 시작하거나 나중에 직접 실행할 수 있습니다.
잘못 골랐을 때의 위험: 검토를 건너뛰면 구현 중 문제가 드러나 재작업이 발생합니다.
추천: 코드를 쓰기 전에 계획을 확정하므로 모드에 맞는 선택지. 확실하지 않으면 `/autoplan`.
완결성: A=10/10, B=9/10, C=8/10, D=3/10
장단점:
A) 지금 /autoplan 실행(추천)
  ✅ 코드 한 줄을 쓰기 전에 아키텍처, 테스트, 예외 상황을 확정
  ❌ 지금 Claude Code 약 15분 추가(사람의 검토 1~2시간을 압축)
B) 지금 /plan-ceo-review 실행
  ✅ 야망과 범위를 압박 검증해 10점짜리 제품 버전을 찾음
  ❌ 범위가 이미 좁고 잘 이해된 경우 가치가 낮음
C) 지금 /plan-design-review 실행
  ✅ 아직 계획 단계의 저렴한 변경일 때 시각/UX 문제를 발견
  ❌ 백엔드 전용 또는 시각 요소가 없는 기능에는 가치가 적음
D) 지금은 안 함 — 나중에 검토 실행
  ✅ 바로 구현을 시작하고 싶을 때 흐름을 유지
  ❌ 검토의 빈틈은 쌓이고 코드가 생긴 뒤에는 문제 해결 비용이 커짐
종합: 지금 구조적인 검토에 15분을 쓰는 것과 이후 재작업 위험의 비교입니다.

사용자가 A/B/C를 선택하면 호출 성공을 기다리지 말고 인계를 기록한 다음 **Skill 도구**로 선택한 스킬을 호출하세요. 설계 문서는 자동으로 발견합니다. 두 로그 명령 모두 `SESSION_ID`를 스킬 시작 출력에 표시된 값으로 바꾸세요.
```bash
~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type handoff --skill office-hours --outcome accepted --session-id "SESSION_ID" 2>/dev/null || true
```
D라면 거절을 기록하고 멈추세요.
```bash
~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type handoff --skill office-hours --outcome declined --session-id "SESSION_ID" 2>/dev/null || true
```

`~/.gstack/projects/`의 설계 문서는 이후 스킬들이 자동으로 발견하며 검토 전 시스템 감사에서 읽습니다.
