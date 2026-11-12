> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from capy-pr.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<a id="step-19-c-capy-pr-body-what-changed-why-blast-radius-approvals"></a>
## 19-C단계: Capy PR 본문(변경 내용, 이유, 영향 범위, 승인)

19단계에서 `CAPY_PR: on`을 출력했을 때만 읽는다. Capy에서는 사람이 Captain을 통해 PR과
READY 보고서를 보고 병합을 결정하므로, 본문은 무엇이 바뀌었는지 그림으로 보여 주고 그 이유와 누가
무엇을 승인했는지를 표시한다. 안내서: Capy `gstack` 스킬의 SKILL.md 옆에 있는 `captain.md`.

**순서.** 꾸밈없는 도입 문장을 먼저 쓰고, 이어서 `## What changed`, `## Why`, `## Blast radius`,
그다음 아래의 표준 섹션을 둔다. `## Approvals`는 마지막 Agent notes 섹션 안에 두며, 이곳에는
`gstack-ship-receipt write`도 영수증을 넣는다. `## Summary`에는 커밋 주제만 담고 캡션을 반복하지 않는다.

1. **증거 선택:** 전후 비교 쌍을 1~3개 고르고 신호가 가장 강한 것을 먼저 둔다. 첫 번째가
   핵심 이미지다.
   - UI 변경: browse 흐름이나 호스트의 브라우저를 사용해 base와 이 브랜치의 변경된 화면을
     같은 크기로 캡처한다.
   - 스킬 또는 프롬프트 변경: `~/.claude/skills/gstack/bin/gstack-pr-shots --path <template or SKILL.md> --heading "<changed section>" --caption "<what changed and why>"`.
   - CLI 변경: 이 ship이 이미 실행하는 명령의 출력을 base와 이 브랜치에서 저장소 안의 파일
     (`.gstack/tmp/before.txt`, `.gstack/tmp/after.txt`)로 저장한 다음
     `~/.claude/skills/gstack/bin/gstack-pr-shots --before <file> --after <file> --kind terminal --caption "<…>"`.
     그림을 만들기 위해 부작용이 있는 명령을 실행해서는 안 된다.
   - 보이는 표면이 없음: 변경을 가장 잘 보여 주는 소스 섹션이나 테스트 출력을 그림으로 만든다.
   `gstack-pr-shots`는 secret scanner와 일치하는 입력을 거부한다(`PR_SHOTS_INPUT_REFUSED`). 캡처에서
   secret을 제거하고, 거부를 우회해서는 안 된다.
2. **`SHOT_PNG:` 읽기.** 경로가 나오면 사용한다. `unavailable (…)`이면 출력된 `shot.html`을 자체
   브라우저에서 너비 880 px로 캡처해 그 PNG를 사용한다. `failed (…)`이면 텍스트 버전만 사용한다.
3. **업로드.** 공개 저장소(`gh repo view --json visibility -q .visibility`가
   `PUBLIC`을 출력)에서만 한다. 비공개 저장소에는 텍스트 버전을 사용하되, 사람이 이미지 사용을 승인했다면
   예외로 한다(`gstack-approvals add`로 기록). 각 PNG를 Capy의 PR asset 도구
   (`tools.pr.uploadAsset`)로 업로드한다. 반환된 URL을 정확히 사용하고 캡션을 alt text로 넣는다.
   `![<caption>](<url>)`(반환된 bare video URL은 자체 줄에 그대로 둔다). 업로드가 실패하면
   일시적 오류일 때만 한 번 재시도한다. 그 외에는 텍스트 버전을 사용하고 캡션 아래에
   `image upload failed: <reason>`을 쓴다. 이미지 때문에 게시를 차단해서는 안 된다.
4. **모든 이미지 아래:** 무엇이 왜 바뀌었는지 설명하는 한 줄 캡션과 출력된
   `text.md`의 내용(이미지를 볼 수 없는 독자와 검색을 위한 접힌 텍스트 전후 비교)을 둔다.
5. **`## Why`:** 2~3문장. 첫 문장은 사람의 표현으로 문제를 말한다(issue,
   실패한 실행 또는 요청을 인용). 나머지는 그 사람에게 무엇이 달라지는지 말한다. 목록을 나열하지 않는다. 나쁜 예: "린트와 CI 단계를 추가합니다." 좋은 예: "검토 반복이 과도하다는 문제를 해결했습니다. 두 번째 검토는 이제 첫 검토 이후의 범위만 읽습니다."
6. **`## Blast radius`:** 본문 템플릿의 항목을 여기서 한 번만 작성한다. 변경이 다른 어디에 영향을 주는지와
   이를 안전하게 만드는 한 가지 사실을, 도달한 evidence-ladder 단계(file:line read, walked failure path, script ran, repro)와 함께 쓴다.
7. **`## Approvals`**(Agent notes 안): `~/.claude/skills/gstack/bin/gstack-approvals render --plan "<the brief's Plan line>"`의 출력을 그대로 사용한다. 이 명령은
   셀을 escape하며, 영수증은 이를 승인 인용으로 읽지 않는다. 공개 저장소(또는 visibility를 알 수 없는 저장소)에는
   `Approved: yes|no (record <id>)`와 `Plan: approved (record r-<id>)`만 넣고, PR 본문에 `--full`을 전달해서는 안 된다. render가
   `PLAN_*` 코드로 거부하면 아무것도 출력하지 않은 것이다. 명시된 수정을 실행하고 다시 render한다.
   `APPROVAL_RECORD_UNAVAILABLE`이면 그 텍스트를 유지하고 READY 보고서에 그렇게 명시한다. 행을 직접 입력해서는 안 된다.
8. **READY 보고서:** 보내는 보고서(Capy의 message
   attachments)에 핵심 이미지 PNG를 첨부하고 업로드된 URL을 제공해 Captain이 인라인으로 보여 줄 수 있게 한다.
