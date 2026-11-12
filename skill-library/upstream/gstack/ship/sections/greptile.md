> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- greptile.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="step-10-address-review-bot-comments-if-pr-exists"></a>
## 10단계: 검토 봇 의견 처리(PR이 있는 경우)

먼저 PR이 있는지 확인합니다. 봇은 PR을 검토하므로 PR이 없거나, `gh`가 없거나, `gh`에 로그인하지 않았거나, GitHub가 아닌 원격 저장소라면 아직 분류할 것이 없습니다:

```bash
if ! command -v gh >/dev/null 2>&1; then echo "PR: skip (gh not installed)"
elif ! gh auth status >/dev/null 2>&1; then echo "PR: skip (gh not logged in)"
elif ! _GH_ERR=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>&1 >/dev/null); then echo "PR: skip (not a GitHub remote: $(printf '%s' "$_GH_ERR" | head -1))"
elif _PR_ERR=$(gh pr view --json number -q .number 2>&1 >/dev/null); then echo "PR: exists"
else case "$_PR_ERR" in *"no pull requests found"*) echo "PR: skip (no PR yet)" ;; *) echo "PR: skip (PR lookup failed: $(printf '%s' "$_PR_ERR" | head -1))" ;; esac
fi
```

`PR: exists`일 때만 디스패치합니다. `PR: skip (<reason>)` → 디스패치하지 않고 "Review bots: not run (<reason>); runs on the PR once it exists"를 기록한 뒤 11단계로 계속합니다.

**초기 PR(6.5단계):** 기록에 `EARLY_PR`과 `EARLY_PR_OPENED_AT`이 있으면 먼저 두 값을 대입하여 해당 PR에 대한 Greptile의 검토를 기다립니다:

```bash
~/.claude/skills/gstack/bin/gstack-greptile-early wait <pr-number> --since <opened-at>
```

각 호출은 약 90초 안에 반환됩니다. 진행 상황 줄을 전달합니다. `GREPTILE_REVIEW: pending`이면 다시 실행합니다. `complete`이면 아래를 디스패치합니다. `timeout` 또는 `unavailable`이면 해당 줄을 이유로 삼아 이용 불가 분류 경로를 따르며, 댓글이 0개라고 절대 주장하지 않습니다. 초기 head의 댓글은 현재 diff를 기준으로 분류합니다(코드가 이후 변경되었다면 `already_fixed`).

7단계의 공유 포그라운드 디스패치 규칙을 사용하여 Agent를 통해 `subagent_type: "general-purpose"`, `run_in_background: false`로 하위 에이전트를 디스패치합니다.
하위 에이전트는 에스컬레이션 등급을 포함해 설정된 모든 봇의 댓글을 가져와 분류하고, 부모는 결정을 처리하며 승인된 수정 사항을 대기열에 넣습니다.

**하위 에이전트 프롬프트:**

> /ship 워크플로의 PR 검토 봇 댓글을 분류하고 있습니다. `~/.claude/skills/gstack/review/greptile-triage.md`를 읽고 가져오기, 필터링, 분류 및 **에스컬레이션 탐지** 단계를 따르세요. `REVIEW_BOTS: skip`은 `no_pr`이고, `REVIEW_BOTS: error`는 `unavailable`입니다. 코드를 수정하거나 댓글에 답하거나 커밋하지 말고 보고만 하세요.
>
> 각 댓글에 `id`, `bot`, `classification`(`valid_actionable`, `already_fixed`, `false_positive`, `suppressed`), `escalation_tier`(1 또는 2), file:line 또는 [top-level] 태그, 본문 요약 및 permalink URL을 할당하세요.
>
> 마지막 줄에 JSON 객체 하나를 반환하세요:
> `{"status":"complete|no_pr|unavailable","dir":"<REVIEW_BOTS_DIR>","total":N,"comments":[{"id":N,"bot":"...","classification":"...","escalation_tier":N,"ref":"file:line","summary":"...","permalink":"url"},...],"reason":"..."}`
> 댓글이 0개인 경우를 포함하여 가져오기에 성공한 뒤에만 `complete`를 사용하세요. PR이 없음을 확인한 뒤에만 `no_pr`를 사용하세요. `gh`/API 오류 또는 불완전한 분류에는 `unavailable`을 사용하세요. 뒤의 두 상태는 total 0과 빈 배열을 반환합니다. `unavailable`에는 실패 이유를 명시하고, 그 외에는 빈 이유를 사용하세요.

