> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from visual-design.md.tmpl — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
## 시각 디자인 탐색

```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/design/dist/design" ] && D="$_ROOT/.claude/skills/gstack/design/dist/design"
[ -z "$D" ] && D="$HOME/.claude/skills/gstack/design/dist/design"
_DS=$("$HOME/.claude/skills/gstack/bin/gstack-paths" --get GSTACK_STATE_ROOT 2>/dev/null); _DC=${_DS:+$_DS/design-ready}; _DK=$(ls -diL "$D" 2>/dev/null)
_dt() { if command -v gtimeout >/dev/null; then gtimeout 10 "$@"; elif command -v timeout >/dev/null; then timeout 10 "$@"
elif command -v perl >/dev/null; then perl -e 'alarm(shift);exec(@ARGV)' 10 "$@"; else return 125; fi; }
_RC=0; _F="Fix: cd ${D%/design/dist/design} && ./setup"
if [ ! -x "$D" ]; then _RC=missing
elif [ ! "$_DC" -nt "$D" ] || [ "$(cat "$_DC")" != "$_DK" ]; then _dt "$D" --version >/dev/null 2>&1 </dev/null || _RC=$?
fi
case "$_RC" in
  0) echo "DESIGN_READY: $D"; [ -n "$_DC" ] && echo "$_DK" > "$_DC" 2>/dev/null ;;
  missing) echo "DESIGN_NOT_AVAILABLE: $D is not installed. $_F" ;;
  124|142) echo "DESIGN_NOT_AVAILABLE: $D --version timed out after 10s" ;;
  125) echo "DESIGN_NOT_AVAILABLE: no timeout/gtimeout/perl to bound $D" ;;
  137) echo "DESIGN_NOT_AVAILABLE: $D --version exited 137 (killed at launch; on macOS usually an invalid code signature). $_F" ;;
  *) echo "DESIGN_NOT_AVAILABLE: $D --version exited $_RC" ;;
esac
```

**`DESIGN_NOT_AVAILABLE`이면:** 아래 HTML wireframe 방식(기존 DESIGN_SKETCH 섹션)으로 대체하세요. 시각 mockup에는 design binary가 필요합니다.

**`DESIGN_READY`이면:** 사용자를 위한 시각 mockup 탐색을 생성하세요.

제안된 디자인의 시각 mockup을 생성 중입니다... (시각 자료가 필요 없으면 "skip"이라고 말하세요)

**Step 1: design directory 설정**

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_DESIGN_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/designs/mockup-$(date +%Y%m%d)"
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
```

**Step 2: design brief 구성**

존재하면 DESIGN.md를 읽어 시각 스타일을 제한하세요. DESIGN.md가 없으면 다양한 방향으로 넓게 탐색하세요. brief와 Step 6의 사용자 피드백은 비공개 파일에 둡니다:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
BRIEF_FILE=$(mktemp "${_GT:?}/brief.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BRIEF_FILE: $BRIEF_FILE (name: ${BRIEF_FILE##*/})"
FEEDBACK_FILE=$(mktemp "${_GT:?}/feedback.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "FEEDBACK_FILE: $FEEDBACK_FILE (name: ${FEEDBACK_FILE##*/})"
```

파일 쓰기 도구로 출력된 각 파일에 표시할 텍스트를 그대로 쓴다(Claude Code의 Write 도구는 먼저 빈 파일을 Read해야 한다). 셸 명령·heredoc·따옴표 인수에 텍스트를 넣지 않는다. 쓰기 실패나 거부 시 전송하지 말고 원인·파일 경로·아래 수동 전송 명령을 출력한다.

**Step 3: 3개 variant 생성**(출력된 이름으로 `<brief-file-name>` 대체)

```bash
BRIEF_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<brief-file-name>"
[ -s "$BRIEF_FILE" ] || { echo "Not run: $BRIEF_FILE is missing or empty. Write the brief, then rerun this block." >&2; exit 1; }
_OUT=$($D variants --brief "$(cat "$BRIEF_FILE")" --count 3 --output-dir "$_DESIGN_DIR/"); _RC=$?
printf '%s\n' "$_OUT"; echo "EXIT: $_RC"
```

동일한 brief의 스타일 변형 3개를 생성합니다(총 약 40초).

