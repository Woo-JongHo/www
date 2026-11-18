# 이 작업의 게시 후보와 검사 한계

현재 재개 요청은 커밋·push·게시를 금지한다. 아래는 검토용 제안이며 stage 또는 실행을 뜻하지 않는다.

- 후보: 이 작업에 속한 `skill-library/` 201개 선택 자료와 `sources.json`·`inventory.json`, `scripts/check-skill-library.ts`, `test/skill-library.test.ts`, `docs/skills/CATALOG.md`, 관련 패키징 제외 설정, 이 작업 문서·원장. 실제 diff와 과거 커밋 포함 여부를 게시 시점에 다시 대조해 변경이 없는 파일은 커밋에 넣지 않는다.
- 제외: 병행 Chat·제품·개발 역할의 다른 변경, 전역 설정·인증, `.www` 원시 증거·프로필·생성물, 비밀 및 원본 대화. 공통 설정 파일의 다른 작업 변경은 별도 후보로 분리한다.
- 한국어 메시지 제안: `Skills 라이브러리 한국어 대체와 출처 검증 정리`.
- 게시 판단 전: 현재 소스에 적용되는 공식 검사와 전체 번역 검토 범위를 확인하고 미검증을 표시한다. checker는 개별 번역 정확성을 보증하지 않는다. 실제 독립 검토·원장 readback과 게시 직전 후보 diff 확인은 별도다.

초기 재개 시점의 역사 기록: 당시 `git status --short`에서는 위 라이브러리·검사기·테스트·CATALOG·package.json에 변경이 없고, 이 작업의 `spec.md`, `verification.md`, `work.json`과 이 후보 문서 및 과거 원장 보존 파일만 변경·추가로 나타났다. 이미 HEAD에 있는 라이브러리 본문을 새 diff로 주장하지 않는다. 전체 프로젝트의 게시 후보 판단은 별도다.

## 2026-11-16 번역 보완 반영 후

현재 작업에는 라이브러리 번역 31개 파일의 보완 100건과 앞서 별도로 보완한 세션 기록 금지 문장, `skill-library/inventory.json`의 로컬 해시·크기 갱신이 포함된다. 원문 출처·commit·original 해시와 법문은 그대로다. 작업 문서와 관련 공유 CATALOG 변경은 다른 작업과 섞이지 않도록 실제 diff를 게시 직전 다시 나눈다. 모델 재대조에서 새 후보가 보고되고 있어 번역 완전성은 아직 미확정이며 사용자에게 게시를 요청하지 않는다. 원시 증거·대화·임시 산출물과 병행 작업은 후보에서 제외한다.

추가 후보 반박 후 앞선 31개 파일 중 9개에 35개 문구가 더 보완됐다. 현재는 135개 문구 보완과 inventory의 로컬 해시·크기가 대상이며, 원문 보존 필드·법문을 게시 변경으로 주장하지 않는다. 실제 diff·별도 세션 기록 금지 수정·관련 문서 범위 및 다른 작업의 공유 파일 변경을 게시 직전에 다시 대조한다. 추가 수정 영역 검토와 공식 기준 판정 전에는 완전성을 확정하지 않는다.

## 현재 사용자 검사에 제출하는 후보

현재는 304개 문구 보완(36개 Markdown)과 별도 세션 기록 금지 2문구(추가 1개 Markdown), 로컬 지문용 inventory가 실제 라이브러리 diff다. 현재 전체 선택 자료는 201개, 한국어 자료 186개, 원문 보존 15개, 총 2,830,516바이트다. checker는 출처·경로·고지·지문·한국어 존재를 검사하며 의미 완전성 판정과 구분한다.

이 후보의 목적은 번역에서 누락되거나 좁아진 지시와 조건을 복원하고 고정 출처 및 로컬 지문을 맞추는 것이다. 한국어 메시지는 **Skills 라이브러리 번역의 조건과 누락을 보완한다**를 제안한다. 관련 검증 기록·spec·후보 설명은 같은 목적의 문서다. CATALOG는 초기 측정치의 시점을 설명하는 한 hunk만 해당하며, 공통 package.json과 다른 제품·개발 변경은 포함하지 않는다.

현재 실제 라이브러리 후보 경로:

