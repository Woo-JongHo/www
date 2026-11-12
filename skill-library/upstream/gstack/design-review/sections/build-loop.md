> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from build-loop.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## 빌드 루프: /design-review --build

UI를 빌드할 때 선택하여 사용한다. 로컬 미리보기에서 각 상태를 lint하고 스크린샷을 찍은 뒤 수정하며, 한 줄의 영수증으로 끝낸다. 감사 단계를 대체하고, 커밋·stash·checkout·reset을 절대 하지 않으며(레인의 수정은 남긴다), 무인 실행 중에는 절대 묻지 않는다(대신 NEEDS INPUT을 기록한다).
`gstack-design-build`가 결과를 결정하며, 이 섹션은 증거를 수집한다.

**일곱 항목**(각 스크린샷에서 점검):

| # | 항목 | 규칙 |
|---|------|------|
| 1 | 한 줄과 두 줄 모두에서 행 패딩이 유지됨 | `row-crowding` (가장자리) |
| 2 | 인접 행 사이에 여백이 있음 | `row-crowding` (다음 행) |
| 3 | 도움말 카피 위에 여백이 있고, sibling 섹션에서 사용하는 muted 처리임 | `copy-flush-under-list` |
| 4 | 상태 메모가 경고 처리된 자체 줄에 위치함 | `note-in-row-weight` |
| 5 | 인접 절과 같은 시각적 위계: 제목 > 이름 > 힌트 | 눈으로만 확인 |
| 6 | 편안한 크기의 클릭 영역 | `small-hit-area` |
| 7 | 375에서 아무것도 넘치지 않음 | `section-overflow` |

항목 3과 5에서는 저장소의 하우스 스타일이 우선이다. sibling 섹션을 기준으로 판단한다.

### 1. 인벤토리

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
RUN="$GSTACK_STATE_ROOT/projects/$SLUG/designs/design-build-run-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$RUN" && chmod 700 "$RUN" && echo "RUN: $RUN"
```

각 블록은 새 셸이다. `<run-dir>`은 출력된 `RUN:` 경로다. 사양과 diff에서 `<run-dir>/inventory.json`을 작성한다. 변경 사항이 표시할 수 있는 모든 scenario × overlay × busy, success, error, empty를 포함한다.

```json
{"version":1,"within":"<section selector>","fixtures":"<repo-relative fixture dir>","touched":["<untracked files you create>"],
 "states":[{"name":"owner","url":"http://127.0.0.1:5300/settings?as=owner","expect":"<selector only this state renders>"},
           {"name":"remove-confirm","mode":"screenshot","steps":"click Remove on the second row"}]}
```

URL 상태에는 `?as=<scenario>`와 해당 데이터로 렌더링되었음을 증명하는 `expect` 선택자가 포함된다. 클릭이 필요한 상태는 `"mode":"screenshot"`이며 lint 완료로 계산하지 않는다. 미리보기와 fixture는 `docs/howto-preview-a-frontend.md`를 참조한다.

### 2. 사전 점검(모든 라운드 전)

```bash
~/.claude/skills/gstack/bin/gstack-design-build preflight --inventory "<run-dir>/inventory.json"
```

브라우저를 먼저 확인하고, 그다음 대상(루프백만 허용, 다른 호스트에는 사람이 작성한 `--grant-remote <host>`가 필요하며 직접 추가하지 않는다), 그다음 연결 가능성을 확인한다. 여기의 `DESIGN_BUILD:` 줄은 실행의 최종 줄이다. 중지한다. `code=NO_PREVIEW`이면 미리보기를 시작하고 사전 점검을 한 번 다시 실행한다. `mutations=unknown`(어떤 미리보기도 응답하지 않음)에서는 변경된 동작을 절대 구동하지 않는다. 실서비스 백엔드에 도달할 수 있다.

### 3. 라운드(최대 세 번)

```bash
~/.claude/skills/gstack/bin/gstack-design-build plan --inventory "<run-dir>/inventory.json" --run-dir "<run-dir>/round-N"
```

1. 출력된 `LINT_CMD:` 줄을 정확히 실행한다. `<run-dir>/round-N/lint.json`의 `app.verdict`, `app.codes`, `app.states[]`, findings를 읽는다. lint의 종료 상태를 결과로 해석하지 않는다.
2. 각 `SHOT:` 줄에 대해 해당 뷰포트에서 스크린샷을 찍는다(스크린샷 전용 상태는 해당 steps로). 드라이버가 쓸 수 있는 위치(Aside의 세션 디렉터리, $B의 경우 /tmp)에 저장한 후 `SHOT:` 경로로 cp한다.
3. 모든 스크린샷에서 일곱 항목을 점검한다.
4. 변경된 각 동작을 busy, success, error, recovery 상태로 구동하고 키보드로 트리거까지 닫는다.
5. 소스와 fixture에서 수정한다. 수정은 커밋하지 않는다.

불완전한 상태(`app.states[]`의 코드)는 라운드가 아니라 하네스 문제다. 명시된 원인을 수정하고 다시 실행한다. 미리보기 501은 실행을 끝낸다. route를 추가하고 미리보기를 재시작한 뒤 사전 점검부터 다시 실행한다. 라운드 3 후, 또는 라운드가 깨끗해지면 더 일찍 편집을 멈춘다.

### 4. 최종 검증(읽기 전용) 및 영수증

마지막 허용된 수정 후에는 아무것도 바꾸지 않는 한 번의 통과를 수행한다(findings를 면제하려면 `plan`과 `receipt`에 `--waivers <file>`을 추가한다).

```bash
~/.claude/skills/gstack/bin/gstack-design-build plan --inventory "<run-dir>/inventory.json" --run-dir "<run-dir>/final"
~/.claude/skills/gstack/bin/gstack-design-build verify-start --inventory "<run-dir>/inventory.json" --run-dir "<run-dir>/final"
```

해당 `LINT_CMD:` 줄과 모든 `SHOT:` 줄을 실행한 다음(`N`: 수정한 라운드 수, 미리보기가 제공했다면 `--preview <state dir>` 추가):

```bash
N=
~/.claude/skills/gstack/bin/gstack-design-build receipt --inventory "<run-dir>/inventory.json" --run-dir "<run-dir>/final" --rounds "${N:?}"
```

변경하지 않은 해당 `DESIGN_BUILD:` 줄이 실행의 마지막이자 유일한 줄이다. 서면 승인이 없으면 네 번째 편집 라운드는 없다.

### 5. 결과

| 결과 | 의미 | 다음 |
|---------|-------|------|
| `clean` / `waived` | 모든 URL 상태가 모든 뷰포트에서 lint되고, 모든 상태가 촬영되며, 열려 있는 항목이 없음 | 보고한다 |
| `open` | 적용 범위는 완전하지만 findings가 열려 있음 | 각각 사유가 있는 waiver 또는 PR 본문 줄을 받음 |
| `incomplete` | 상태가 모든 곳에서 lint되지 않았거나 촬영되지 않음, 미리보기 501, 또는 오래된 증거 | 수정 줄을 제시하고, 나머지 미검증 항목을 PR 본문에 나열 |
| `unrendered` | 설치, 브라우저 또는 미리보기가 없음 | 수정 줄을 제시 |
| `stale` | 영수증 후 트리가 변경됨 | 최종 통과를 다시 실행 |

READY가 인용하기 전에 `~/.claude/skills/gstack/bin/gstack-design-build check --inventory "<run-dir>/inventory.json" --receipt <file>`이 이를 다시 출력해야 한다. `incomplete`는 레인 카드의 권고를 절대 충족하지 않는다.
