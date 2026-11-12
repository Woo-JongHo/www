> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from handoff.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<a id="step-18-h-handoff-without-a-pr-automation-lanes"></a>
## 18-H단계: PR 없이 인계(자동화 레인)

실행이 PR을 열면 안 되는 경우(`--no-pr`, 자동화 레인, 무인 부모의 지시)에는 pr-body 절을 이 절로 대체한다. 여기서는 아무것도 게시하지 않는다. 무인 실행의 허용 범위는 docs/unattended.md#what-an-unattended-session-may-do를 참고한다.

1. 검증 전용 검사: pr-body 절과 같이 16단계 레인별 통과·실패·생략 횟수를 `.gstack/tmp/ship-gate.json`에 쓰고 `requires-remote` 레인을 명시한다. 그런 다음 해당 이슈 링크 플래그를 사용해 질문 없이 실행한다.
   ```bash
   ~/.claude/skills/gstack/bin/gstack-issue-links --base <base> --out .gstack/tmp/issues.json
   ~/.claude/skills/gstack/bin/gstack-ship-receipt write --base <base> --gate @.gstack/tmp/ship-gate.json --issues @.gstack/tmp/issues.json --out .gstack/tmp/ship-receipt.md
   ```
   11단계에서 `.gstack/tmp/targeted.json`을 저장했다면 해당 쓰기에 `--review-targeted @.gstack/tmp/targeted.json`을 추가한다.
2. 완료 메시지는 식별자를 앞에 두고 다음 순서로 보낸다. `SHIP_RECEIPT:` 줄과 영수증 블록; `branch:`와 `sha:`(`git rev-parse HEAD`); 푸시됨 또는 `not pushed`; `inputs:`에 계획이나 이슈·기준 SHA·비용 상한; `before/after:`에 주장하는 지표별 한 행과 기준 및 이번 SHA에서 측정한 명령; `escalation:`에 병합을 중단시키는 조건 하나(`requires-remote` 레인·열린 게이트 발견 사항·미검증 주장) 또는 `none`.
   `issues:` 줄, 이슈로 승격하지 않은 후보와 조회 실패를 포함한다. 스레드 간 전달에는 전체 스레드 ID(`jam_…`)를 쓴다.
3. 19단계와 21단계를 생략한다. NO_VERSION이 적용되면 `"version":null`로 20단계를 실행하고 이어 `--body .gstack/tmp/ship-receipt.md`로 22단계를 실행한다.

<a id="multi-lane-runs"></a>
### 다중 레인 실행

레인은 단계마다 WIP 커밋을 푸시하고 푸시한 SHA를 게이트로 검사한다.