<!-- design:round-accounting -->
**라운드 회계(모든 board, check 또는 inline view 전):** `$D`는 절대 덮어쓰지 않습니다. 이미 사용한 이름은(예: `-2`) 증가하므로 JSON이 출력한 경로만 사용하고 이후 블록에는 literal path로 전달하세요(bash 블록은 변수를 공유하지 않음). `requested` 유료 이미지 중 `saved`가 몇 개인지 사용자에게 말하고 각 `failures` 항목을 이름으로 말하세요. exit code로 라우팅합니다. 0이면 `saved`로 계속, 3이면 `saved`로 계속하되 실행이 일찍 중단되었다고 말하고, 2이면 아무것도 저장되지 않았으므로 `failures`를 보고하고 중지합니다. `$D compare` 또는 `$D check`를 실행하지 마세요.

**Step 4: variant를 inline으로 보인 뒤 comparison board 열기**

저장된 각 이미지를 먼저 사용자에게 inline으로 보이고(Read 도구로 출력된 경로 읽기), 다음으로 comparison board를 만들고 serve하세요:

<!-- design:board -->
검사를 통과한 이번 라운드의 출력 이미지 경로를 순서대로 JSON 배열로 만들어 Write 도구로 `$_DESIGN_DIR/board-images.json`에 쓴다. 보드의 A·B·C는 그 순서를 따른다. 이전 Submit이 이번 이미지를 승인하지 못하도록 보관한 뒤 보드를 만든다.

```bash
[ -f "${_DESIGN_DIR:?set _DESIGN_DIR to the design dir printed above}/feedback.json" ] && mv "${_DESIGN_DIR:?}/feedback.json" "${_DESIGN_DIR:?}/feedback-$(date -u +%Y%m%dT%H%M%SZ).json"
$D compare --images-file "$_DESIGN_DIR/board-images.json" --output "$_DESIGN_DIR/design-board.html" --serve
```

이 명령은 board를 design daemon에 게시하고 사용자의 기본 browser에서 연 뒤 종료합니다. 피드백을 기다리지 않습니다. 캡처한 stderr에서 `BOARD_URL: http://127.0.0.1:N/<secret>/boards/<id>/` 줄을 읽은 뒤 AskUserQuestion으로 기다리세요: "<BOARD_URL>을 검토하고 Submit 또는 Regenerate를 누른 뒤 알려 주세요. 여기 선호를 붙여 넣어도 됩니다." 답변 후 board HTML 옆의 `feedback.json` 또는 `feedback-pending.json`을 읽으세요.

명령이 nonzero로 끝나거나 `BOARD_URL`을 출력하지 않으면 Read로 각 variant를 inline으로 보이고 AskUserQuestion으로 대체하세요: "어느 변형이 좋으며 어떤 피드백이 있나요?"

**Step 5: 피드백 처리**

JSON에 `"regenerated": true`가 있으면:
1. `regenerateAction`(또는 remix 요청의 경우 `remixSpec`)을 읽습니다.
2. 갱신된 brief로 `$D iterate` 또는 `$D variants`를 사용해 새 variants를 생성합니다. Step 3처럼 brief 파일을 다시 쓰고 capture 및 round accounting을 적용합니다.
3. `--serve` 없이 Step 4의 board 블록으로 board를 다시 빌드합니다.
4. 새 HTML을 실행 중인 board에 POST합니다. stderr의 board URL(`BOARD_URL: http://127.0.0.1:N/<secret>/boards/<id>/` — daemon path)을 parse하거나 legacy port(`SERVE_STARTED: port=N` — `--no-daemon`에서만 출력, `/api/reload` root에 도달)로 대체합니다. Daemon path:
   `jq -nc --arg html "$_DESIGN_DIR/design-board.html" '{html: $html}' | curl -sS -X POST "${BOARD_URL}api/reload" -H 'Content-Type: application/json' --data-binary @-`
5. 같은 tab에서 board가 자동 새로고침됩니다.

`"regenerated": false`이면 승인된 variant로 진행하세요.

**Step 6: 승인된 선택 저장**

Step 2의 feedback 파일에 사용자 피드백(없으면 `none`)을 쓰고, 이 board의 `board-images.json`(directory listing은 절대 사용하지 않음)을 통해 확인된 문자를 매핑하여 저장하세요. 출력된 이름으로 `<feedback-file-name>`을 대체합니다:

