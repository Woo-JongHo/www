> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- ship/DRIVER.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="ship-driver-run-ship-from-a-parent-agent"></a>
# /ship 드라이버: 부모 에이전트에서 /ship 실행하기

부모 에이전트가 /ship을 실행할 때는 `ship/SKILL.md`가 아니라 이 문서를 읽습니다
(`SESSION_KIND: unattended`). 명령은 `<root>/bin/`에 있습니다(`<root>`에는 `ship/`이 있음). 각 명령은
설치 프로그램이 출력한 `GSTACK_LAUNCH` 할당과 함께 실행하고(`. <its GSTACK_LAUNCH_FILE>`), 도구 펜스에서
`export $(...)`, `env`, `printenv` 또는 인자 없는 `set`은 절대 사용하지 않습니다.

**규칙.** 아래의 각 단계는 한 번의 호출입니다. 즉, bin 실행, 읽기, 디스패치와 대기를 수행하고 결과 줄과 리더
출력만 그대로 반환하는 하나의 프로그램(Capy: 실행, 그 외: 스크립트)입니다. 모델은 리드 판단, 수정, CHANGELOG, PR 문구,
게이트, 보고서만 유지합니다. `STOP:`(종료 코드 3)은 그 뒤의 어떤 것도 실행되지 않았음을 뜻하고, `NEXT:`는
다음 행동을 지정합니다. 어떤 단계나 아래 목록에서 지시할 때만 해당 섹션을 읽고, 절대
미리 읽지 않습니다. 이 파일에서 다루지 않는 STOP이나 결정은 그 단계에서 `ship/SKILL.md`를 읽고, 그곳에서 마친 뒤
돌아옵니다. 무인 실행에서는 질문의 권장 옵션을 선택하고(기록함), 게이트
처분과 승인은 보류 상태로 두고 실행을 끝냅니다. 단, `gstack-no-stop`은 예외입니다. 기록을 유지합니다(`--record`). Phase 1에서 여섯 제목을 작성하고 단계별로 채웁니다. **Checks**
(Phases 2-4: 레인, pregate, eval, `Coverage:`, 계획 검사, `Exploratory QA:`, `Scope Check:`), **Decisions**(어느
단계든: 답변했거나 자동 선택한 각 질문을 그대로), **Reviews**(Phases 3-5: 계획 줄,
시작 토큰, `Pre-Landing Review:`, `Gate edits:`, 검토된 트리), **Release**(Phases 5-7:
버전, CHANGELOG, 커밋), **Documentation**(Step 14.5), **Next steps**(모든 단계: 다음 행동)입니다.

**검토자는 각 섹션에 고유합니다.** 모든 검토자 브리프, 심각도와 신뢰도 규칙,
게이트는 해당 섹션에서 그대로 가져옵니다. 이 파일은 검토자 브리프를
절대 줄이지 않습니다. 차단형 리더의 프롬프트는 변경하지 않은 `gstack-review-dispatch render`
파일이며, 그 발견 사항은 `collect`를 통해서만 `merged.jsonl`에 도달합니다. `judge`는 삭제나 하향 조정을 거부합니다. 감사 리더(Steps 7, 8, 14.5)는 차단할 수 없습니다. `AUDIT_MODEL:`에는 낮은 노력을 쓰고,
14.5는 한 번만 실행하며, 발견 사항은 PR 본문에 넣습니다.

**호출.** 수정이 없는 한 번의 패스는 9회 호출입니다. Phases 1-8과 보고서입니다. STOP에 따른
섹션 읽기나 수정 검사를 포함하면 최대 12회이고, 대기 200초마다 keep-alive 한 번을 추가합니다.

**예산: 관찰.** `gstack-ship-budget start --mode observe`는 기록만 하고 절대 승인하지 않습니다. 각 프로그램은
`gstack-ship-budget note --step <last step> --reading R --credits C --record <rec>`로 끝나며, R과 C는 해당 프로그램에서 읽습니다
(Capy: `cost.tokens`, `cost.credits`). 단계별 검사, 예약, meter 전용
호출, 인계는 없습니다. `--token-cap` 아래에서는 한도를 넘긴 note가 유일한 중지 검사인 `verdict=stop`을 출력합니다.
디스패치 프로그램은 리더 시작 시 `BEFORE`(R과 C)를 취하고, 마지막 리더가 종료된 뒤의 reading과 함께
`--dispatched-at <R> --dispatched-credits <C> --readers <n>`을 전달합니다.

