# 구조 ID 계약과 단계별 설계도 탐색 설계

## 목표와 현재 차이

사용자는 전체 구조를 파악하고 클릭할수록 하위 책임을 읽으며 명세·코드·지도에서 같은 안정 ID를 찾길 요청했다. 002의 파일 경로 노드·import 추출·overview 불리언은 보존할 근거 자료지만 새 요구를 충족하지 않는다. 이번 작업은 기능 구조를 정본으로 삼고 기존 참조 추출을 구현 근거로 사용한다. 기존 002 이력은 바꾸지 않고 관계만 연결한다.

## 정본과 데이터 흐름

`docs/architecture/structure.json`이 구조 ID, 제목·설명, 단일 parent, 명세 파일 목록, 명시 허용 의존성의 정본이다. root는 arch.www다. ID는 경로에서 생성하지 않는다. `docs/specs/architecture.md`의 기계 판독 가능한 architecture-requirements fenced JSON 블록이 요구 ID·구조 ID·요구 설명·필수 구현/검증 선언 여부를 한 번 정의한다. 문서에서는 같은 데이터를 중복 원장으로 복제하지 않는다. 실제 기존 기능 상세는 기존 Chat·Ecosystem·보고서 정본으로 참조한다.

관리 대상은 기존 src TypeScript와 scripts/workflow TypeScript 및 workflow.ts/source-policy.ts/generate-architecture.ts/build.ts이며 새 architecture checker·contract 모듈도 포함한다. 임의 목록으로 기존 관리 대상을 제외할 수 없게 한다. 각 파일의 실제 선행 JSDoc에 `@architecture arch.…`와 `@implements REQUIREMENT-ID`를 선언한다. 주석처럼 보이는 문자열·템플릿·코드 예제를 주석으로 받지 않는다. JSDoc는 실행 기능을 바꾸지 않는다. 같은 구조에 여러 구현 파일·요구가 연결될 수 있다. 테스트의 실제 소스 JSDoc에 `@verifies REQUIREMENT-ID`를 선언하고 실제 테스트 구문이 있는 .test.ts(x)만 테스트 연결로 받는다. 선언된 연결은 테스트 통과 증거와 구분해 표시한다.

scripts/architecture-contract.ts는 unknown 경계에서 계약 JSON·명세·AST 선언을 파싱하고 계약을 검증한다. 파일 경로·심볼/행·내용 hash는 위치 근거이며 ID 정본이 아니다. generate-architecture.ts는 기존 import/export 분석 결과와 계약 검증 결과를 합쳐 architecture.generated.json을 생성한다. 기존 low-level import 분석 함수는 작은 parser fixture 검사에 쓸 수 있으나 실제 generateArchitecture·CLI·build에는 계약 검증을 생략하는 공개 bypass를 두지 않는다. UI는 Node/파일 시스템 없이 생성된 JSON만 소비한다.

## 계층과 화면

제품 책임 중심으로 전체→대화/리포트/Native 연결/개발/구조지도/빌드 영역을 보여준다. 대화 아래 세션·메시지·활동, 세션 아래 복원 등의 실제 책임을 둬 3회 이상의 탐색을 확인한다. 노드 분류는 선언만 사용하며 파일명 fallback으로 미등록 파일을 조용히 포함하지 않는다. 초기에 실제 50개 파일을 빠짐없이 매핑한다. 신규 관련 모듈도 즉시 선언한다.

src/architecture-tree.ts는 부모·자식·ancestor breadcrumb, 하위 모듈/요구/테스트 집계, 현재 단계 자식 사이로 실제 참조를 축약하는 순수 모델이다. branch 클릭은 그 branch로 진입해 직계 자식만 펼친다. leaf 클릭은 같은 ID의 명세·구현·검증 선언과 외부 의존성을 읽는다. 전체와 ancestor breadcrumb로 복귀한다. ID/제목/파일/요구 검색은 전역 검색 후 해당 parent 경로를 열어 leaf를 선택하며 진입 뒤에도 결과를 찾을 수 있게 한다. 키보드 Enter/Space/방향키, 포커스 이동, 빈 검색, 860px 좁은 창과 overflow를 검증한다. 기존 생태계 안내 탭·Chat 초안·읽기 상태는 보존한다. 자동 layout은 현재 깊이의 가독성과 예측 가능한 위치를 우선한다. 전체 코드를 펼치는 단순 불리언을 재포장하지 않는다.

## 강제할 실패

- 중복/잘못된 구조 ID, root 중복, 부모 누락·순환, 고아 node와 실제 위치 탈출·심볼릭 링크
- 미정의 요구 ID와 참조 구조 ID, 중복 정의, 필수 요구의 구현 또는 테스트 참조 누락
- 관리 대상 파일의 선언 누락·중복·잘못된 소속과 코드/명세/테스트 사이 구조 소속 불일치
- 명시되지 않은 구조 간 의존성. 최초 allowed 목록은 현재 실제 참조와 책임을 검토해 정하며 모든 의존성 허용 wildcard를 두지 않는다. 같은 구조/내부 하위 관계와 경계 의존성의 판정 규칙을 정확히 문서화한다.
- 실제 소스·명세·정본과 저장 snapshot의 불일치. 명세만 바뀌어도 digest와 snapshot이 바뀐다.

