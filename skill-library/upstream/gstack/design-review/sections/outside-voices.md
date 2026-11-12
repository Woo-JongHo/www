> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from outside-voices.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## 디자인 외부 의견(독립적)

**동의:** Codex를 사용할 수 있고 `codex_reviews`가 전송을 허용하면 외부 의견은 질문 없이 실행된다(unset은 활성화된 기본값을 의미하며, 첫 전송은 일회성 notice를 출력한다). `codex_reviews=disabled`이면 native voice만 실행한다.

**Codex 가용성 확인:**
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

여기서 역사적 `CODEX_MODE` 변수는 **Codex** 사용 가능 여부를 설명한다. `CODEX_MODE: disabled` 또는 전송의 `consent_missing` 줄은 `codex_reviews`가 꺼져 있거나 읽을 수 없다는 뜻이다. 묻지 말고 `outside_status: disabled`를 기록한다. 인증과 구성된 model의 유효성은 실제 invocation이 확인하며, 어느 쪽도 덮어쓰지 않는다. CLI가 없거나 고장 났으면 Codex를 설치 또는 복구한다. 인증 실패면 `codex login`을 실행한다. 그 외에는 이 caller의 opt-in/skip 선택을 존중한다. ready가 아닌 모든 결과는 외부 coverage 누락이다. caller의 기존 fallback을 따른다. 다른 external provider로 대체하지 않는다.

거절하면 두 의견을 모두 생략한다. `CODEX_MODE: disabled`이면 호스트 내부 의견만 실행하고 `outside_status: disabled`를 기록한다. 준비되지 않았다면 복구 안내를 유지하고 내부 의견만 사용하며 성공해도 `outside_status: unavailable`로 기록한다. 프로세스를 만들기 전에 호출이 하니스를 재확인한다.

**준비되면** 두 의견을 실행하고 둘 다 끝난 뒤 종합한다. 지원되면 호출을 겹치되 내부 호출은 결과를 기다리는 방식으로 유지한다.

1. **Codex 디자인 의견**(Bash 사용):
프롬프트에는 경로만이 아니라 실제 계획·제품·프런트엔드 소스 맥락을 포함한다.

"이 저장소의 프런트엔드 소스 코드를 다음 디자인 필수 규칙으로 검토하세요.
- 간격: 디자인 토큰·CSS 변수로 체계화되어 있나요, 임의 숫자인가요?
- 글자: 표현력 있고 목적에 맞는 글꼴인가요, 기본 글꼴 묶음인가요?
- 색상: 정의된 CSS 변수 체계인가요, 하드코딩한 16진수 색상이 흩어져 있나요?
- 반응형: 분기점이 정의되어 있나요? 히어로에 calc(100svh - header)를 쓰고 모바일을 검사했나요?
- 접근성: ARIA 영역·대체 텍스트·대비율·44px 터치 영역이 있나요?
- 움직임: 보이는 기본 상태에서 ease-out하는 진입·스크롤 표시 장면 하나와 정보성 상태 전환만 있나요, 아니면 없거나 장식뿐인가요?
- 카드: 카드 자체가 상호작용일 때만 쓰나요? 장식용 카드 격자가 없나요?

먼저 MARKETING/LANDING PAGE vs APP UI vs HYBRID로 분류한 뒤, 일치하는 규칙을 적용하세요.

확인 질문 — 각각 YES 또는 NO로 답하기:
1. 첫 화면에서 브랜드·제품이 분명한가?
2. 강한 시각적 기준점 하나가 있는가?
3. 제목만 훑어 페이지를 이해할 수 있는가?
4. 각 절은 하나의 역할만 하는가?
5. 카드가 실제로 필요한가?
6. 움직임이 위계나 분위기를 개선하는가?
7. 장식 그림자를 모두 없애도 고급스럽게 보이는가?

즉시 거부 — 하나라도 해당하면 표시:
1. 첫인상이 일반적인 SaaS 카드 격자
2. 아름다운 이미지에 약한 브랜드
3. 강한 제목에 명확한 행동 없음
4. 텍스트 뒤의 복잡한 이미지
5. 같은 분위기 문구를 반복하는 절
6. 서사적 목적 없는 캐러셀
7. 레이아웃 대신 카드만 쌓은 앱 UI

구체적으로 작성하세요. 모든 finding에 file:line을 참조하세요."

실제 계획·명세·소스를 포함한 **전체 프롬프트와 맥락**을 비공개 파일에 쓴다. 셸 인용 처리한 경로를 `<prepared-prompt-file>`에 대입하고 사용자 텍스트를 셸 소스에 보간하지 않는다. 각 발견의 심각도(Critical, High, Medium, Low), Recommendation: <action> because <reason> 줄과 마지막 `VERDICT: CLEAN` 또는 `VERDICT: FINDINGS`를 요청한다.

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
"$_CODEX_PROBE" run-with-timeout --effort high 300 codex exec - -C "$_REPO_ROOT" -s "${_CODEX_SANDBOX_MODE:?}" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$_OUTSIDE_TMP/text" <"$_OUTSIDE_INPUT" >"$_OUTSIDE_TMP/events" 2>"$_OUTSIDE_TMP/stderr" || _OUTSIDE_EXIT=$?
cat "$_OUTSIDE_TMP/text" 2>/dev/null || tail -n 20 "$_OUTSIDE_TMP/events"