```bash
_IMG=$(jq -r --arg v "<VARIANT>" '.[($v | explode[0]) - 65] // empty' "$_DESIGN_DIR/board-images.json")
if [ -n "$_IMG" ]; then
  FEEDBACK_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<feedback-file-name>"
  [ -s "$FEEDBACK_FILE" ] || { echo "Not saved: $FEEDBACK_FILE is missing or empty. Write the feedback, then rerun this block." >&2; exit 1; }
  jq -n --arg approved_variant "<VARIANT>" --arg approved_path "$(basename "$_IMG")" --rawfile feedback "$FEEDBACK_FILE" --arg date "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg screen "mockup" --arg branch "$(git branch --show-current 2>/dev/null)" '$ARGS.named | .feedback |= rtrimstr("\n")' > "$_DESIGN_DIR/approved.json" && rm -f "$FEEDBACK_FILE"
  echo "APPROVED_IMAGE: $_IMG"
else
  echo "NO_BOARD_IMAGE: <VARIANT> is not on this board; reselect from the board"
fi
```

출력된 `APPROVED_IMAGE`를 design doc 또는 plan에서 참조하세요.

## 시각 스케치(UI 아이디어만)

선택한 접근 방식에 사용자 대면 UI(화면·페이지·양식·대시보드·상호작용 요소)가 있으면 거친 와이어프레임으로 시각화하세요. 순수 백엔드·인프라 아이디어이거나 UI가 없으면 이 절을 조용히 건너뛰세요.

**Step 1: design context 수집**

1. repo root에 `DESIGN.md`가 있는지 확인하세요. 있으면 design system 제약(colors, typography, spacing, component patterns)을 읽고 wireframe에 사용하세요.
2. 핵심 design 원칙을 적용하세요:
   - **정보 계층** — 사용자가 첫째, 둘째, 셋째로 무엇을 보나요?
   - **상호작용 상태** — loading, empty, error, success, partial
   - **엣지 케이스 편집증** — 이름이 47자인 경우? 결과가 0개? Network 실패?
   - **빼기 기본값** — "가능한 한 적은 디자인"(Rams). 모든 요소가 pixel의 가치를 증명합니다.
   - **신뢰를 위한 디자인** — 모든 interface element는 사용자 신뢰를 쌓거나 깎습니다.

**Step 2: wireframe HTML 생성**

다음 제약으로 single-page HTML 파일을 생성하세요:
- **의도적으로 rough한 미학** — system font, 얇은 회색 border, 무색, 손그림 같은 element를 사용합니다. polished mockup이 아니라 sketch입니다.
- Self-contained — 외부 dependency, CDN link 없이 inline CSS만 사용
- 핵심 interaction flow(최대 1-3 screens/states)를 보임
- 현실적인 placeholder content를 포함("Lorem ipsum" 금지, 실제 use case에 맞는 content 사용)
- design 결정을 설명하는 HTML comment 추가

먼저 비공개 directory를 만드세요. renderer가 그 directory 전체를 loopback으로 serve하므로 반드시 본인 전용이고 다른 것을 담지 않아야 합니다(다른 사용자가 미리 만들 수 있는 고정 shared /tmp 이름은 절대 사용하지 않음):
```bash
mktemp -d "${TMPDIR:-/tmp}/gstack-sketch.XXXXXX"
```
그 `<that directory>/sketch.html`에 sketch를 씁니다(Write 도구).

**Step 3: render 및 capture**

`gstack-render`는 실행 중이면 Aside browser에서, 아니면 gstack 자체 headless browser에서 sketch를 엽니다(첫 줄이 각각 `ENGINE=aside` 또는 `ENGINE=browse`로 말함). 그리고 screenshot을 찍습니다:

```bash
bun --no-env-file --config=/dev/null run $HOME/.claude/skills/gstack/bin/gstack-render.ts <sketch-dir>/sketch.html --screenshot <sketch-dir>/sketch.png --width 1280
```

`NEEDS_ASIDE` 또는 `ASIDE_NOT_RUNNING` 뒤에 `ERROR: no browser available`가 출력된 경우에만(Aside가 열려 있지 않고 gstack 자체 browser도 빌드되지 않음) render 단계를 건너뛰세요. 사용자에게 이렇게 말하세요: "시각 스케치는 Aside 브라우저(macOS 15+, aside.com) 또는 gstack 자체 브라우저로 렌더링합니다. Aside를 열거나 gstack 저장소에서 ./setup을 실행하면 와이어프레임을 렌더링하겠습니다." 둘 중 어느 것도 대신 설치하지 마세요.

**Step 4: 제시 및 반복**

사용자에게 screenshot을 보이세요. 물으세요: "이런 느낌이 맞나요? 레이아웃을 더 다듬을까요?"

