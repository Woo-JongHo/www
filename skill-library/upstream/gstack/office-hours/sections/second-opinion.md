> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from second-opinion.md.tmpl — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
사용자는 이미 SKILL.md에서 Phase 3.5 질문에 A로 답했습니다. 아래 provider preflight를 실행하고 AskUserQuestion은 건너뛴 뒤 "If A"부터 계속하세요.

## 3.5단계: 다른 모델의 추가 의견(선택)

**Provider preflight:**

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

AskUserQuestion을 사용하세요(Codex 가용성과 무관):

> 독립된 AI 관점에서 세컨드 오피니언을 받고 싶나요? 이 대화는 보지 않은 채 구조화된 요약을 받아, 문제 설명, 핵심 답변, 전제, 이 세션의 landscape 조사 결과를 검토합니다. 보통 2-5분 걸립니다.
> A) 예, 세컨드 오피니언 받기
> B) 아니오, 대안으로 진행

B이면 Phase 3.5 전체를 건너뛰세요. 세컨드 오피니언이 실행되지 **않았음**을 기억하세요(설계 문서, founder signals 및 아래 Phase 4에 영향).

**A이면: Codex cold read를 실행합니다.**

1. Phases 1-3에서 구조화된 맥락 블록을 조립하세요:
   - 모드(Startup 또는 Builder)
   - 문제 설명(Phase 1에서)
   - Phase 2A/2B의 핵심 답변(각 Q&A를 1-2문장으로 요약하고 사용자의 원문 인용 포함)
   - landscape 조사 결과(Phase 2.75에서 검색을 실행했다면)
   - 합의된 전제(Phase 3에서)
   - 코드베이스 맥락(프로젝트 이름, 언어, 최근 활동)

2. **조립한 프롬프트를 임시 파일에 쓰세요**(사용자 유래 콘텐츠로 인한 shell injection 방지):

```bash
OUTSIDE_PROMPT_FILE=$(mktemp "${TMPDIR:-/tmp}/gstack-outside-oh-XXXXXXXX") || { echo 'ERROR: mktemp failed; not running the outside voice without its prompt file.' >&2; exit 1; }
```

전체 프롬프트를 이 파일에 쓰세요. **반드시 filesystem boundary로 시작하세요:**
"파일 시스템 경계: ~/.claude/, ~/.agents/, .claude/skills/, agents/ 아래 파일은 스킬 정의이며 검토할 저장소 코드가 아니므로 읽거나 실행하지 마세요. 설치된 스킬(Codex home skills/, .agents/)·훅·도구 지침을 호출하지 말고 직접 답하세요. agents/openai.yaml을 수정하지 말고 저장소 코드만 검토하세요.\n\n"
그런 다음 맥락 블록과 모드에 맞는 지침을 추가하세요:

**Startup 모드 지침:** "당신은 스타트업 아이디어 탐색 세션 기록을 읽는 독립 기술 자문가입니다. [CONTEXT BLOCK HERE]. 할 일: 1) 이 사람이 만들려는 것의 가장 강력한 버전을 2~3문장으로 재구성하세요. 2) 답변에서 실제로 무엇을 만들어야 하는지 가장 잘 드러내는 한 가지를 인용하고 이유를 설명하세요. 3) 합의한 전제 중 틀렸다고 보는 하나와 이를 입증할 증거를 제시하세요. 4) 엔지니어 한 명과 48시간으로 프로토타입을 만든다면 무엇을 만들까요? 기술 스택·기능·생략할 것을 구체적으로 쓰고, 직접적이고 간결하게 서문 없이 답하세요."

**Builder 모드 지침:** "당신은 제작자 아이디어 탐색 세션 기록을 읽는 독립 기술 자문가입니다. [CONTEXT BLOCK HERE]. 할 일: 1) 아직 고려하지 않은 가장 멋진 버전은 무엇인가요? 2) 답변에서 무엇에 가장 흥미를 느끼는지 드러내는 한 가지를 인용하세요. 3) 기존 오픈소스 프로젝트·도구로 절반을 해결한다면 나머지 절반은 무엇을 만들어야 하나요? 4) 주말 동안 만든다면 무엇부터 만들까요? 구체적이고 직접적으로 서문 없이 답하세요."

