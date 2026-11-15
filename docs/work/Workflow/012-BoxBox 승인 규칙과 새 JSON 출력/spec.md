# BoxBox 승인 규칙과 새 JSON 출력

## 요청과 목적

BoxBox 반복 실패를 원인별 이슈로 기록하고, 같은 상황에서 필요한 질문으로 해결하도록 한다. 사용자는 고정 v1의 TypeScript 28개 규칙·86개 규칙/파일 조합의 등록과 적용, 지정 JSON 경로의 새 출력부터 정렬 적용을 직접 승인했다. 기존 보고서 덮어쓰기와 v2의 추가 범위는 승인하지 않았다. 실제 원문·질문 ID·v1 내용 지문은 로컬 승인 근거에 보존했다.

생태계 구조 ID 구현은 별도 작업 work-1016628c-ac24-4264-840e-0d752e5de1f4가 소유한다. 기존 Workflow 007은 훅 감지/설치, 010은 parser·전체 후보·번역/게시까지 다루는 과거 범위여서 그대로 보존한다. 이번 작업은 새 인간 결정과 새 출력 계약의 실행 책임을 분리한다. 수용 기준 정의의 정본은 work.json의 AC-1~AC-5다.

## 승인 경계

- v1의 정확한 key와 정확한 파일만 registry에 추가한다. 기존 JSON 승인과 과거 결정은 바꾸지 않는다. 새 key·새 파일·중첩 깊이 조건을 없는 것처럼 추가하지 않는다.
- docs/work/**/*.json, src/architecture.generated.json, docs/architecture/structure.json의 승인된 새 출력에만 적용한다. 기존 불변 보고서는 재정렬하지 않는다. 원장은 실제 의미상 상태가 바뀐 새 revision에서만 새 출력 계약을 쓴다.
- package.json·JSONL·Native job metadata·.www runtime 출력과 임의 다른 repository는 이번 JSON 새 출력 대상이 아니다.
- 자동 Align은 공식 pipeline만 사용한다. 새 도메인 값의 최초 JSON 생성은 별도의 Write 기능으로 구현하고 기존 text/파일을 읽어 정렬하는 우회 명령을 만들지 않는다.
- commit·push·엔진/설치본 수정·외부 이슈 게시 권한은 이 작업에 포함하지 않는다.

## 실제 관찰과 실행 순서

현재 설치는 source check의 SUGGEST 압축 멤버가 있으면 승인 complete여도 public Align이 쓰기 전에 거부한다. 전체 미정렬 후보에서 압축 멤버는 contract 한 곳·계층 모델 두 곳·기존 모델 한 곳이며 unsupported parameter/REFUSE는 없었다. 승인 누락과 구조 사전조건을 분리한다.

1. 기존 승인·문서·registry/local pin을 백업하고 v1만 등록한다.
2. 압축 멤버를 동작 보존 Write로 펼친 뒤 현재 proof가 완전한 파일만 공식 정렬한다. 미승인 부분은 그대로 남긴다.
3. 명시적인 repository opt-in과 새 작업/보고서 도메인 serializer를 구현한다. 공식 CLI golden과 앱 무설치 runtime 경로를 검증한다.
4. 현재 전체 후보를 다시 고정하고 이미 승인한 부분을 제외한 실제 차이만 질문한다. 이슈·검증·보고서에는 적용/거부/미실행과 최종 독립 검토를 구분한다.

## 추가안 v3와 추가 4개 승인

사용자는 네 선택지 중 `1`(두 제안 모두 승인)을 직접 선택했다. 고정 `approvals/stable-delta-v3.md`의 15개 파일·76개 정확 key/파일 조합과 `decisions/extra-4-v1.md`의 test/work-json.test.ts 추가 4개 조합만 승인된 범위다. 원래 질문과 고정 제안서는 당시 상태로 보존하고, 새 실제 답변을 별도 승인 근거에 연결한다. 다른 파일·규칙·glob으로 확장하지 않는다.

등록 후 현재 소스를 재검사하고 공식 dry-run·Align·고정점·보존 검사를 수행한다. 과거 미승인 상태를 기대하던 검증은 역사적 질문과 현재 승인 결과를 분리하도록 보강한다. 공동 작업의 변경과 기존 보고서는 보존하며, 이 결정에 commit·push·엔진·설치본 변경은 포함하지 않는다.
