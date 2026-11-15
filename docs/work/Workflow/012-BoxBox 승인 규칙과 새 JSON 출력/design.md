# 승인 범위와 JSON 출력 설계

## 책임 분리

구조 ID 작업의 핵심 지도와 등록 검사, BoxBox의 승인 library/새 출력은 각각 기존 작업 UUID와 이번 UUID로 추적한다. canonical BoxBox issue 029·030·031의 이슈 원장은 그대로 참조하며 WWW의 정렬 승인으로 BoxBox 엔진 정책을 바꾸지 않는다.

registry는 기존 byte prefix와 기존 JSON 문서를 보존한 행정 append만 한다. 공식 승인 writer CLI는 없으므로 실제 schema·loader·approval gate로 검증한 diff를 사용한다. 사용자가 승인한 v1 Markdown 지문과 질문/답변 원문이 근거다. 현재 canonical 생성기의 registry 네 파일 pin은 등록 뒤 실제 byte hash로 명시 갱신하고 JSON 선택 proof와 snapshot check를 확인한다.

## 구조 사전조건과 정렬

압축 인터페이스의 SUGGEST는 새 승인으로 없어지지 않는다. contract.ts와 두 모델 파일의 네 인터페이스만 의미·멤버·주석·타입을 보존해 여러 줄로 펼친다. 승인되지 않은 새 멤버 표를 수동 padding하지 않는다. 이 뒤 source report와 실제 자동 쓰기 readiness를 다시 본다. source approvalEligible와 formatter 실행 가능은 다른 사실이다.

## 새 도메인 JSON 출력

새 모듈 scripts/workflow/work-json.ts가 작업/보고서 생성 출력을 소유한다. 기존 record.ts는 실행 사건과 .www 저장을 소유하므로 JSON 출력을 그곳에 숨기지 않는다. 구조 정본에 arch.development.records.serialization leaf와 RESP-DEVELOPMENT-RECORDS-SERIALIZATION 요구를 추가하고 새 모듈·실제 테스트에 명시 선언한다. 새 실제 import에 필요한 정확한 의존만 허용한다.

외부 API는 새 work revision/new report의 의미 객체와 repository의 명시 정책을 받는 domain writer다. 기존 JSON text/파일을 입력받는 재포맷 API·CLI·migration을 노출하지 않는다. private emitter가 JSON syntax를 처음 생성한다. 정상 JSON.stringify의 의미를 지키기 위해 새 의미 객체를 표준 stringify로 한 번 정규화한 뒤 자체 생성 데이터만 parse해 순수 emit할 수 있다. 기존 파일 내용을 parse해 의미 변경 없이 다시 저장하는 용도로 쓰지 않는다. getter/toJSON의 중복 실행, undefined/배열/non-finite/escaping/order/cycle/BigInt는 실제 현재 의미와 대조한다.

같은 객체의 연속 단일행 scalar 속성 세 개 이상만 열을 공유한다. 인코딩된 key의 code point 폭은 Hangul/Han/Hiragana/Katakana=2, 나머지=1인 현재 정본과 일치시킨다. 최대 key 폭과의 차이만 colon 앞에 넣고 colon 뒤는 공백 한 개다. value·comma·indent·물리 행과 문자열 내부 표기는 native JSON 출력과 같다. 중첩·배열·다른 부모·두 개 이하의 run은 열을 공유하지 않는다.

정책은 docs/architecture/work-output.json의 명시된 version/format/scope에 한정한다. WWW에만 opt-in 파일을 두고 다른 repository의 부재는 기존 plain JSON 동작이다. 잘못된 정책은 쓰기 전에 실패하며 silent fallback하지 않는다. policy의 approvalRef는 실제 결정의 참고값이지 runtime이 사람 승인을 새로 만들어 내는 증거가 아니다. 경로/명령 확장값을 받지 않는다. 앱은 BoxBox CLI·registry·설치 경로를 runtime에 요구하지 않는다. developer golden에만 공식 CLI를 쓴다.

## 연결점과 불변 조건

work.ts의 open/adopt/mutate, report-lifecycle.ts의 reportingRequired 실제 변경, reports.ts의 새 report와 최종 크기 검사, native-reports.ts의 신규 Native work 기록에 연결한다. .www events/JSONL/session/job metadata에는 적용하지 않는다.

실제 의미 변화가 없는 상태 변경과 read/list/dedupe는 기존 byte를 그대로 둔다. 새 revision은 기존 lock·외부 변경 검사·atomic save를 유지하고 실제 저장 bytes를 hash한다. 새 report는 final JSON 크기와 HTML 크기를 확인한 뒤 새 ID에만 publish한다. 기존 report hash를 재계산해 덮거나 과거 report를 current로 만들지 않는다.

## 검증

공식 CLI byte golden은 새 의미 값에서 기존 native JSON을 임시 파일로 생성해 기존 JSON 승인으로 Align한 결과와 domain emitter를 비교한다. Unicode·escape·세 행 경계·중첩·표준 JSON 의미·크기/실패/원본 불변을 검사한다. NO_GROUPS는 검증 범위를 명시하고 자동 쓰기 성공으로 포장하지 않는다. 활성 정책/미활성/오류/다른 repo, raw workRecordHash·no-op·dedupe·Native 새 기록·실제 Electron 보고서를 검사한다. 현재 소스의 독립 Opus 검토와 저작 보고서까지 연결한다.
