> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- pr-body.md.tmpl에서 자동 생성 — 직접 편집하지 말 것 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="prepare-the-title-step-18"></a>
### 제목 준비(18단계)

비공개 파일로 제목을 준비한다. 19단계는 셸 문자열이 아니라 해당 파일을 게시한다.

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
TITLE_FILE=$(mktemp "${_GT:?}/pr-title.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "TITLE_FILE: $TITLE_FILE (name: ${TITLE_FILE##*/})"
```

파일 쓰기 도구로 출력된 각 파일에 실제 표시될 텍스트를 정확히 쓴다. Claude Code의 Write는 먼저 빈 파일을 Read해야 한다. 텍스트를 셸 명령·heredoc·인용 인수에 넣지 않는다. 쓰기가 실패하거나 거부되면 전송하지 않는다. 원인·파일 경로와 아래 수동 전송 명령을 출력한다.

1. 기존 열린 PR/MR(2번을 따르는 6.5단계의 조기 PR 제외)은 출력된 파일 이름, 일치한 번호, `NEW_VERSION`을 대입해 플랫폼에서 파일을 채운다. 제목 텍스트는 에이전트를 거치지 않는다.
   ```bash
   TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
   gh pr view <pr-number> --json title -q .title | ~/.claude/skills/gstack/bin/gstack-pr-title-rewrite.sh <new-version> --stdin > "$TITLE_FILE" || exit 1
   ```
   GitLab은 같은 파이프에 `glab mr view <pr-number> --output json | jq -r .title`을 넣는다.
2. 새 PR/MR은 파일 쓰기 도구로 `v<NEW_VERSION> <plain change>`를 쓴다. 이슈 코드가 있으면 끝에 ` (<issue code>)`를 붙인다. 앞부분은 프로젝트 사용자에게 무엇이 달라졌는지 일상어로 말한다(예: "PR 대기 중 gstack이 GitHub 요청 한도에 도달하지 않도록 수정(GST-1713)"). 작동 원리보다 사용자가 얻는 결과를 명시한다. `<type>(<scope>):` 접두어, 추적 코드, 레인·Captain 이름, 저장소에서 만든 용어를 뒤쪽 괄호 앞에 쓰지 않는다(docs/ship-policy.md#plain-titles).
3. 생성·갱신한 모든 제목은 반드시 `v$NEW_VERSION `으로 시작해야 한다. `grep -Eq '^v<new-version>( |$)' "$TITLE_FILE"`로 검사하고 접두어 없는 제목을 게시하지 않는다.
4. **NO_VERSION:** 1~3번을 대체한다. 기존 제목은 플랫폼에서 파일로 직접 전달해 유지하거나 `<plain change>[ (<issue code>)]`를 쓴다. 버전 접두어는 없다.
5. **평이한 제목:** `~/.claude/skills/gstack/bin/gstack-plain-title check --title-file "$TITLE_FILE"`을 실행한다. `refused=<n>`이면 각 `PLAIN_TITLE:` 줄이 지목한 단어에 따라 제목 앞부분을 일상어로 다시 쓰고 `ok`, `exempt`, `none`까지 반복한다. 기존 PR 제목도 같은 방식으로 다시 쓴다. 이어 `gstack-plain-title check --branch "$(git branch --show-current)" --mode warn`을 실행하고 마지막 줄을 출력한다. 푸시된 브랜치는 이름을 바꾸지 않는다.

19단계를 위해 제목 파일 이름을 저장한다.

---

<a id="step-19-create-prmr"></a>
## 19단계: PR/MR 생성

18단계의 PR/MR 조회를 다시 확인하고 기록한다. 오류나 모호한 일치는 게시를 중단시킨다. 열린 PR/MR 또는 제목이 바뀌었으면 18단계의 신원·제목 준비를 반복한 뒤 여기로 돌아와 새 조회와 새 본문을 준비하고 게시한다.

<a id="resolve-linked-spec-before-composing-the-body"></a>
### 본문 작성 전 연결 명세 확인

1. 아카이브 디렉터리와 브랜치를 확인한다.
   ```bash
   GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
   SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG)
   CURRENT_BRANCH=$(git branch --show-current)
   SPEC_ARCHIVES="$GSTACK_STATE_ROOT/projects/$SLUG/specs"
   ```
2. 아카이브 frontmatter는 셸 소스가 아닌 데이터로 읽는다. `spec_branch`가 `CURRENT_BRANCH`와 정확히 일치하는 항목을 고르고, 여러 항목이면 `spec_filed_at`이 최신인 것을 사용한다. 브랜치 이름에서 이슈 번호를 추론하지 않는다. 읽을 수 있는 일치 항목이나 양의 정수 `spec_issue_number`가 없으면 `## Linked Spec`만 생략하고 PR 작성을 계속한다. 이슈를 연결하기 전에 모호한 일치를 해결한다.
3. 명세의 수용 기준을 8단계 결과와 비교한다. 8단계 계획 범위가 완전히 완료되고 모든 명세 기준이 검증되었을 때만 `Closes #N`을 허용한다. 부분 완료·연기·실패·제외·미검증 범위는 `Linked to #N`과 남은 작업을 명시하며 자동 종료하지 않는다. 비공개 절대 경로 대신 아카이브 파일 이름과 `spec_filed_at`을 넣는다. `gstack-post`가 본문과 함께 검사한다.

<a id="issue-links"></a>
### 이슈 링크

`~/.claude/skills/gstack/bin/gstack-issue-links --base <base> --out .gstack/tmp/issues.json`을 실행한다. 사용자가 수정했다고 명명한 이슈마다 `--issue <n>`, 실패한 CI 실행마다 `--ci-run <id>`를 추가한다. 대화형 실행은 `(promote: fix #N)` 참조를 한 번 묻고 `fix #<n>` 답변마다 `--issue <n>`을 추가한다. `Related:` PR에는 소유자가 확인할 때만 `--supersedes <n>`/`--credit <n>`을 추가하며 변경 후 재실행한다. 완료 메시지에는 승격되지 않은 후보, `Related:` 줄, `ISSUE_LOOKUP_FAILED`를 나열한다.

### Capy

`[ "${GSTACK_CAPY:-}" = 1 ] && echo 'CAPY_PR: on' || echo 'CAPY_PR: off'`를 실행한다. `CAPY_PR: on`이면 지금 `~/.claude/skills/gstack/ship/sections/capy-pr.md`를 읽는다. `## What changed`, `## Why`, `## Blast radius`를 앞에 두고 `## Approvals`는 Agent notes에 넣는다. `CAPY_PR: off`이면 생략한다.

PR/MR 본문에는 다음 절을 넣는다. 이전 실행의 본문을 재사용하지 않는다. 앞부분은 사람, 끝부분은 기계를 위한 것이다. 본문은 프로젝트 사용자에게 무엇이 바뀌었는지와 README의 어떤 목표를 돕는지를 평이한 한두 문장으로 시작한다. 목표가 명시되지 않았으면 사용자가 얻는 이점을 쓴다. 그 위에는 제목을 두지 않는다. 추적 코드·영수증·승인·Plan 줄·검토 반복·게이트 줄 등 기계가 읽는 줄은 모두 맨 끝 Agent notes에만 넣고 그 위에 두지 않는다.

```
<사용자에게 달라진 점과 이를 통해 달성하는 README 목표를 평이한 한두 문장으로 작성.>

## Summary
<사용자의 표현으로 겪거나 보거나 요청한 문제를 먼저 쓰고 수정과 현재 얻는 결과를 설명한다. 그 뒤 `git log origin/<base>..HEAD --oneline`의 주제를 쓰되 VERSION/CHANGELOG 관리 작업은 뺀다. 파일 목록이나 커밋 목록으로 쓰지 않는다. 나쁜 예: "gstack-prose-lint 추가, 13·19단계 연결, 골든 갱신." 좋은 예: "CHANGELOG 항목을 두 번 읽지 않아 상투어가 매 배포에 들어갔습니다. 이제 /ship이 커밋 전에 항목을 검사하고 다시 쓸 줄을 지정합니다.">

## Blast radius
<한두 문장으로 호출자·소비자·생성 파일·호스트 등 함께 영향받는 대상과 이를 안전하게 만드는 사실 하나를 쓴다. 그 사실이 도달한 증거 단계(파일:줄 읽기, 실패 경로 추적, 스크립트 실행, 재현)를 포함한다.>

## Test Coverage
<7단계 커버리지 그림 또는 "모든 새 코드 경로에 테스트가 있습니다.">
<7단계를 실행했으면: "Tests: {before} → {after} (+{delta} new)">
<7단계를 실행했으면: "Coverage: {X}% value-weighted ({Y}% including {W} weakly covered paths)">
<7단계를 실행했으면: "Test value: {K} tests written, {R} rejected by the authoring gate, {E} existing tests extended, {W} paths weakly covered (weak = ★, gate-failing or unrated)." 수가 1이면 단수 명사를 쓴다("1 test written", "1 existing test extended", "1 path weakly covered").>
<약한 경로와 남은 공백을 가치 카드가 있는 제안 테스트로 나열한다. 각 회귀 테스트의 "Regression proof — fails at HEAD · passes at base · passes after fix" 줄과, 파일 형식의 주석 구문을 모르는 카드의 Test value 세부 정보를 넣는다.>
<5단계 레인마다 영수증 `tests_ran`에서 "Tests ran: <lane> N" 한 줄을 넣는다. 실행기 요약을 인식하지 못하면 "Tests ran: <lane> count unavailable"로 쓴다. ZERO-RUN 레인은 해결되지 않은 채 이 본문에 도달할 수 없다.>

## Pre-Landing Review
<9단계 코드 검토의 발견 사항 또는 "문제를 찾지 못했습니다."를 쓰고 9.4단계의 `REVIEW_LOOP:` 줄을 넣는다.>
<`gstack-approvals rulings`가 출력한 각 `Ruled note: …` 줄을 그대로 넣는다. 소유자가 공개 메모로 판정한 발견 사항, 판정자와 이유다. finish의 `MECHANICAL: x`는 `Mechanical retake: x`, `UID_SIDECAR: x (beside y)`는 `Godot UID sidecar: x (beside y)`로 넣는다. 하나라도 없으면 `gstack-ship-receipt write --body`가 거부한다.>
<Gate edits: 9단계 최신 `Gate edits:` 줄을 그대로 넣는다. `none detected (...)`, `N listed, M read, K findings — J kept, R restored, O open`, `partial (...)`, `UNAVAILABLE — ...` 중 하나다. partial·UNAVAILABLE을 `none detected`라고 쓰지 않는다. 아래에 유지한 발견 사항의 `gate`·경로·`reason`과 열린 발견 사항의 `gate`·경로를 각각 쓴다. 식별과 이유만 쓰고 diff 조각은 넣지 않는다.>
<외부 검토: 판정 결과를 쓴다. `unverified`·`unavailable`은 사유와 함께 검토 범위 누락으로 표시하고 통과로 쓰지 않는다.>

<9.4단계에서 저장한 `## Deferred findings`와 `## Review notes`를 각각 독립 절로 그대로 넣는다. 비어 있으면 해당 절을 생략한다. 참조만 넣고 종료 키워드는 쓰지 않는다.>

## Exploratory QA
<9단계의 현재 대상 표면·탐색 계획, 재현 사례, 승인된 회귀와 red/green 증거, 수정, 차단·불확정·미실행 범위를 넣는다. 오래되었거나 사용할 수 없는 결과를 통과로 쓰지 않는다.>

## Design Review
<설계 검토를 실행했으면: "Design Review: static (no preview declared). Design-lite: N findings — M auto-fixed, K skipped. AI Slop: clean/N issues." 영수증의 `design`도 같아야 한다. 아직 /ship 안에서 렌더링된 /design-review는 실행하지 않는다.>
<탐지기: 프로브가 출력한 "clean" | "N findings (rule-id, rule-id)" | "not installed" | "not cached" | "off" 상태를 쓴다. 규칙 ID와 개수만 넣고 발견 사항 본문·코드 조각은 PR 본문에 넣지 않는다.>
<프론트엔드 파일이 바뀌지 않았으면: "프론트엔드 파일 변경이 없어 설계 검토를 생략했습니다.">

## Eval Results
<평가를 실행했으면 스위트 이름·성공/실패 수·비용 대시보드 요약을 쓴다. 생략했으면 "프롬프트 관련 파일 변경이 없어 평가를 생략했습니다.">

## Review bot comments
<10단계 완료: 봇 이름과 [FIXED] / [FALSE POSITIVE] / [ALREADY FIXED]로 댓글을 나열한다. 조회 성공 후 빈 결과이면 "검토 봇 댓글이 없습니다."라고 쓴다.>
<10단계 사용 불가: `Review bot triage: UNAVAILABLE (dispatch failed)`와 실제 사유를 넣는다.>
<10단계 no_pr: 이 절을 생략한다.>

## Scope Drift
<범위 이탈 검사를 했으면 "Scope Check: CLEAN" 또는 범위 이탈·확장 발견 목록>
<범위 이탈 검사를 하지 않았으면 이 절 생략>

## Plan Completion
<계획 파일을 찾았으면 8단계 완료 체크리스트 요약>
<8단계에서 미실행 줄을 출력했으면 그 줄을 그대로 삽입>
<계획 항목을 연기했으면 연기 항목 나열>

## Linked Spec
<위 연결 명세 검사가 허용할 때만 Closes #N을 쓴다. 그 외에는 "Linked to #N (partial delivery — not auto-closing)"과 남은 작업, "Close #N manually after follow-up lands."를 넣는다. 아카이브 파일 이름과 등록 날짜를 포함한다. 유효한 일치가 없으면 이 절 전체를 생략한다.>

## Issues
<이슈 링크 stdout을 그대로 삽입. ISSUE_LINKS: none이면 생략.>

## Verification Results
<8.1단계 의무를 9단계에서 실행한 결과: N PASS, M FAIL, K BLOCKED, J NOT RUN. 비해당 사유, 미해결 의무, 승인된 연기를 넣는다. 사용 불가·불확정은 PASS가 아니다.>

## TODOS
<완료 표시한 항목이 있으면 버전을 포함한 완료 항목 목록>
<완료 항목이 없으면 "이 PR에서 완료한 TODO가 없습니다.">
<TODOS.md를 만들거나 재구성했으면 그 사실 명시>
<TODOS.md가 없고 사용자가 생략했으면 이 절 생략>

## Documentation
<이번 실행의 14.5단계에서 검토한 비어 있지 않은 `documentation_section`을 넣는다. 저장된 절 파일을 아래 합성 블록의 `DOCS_SECTION_FILE` 줄이 그대로 삽입한다. 사용자 예외로 배포하는 차단된 감사는 절 파일이 없다. 여기 차단 상태·범위·예외를 명시하고 블록의 `DOCS_SECTION_FILE` 검사와 `cat -- "$DOCS_SECTION_FILE" && echo &&` 단계를 제거한다. 예외는 14.5단계가 `.gstack/tmp/docs-audit.json`에 저장한 다음 한 줄을 그대로 쓴다. `Documentation exception: accepted by <accepted_by> <date> via <via>: <reason>`. 본문에 이 줄이 없으면 아래 영수증 쓰기가 `DOCS_AUDIT_BLOCKED`로 거부한다.>
<항상 상태와 검토 범위를 넣는다. updated, current 또는 실제 사용자가 명명한 위험 예외가 있는 blocked다. 이 절을 생략하거나 다른 실행의 감사를 재사용하지 않는다.>

## Test plan
- [x] <실행한 각 테스트 레인의 명령>: <관측된 통과 요약>

🤖 [Claude Code](https://claude.com/claude-code)로 생성

<!-- gstack:agent-notes -->
<details><summary>Agent notes</summary>

<기계가 읽는 줄은 마지막에 둔다. `Refs <issue codes>`, Plan 줄이 포함된 `## Approvals` 출력(Capy), Pre-Landing Review 절의 `REVIEW_LOOP:`, `Gate edits:`, `Ruled note:`, `Review-loop exception:` 및 예외 줄이다. `gstack-ship-receipt write`가 여기에 영수증을 추가하므로 직접 입력하지 않는다.>

</details>
```

<a id="compose-the-body-then-publish-through-gstack-post"></a>
#### 본문을 합성한 뒤 gstack-post로 게시

공개 저장소의 PR 본문은 누구나 읽을 수 있다. `gstack-post`는 전송하는 제목·본문의 정확한 바이트를 검사하고 `gh`/`glab`에 인수로 전달하므로 별도 검사는 없다. Codex·검토 봇·평가 출력 절은 도구 출처가 붙은 펜스(` ```codex-review ` / ` ```review-bot `)로 감싼다. 그러면 도구가 인용한 예제 자격 증명은 PR 차단 대신 WARN으로 낮춘다. 실제 형식의 자격 증명은 펜스 안에서도 차단한다.

위 본문을 비공개 파일 두 개로 쓴다. 첫 파일은 `## Documentation` 제목 줄까지, 두 번째는 `## Test plan`부터 마지막 Agent notes 절까지 담는다.

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
BODY_TOP_FILE=$(mktemp "${_GT:?}/pr-body-top.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BODY_TOP_FILE: $BODY_TOP_FILE (name: ${BODY_TOP_FILE##*/})"
BODY_REST_FILE=$(mktemp "${_GT:?}/pr-body-rest.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BODY_REST_FILE: $BODY_REST_FILE (name: ${BODY_REST_FILE##*/})"
```

파일 쓰기 도구로 출력된 각 파일에 실제 표시될 텍스트를 정확히 쓴다. Claude Code의 Write는 먼저 빈 파일을 Read해야 한다. 텍스트를 셸 명령·heredoc·인용 인수에 넣지 않는다. 쓰기가 실패하거나 거부되면 전송하지 않는다. 원인·파일 경로와 아래 수동 전송 명령을 출력한다.

새 셸에서 14.5단계에 저장한 절 파일 경로를 `DOCS_SECTION_FILE`로 복원하고 출력된 이름을 대입한다. 블록이 두 초안을 지우므로 본문을 바꾸려면 새로 쓴다.

```bash
: "${DOCS_SECTION_FILE:?Restore the saved Step 14.5 section file path before composing}"
PR_BODY_FILE=$(mktemp "${TMPDIR:-/tmp}/gstack-pr-body.XXXXXX") || { echo "ERROR: mktemp failed — cannot compose the PR body; refusing to publish." >&2; exit 1; }
BODY_TOP_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<body-top-file-name>"
BODY_REST_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<body-rest-file-name>"
[ -s "$BODY_TOP_FILE" ] && [ -s "$BODY_REST_FILE" ] || { echo "Not composed: $BODY_TOP_FILE or $BODY_REST_FILE is empty, so the body was never written. Write both, then rerun." >&2; exit 1; }
~/.claude/skills/gstack/bin/gstack-prose-lint "$BODY_TOP_FILE" --sections 'Why,Summary,Blast radius' --gate >&2 || { echo "Not composed: fix what gstack-prose-lint printed above (a PROSE: line is a sentence to rewrite in the draft; a usage line means the draft lost a heading), then rerun." >&2; exit 1; }
~/.claude/skills/gstack/bin/gstack-plain-title check --body-file "$BODY_TOP_FILE" >&2 || { echo "Not composed: rewrite the opening the PLAIN_TITLE: lines above name (one or two plain sentences, no heading or code above them), then rerun." >&2; exit 1; }
{ awk 1 "$BODY_TOP_FILE" && cat -- "$DOCS_SECTION_FILE" && echo && awk 1 "$BODY_REST_FILE"; } > "$PR_BODY_FILE" || exit 1
rm -f "$BODY_TOP_FILE" "$BODY_REST_FILE"
echo "PR_BODY_FILE: $PR_BODY_FILE"
```

인계 기록부터 쓴다. 식별자가 잘림에도 남도록 한다. 파일 쓰기 도구로 16단계의 4번째 단계에서 얻은 레인별 집계(`{"<lane>":{"pass":N,"fail":N,"skip":N}}`)를 `.gstack/tmp/ship-gate.json`에 쓴 뒤 다음을 실행한다.

```bash
rm -f .gstack/tmp/review-loop.json
NS=$(~/.claude/skills/gstack/bin/gstack-no-stop list | sed -n 's/^NO_STOP_FILE: //p'); [ -s "$NS" ] || NS=
~/.claude/skills/gstack/bin/gstack-review-scope summary --since "$REVIEW_SINCE" --no-ledger --out .gstack/tmp/review-loop.json &&
~/.claude/skills/gstack/bin/gstack-ship-receipt write --pr <pr-number> --base <base> --gate @.gstack/tmp/ship-gate.json --pregate .gstack/tmp/pregate.json --issues @.gstack/tmp/issues.json --review-loop @.gstack/tmp/review-loop.json --docs @.gstack/tmp/docs-audit.json $([ -s .gstack/tmp/targeted.json ] && echo --review-targeted @.gstack/tmp/targeted.json) ${NS:+--no-stop "@$NS"} --body "$PR_BODY_FILE"
```

읽은 뒤 추가한 문서 주장이나 승인된 수정 회차 후(`--grant` 추가) 쓰기가 `review_targeted`를 거부하면 9단계 계획을 `--range-base <its head>
--targeted-ran <its targeted_patch_id>`로 다시 실행한다. `NEXT: targeted`이면 해당 독자 하나만 실행하고(`pass`, 그 검토 단계, `verify --targeted-out .gstack/tmp/targeted.json`) 다시 쓴다.
5단계의 기준 브랜치 실패 일시정지는 `--base-red <pause file>`을 추가한다. 큐가 `QUEUE_RECEIPT_CONDITIONAL`로 거부하는 조건부 영수증이다. `--docs`는 14.5단계가 저장한 `{status, scope[, exception]}` 기록을 읽는다. 영수증은 이를 `docs`로 담는다. 소유자 예외 없이 `blocked`인 상태 또는 예외 줄이 없는 본문은 `DOCS_AUDIT_BLOCKED`이며 아무것도 쓰지 않는다.
소유자가 수정 확인 편집 뒤 중단을 수락했다면 `--review-loop-exception @<file>`(`{accepted_by, date, via, reason, fix_check: {head, findings}}`)을 추가하고 출력된 `Review-loop exception:` 줄을 본문에 넣는다. `REVIEW_LOOP:` 아래 산문 한 줄로 대신하지 않는다.
소유자가 수정 대신 공개 메모로 판정한 발견 사항은 이번 실행 밖에서 기록한 소유자의 `gstack-approvals rule`로만 닫힌다. 이번 실행이나 review-log 필드로 닫지 않는다(docs/ship-policy.md#ruled-notes). 영수증의 `ruled_notes`에 각각 나열한다.
`gstack-review-dispatch verify`가 `REVIEW_EXCLUDE_RECORD: digest=<d>`를 출력했으면 `--review-exclude <d>`와 마지막 14.5단계 감사의 `--docs-post <audit-id>-post.json`, `--docs-pre <its Prepare snapshot>`을 추가한다. 더 이상 HEAD와 일치하지 않는 digest는 `RECEIPT_INVALID field=review_exclude`다. 쓰기가 아니라 검토를 다시 실행한다. 단, 문서 감사의 `review_exclude_paths` 아래 파일만 변경한 경우는 `--docs-post`로 연결한다(`REVIEW_EXCLUDE_DOCS_AUDIT:`).

요약은 이번 호출의 검토 회차에 대한 브랜치 검토 로그를 읽는다. 그 `REVIEW_LOOP:` 줄을 Pre-Landing Review 절에 넣는다. 여기서는 모든 발견 사항이 9.4단계를 거쳐 행으로 들어간다. `gstack-review-dispatch`로 독자를 수집한 실행(ship/DRIVER.md)은 대신 `--run <run dir>`를 넘긴다. `&&`가 중요하다. `REVIEW_SINCE`와 일치하는 검토가 없어 요약이 거부되었을 때 `write`가 낡거나 빈 반복 파일을 기록해서는 안 된다.

16단계에서 작성한 경우에만 `--receipt .gstack/tmp/tree-receipt.json`을 추가한다(gate-ahead).
새 PR/MR은 `--pr`을 생략하고 생성 뒤 번호를 넣어 다시 실행한 뒤 본문을 재게시한다.
`SHIP_RECEIPT:` 줄은 완료 메시지의 첫 줄이다. `gstack-ship-queue ready`, `train build`, `verify --train`은 게시된 영수증을 요구한다(`QUEUE_RECEIPT_MISSING`, `QUEUE_RECEIPT_STALE`, 이를 우회하는 플래그 없음). 따라서 매 READY 전과 모든 푸시 후에 /ship을 실행한다. `RECEIPT_INVALID`는 잘못된 필드를 지목한다. 그 입력 파일을 수정하고 재실행한다. 아무것도 쓰지 않은 상태다. `ISSUE_LINKS_MISSING`이면 지정한 줄을 `## Issues` 아래 추가하고 재실행한다. `PREGATE_STALE`은 도장이 찍힌 트리에서 `gstack-pregate` 재실행을 뜻한다. `PREGATE_REMOTE_UNCLEARED`는 실행 URL을 넣은 `gstack-pregate clear`가 필요하다. 둘 다 게시를 중단한다.

아래 각 블록에서 실제 `PR_BODY_FILE` 경로를 복원하고 18단계의 제목 파일 이름을 대입한다. `gstack-post`는 원격에서 GitHub/GitLab과 저장소 공개 여부를 탐지한다. GitLab을 포함해 조회가 불가능하면 스캐너의 public-strict 정책을 쓴다. 본문을 다시 렌더링하지 않는다. 모든 재시도는 같은 파일을 전송한다.

**기존 열린 PR/MR**(재확인에서 얻은 `<pr-number>`):

```bash
TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
~/.claude/skills/gstack/bin/gstack-post pr-body <pr-number> --body-file "${PR_BODY_FILE:?restore the composed body path}" && \
~/.claude/skills/gstack/bin/gstack-post pr-title <pr-number> --title-file "$TITLE_FILE"
```

본문, 이어 제목을 갱신한다. 폐기된 GraphQL 편집은 REST로 재시도하고 제목을 다시 읽는다. 이어 9단계 게이트 발견 사항에 따라 초안 상태를 결정한다.

1. 6.5단계에서 조기 초안으로 열었고 사용자가 초안을 요청하지 않았으며 `open` 게이트 발견 사항이 없으면 `gh pr ready <pr-number>`로 지금 준비 상태로 바꾼다.
2. 6.5단계에서 조기 초안으로 열었고 `open` 발견 사항이 하나라도 있으면 초안을 유지한다. `Draft kept: Gate edits: N open`과 열린 발견 사항의 `gate`·경로를 출력한다.
3. 이미 준비 상태인 PR에 `open` 발견 사항이 있으면 17단계에 기록된 사람의 승인(해당 B 선택지)이 있을 때만 게시한다. 본문에는 이미 `Gate edits: N open` 배너가 있다. 해당 기록이 없으면 여기서 중단하고 보고한다.

기존 URL을 출력하고 20단계로 진행한다. 아래 생성 명령은 생략한다.

**열린 PR/MR 없음:** `open` 게이트 발견 사항이 하나라도 있으면 `--draft`를 추가한다. 이후 에이전트는 PR이 존재한다는 이유로 승인을 추론하지 않는다. 사람이 열린 항목을 처리한 뒤 준비 상태로 바꾼다. 그 외에는 준비 상태로 생성한다.

```bash
TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
~/.claude/skills/gstack/bin/gstack-post pr-create --base <base> --title-file "$TITLE_FILE" --body-file "${PR_BODY_FILE:?restore the composed body path}"
```

열린 게이트 발견 사항이 있으면 같은 명령의 `--title-file` 앞에 `--draft`를 붙인다.

어느 블록이든 종료 코드에 따라 분기한다.
- **0** 게시 완료. `$PR_BODY_FILE`과 제목 파일을 제거한다.
- **4** `PLAIN_TITLE_REFUSED`: 본문을 포함해 아무것도 게시하지 않았다. 각 `PLAIN_TITLE:` 줄의 지시(18단계 5번)대로 제목 파일 앞부분을 고치고 같은 블록을 재실행한다.
- **1** HIGH 발견 사항: BLOCKED — 게시하지 않는다. 원본에서 자격 증명을 교체하고 가린 뒤 새 파일을 합성한다.
- **2** MEDIUM 발견 사항: `TOKEN:`을 동반한 `RULE:` 줄로 출력한다. 발견 사항마다 AskUserQuestion을 사용하며 공개 저장소에서는 더 엄격히 하고 일괄 확인하지 않는다. 개인정보는 자동 가리기를 제공한다. `~/.claude/skills/gstack/bin/gstack-redact --from-file "$PR_BODY_FILE" --auto-redact <ids>` 출력을 본문 파일에 다시 쓰고 블록을 재실행해 재검사한다. 사용자가 발견 사항을 변경 없이 수락했을 때만 토큰을 출력한 명령에 `--confirm <confirm-token>`을 추가해 같은 블록을 재실행한다. 편집했다면 새 토큰이 필요하다.
- **64**이며 stderr가 현재 본문에 제목이 `more than once` 있다고 하면 아무것도 게시하지 않은 상태다. 중단하고 중복 제목을 보고한다. 어느 사본을 남길지는 사람이 정하므로 스스로 `--replace`로 재실행하지 않는다(docs/troubleshooting.md#gstack-post-pr-body-merge).
- **3** `gh`/`glab` 실패 또는 그 밖의 **64**(사용 가능한 원격·CLI 없음): 오류·브랜치·원격 URL·수동 게시 블록을 출력한다. 코드는 푸시되었으므로 중단하지 않지만 생성하지 않은 PR을 생성했다고 보고하지 않는다. 22단계는 `status=refused`로 끝낸다. 열린 게이트 발견 사항이 있으면 게이트 편집이 공개되지 않았다고도 밝히고 16단계 열린 항목 보고서를 호출 기록에 남긴다. 공개를 완료했다고 보고하지 않는다.
- 그 밖의 종료 오류는 원인이 해결될 때까지 게시를 차단한다.

**PR/MR URL을 출력**한 뒤 20단계로 진행한다.

---