**대기.** 어떤 호출도 200초 넘게 기다리지 않습니다. 프로그램은 첫 줄 이후 200초가 지났을 때 여전히 실행 중인 항목을 반환하고, 다음
호출이 폴링을 재개합니다. 레인, pregate, `finish`는 백그라운드에서 실행합니다. 재시작 후에는 같은 명령을 다시 실행합니다. 리더가
실행 중인 동안에는 절대 턴을 끝내지 않습니다(각 리더가 턴을 깨움). 작은 대기 자식은 아무것도 절약하지 못합니다. 100분이 지나면 중지합니다. 반환은
프로그램당 32KB 이하입니다. 더 긴 읽기는 처음 사용하기 전에 제목 단위로 나누어 각 바이트를 한 번만 읽습니다. 단계 프로그램은
`gstack-ship-parts next --run <run dir> --phase <n+1> --room <32000 - its output>`로 끝나며,
`NEXT: parts`가 나오면 이것만 단독 실행합니다.

**패스당 프로그램 하나.** 각 검토 패스, Step 11, Step 14.5 감사는 각각 하나의 프로그램이며,
실행 중에는 부모가 다른 호출을 하지 않습니다. (1) `gstack-review-dispatch pass`: 해당 패스의 플래그를 사용한 `gstack-review-plan --base <base>`,
그다음 스테이징된 매니페스트(Step 14.5: 리더 하나, `docs`), (2) 해당 단계가 기록하는 각 행마다 `gstack-review-log --start
<skill>` 한 번, (3) `BEFORE`, (4) `sent`(`BRIEF_MISMATCH`이면 무효), 그다음 렌더링된 파일별 리더 하나당
하위 에이전트 하나,
(5) 모든 리더가 종료될 때까지 폴링(status `done` 또는 `failed`, 혹은 최종 요약. 새 `idle`은
실행되지 않은 상태), (6) reading 쌍으로 `note`. 이후 배치(전문가가 수집한 줄에 대한 Red Team)는
(3)-(6)을 반복합니다. (7) collect: `collect`를 통해 각 리더의 최종 출력과 상태만 반환합니다. 디스패치 단계를 호출별로
순회하지 않습니다.

<a id="1-load-step-0"></a>
## 1. 로드: Step 0

설치 검사, 이 파일.

<a id="2-preflight-tests-evals-and-reads-steps-09-1-2-3-4-5-6-65-10"></a>
## 2. 사전 점검, 테스트, eval 및 읽기: Steps 0.9, 1, 2, 3, 4, 5, 6, 6.5, 10

`gstack-ship-budget start --record <rec> --mode observe [--token-cap <n>] --reading R --credits C`, 그다음
`gstack-ship-preflight --base <base> --run <run dir name> --lane <label>=<test command>...`. `CARRY: carried`는 해당 `GSTACK_RESULT:`
줄에서 실행을 끝냅니다. `ship_lanes_from`: 일찍 푸시합니다(`sections/tests.md#ci-carry`). 레인은 종료 코드 0과 `tests_ran: N`이면 통과합니다. `0`은 ZERO-RUN(실패)이고, `unknown`은
`count unavailable`입니다. 브랜치 내 실패는 중지합니다. 수정 후 `--tests-only`로 다시 실행합니다.
`requires-remote`는 Step 18 전에 `gstack-pregate clear`가 필요합니다. 프롬프트, 템플릿, judge 또는 eval
하네스가 바뀌었으면 eval 선택기와 병합 전 명령을 시작합니다(30분이 지나면 분리). 그렇지 않으면
`evals: none affected`를 기록합니다. Step 6.5는 `gstack-greptile-early detect`가 Greptile을 발견한 경우에만 실행합니다.
그다음 `gstack-ship-preflight --audit --base <base> --out <run dir>`가 diff를 한 번 기록하고
(`CONTEXT:`), 변경된 경로의 TODOS.md 항목도 기록합니다(`TODOS:`). 또한 coverage map,
계획 후보와 `READER: coverage=<needed|none> plan=<needed|none>`을 출력합니다. 리더가 `needed`일 때만 해당 섹션을 읽습니다.
부모에 TODOS.md나 전체 diff를 절대 읽어 들이지 않습니다. `PERSIST:` 힌트는 Step 9를 절대 대체하지 않습니다.

<a id="3-audits-and-review-steps-7-8-9-91-92-921"></a>
## 3. 감사 및 검토: Steps 7, 8, 9, 9.1, 9.2, 9.2.1

하나의 프로그램: 감사 리더 `READER:` 이름(Step 7은 `sections/test-coverage.md`, Step 8은
`sections/plan-completion.md`에서 가져와 각각 작성된 대로 실행합니다. Step 7은 테스트를 작성할 수 있으므로 먼저 종료시킴), 9.2.1의 Reads만, 그리고 패스
(위): Steps 9-9.2를 `sections/review-army.md`에 작성된 대로 실행합니다. 리더가 실행되지 않았을 때의 `Coverage:`와 Step 8 줄은 `--audit`에서 가져옵니다.