**부모 처리:**

마지막 줄을 JSON으로 파싱합니다. 선언된 상태, 댓글 배열과 일치하는 음이 아닌 정수 total, 모든 댓글의 `bot`과 정수 `id`, 댓글이 있을 때의 `dir`, 위 상태/이유 불변 조건을 요구합니다. 알 수 없거나 누락된 상태는 빈 성공 검토가 아니라 이용 불가입니다.

`no_pr`이면 "Review bots: not run (no PR, or both bot lists are none)"을 기록하고, 댓글 0개인 `complete`이면 "Review bots: fetched, zero comments"를 기록합니다. 둘 다 11단계로 계속합니다.

**이용 불가 분류:** 반환된 `unavailable`, 실패한 디스패치, 잘못된 결과 또는 약 10분 후에도 완료되지 않은 경우 이 경로를 따릅니다. 실행 중인 하위 에이전트를 중지하고 계속하기 전에 중지되었음을 확인합니다. `Review bot triage did not complete — review the PR comments manually`을 출력합니다.
19단계 검토 결과에 `Review bot triage: UNAVAILABLE (dispatch failed)`와 실제 이유를 포함합니다. 20단계에는 분류 필드가 없습니다. 댓글이 0개이거나 분류가 완료됐다고 주장하지 않고 11단계로 계속합니다. 이 선택적 분류는 배포를 차단하지 않습니다.

그 외에는 봇마다 한 줄씩 출력합니다: `+ {n} {bot} comments ({valid_actionable} valid, {already_fixed} already fixed, {false_positive} FP)`.

`comments`의 각 댓글에 대해:

**유효하고 조치 가능:** 다음 내용으로 AskUserQuestion을 사용합니다:
- 댓글(file:line 또는 [top-level] + 본문 요약 + permalink URL)
- `RECOMMENDATION: Choose A because [one-line reason]`
- 선택지: A) 지금 수정, B) 확인하고 그대로 배포, C) 오탐임
- 사용자가 A를 선택하면 여기서 편집하지 않고 승인된 수정 사항을 대기열에 넣습니다. 해당 수정이 검토와 테스트를 통과한 뒤 greptile-triage.md의 **Fix reply template**(인라인 diff + 설명)을 사용하여 기록합니다(History File Writes, type: fix).
- 사용자가 C를 선택하면 greptile-triage.md의 **False Positive reply template**을 사용하여 답하고 기록합니다(type: fp).

**유효하지만 이미 수정됨:** AskUserQuestion 없이 greptile-triage.md의 **Already Fixed reply template**을 사용하여 답합니다:
- 수행한 작업과 수정 커밋 SHA를 포함합니다
- 기록합니다(type: already-fixed)

**오탐:** AskUserQuestion을 사용합니다:
- 댓글과 그것이 잘못됐다고 생각하는 이유(file:line 또는 [top-level] + 본문 요약 + permalink URL)를 보여 줍니다
- 선택지:
  - A) 봇에 오탐이라고 설명하는 답변 작성(명백히 잘못된 경우 권장)
  - B) 그래도 수정(사소한 경우)
  - C) 조용히 무시
- 사용자가 A를 선택하면 greptile-triage.md의 **False Positive reply template**을 사용하여 답하고 기록합니다(type: fp).
- 사용자가 B를 선택하면 위와 같이 승인된 수정 사항을 대기열에 넣습니다.

**억제됨:** 조용히 건너뜁니다. 이전 분류에서 알려진 오탐입니다.

**분류 후:** 수정이 승인되었으면 그 승인과 댓글 참조를 저장합니다.
9단계의 전체 검토/수정 루프를 실행한 다음 여기로 돌아옵니다. 완료된 수정에 대해 다시 묻지 않고 저장된 답변을 마무리하고 새 댓글을 분류합니다.
대기 중인 수정이 없으면 11단계로 계속합니다.

---