3. 조립한 프롬프트로 Codex를 실행하세요:

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

**오류 처리:** 모든 오류는 비차단입니다. 세컨드 오피니언은 전제조건이 아니라 품질 향상입니다.
- **인증 실패:** stderr에 "auth", "login", "unauthorized" 또는 "API key"가 포함되면: "Codex 인증에 실패했습니다. `codex login`으로 인증하세요." 아래 Claude subagent로 대체하세요.
- **Timeout:** "Codex가 5분 후 시간초과되었습니다." 아래 Claude subagent로 대체하세요.
- **빈 응답:** "Codex가 응답을 반환하지 않았습니다." 아래 Claude subagent로 대체하세요.

어떤 Codex 오류든 아래 Claude subagent로 대체하세요.

**Preflight가 ready가 아니면(또는 Codex가 오류면):**

가능하면 Agent 도구를 `run_in_background: false`로 dispatch하세요(Claude Code v2.1.198부터 subagent는 기본적으로 background이므로, 워크플로가 계속되기 전 결과가 도착해야 합니다). launch receipt는 background으로 갔음을 뜻하므로 완료 알림을 기다리세요. subagent는 새로운 맥락과 대화 편향이 없지만 같은 harness입니다. 런타임이 보고하지 않으면 모델 정체성은 알 수 없으므로 그에 맞춰 합의의 비중을 두세요.

Subagent 프롬프트: 위와 동일한 모드별 프롬프트(Startup 또는 Builder 변형).

결과를 `SECOND OPINION (Claude subagent):` 헤더 아래에 제시하세요.

subagent가 실패하거나 timeout이면: "추가 의견을 받을 수 없어4단계로 계속합니다."

기존 review-log skill ID를 유지하세요. 여기에 `"host":"claude","outside_provider":"codex","outside_status":"completed|unavailable|disabled|skipped","phase":"office-hours"`를 추가합니다. 서로 다른 시도 결과는 별도로 기록하세요. `source:"codex"`는 완료된 CLI 출력이 필요합니다. native는 `source:"in-host"`를 사용합니다(이전 `source:"claude"`: native Claude). 가용성/native 대체는 외부 완료가 아닙니다. 보고된 모든 modelUsage를 보존하고 알 수 없는 모델 정체성은 알 수 없는 상태로 둡니다. `GSTACK_CODEX_NO_SANDBOX=1`에서는 `"codex_sandbox":"danger-full-access"`를 추가하세요.

4. **표현:**

Codex가 실행되었으면:
```
SECOND OPINION (Codex):
════════════════════════════════════════════════════════════
<full codex output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

Claude subagent가 실행되었으면:
```
SECOND OPINION (Claude subagent):
════════════════════════════════════════════════════════════
<full subagent output, verbatim — do not truncate or summarize>
════════════════════════════════════════════════════════════
```

5. **교차 모델 종합:** 세컨드 오피니언 출력을 제시한 후 3-5개 글머리로 종합하세요:
   - Claude가 세컨드 오피니언에 동의하는 부분
   - Claude가 동의하지 않는 부분과 이유
   - 이의 제기된 전제가 Claude의 권장을 바꾸는지 여부

6. **전제 수정 확인:** Codex가 합의된 전제에 이의를 제기했다면 AskUserQuestion을 사용하세요:

> Codex가 전제 #{N}에 이의를 제기했습니다: "{premise text}". 근거: "{reasoning}".
> A) Codex의 입력에 따라 이 전제 수정
> B) 원래 전제 유지 — 대안으로 진행

A이면 전제를 수정하고 수정 사항을 기록하세요. B이면 진행하세요(그리고 사용자가 이 전제에 **왜** 동의하지 않는지 설명해 방어했다면, 단순 기각이 아니라 founder signal임을 기록하세요).