<a id="4-judgment-steps-81-82-93-94-and-step-11"></a>
## 4. 판정: Steps 8.1, 8.2, 9.3, 9.4 및 Step 11

Step 8.1, 9.2.1의 probe, todos와 commits 파일에 대한 8.2(`Scope Check:`), 그다음 핵심 체크리스트, Steps
9.3, 9.4와 작성된 대로의 반복 결정(모든 수정 전에 `JUDGMENT: ok`), 수정과 지속성 처리를
하나의 프로그램에서 수행합니다. `Pre-Landing Review:`, `Gate edits:`를 출력합니다. `NEXT: stop`이면 중지합니다. `full` 또는
`scoped`이면 하나의 프로그램이 실패한 테스트, 수정, `--tests-only`, Phase 3을 실행하고 각각 게이트를 적용합니다(`full`에서만 `diffBase` RANGE_BASE, scoped 수정 검사: Step 3.5). `fix-check`이면
`fixCheck: {fix_list, hunks, tests, callers}`를 포함한 패스를 실행합니다. `done` 또는 `voices`이면 해당 프로그램은
`sections/adversarial.md`의 Step 11을 작성된 대로 실행하며(위), 마지막 전체 패스 계획이 나열한 voice만 실행합니다(없으면
`ADVERSARIAL: skipped (review plan)`).

<a id="5-voices-bind-and-version-steps-11-115-12"></a>
## 5. Voice, 바인딩 및 버전: Steps 11, 11.5, 12

voice를 판정합니다. coverage 밖의 누락은 `clean`이 아니라 `unavailable`입니다. 대기열에 든 수정은 Phases
3-4를 다시 실행합니다. 그다음 `gstack-review-dispatch verify`(`VERIFY: clean`)와 `gstack-review-read`: 최종 Step 9 및 Step 11의 네이티브 행(또는 계획된 건너뛰기 후 `CURRENT` 최신성)이
`wtree`, `start_wtree`, `end_wtree`에서 일치해야 합니다. 해당 트리와 base `<b>`를 저장합니다. 그다음
`gstack-ship-release version --base <base> [--bump micro|patch] --why '<line>'`; MINOR, MAJOR, `BUMP_ANSWER_REQUIRED`는
승인이 필요합니다. `VERSION: skipped|kept`이면 기록하지 않습니다.

<a id="6-notes-and-documentation-steps-13-14-145"></a>
## 6. 노트 및 문서화: Steps 13, 14, 14.5

Step 13: `NEXT:`가 지정하는 commits 파일에서 사용자 대상 항목 하나를 가져오고,
`gstack-prose-lint <it> --base origin/<base> --gate`를 `PROSE_LINT: ok`가 될 때까지 실행합니다. Step 14: todos 파일에서 편집한 TODOS.md 연기 및
완료 항목입니다. Step 14.5는 모든 ship에서 `sections/documentation.md`를 읽고 그 감사를 작성된 대로
하나의 프로그램에서 실행한 뒤(위), `gstack-ship-receipt docs-caps --base <base>`를 실행합니다. `Documentation:`을 출력합니다.
재감사는 최대 한 번입니다.

<a id="7-release-steps-15-16-17"></a>
## 7. 릴리스: Steps 15, 16, 17

이분 탐색 가능한 단위로 커밋합니다. `gstack-ship-release finish --base <base> --reviewed-tree <t> --reviewed-base <b>
--docs-post <post> --lane ... [--build <cmd>] --trailer '<t>' [--plan <line>]`: `PLAN:`, `ROUTE:`, `DOCS:`, `EVIDENCE:`(FRESH.
STALE 또는 MISSING이면 한 번 재실행), `PREGATE:`를 출력합니다. 이 항목들, 마지막 `Gate edits:`, 각 `tests_ran`을 출력합니다. 그다음
`gstack-ship-release push --branch <branch> [--gate-open <n>]`: `REDACT_PREPUSH:`, `SEALED:`, `GUARDS:`, `PUSH:`
(pushed, ALREADY_PUSHED). `EVIDENCE: DEFERRED`이면 해당 `NEXT:`가 지정하는 `accept`를 실행합니다. 최종 head
저장소 게이트는 CI와 나란히 실행합니다. 무인 실행에서는 push가 pre-push 제안을 연기합니다. 그 외에는 해당 STOP이 Step 17의 guard 블록(`HOOK_STATE:`, `HOOKS_IN_GIT_DIR:`, `PREPUSH_PROMPTED:`)을 실행합니다. 절대 force-push하지 않습니다.

<a id="8-publish-steps-18-19-19-c-20-21-22"></a>
## 8. 게시: Steps 18, 19, 19-C, 20, 21, 22