변경을 원하면 피드백으로 HTML을 다시 생성하고 다시 render하세요. 승인하거나 "good enough"라고 하면 진행하세요.

**Step 5: sketch 저장**

임시 `sketch.png` 및 `sketch.html`을 `<PROJECT_DIR>/{user}-{branch}-sketch-{datetime}.*`로 복사하세요. "Recommended Approach"에 `Wireframe: projects/<slug>/<png name>`(state-root relative) 또는 `Wireframe: none (<reason>)`을 추가하세요.

**Step 6: 외부 디자인 관점** (선택 사항)

wireframe이 승인된 뒤 외부 디자인 관점을 제안하세요:

```bash

if ! _OUTSIDE_CFG=$("$HOME/.claude/skills/gstack/bin/gstack-config" get --stored codex_reviews) || [ "$_OUTSIDE_CFG" = disabled ]; then
  echo 'CODEX_MODE: disabled'
elif ( # GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi
); then
  if command -v codex >/dev/null 2>&1; then echo 'CODEX_MODE: ready'; else echo 'CODEX_MODE: not_installed'; fi
else
  echo 'CODEX_MODE: under_current_harness'
fi
```

이전의 `CODEX_MODE` 변수는 여기서 **Codex** 가용성을 설명합니다. `CODEX_MODE: disabled` 또는 전송의 `consent_missing` 줄은 `codex_reviews`가 꺼져 있거나 읽을 수 없다는 뜻입니다. 묻지 말고 `outside_status: disabled`를 기록하세요. 인증 및 구성된 모델의 유효성은 어느 것도 재정의하지 않고 실제 호출로 확인합니다. CLI가 없거나 손상되었으면 Codex를 설치 또는 복구하고, 인증 실패면 `codex login`을 실행하세요. 그 외에는 이 호출자의 opt-in/skip 선택을 따르세요. ready가 아닌 모든 결과는 외부 범위 누락입니다. 호출자의 기존 대체 절차를 따르세요. 다른 외부 provider로 절대 대체하지 마세요.

Codex를 사용할 수 있으면 AskUserQuestion을 사용하세요:
> "선택한 접근 방식에 대해 외부 디자인 관점을 원하나요? Codex는 visual thesis, content plan, interaction ideas를 제안합니다. Claude subagent는 대안적 aesthetic direction을 제안합니다."
>
> A) 예 — 외부 디자인 목소리 받기
> B) 아니오 — 없이 진행

사용자가 A를 고르면 아래 두 독립적 목소리를 모두 실행하고 종합 전에 둘의 결과를 기다리세요. 호스트가 병렬 도구 호출을 지원하면 겹칠 수 있으며 native subagent 호출은 blocking 상태를 유지합니다.

1. **Codex** (Bash를 통해, `model_reasoning_effort="medium"`):
Prompt: "이 제품 접근법에 대해 분위기·질감·에너지를 한 문장으로 담은 시각적 방향, 콘텐츠 계획(히어로 → 뒷받침 → 세부 → CTA), 페이지 느낌을 바꾸는 상호작용 아이디어2개를 제시하세요. 구도 우선·브랜드 우선·카드 없음·문서보다 포스터라는 미적 기본값을 적용하고 분명한 의견을 내세요." 준비된 프롬프트에 승인된 product approach와 wireframe source를 포함하세요.

실제 plan/spec/source를 포함한 **완전한 프롬프트와 맥락**을 비공개 파일에 쓰세요. `<prepared-prompt-file>` 대신 shell-quoted 경로를 넣고, 사용자 텍스트를 shell source에 절대 삽입하지 마세요. `Recommendation: <direction> because <product-specific reason>`으로 끝나는 완전한 design proposal을 요청하세요.