- `skill-library/inventory.json`
- `skill-library/upstream/addy-osmani/references/observability-checklist.md`
- `skill-library/upstream/addy-osmani/references/orchestration-patterns.md`
- `skill-library/upstream/addy-osmani/references/performance-checklist.md`
- `skill-library/upstream/addy-osmani/references/security-checklist.md`
- `skill-library/upstream/addy-osmani/references/testing-patterns.md`
- `skill-library/upstream/addy-osmani/skills/api-and-interface-design/SKILL.md`
- `skill-library/upstream/addy-osmani/skills/spec-driven-development/SKILL.md`
- `skill-library/upstream/gstack/README.md`
- `skill-library/upstream/gstack/design-review/SKILL.md`
- `skill-library/upstream/gstack/office-hours/SKILL.md`
- `skill-library/upstream/gstack/office-hours/sections/second-opinion.md`
- `skill-library/upstream/gstack/plan-design-review/sections/review-sections.md`
- `skill-library/upstream/gstack/plan-eng-review/SKILL.md`
- `skill-library/upstream/gstack/plan-eng-review/sections/review-sections.md`
- `skill-library/upstream/gstack/qa-only/SKILL.md`
- `skill-library/upstream/gstack/qa-only/sections/preamble.md`
- `skill-library/upstream/gstack/qa/sections/exploratory.md`
- `skill-library/upstream/gstack/qa/sections/preamble.md`
- `skill-library/upstream/gstack/qa/sections/qa-patterns.md`
- `skill-library/upstream/gstack/review/SKILL.md`
- `skill-library/upstream/gstack/review/checklist.md`
- `skill-library/upstream/gstack/review/design-checklist.md`
- `skill-library/upstream/gstack/review/gate-integrity.md`
- `skill-library/upstream/gstack/review/greptile-triage.md`
- `skill-library/upstream/gstack/review/sections/adversarial.md`
- `skill-library/upstream/gstack/review/sections/plan-completion.md`
- `skill-library/upstream/gstack/review/sections/preamble.md`
- `skill-library/upstream/gstack/ship/DRIVER.md`
- `skill-library/upstream/gstack/ship/sections/capy-pr.md`
- `skill-library/upstream/gstack/ship/sections/handoff.md`
- `skill-library/upstream/gstack/ship/sections/preamble.md`
- `skill-library/upstream/gstack/ship/sections/test-coverage.md`
- `skill-library/upstream/matt-pocock/README.md`
- `skill-library/upstream/matt-pocock/skills/engineering/diagnosing-bugs/SKILL.md`
- `skill-library/upstream/pstack/pstack/docs/guide/01-setup.md`
- `skill-library/upstream/spec-kit/templates/commands/clarify.md`
- `skill-library/upstream/superpowers/skills/requesting-code-review/SKILL.md`

원문 해시·크기·고정 revision·법문은 보존됐다. 186개 자료의 분할 의미 대조, Astra 반박, 추가 문구 대조는 보조 읽기 증거이며 모든 문장의 무오류나 최종 감사 통과를 뜻하지 않는다. 공식 현재 감사·기준 판정·보고서가 남아 있는 상태를 포함하여 사용자 검사에 제출한다. 이후 새로운 지적이 있으면 같은 후보에 근거를 남겨 보완한다.

`.www`의 원시 모델 로그·프로필·스크린샷·개인 절대경로·임시 출력·생성물, 원본 대화·인증·전역 설정, 병행 제품 소스는 제외한다. 실제 포함 diff와 index는 실행 승인 전 다시 확인해야 하며 이 문서는 stage·commit·push·PR·배포 요청이 아니다. 현재 index와 HEAD는 변경하지 않았다.

## 용도별 후보 A/B와 검증 순서

| 후보 | 목적·한국어 메시지 | 포함 경로 또는 hunk | 검증·선행 관계 |
|---|---|---|---|
| B | 최상위 미검토 파일을 실제로 거부한다. **Skills 라이브러리 최상위의 미검토 파일을 거부한다** | `scripts/check-skill-library.ts`, `test/skill-library.test.ts`의 루트 순회·정확한 제어 JSON 허용·실제 파일/디렉터리/링크 세 회귀. 작업 spec·verification의 해당 검증기 경계 설명 hunk | B를 먼저 분리해 기존 정상과 새 거부 회귀 및 strict 타입 검사를 확인한 다음 A를 검증한다. |
| A | 번역의 조건·누락을 원문에 맞추고 로컬 지문을 갱신한다. **Skills 라이브러리 번역의 조건과 누락을 보완한다** | 위 37개 Markdown과 inventory, 관련 번역/출처 spec·verification hunk. CATALOG는 초기 측정치의 시점을 설명하는 해당 hunk만 귀속 | B가 적용된 상태에서201자료 검사·15회귀·원문/번역 의미 근거·실제 감사와 현재 후보를 확인한다. |

두 후보는 독립 검토·되돌리기 목적이 달라 한 커밋으로 합치지 않는다. 후보 문서의 목록·메시지는 검토 준비 자료이며 실제 실행 시 같은 파일에 섞인 문서 hunk를 위 목적대로 분리해 다시 확인한다. 공통 작업 기록의 상태/전체 후보 요약은 마지막 통합 기록으로 다루며, 다른 작업의 공유 문서 변경을 파일 단위로 함께 stage하지 않는다.

현재 검사는 전체 작업 트리에서 수행한 결과다. B만 격리한 후보 상태 또는 B 선행 커밋+A만 적용한 상태를 각각 검사한 것은 아니므로 후보별 격리 검증 통과를 주장하지 않는다. 수정 전12통과/3실패, 수정 후15통과/실패0과 두 strict 타입 검사 및201개 현재 자료 검사는 실제 관찰이다. 실행 승인 전에 각 후보의 정확한 diff·index·선행 상태와 해당 검증 적용성을 다시 확인해야 한다. stage·commit·push는0회다.


