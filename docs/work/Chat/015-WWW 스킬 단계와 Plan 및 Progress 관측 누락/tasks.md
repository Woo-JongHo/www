# 수정 및 검증 계획

## 재개와 실제 표본

같은 UUID의 [명세](spec.md)·[진단](diagnosis.md)·[작업 원장](work.json)을 읽는다. 현재 권한은 문서·이슈 등록까지이며 제품 쓰기는 구현 요청과 정확한 경로를 연결한 뒤 수행한다. 실행 중 앱의 빌드·session/thread/turn, 사용자 화면, 공개 사건과 필요한 단계 영수증을 Git 제외 증거 경로에 수집한다. 비공개 사고·자격증명·전체 개인 로그는 게시하지 않는다.

연결 기준: ISSUE-TRACE, OBS-REGRESSION.

## 근거 계약 설계

Codex Sol이 단계 생산자·작업 UUID·세션/턴 연결·동시성·신뢰 경계를 소유한다. 독립적인 표시 검증은 경계 확정 후 Terra에 배분할 수 있다. 명세만 작성한 현재 시점에 실제 모델 배분을 실행했다고 표시하지 않는다.

- 기존 `scripts/workflow/run.ts`의 역할·단계 runtime 기록과 `src/native-session.ts`의 공개 사건 경계를 조사한다. 현재 세션에 연결할 근거가 있을 때만 단계 상태를 전달한다. 저장소 전체의 최신 작업 하나를 현재 대화로 추정하지 않는다.
- 스킬 ID·단계/시도 식별·작업 UUID·session/thread/turn·상태·시각·출처를 필요한 범위로 정의한다. 개발 역할의 절차 적용 선언과 실제 호스트 영수증을 구분하고 완료의 증거 수준을 표시한다.
- 명시적 Skill 요청·문서 읽기와 명령 참조는 기존 출처를 유지한다. 선언된 단계의 중복·실패·중단·지연·재접속·복원과 권한 밖 입력의 거부 규칙을 정한다.
- 계획 문서 지원은 명시적 연결·제한된 읽기·안정 항목 ID·현재성·Native 계획과의 관계를 정한 뒤 적용한다. tasks.md가 있다는 사실만으로 현재 실행 계획을 합성하지 않는다.

연결 기준: OBS-EVIDENCE, OBS-LIFECYCLE, PLAN-SOURCE, AGENT-TRUTH.

## 투영과 문구 수정

- `src/agent-overview.ts`와 `src/agent-overview-view.tsx`에서 선택·읽기 관측·명시적 pending·미관측·미연결·모호성을 구분한다. 고정 다섯 항목과 현재 요구의 범위를 유지한다.
- Plan이 없는 현재 턴의 공개 commentary를 항목 미연결 설명으로 표시한다. 유효한 단일 활성 항목이 있으면 기존 Progress 연결을 유지하고 늦은 계획으로 이전 메시지를 재귀속하지 않는다.
- `src/native-activity.ts`, `src/www-activity.ts`의 파서·정규화는 출처를 보존하고 셸 연쇄 실행이나 문서 읽기 완료의 강한 추정을 추가하지 않는다.
- Native Subagent 집계와 외부 CLI·역할 문서의 표시는 분리한다. 표시용 가짜 호출·실행·완료나 임의 진행률을 만들지 않는다.

연결 기준: OBS-EVIDENCE, OBS-UNKNOWN, PROGRESS-FALLBACK, AGENT-TRUTH.

## 행동 테스트와 실제 수용 확인

- `test/agent-overview.test.ts`, `test/www-activity-view.test.ts`, `test/native-activity.test.ts`, `test/www-activity.test.ts`의 기존 검사에 읽기만·명시 선택·단계 선언·실행 영수증·계획 없는 commentary·늦은 계획·복수 활성 항목·0개 Subagent 대조를 추가한다.
- 새 턴·다른 탭/동일 프로젝트·중복·종료 후 늦은 사건·EOF·실패·복원·2,000건 절단을 검사한다. 원본 사건과 투영 및 화면의 상태·문구가 같은 근거를 가리켜야 한다.
- 실제 Electron·합성 Native에서 계획 없는 공개 설명과 단계 변화, 미관측/대기, 탭 전환·좁은 화면·모션 축소를 확인하고 스크린샷·명령·기대/관측·소스 식별을 같은 UUID에 연결한다.
- 실제 Native로 이번 문서 작업과 같은 표본을 다시 수행해 생산자의 기록이 호스트에서 수용되고 UI에 도달하는지 확인한다. 합성 실행과 실제 계정·모델 표본은 별도로 기록한다.
- 소스 정책·strict 타입·필요한 구조 생성·빌드와 직접 영향받는 집중 검사를 공식 하네스로 실행한다. 기존 검사 명령을 통과시킨 사실만으로 새 시나리오를 검증했다고 하지 않는다.

연결 기준: OBS-LIFECYCLE, PLAN-SOURCE, PROGRESS-FALLBACK, AGENT-TRUTH, OBS-REGRESSION.

## 문서·이슈와 검토

현재 작업의 기준 정의는 work.json, 증상·가설·입증 범위는 diagnosis.md, 사용자 행동과 범위는 spec.md가 소유한다. GitHub 이슈에는 정제한 요약과 작업 UUID·로컬 문서의 게시 여부를 남기며 전체 개인 원문은 올리지 않는다.

구현과 함께 현행 Chat·제품·개발 안내의 관측 설명을 갱신한다. Home 003의 모니터링 화면과 Chat 014의 입력·스크롤·Working 변경을 대조하되 해당 작업의 파일을 자동 수정하거나 동일 파일을 중복 소유하지 않는다. 독립 문서 검토·제품 감사·실행 검증의 미실행을 구분하고, 실제 완료 근거를 확보한 뒤 같은 GitHub 이슈에 결과를 연결한다. 현재 문서/이슈만으로 버그를 닫지 않는다.

연결 기준: ISSUE-TRACE, OBS-EVIDENCE, OBS-LIFECYCLE, OBS-UNKNOWN, PLAN-SOURCE, PROGRESS-FALLBACK, AGENT-TRUTH, OBS-REGRESSION.