cat "$_OUTSIDE_TMP/stderr" >&2 || { [ "$_OUTSIDE_EXIT" -ne 0 ] || _OUTSIDE_EXIT=1; }
_OUTSIDE_RC=0
bun --no-env-file --config=/dev/null "$HOME/.claude/skills/gstack/lib/outside-review-result.ts" --label 'Codex outside review' --exit "$_OUTSIDE_EXIT" --stderr "$_OUTSIDE_TMP/stderr" --events "$_OUTSIDE_TMP/events" review "$_OUTSIDE_TMP/text" || _OUTSIDE_RC=$?
case "$_OUTSIDE_RC" in
  0|3) ;;
  4) echo 'OUTSIDE_STATUS: unverified provider=codex host=claude'; exit 4 ;;
  *) [ "$_OUTSIDE_EXIT" -ne 0 ] && exit "$_OUTSIDE_EXIT"; exit 1 ;;
esac
echo 'OUTSIDE_STATUS: completed provider=codex host=claude'
```

Bash `timeout: 360000`을 사용하고 전체 응답을 `tool-output` fence로 보인다. 실행 성공과 유효한 표시가 필요하다. 거부·빈/잘못된 출력·점수/심각도/완료표시 누락·시간초과·CLI 실패는 `outside_status: unavailable`이다. P0/P1은 내부 발견처럼 차단하며 `OUTSIDE_STATUS: unverified`는 검증 누락이다. 호출자의 대체 절차를 쓰고 누락을 clean/PASS로 취급하지 않는다. 어느 결과든 자신의 비공개 프롬프트만 삭제하며 임시 정리는 자동이다.

2. **Claude 디자인 하위 에이전트**(가능하면 Agent 도구의 `run_in_background: false`. 결과를 기다리며 시작 접수만 오면 백그라운드 완료 알림을 기다린다):
"이 저장소의 프런트엔드 소스를 독립적인 시니어 제품 디자이너로 검토하세요. 개별 위반보다 파일 간 일관성 패턴에 집중하세요.
- 간격값이 코드베이스 전체에서 체계적인가요?
- 색상 체계가 하나인가요, 접근법이 흩어져 있나요?
- 반응형 분기점이 일관된 집합을 따르나요?
- 접근성이 일관되나요, 군데군데 빠졌나요?

각 finding에 문제점, severity(critical/high/medium), file:line을 제시하세요."

**오류 처리(모두 진행을 차단하지 않음):**
- **인증 실패:** stderr에 "auth", "login", "unauthorized", "API key"가 있으면 "Codex 인증에 실패했습니다. `codex login`으로 인증하세요."
- **시간초과:** "Codex가 5분 후 시간초과되었습니다."
- **빈 응답:** "Codex가 응답을 반환하지 않았습니다."
- Codex 오류 시 Claude 하위 에이전트 출력만 사용하고 `[single-model]` 표시.
- Claude도 실패하면 "외부 의견을 사용할 수 없어 주 검토로 계속합니다."

Output header: `CODEX SAYS (design source audit):` 및 `CLAUDE SUBAGENT (design consistency):`.

**종합 — 확인 질문 점수표:**

위에 표시된 /plan-design-review와 같은 scorecard 형식을 사용한다. 두 output에서 채운다.
finding을 `[codex]` / `[subagent]` / `[cross-model]` tag와 함께 triage로 병합한다.

**결과 기록:**
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"design-outside-voices","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","host":"claude","outside_provider":"codex","outside_status":"OUTSIDE_STATUS","phase":"design","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
STATUS="clean"은 발견 없이 완료된 검토에만 쓴다. 발견이 있으면 "issues_found", 둘 다 미완료면 "unavailable"을 쓴다. SOURCE는 완료한 제공자 또는 in-host다.

역사적 review-log skill ID를 유지한다. `"host":"claude","outside_provider":"codex","outside_status":"completed|unavailable|disabled|skipped","phase":"design"`를 추가한다. 서로 다른 attempt outcome은 별도로 기록한다. `source:"codex"`는 완료된 CLI output을 요구한다. native는 `source:"in-host"`를 사용한다(역사적 `source:"claude"`: native Claude). availability/native fallback은 외부 완료가 아니다. 보고된 모든 modelUsage를 보존한다. 알 수 없는 model identity는 unknown으로 남긴다. `GSTACK_CODEX_NO_SANDBOX=1` 아래에서는 `"codex_sandbox":"danger-full-access"`를 추가한다.
