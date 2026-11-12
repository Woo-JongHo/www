> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 게이트 무결성 카탈로그

just-say-no-to-process-porn-and-ceremony 스킬의 REWARD-HACKING-CATALOG에서 가져온 내용입니다. 패턴 이름 자체가 억제 효과를 내므로 이름을 보존합니다. 각 항목은 문제 행동, gstack의 대응책, 적용 위치를 설명합니다. ID는 `/review`와 `/ship`이 발견 사항에 기록하는 `gate` 값이며, `gstack-gate-diff`는 태그가 있는 항목을 읽기 수준 목록에 출력합니다. 설계와 근거: `docs/designs/HONEST_WORK_GATE_INTEGRITY.md`.

다음 세 수준은 모든 곳에서 구분합니다. **나열됨**은 테스트·CI·runner/lint-config·snapshot·golden 경로의 모든 hunk이며 목록일 뿐 발견 사항은 아닙니다. **읽기**는 태그가 있거나 줄을 삭제하는 목록의 hunk입니다. 각각에 대해 *이 완화가 원래 검출하려던 실패를 숨기는가, 아니면 이 diff에서 확인할 수 있는 측정이나 결정으로 정당화되는가?*를 묻습니다. **발견 사항**은 그 질문을 통과하지 못한 hunk이며, 각각 또는 일관된 그룹마다 사람이 한 번 판단합니다. 통제 수단은 탐지기가 아니라 사람의 처리 결정입니다. 도구는 목록과 태그를 제공하며 판단하거나 발견 사항을 숨기지 않습니다.

## 태그 패턴(`gstack-gate-diff` 출력)

### RH-1 — 테스트 제거 또는 비활성화

보호하던 코드를 고치는 대신 테스트를 삭제·건너뛰거나 일부만 선택합니다. 제거된 `test(`/`it(`/`def test_`/`func Test`/`@Test`, 추가된 `.skip`, `.only`, `xit`, `xdescribe`, `@pytest.mark.skip`, `#[ignore]`, `t.Skip(`, `@Disabled`, `@Ignore`, `XCTSkip`, `@tag :skip`가 해당합니다. 테스트가 나타내던 실패가 사라져 테스트 모음이 통과한 것처럼 보입니다.

대응책: `gstack-gate-diff`가 hunk에 태그를 붙입니다. 태그는 사실의 표기이므로 소스와 함께 삭제한 테스트에도 붙고, 이를 발견 사항에서 제외할지는 도구가 아니라 에이전트가 판단합니다. `/review`의 게이트 무결성 검토는 발견 사항을 네 선택지 ASK(`review-gate-disposition`)로 보냅니다. `/ship` 핵심 체크리스트 2.5도 같은 검사를 하며, PR 본문의 `Gate edits:`에 유지 사유를 기록합니다. 큰 diff에서는 테스트 전문가의 “유효한 실패 테스트를 버리는 행위를 수용하지 않는다”는 규칙도 적용됩니다.

### RH-2 — 증거 등급 부풀리기

mock·fixture·재현·정적 읽기를 주장이 요구하는 증거인 것처럼 제시합니다. stub 응답을 받고 “프로덕션에서 검증”했다고 하거나 grep만으로 “route에 도달 가능”하다고 말하는 경우입니다. 태그로는 찾을 수 없으므로 산문을 검사합니다. 대응책은 전문의 “주장은 근거가 필요함”(가진 증거의 종류를 밝히고 요구된 종류를 다른 것으로 대체하지 않음), `/review`의 주장 검증, 태그 없이 diff에서 RH-2를 읽는 게이트 무결성 지침입니다. `/ship` 16단계의 “새 검증 증거 없이 완료를 주장하지 않는다”가 게시 게이트입니다.

### RH-3 — 소유 테스트 없이 snapshot 또는 golden 재생성

snapshot(`__snapshots__/<name>.snap`, `*.snap`)이 바뀌었는데 관례상 소유자인 `<name>` 테스트 파일에는 후보 hunk가 없습니다. 새 출력을 테스트한 것이 아니라 받아들였을 가능성이 있습니다. `*.golden`, `testdata/`, 프로젝트 `Snapshot paths:`에는 `RH-3?`(소유자 미확인) 태그를 붙여 나열하고 읽되 추정하지 않습니다. 대응책은 태그와 게이트 무결성 읽기입니다. 소스와 함께 갱신한 snapshot은 목록에만 남고 발견 사항은 아닙니다. gstack의 SKILL.md golden은 설계상 템플릿 편집마다 재생성되므로 RH-3를 자동 차단하지 않습니다. PR 본문 줄을 통해 제품 snapshot 재생성이 사람에게 드러나게 합니다.