- Step 18: 열린 PR 조회. 평문 `v<NEW_VERSION> ` 제목(`gstack-plain-title check`). HEAD에 열린 PR이 없는 `UNATTENDED_SHIP:`은 Step 18-H를 선택합니다.
- Step 19 본문: 평문 시작 문장, 그다음 `sections/pr-body.md`가 나열하는 섹션. `CAPY_PR: on`(Step 19-C)에서는 What changed, Why, Blast radius 순으로 시작합니다. Agent notes가 마지막입니다(receipt, `gstack-approvals render --plan`, `REVIEW_LOOP:`). `gstack-prose-lint <top> --sections 'Why,Summary,Blast radius' --gate`; `gstack-issue-links`; `gstack-review-scope summary --since "$REVIEW_SINCE" --run <dir> && gstack-ship-receipt write --pr <n> --base <base> --gate @<f> --pregate <f> --issues @<f> --review-loop @<f> --docs @<f> [--review-exclude <d>] [--review-targeted @<f>] --body <body>`; `gstack-post pr-body`와 `pr-title`(새 PR: 호스트 PR 도구, 게이트 발견 사항이 `open`인 동안 draft). `SHIP_RECEIPT:`가 보고서를 엽니다.
- Step 20: `gstack-review-log`를 통한 metrics 행.
- Step 22: `gstack-ship-budget close --reading R --credits C`(`BUDGET_FINAL:`, `BUDGET_TIMELINE:`(토큰, 크레딧), 모든 `METER:` 줄을 보고), 그다음 `gstack-ship-receipt result --pr <n>`: `GSTACK_RESULT: skill=ship status=complete head=<sha> run=<dir>`. 병합 대기열에서는 푸시된 head에서 `gstack-ship-queue ready --pr <n> [--screen|--no-screen]`을 실행하고 그 출력을 붙여넣습니다.

<a id="where-each-stop-sends-you-paths-under-ship"></a>
## 각 STOP의 이동 위치(`<root>/ship/` 아래 경로)

- `merge conflicts`: `SKILL.md#step-3-merge-the-base-branch-before-tests`
- `NEXT: carry route`: `SKILL.md#step-1-pre-flight`
- `DISTRIBUTION: candidates=`: `SKILL.md#step-2-distribution-pipeline-check`
- store 질문이 포함된 `APPLE:`: `sections/apple-release.md#apple-app-store-release`
- `pregate fail` 또는 `incomplete`: `sections/tests.md#step-5-run-tests-on-merged-code`
- 실패했거나 zero-run인 레인: `sections/tests.md#test-failure-ownership-triage`
- red eval 또는 실패한 free-suite shard: `sections/measure.md#measure-then-fix-loop-a-red-paid-eval-or-a-failed-free-suite-shard`
- Greptile 발견: `sections/greptile-early.md#step-65-early-greptile-pr-after-the-free-tests-pass`
- PR이 있는 Step 10: `sections/greptile.md#step-10-address-review-bot-comments-if-pr-exists`
- 목표 미만 coverage, 실패한 감사: `sections/test-coverage.md#step-7-test-coverage-audit`
- NOT DONE 또는 UNVERIFIABLE인 계획 항목: `sections/plan-completion.md#gate-logic`
- `NEXT: stop`: `sections/review-army.md#decide-whether-to-repeat-step-9`
- `REVIEW_SCOPE_*` 거부, review-log 행: `sections/review-army.md#step-94-fix-first-and-persistence`
- 통과하지 못한 필수 probe: `sections/review-army.md#step-921-exploratory-qa-before-fix-first`
- 네이티브 adversarial 미완료, 대기열에 든 수정: `sections/adversarial.md#finish-the-adversarial-phase`
- Step 11.5 불일치: `SKILL.md#step-115-bind-the-reviews`
- `version` STOP: `SKILL.md#step-12-version-bump-auto-decide`
- `Documentation: blocked` 또는 한도를 넘은 `DOCS_CAP:`: `sections/documentation.md#blocked-recovery`
- finish: 검토 이후 변경됨: `SKILL.md#2-choose-the-change-route`
- finish: 문서화 입력 변경됨: `SKILL.md#3-resolve-documentation-freshness`
- finish: build, lane 또는 pregate STOP: `SKILL.md#4-verify-the-frozen-candidate`
- push STOP: `SKILL.md#step-17-push`
- 무인 실행, HEAD에 열린 PR 없음: `sections/handoff.md#step-18-h-handoff-without-a-pr-automation-lanes`
- receipt write 또는 `gstack-post` 거부: `sections/pr-body.md#compose-the-body-then-publish-through-gstack-post`
- `verdict=stop` 또는 `DELEGATE:`: `sections/budget-handoff.md#budget-and-context-handoff-read-when-a-cap-is-set-or-verdictdelegate-prints`
- `QUEUE_RECEIPT_STALE`: `../docs/ship-policy.md#ship-before-ready`