감사5의 증거→주장 관계 역전을 원문94행과 대조해 150번째 문구로 수정했다. 현재 정식 재감사와 AC1 의미 추적 검증은 아직 남아 있으며 과거 감사 fail/not_run을 보존한다. 이 보완도 자료 후보A에만 속한다.


감사6의 첫화면 모션 시작상태·ease-out 조건 및 프레임워크 생성 심벌의 메타구성 인용 명령을 직접 원문166행·160~167행과 대조해2문구를 추가 수정했다. 당시152문구였으며 공식 감사7과 AC1 의미 근거 수용이 남았다. 과거 감사의 fail·독서한계와 미실행은 그대로 보존한다. 자료후보A의 범위만 갱신하며 후보B와 혼합하지 않는다.


현재154문구: 감사7이 확인한 두 Content-first 문단의 diff최신성근거를 HEAD일치·커밋거리로대체금지(evenzero), use/show명령과누락UNVERIFIED조건을 원문문단과직접대조해추가2문구복원했다. 현재감사8과AC1의미근거수용전이므로미완료다. 자료후보A만갱신하며B와분리·stage/commit/push0을유지한다.


## 2026-11-17 사용량 제한 후 현재 교정

실제 감사8의 기술의미2건과 두 대형 MD의 추가99건을 합친 101건을 현재 base SHA에서 선별 적용했다. 누적255문구이며, 별도 세션 기록 금지2문구와 후보A/B 분리는 유지한다. Sol 원문 대조·Astra101건 보조 반박 뒤 fixtures/mocks, 등급 없는 테스트 포함 집계, P2 권장 강도·승인 인용 조건·원시 대화 기록 표현을 정밀화했다. 두 문서의 실행 Bash20블록과 원문15개, original 해시·크기 필드는 보존했다. 이번 저작은 실제 typed post/sourceStable 통과이며 의미 전체 무오류·최종 감사 PASS·원장 완료를 뜻하지 않는다. 과거 감사1~8의 fail/not_run·사용량 중단과 불확실성은 삭제하거나 통과로 바꾸지 않았다. 커밋·push·게시0회다.


현재256문구: 추가 실제감사9가 eng 문서의 별도 P2 문장에서 should 권고를 의무로 옮긴 지적을 받아 같은 원문1228행과 대조해1문구를 교정했다. 앞서 design의 같은 지시 교정과 다른 실제위치다. 감사9 fail과 부분저작보고서를 보존하며 새 실제감사수용 전에는 완료를 주장하지 않는다. 추가원문/Bash/출처필드보존검사와공식typed사후검사통과, 자료후보A만변경·stage/commit/push0이다.


## 현재286문구 — 두 대형 문서의 전문 대조 후

추가 감사 반복 전에 독립 Astra가 현재 두 문서와 고정 원문 네 파일4394행을50행씩끝까지 읽고 남은 기술의미30건을 대조했다. 함수/메서드·테스트 대역·스모크 검사·원시 기록·승인조건·미해결집계·학습기록 주어·추론 enum과손상된의존표헤더를 복원했다. Root가30건원문을재대조하고기존목록들여쓰기2곳을보존해선별적용했다. 누적286문구이며 실제 typed post/sourceStable 통과·원문15/Bash20/고정출처필드보존이다. 이전 감사9 fail과 미실행 범위를 유지하며, 현재 공식의미재감사 전에는 AC1이나 전체완료를 주장하지 않는다. 별도검사기후보B 및 병행제품변경과 분리·stage/commit/push0을 유지한다.


## 현재304문구 — 기존 지적의 현재 재사용 대조

다국어 결과 키를 다시 파싱해 파일별 판독185건과 실제출력누락1건을구분했다. 이전134개지적을현재원문과다시대조해이미교정84·문맥상반박28·원문모호4·추가의미교정18로분리했고,현재8문서쌍의전문읽기도별도로회수했다. 새18문구는공식하위유지보수작업 `work-2edb1795-1f7b-4982-a849-e3caa6926426`에한정접수해기존W005정확권한목록을수기로바꾸지않고선별반영했다. 기존선택201자료안의7파일이며새라이브러리·제품기능·모델대체권한이아니다. 로컬지문·크기만갱신했고원문15·고정출처/법문/비대상본문과명령을보존했다. diff코드표지오역1건은원문식별자로복원했다. 하위저작typed post/sourceStable통과는W005전체의미통과/완료가아니며각UUID의고유감사·보고·완료영수증을복사하지않는다. 감사10제목지적은primary소비지침근거부족으로11에서재판정됐지만전체AC1/4수용은아직별도다. stage/commit/push0과새공식감사대기를유지한다.