### RH-4 — 자리표시자 커밋

`todo!()`, `unimplemented!()`, `raise NotImplementedError`, `throw new
Error("not implemented")`, `pass  # TODO`가 테스트 이외의 코드에 들어갔는데 작업을 완료했다고 보고합니다. 대응책: 제품 코드에서도 내용 검사로 hunk에 태그를 붙입니다. 계획 완료 감사의 `done/changed/partial` 분류와 `Linked to #N`을 자동 종료하지 않는 규칙이 남은 의무를 유지합니다.

### RH-5 — 동어반복 테스트

자체 설정을 단언하거나 구현을 줄마다 복제하거나 거부하는 부정 사례가 없어 실패할 수 없는 테스트입니다. 태그가 아니라 diff에서 직접 읽습니다. 대응책은 테스트 가치 카드의 `protects=` / `fails_when=` 및 `no_claim=`(통과가 입증하지 못하는 것), 이 내용이 없는 카드를 거부하는 `/ship` 7단계 저작 게이트, 태그 hunk와 함께 RH-5를 읽는 게이트 무결성 지침입니다.

### RH-10 — 명세 편집을 진척으로 표시

계획·명세의 수용 문구를 구현에 맞게 고친 뒤 새 문구를 기준으로 완료했다고 보고합니다. 대응책: `/ship` 계획 완료 감사가 수용 기준을 담은 계획 절을 기준 브랜치 또는 최초 커밋의 기준선과 비교합니다. 수정된 항목은 `ACCEPTANCE_EDITED`로 보고하며 `CHANGED`에 합치지 않습니다. 원래 의무를 계속 감사하고 PR 본문에 범위 변경을 명시합니다. 한계: 계획을 처음 도입한 커밋 안에서 다시 쓴 항목은 확인할 수 없습니다.

### RH-12 — 제품 코드에서 테스트 환경 감지

제품 코드가 `process.env.CI`, `NODE_ENV === 'test'`, `RAILS_ENV == 'test'`, `PYTEST_CURRENT_TEST`, `GITHUB_ACTIONS`로 분기해 테스트와 프로덕션에서 다르게 동작합니다. 대응책: 테스트 경로 밖의 해당 분기에 태그를 붙이고, 사용자 기능보다 검사를 통과하려고 만든 분기인지 게이트 무결성 검토에서 묻습니다.

### RH-13 — 검사 억제 pragma 추가

`eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `# noqa`, `#[allow(`, `// nolint`, `rubocop:disable`, `@SuppressWarnings`로 검사기를 만족시키는 대신 침묵시킵니다. 대응책: 경로와 무관하게 hunk에 태그를 붙이고, 억제한 진단이 원래 고쳐야 했던 실패인지 읽고 판단합니다.

### RH-14 — 게이트 우회

범위 안의 커밋에 `[skip ci]`/`[ci skip]`가 있거나, 워크플로에 `continue-on-error: true`·`allow_failure: true`가 추가되거나, 스크립트·훅에 `--no-verify`가 추가됩니다. 대응책은 태그입니다. 삭제한 워크플로 작업은 경로 기준으로 나열하고 읽습니다(v1에는 작업 삭제 전용 탐지가 없음). `/ship`은 `--no-verify`로 push하거나 force-push하지 않습니다.

### RH-15 — 게이트 값 완화

테스트·평가·CI·설정 파일의 한 hunk에서 수치 게이트가 완화됩니다. timeout, retry, retries, tolerance, epsilon, delta, maxDiff, jitter는 **증가**하고 threshold, min_score, minimum, coverage, required는 **감소**하는 방향입니다. 정확한 개수 단언을 범위로 느슨하게 하는 경우(`toBe(3)` → `toBeGreaterThan(0)`)도 포함합니다. 짝이 없는 값에는 `RH-15?`를 붙여 읽습니다.

도구는 hunk 옆의 인용(`ship-measure` 보고서를 명시한 커밋 텍스트, `gstack-shortcut(dec-*)` 마커)을 출력하지만 이를 근거로 숨기지 않습니다. `ship-measure` 보고서는 Git에서 무시되며 커밋 텍스트는 위조할 수 있기 때문입니다. 대응책: `/review`의 “평가 임계값 변경” 일괄 제외를 코드 품질 의견으로만 한정합니다. 에이전트는 인용을 읽기 전용으로 확인해 “유지 — 정당화됨” 선택지에 verified/unverified로 표시합니다. `ship/sections/measure.md`의 측정 후 수정 루프(“통과시키려고 예산을 올리거나 임계값을 내리거나 재시도를 추가하거나 사례를 건너뛰지 않는다”)가 기본 복구 경로입니다.