## 하네스 소유

build.ts는 계약 검증 포함 생성→번들 순서를 유지한다. `npm run check:architecture`는 생성 없이 전체 계약과 snapshot 현재성을 검사하고 `npm run check`에 필수로 연결한다. stale 상태를 통과시키려고 checker에서 자동 재생성하지 않는다.

scripts/workflow.ts의 실제 typed authoring 실행은 사전 계약 위반을 작성 context에 전달하고 사후 계약·snapshot 미해결을 harness.ok=false/CLI 비정상 종료로 판정한다. 새 계약 파일을 삭제해 사후 검사를 생략하지 못하게 사전 enable 상태를 보존한다. 계약이 없는 기존 최소 테스트 fixture 저장소는 명시적인 비적용으로 구분하되 실제 WWW의 활성화 선언·계약 누락을 성공으로 바꾸지 않는다. 등록된 검사 경로와 host 수용까지 실행 근거를 남긴다. 실제 파일을 망가뜨린 뒤 복원하는 위험한 검사는 .www의 독립 fixture에서 한다.

## 검증과 완료

AC-1/2: 유효 계약, 파일 이동시 ID 보존, duplicate/unknown/cycle/missing annotation/missing implementation/missing tests/forbidden dependency/주석 위장 문자열/경로 탈출을 최소 fixture로 검사한다. AC-3: 결정성·명세 내용 변경·stale snapshot, 실제 CLI·typed harness 사후 거부를 확인한다. AC-4/5: 모델 검사와 실제 Electron에서 branch 진입 3단계, breadcrumb 복귀, ID·요구 검색, leaf의 실제 요구/파일/테스트 근거, 키보드와 좁은 창 및 Chat 보존을 관찰한다. AC-6: 정본 개발 문서와 저작 보고서, 현재 소스의 공유 core Opus 읽기 전용 검토를 부모가 기록한다.

선언 존재는 요구 충족의 의미 증명이 아니다. 실행 중 tracing, 함수 호출 그래프, 사용자 선택 저장소의 실시간 분석, 범용 정책 DSL, 서버·GitHub 연동, BoxBox 엔진/전역 설정 수정은 범위 밖이다. 기존 BoxBox 문제를 숨기거나 source-policy/타입 검사/검토 정책을 약화하지 않는다. 실행/기능/스타일/검토/게시 결과를 분리한다. 이번 요청은 commit·push·원격 실행 승인이 아니다.

## JSDoc 경계 실측

설치된 TypeScript로 첫 import 앞의 실제 JSDoc를 파싱했다. ts.getJSDocTags(firstStatement)의 @architecture는 comment에 ID가 있지만, @implements는 내장 JSDocImplementsTag라 comment가 없고 tag.class.getText(source)에 CHAT-RESUME-01이 있다. comment 필드만 읽는 구현은 잘못된다. 실제 AST tag 범위와 원문/전용 필드를 사용하고 문자열 위장·중복·잘못된 ID를 부정 검사한다.

## 최종 구현에서 확인한 결정

root의 여섯 책임은 실제 Electron 1440×900에서 2열 3행으로 모두 보이게 배치했다. 좁은 창은 글자를 줄이지 않고 내부 스크롤하며, 수동 배율은 일반 렌더에서 유지하고 계층·창 크기 변경에서 복구한다.

생성 JSON은 개발·빌드에서만 기존 WWW JSON 승인과 설치 BoxBox 공개 CLI를 staging 경로에 적용한다. 두 번 정렬의 고정점·값/순서 보존·source check를 통과한 출력만 쓰며 check는 원본을 보존한다. 앱 runtime과 불변 과거 보고서 writer에는 CLI를 넣지 않았다. 머신별 설치·승인 근거 pin은 무시되는 로컬 설정이 소유하며 새 머신 setup이 필요하다.

하네스는 설치된 현재 checker를 별도 프로세스에서 읽어 모듈 캐시로 수정 전 generator를 검사하는 경계를 제거했다. Node/Bun 격리 회귀에서 cached stale과 fresh accepted를 비교했다. 전체 검사에서 드러난 Native 보고서 취소 retry 경합은 terminal interrupted의 선행 거절과 결정적인 디스크 상태 fixture로 수정했다. 테스트 타임아웃이나 수용 기준은 완화하지 않았다.

BoxBox TS 규칙은 고정 제안과 실제 승인 적용을 구분한다. 현재 미승인 정렬을 자동 적용하거나 과거 보고서의 hash를 바꾸지 않았으며 스타일과 독립 검토 상태는 검증 기록에서 별도로 판단한다.
