> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- changelog.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="step-13-changelog-auto-generate"></a>
## 13단계: CHANGELOG(자동 생성)

1. 형식을 파악하기 위해 `CHANGELOG.md` 헤더를 읽습니다.

2. **먼저 브랜치의 모든 커밋을 열거합니다:**
   ```bash
   git log origin/<base>..HEAD --oneline
   ```
   전체 목록을 복사합니다. 커밋 수를 셉니다. 이 목록을 체크리스트로 사용합니다.

3. 각 커밋이 실제로 무엇을 변경했는지 파악하기 위해 **전체 diff를 읽습니다**:
   ```bash
   git diff origin/<base>
   ```

4. 무엇이든 작성하기 전에 **주제별로 커밋을 묶습니다**. 일반적인 주제:
   - 새로운 기능 / 역량
   - 성능 개선
   - 버그 수정
   - 죽은 코드 제거 / 정리
   - 인프라 / 도구 / 테스트
   - 리팩터링

5. 모든 그룹을 다루는 **CHANGELOG 항목을 작성합니다**:
   - 브랜치의 기존 CHANGELOG 항목이 이미 일부 커밋을 다룬다면 새 버전용 통합 항목 하나로 대체합니다
   - 변경 사항을 해당하는 섹션으로 분류합니다:
     - `### Added` — 새로운 기능
     - `### Changed` — 기존 기능의 변경
     - `### Fixed` — 버그 수정
     - `### Removed` — 제거된 기능
   - 간결하고 설명적인 글머리표를 작성합니다
   - 확인한 파일 헤더 뒤이자 첫 릴리스 항목 앞에 오늘 날짜로 삽입합니다
   - 형식: `## [X.Y.Z.W] - YYYY-MM-DD`
   - **문체:** 사용자가 이전에는 할 수 없었지만 이제 **할 수 있는** 일을 앞세웁니다. 구현 세부 사항이 아닌 평이한 언어를 사용합니다. TODOS.md, 내부 추적 또는 기여자 대상 세부 사항은 절대 언급하지 않습니다. 항목 어디에도 추적기 코드(GST-123, R-number)를 쓰지 말고, 저장소에서 만든 용어 없이 프로젝트 사용자가 이해할 수 있는 굵은 도입부를 사용합니다(docs/ship-policy.md#plain-titles).

6. **교차 확인:** CHANGELOG 항목을 2단계의 커밋 목록과 비교합니다.
   그 목록에서 사용자에게 보이는 모든 변경 사항이 표현되어야 하며, 빠진 것이 있으면 추가합니다.
   사용자에게 보이는 효과가 없는 커밋(병합, 버전 올림, 이 브랜치에서 앞서 도입한 작업의 수정)은 글머리표가 필요 없습니다. 항목에는 사용자에게 보이는 모든 주제가 반영되어야 합니다.

**사용자에게 변경 사항을 설명해 달라고 요청하지 마세요.** diff와 커밋 기록에서 추론합니다.

7. **항목을 린트합니다:** `~/.claude/skills/gstack/bin/gstack-prose-lint CHANGELOG.md --base origin/<base> --gate`는 이 브랜치가 추가한 줄만 읽습니다. 명시된 각 `PROSE:` 줄을 다시 작성하고 마지막 줄이 `PROSE_LINT: ok`가 될 때까지 다시 실행합니다.
   조각 파일(`changelog_fragments` 정책)은 마지막 줄이 `ok`, `exempt` 또는 `none`이 될 때까지 `~/.claude/skills/gstack/bin/gstack-plain-title check --changelog <fragment>`도 실행합니다. 항목에 추적기 코드를 쓰지 말고 평이한 굵은 도입부를 사용합니다.

**NO_VERSION(12단계):** 이 단계를 건너뜁니다. CHANGELOG 항목이나 버전 헤더를 작성하지 않습니다.

**유지됨(12단계 `VERSION: <v> kept`):** 버전 헤더를 쓰지 않습니다. 저장소 자체 규칙이 단위 PR 메모를 두도록 한 곳(CHANGELOG 머리말 또는 지정한 조각 디렉터리)에 항목을 배치하고, 그런 곳이 없으면 `## [Unreleased]` 아래에 둡니다. 릴리스된 헤더 아래에는 절대 두지 않습니다.

**CHANGELOG 없음:** 정책의 `changelog`가 `null`이거나 정책에서 지정한 파일(기본값은 `CHANGELOG.md`)이 HEAD에 없으면 한 줄로 `CHANGELOG: skipped (none at <path>)`를 출력하고, 아무것도 작성하지 않으며 파일을 절대 만들지 않습니다. 대신 19단계의 PR 본문이 릴리스 노트를 담습니다. 버전 소스와 CHANGELOG가 모두 없는 저장소는 두 줄을 모두 출력하고 `version`이 `"none"`인 영수증과 함께 배포합니다(docs/ship-policy.md#ship-receipt).

---