### RH-16 — 예외 삼키기

테스트 이외의 코드에 `catch {}`, `catch (e) {}`, `except: pass`, `rescue nil`, `_ = err`를 추가해 실패를 숨깁니다. 대응책: RH ID 아래 태그로 나열하고 slop-scan의 빈 catch 규칙은 수정 제안을 유지합니다. 전문의 stderr 규칙(표준 오류를 숨긴 명령을 증거로 인용하지 않음)은 증거 수집 명령에도 적용됩니다.

## 실제 실행의 관찰 근거(실행 없이 통과 표시)

### PL-1 — 종료 코드는 증거가 아님

테스트를 아무것도 선택하지 않은 테스트 모음이나 파일을 하나도 컴파일하지 않은 빌드처럼, 작업이 일어났다는 관찰 없이 종료 코드 0만으로 성공이라고 보고합니다. 대응책은 전문의 “주장은 근거가 필요함”(실행한 명령과 관찰 결과를 명시하고, 확인한 빈 결과는 통과가 아닌 빈 결과로 보고함)과 `/ship` 16단계의 실행 영수증 검사입니다.

### PL-2 — 테스트를 실행하지 않은 통과 표시

테스트 레인이 테스트를 하나도 실행하지 않고 종료 코드 0으로 끝납니다. 예: bun `0 pass 0 fail`, jest "No tests found", pytest "no tests ran", rspec "0 examples", `go test`의 `[no
test files]`만 있는 출력 또는 필터 후 빈 선택입니다. 대응책: `/ship` 5단계는 종료 코드 0만이 아니라 실행기 요약 줄로 레인의 통과를 판단합니다. 세 개수 상태는 합치지 않습니다. `tests_ran: N`은 통과, `tests_ran: 0`은 ZERO-RUN으로 실패 레인, `tests_ran: unknown`은 종료 코드 0의 통과를 유지하되 PR 본문에 `count unavailable`을 출력합니다. `gstack-evidence check`는 ZERO-RUN을 STALE과 동등하게 보고하고 PR 본문의 `## Test Coverage`에 레인별 `tests ran` 개수를 표시합니다.

## 통제 수단의 위치

| 표면 | 통제 |
|---|---|
| 공용 전문 | 주장은 근거가 필요함: 실행·증거 종류·실패 공개·빈 결과·stderr 규칙 |
| `/review` 3.5단계 diff 검사 | `GATE_SCAN_BLOCK`이 `gstack-gate-diff <base>` 실행. UNAVAILABLE·partial은 누락 범위이며 `none detected`가 아님 |
| `/review` 체크리스트 패스 1 | 세 수준·한 질문·항상 ASK이며 AUTO-FIX 아님·그룹별 한 결정·인용으로 발견 사항을 없애지 않음 |
| `/review` 5c단계 | `review-gate-disposition`(단방향): A) 게이트 복원, B) 유지 — 정당화됨, C) 유지 — 기타 사유, D) 이후 사람이 판단하도록 미결 유지. spawned/headless에는 D 권장 |
| `/review` 5.8단계 | 발견 사항에 `gate`·`gate_id`·`reason`·로거가 찍은 `actor` 포함. 조치는 `kept`/`restored`/`open`. `open`도 `issues_found`에 포함하며 hunk 텍스트는 저장하지 않음 |
| `gstack-review-log` | `gstack-session-kind`에서 `actor`를 찍고 비대화형이면 `action: "open"` 강제 |
| `/ship` 핵심 체크리스트 2.5, 7단계·9.4단계 | 체크리스트 읽기 전, 테스트 생성 하위 작업 반환 후, 상위 수정 후에 같은 블록 실행 |
| `/ship` 5단계·16단계 | 실행기 요약으로 통과 판단, 세 `tests_ran` 상태, ZERO-RUN은 실패 레인 |
| `/ship` 16단계의 stage 5 | 게이트 발견 사항별 처리 결정·사유·행위자 또는 검사 범위 줄, 감사자의 판단 태도 |
| `/ship` 19단계 | Pre-Landing Review의 `Gate edits:`와 Test Coverage의 레인별 `tests ran`. 발견 사항이 `open`이면 초안 유지 |