```bash
# GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi

_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo 'ERROR: not in a git repo' >&2; exit 1; }
_OUTSIDE_TMP=$(mktemp -d "${TMPDIR:-/tmp}/gstack-outside.XXXXXXXX") || exit 1
trap 'rm -rf "$_OUTSIDE_TMP"' EXIT
_OUTSIDE_INPUT="$_OUTSIDE_TMP/prompt"
cat -- '<prepared-prompt-file>' >"$_OUTSIDE_INPUT" || exit 1
_CODEX_PROBE="$HOME/.claude/skills/gstack/bin/gstack-codex-probe"
_CODEX_OUT=$("$_CODEX_PROBE" select-model exec) || exit 1
_CODEX_SEL=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SEL: //p')
_CODEX_SANDBOX_MODE=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SANDBOX: //p')
"$_CODEX_PROBE" check-sandbox || exit 1
"$_CODEX_PROBE" show-first-use-notice
_OUTSIDE_EXIT=0
"$_CODEX_PROBE" run-with-timeout --effort medium 300 codex exec - -C "$_REPO_ROOT" -s "${_CODEX_SANDBOX_MODE:?}" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$_OUTSIDE_TMP/text" <"$_OUTSIDE_INPUT" >"$_OUTSIDE_TMP/events" 2>"$_OUTSIDE_TMP/stderr" || _OUTSIDE_EXIT=$?
cat "$_OUTSIDE_TMP/text" 2>/dev/null || tail -n 20 "$_OUTSIDE_TMP/events"

cat "$_OUTSIDE_TMP/stderr" >&2 || { [ "$_OUTSIDE_EXIT" -ne 0 ] || _OUTSIDE_EXIT=1; }
_OUTSIDE_RC=0
bun --no-env-file --config=/dev/null "$HOME/.claude/skills/gstack/lib/outside-review-result.ts" --label 'Codex outside review' --exit "$_OUTSIDE_EXIT" --stderr "$_OUTSIDE_TMP/stderr" --events "$_OUTSIDE_TMP/events" proposal "$_OUTSIDE_TMP/text" || _OUTSIDE_RC=$?
case "$_OUTSIDE_RC" in
  0|3) ;;
  4) echo 'OUTSIDE_STATUS: unverified provider=codex host=claude'; exit 4 ;;
  *) [ "$_OUTSIDE_EXIT" -ne 0 ] && exit "$_OUTSIDE_EXIT"; exit 1 ;;
esac
echo 'OUTSIDE_STATUS: completed provider=codex host=claude'
```

Bash `timeout: 360000`을 사용하고 전체 응답을 `tool-output` fence에 보이세요. 성공적 실행과 유효한 marker가 필요합니다. 거부, 비었거나 형식이 잘못된 출력, Recommendation marker 누락, timeout 또는 CLI 실패는 `outside_status: unavailable`을 뜻합니다. P0/P1 발견 사항은 native 항목처럼 차단합니다. `OUTSIDE_STATUS: unverified`는 범위 누락입니다. 완료된 proposal은 계속하고 native 완료는 외부 범위로 세지 않습니다. 어느 결과 뒤든 비공개 프롬프트만 삭제하세요. scratch cleanup은 자동입니다.

기존 review-log skill ID를 유지하세요. `"host":"claude","outside_provider":"codex","outside_status":"completed|unavailable|disabled|skipped","phase":"design-sketch"`를 추가합니다. 서로 다른 시도 결과는 별도로 기록하세요. `source:"codex"`는 완료된 CLI 출력이 필요합니다. native는 `source:"in-host"`를 사용합니다(이전 `source:"claude"`: native Claude). 가용성/native 대체는 외부 완료가 아닙니다. 보고된 모든 modelUsage를 보존하고 알 수 없는 모델 정체성은 알 수 없는 상태로 둡니다. `GSTACK_CODEX_NO_SANDBOX=1`에서는 `"codex_sandbox":"danger-full-access"`를 추가하세요.

2. **Claude subagent** (Agent 도구를 통해, 가능하면 `run_in_background: false` — Claude Code v2.1.198부터 subagent는 기본적으로 background입니다. launch receipt는 background으로 갔음을 뜻하므로 완료 알림을 기다리세요):
"이 제품 접근법에는 어떤 디자인 방향을 권하나요? 어떤 미감·타이포그래피·상호작용 패턴이 맞으며 사용자에게 이 접근법이 필연적으로 느껴지게 하는 것은 무엇인가요? 글꼴명·16진수 색상·간격값을 구체적으로 쓰세요. 크림색 바탕과 고대비 세리프·테라코타 강조, 검정에 가까운 바탕과 네온 하나·빛나는 테두리, 제목 속 이탤릭 강조어, 01/02/03 절 번호, 작은 자간 넓은 고정폭 레이블, 알약 모양 버튼에 기대지 마세요. 첫 아이디어가 이 중 하나라면 이를 밝히고 다시 고르세요."

Codex 출력을 `CODEX SAYS (design sketch):` 아래에, subagent 출력을 `CLAUDE SUBAGENT (design direction):` 아래에 제시하세요.
오류 처리는 모두 비차단입니다. 실패하면 건너뛰고 계속하세요.
