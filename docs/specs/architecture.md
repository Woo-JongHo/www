# 구조 ID와 요구 연결 계약

구조의 정본은 `docs/architecture/structure.json`이다. 아래 catalog가 각 leaf 책임의 요구 ID와 구현·검증 선언 필수 여부를 한 번 정의한다. ID는 책임 이름이며 파일 이동으로 바뀌지 않는다. 상세 사용자 동작은 Chat·Ecosystem·보고서 명세를 함께 읽는다.

```architecture-requirements
[
  {
    "id": "RESP-DEVELOPMENT-ARTIFACTS",
    "nodeId": "arch.development.artifacts",
    "description": "산출물 검토의 완전성·근거 위치·문서/기준 현재성과 개발 도구의 출처·제공·수용 미확인을 구분한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-PROJECTS",
    "nodeId": "arch.native.projects",
    "description": "로컬 프로젝트 인덱스가 실제 경로 식별·최근순·즐겨찾기·직렬 갱신·원자 저장과 오류 시 원본 보전을 담당한다. main은 single-instance lock 뒤 userData당 factory 하나를 사용하며 실행·전송·승인 중 전환 보호를 소유한다. 제한된 IPC가 renderer의 조회·즐겨찾기·프로젝트 선택과 작업 기록 보드를 연결한다. 보드는 승인 프로젝트의 work.json만 한도 내에서 읽고 원본 상태·부분 실패·빈 자료를 구분하며 코드 실행이나 업무 상태 쓰기를 하지 않는다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-RESOURCES",
    "nodeId": "arch.native.resources",
    "description": "main 전용 관측 원자 원장이 scope 격리·안정 식별 병합·제한된 메타데이터 저장·복원·종료와 실패 보전을 담당한다. main이 Native 관측 정규화와 저장을 소유하고 제한된 IPC로 renderer에 scope별 읽기 전용 snapshot을 전달한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-SERIALIZATION",
    "nodeId": "arch.development.records.serialization",
    "description": "새 작업 revision과 신규 보고서의 최초 JSON 출력에서 native 의미와 승인된 scalar 열을 보존한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-TOOLING-BUNDLE",
    "nodeId": "arch.tooling.bundle",
    "description": "앱 번들 생성과 Git 버전·릴리즈 preflight·산출물 체크섬, 공개 엔진 CI 연결 책임을 구현하고 실제 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-TOOLING-STRUCTURE-CONTRACT",
    "nodeId": "arch.tooling.structure-contract",
    "description": "구조와 요구 선언 계약 검증 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-TOOLING-MAP-VALIDATION",
    "nodeId": "arch.tooling.map-validation",
    "description": "계약과 지도 현재성 검사 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-TOOLING-MAP-GENERATION",
    "nodeId": "arch.tooling.map-generation",
    "description": "결정적인 구조 지도 생성 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-TOOLING-SOURCE-POLICY",
    "nodeId": "arch.tooling.source-policy",
    "description": "TypeScript 소스 정책 검사 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-AUTHORING",
    "nodeId": "arch.development.authoring",
    "description": "typed 저작 하네스 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-PROVIDERS-CODEX",
    "nodeId": "arch.development.providers.codex",
    "description": "Codex 실행 어댑터 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-PROVIDERS-GJC",
    "nodeId": "arch.development.providers.gjc",
    "description": "GJC 실행 어댑터 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-PROVIDERS-INVOCATION",
    "nodeId": "arch.development.providers.invocation",
    "description": "플랫폼별 실행 명령 계약 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-EVIDENCE-REPOSITORY",
    "nodeId": "arch.development.evidence.repository",
    "description": "전체 저장소 검사 적용성 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-EVIDENCE-DOCUMENTATION",
    "nodeId": "arch.development.evidence.documentation",
    "description": "문서 영향 검토 적용성 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-EVIDENCE-VERIFICATION",
    "nodeId": "arch.development.evidence.verification",
    "description": "검증 시도와 소스 식별 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-LOCK",
    "nodeId": "arch.development.records.lock",
    "description": "작업 기록 쓰기 잠금 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-AUTHORIZATION",
    "nodeId": "arch.development.authorization",
    "description": "작업 권한과 실행 전 검사 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-EVENTS",
    "nodeId": "arch.development.records.events",
    "description": "실행 사건 기록 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-REPORTING-LIFECYCLE",
    "nodeId": "arch.development.reporting.lifecycle",
    "description": "저작 보고서 종료 절차 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-REPORTING-DOCUMENT",
    "nodeId": "arch.development.reporting.document",
    "description": "저작 보고서 문서 렌더링 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-REPORTING-STORAGE",
    "nodeId": "arch.development.reporting.storage",
    "description": "저작 보고서 보관과 게시 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-REVIEW",
    "nodeId": "arch.development.review",
    "description": "독립 검토 실행과 판정 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-ROUTING",
    "nodeId": "arch.development.routing",
    "description": "요청과 스킬 라우팅 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-EXECUTION",
    "nodeId": "arch.development.execution",
    "description": "개발 단계 실행 통합 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-VALIDATION",
    "nodeId": "arch.development.records.validation",
    "description": "작업 레코드 스키마 검사 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-PROTOCOL",
    "nodeId": "arch.development.records.protocol",
    "description": "작업 레코드 타입 계약 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-RECORDS-STATE",
    "nodeId": "arch.development.records.state",
    "description": "작업 상태와 수용 판정 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-ACTIVITY-CATALOG",
    "nodeId": "arch.chat.activity.catalog",
    "description": "활동 목록과 읽기 상태 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-BLUEPRINT-LAYOUT",
    "nodeId": "arch.blueprint.layout",
    "description": "설계도 배치와 연결 탐색 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-MESSAGES-MARKDOWN",
    "nodeId": "arch.chat.messages.markdown",
    "description": "대화 메시지 Markdown 표시 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-MESSAGES-READING",
    "nodeId": "arch.chat.messages.reading",
    "description": "대화 행 펼침 상태 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-SESSIONS-READING",
    "nodeId": "arch.chat.sessions.reading",
    "description": "대화별 초안과 읽기 상태 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-MESSAGES-EXECUTION",
    "nodeId": "arch.chat.messages.execution",
    "description": "실행 카드와 출력 표시 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-MESSAGES-PREVIEW",
    "nodeId": "arch.chat.messages.preview",
    "description": "명령 출력 미리보기 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-SESSIONS-RESTORE",
    "nodeId": "arch.chat.sessions.restore",
    "description": "Native 대화 목록과 복원 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-DEVELOPMENT-SERVICE",
    "nodeId": "arch.development.service",
    "description": "개발 상태 서비스 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-BLUEPRINT-VIEW",
    "nodeId": "arch.blueprint.view",
    "description": "설계도와 생태계 화면 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-BLUEPRINT-ECOSYSTEM",
    "nodeId": "arch.blueprint.ecosystem",
    "description": "생태계 안내 모델 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-COMPOSER",
    "nodeId": "arch.chat.composer",
    "description": "한글 조합과 메시지 입력 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-LIFECYCLE",
    "nodeId": "arch.native.lifecycle",
    "description": "Electron 수명주기와 IPC 처리 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-ACTIVITY-VIEW",
    "nodeId": "arch.chat.activity.view",
    "description": "Native 활동 상세 화면 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-ACTIVITY-PROJECTION",
    "nodeId": "arch.chat.activity.projection",
    "description": "Native 활동 사건 투영 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-SESSIONS-REQUESTS",
    "nodeId": "arch.chat.sessions.requests",
    "description": "Native 대화 요청 구성 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-LAUNCH",
    "nodeId": "arch.native.launch",
    "description": "Native 실행 파일 선택 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-REPORTS-COLLECTION",
    "nodeId": "arch.reports.collection",
    "description": "보고서용 완료 사건 수집 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-REPORTS-QUEUE",
    "nodeId": "arch.reports.queue",
    "description": "자동 보고서 큐와 수명주기 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-BRIDGE",
    "nodeId": "arch.native.bridge",
    "description": "제한된 브리지 노출 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-MESSAGES-PROJECTION",
    "nodeId": "arch.chat.messages.projection",
    "description": "대화 사건을 블록으로 투영 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-WORKSPACE",
    "nodeId": "arch.chat.workspace",
    "description": "화면 전환과 대화 작업 공간 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-REPORTS-JUDGEMENT",
    "nodeId": "arch.reports.judgement",
    "description": "읽기 전용 Native 보고서 판단 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-REPORTS-SERVICE",
    "nodeId": "arch.reports.service",
    "description": "보고서 목록과 읽기 서비스 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-REPORTS-VIEW",
    "nodeId": "arch.reports.view",
    "description": "보고서 탐색 화면 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-TRANSPORT",
    "nodeId": "arch.native.transport",
    "description": "JSONL 요청과 응답 전송 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-PROTOCOL",
    "nodeId": "arch.native.protocol",
    "description": "프로세스 간 공용 계약 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-CHAT-ACTIVITY-ARTIFACTS",
    "nodeId": "arch.chat.activity.artifacts",
    "description": "WWW 작업 산출물 식별 책임을 구현하고 관련 동작을 검증한다.",
    "implementationRequired": true,
    "verificationRequired": true
  },
  {
    "id": "RESP-NATIVE-BUILD-INFO",
    "nodeId": "arch.native.build-info",
    "description": "실행 중인 앱에 동일 빌드의 버전·커밋·dirty·소스 digest를 표시한다.",
    "implementationRequired": true,
    "verificationRequired": true
  }
]
```

각 관리 소스의 첫 문장 앞 실제 JSDoc에 `@architecture arch.…` 하나와 `@implements RESP-…`를 선언한다. 테스트 첫 문장 앞 JSDoc의 `@verifies RESP-…`는 실제 테스트 호출이 있는 `.test.ts(x)`에서만 받는다. 문자열과 일반 주석은 선언이 아니다. 연결의 존재는 기능 충족이나 테스트 통과의 증명이 아니다.

의존성은 같은 구조 ID 내부만 자동 허용한다. 부모·자식·형제 사이도 `allowedDependencies`에 정확한 대상 ID가 있어야 한다. 목록은 기존 AST import의 타입·런타임 참조와 책임을 대조한 초기 경계다. 외부 패키지와 비관리 asset은 기존 추출의 excluded 근거로 남기며 wildcard는 허용하지 않는다.

관리 범위는 `src`와 `scripts/workflow`의 TypeScript 및 루트 build, typed workflow, source policy, 지도 생성기, 계약 검사기다. 새 계약 검사 모듈도 자신의 구조·요구 선언이 필요하다. migration.json은 과거 이관 계획이며 실행기의 입력이 아니다.

파일 경로를 옮기더라도 책임이 유지되면 구조 ID와 요구 ID를 유지한다. 새 파일은 직접 구조·구현을 선언해야 하며 경로 이름에서 소속을 추정하지 않는다. `src/architecture.ts`와 `src/architecture-tree.ts`는 `arch.blueprint.layout` 및 `RESP-BLUEPRINT-LAYOUT`을 함께 구현한다. 테스트는 각 실제 검증 선언 위치에 연결된다.

테스트 연결은 닫힌 AST 등록 문법으로만 수용한다. `bun:test`·`node:test`의 모든 value import(별칭·namespace·기본 가져오기 포함)를 framework-origin 루트로 식별하되, 수용 API는 named `test`·`it`·`describe`, Node named `suite`와 Node 기본 `test`의 **bare identifier 직접 호출**뿐이다. type-only import는 제외한다. property·element·call·태그 template과 괄호·`as`·타입 assertion·non-null·`satisfies` 래핑을 따라 framework 루트를 식별한다. `.if`·`.skipIf`·`.todoIf`·`.each`·태그형 each·`.only`·`.skip`·`.todo`, 깊은 `test.describe.skip`, namespace 멤버와 호출 결과 재호출 등은 조건·문자값과 무관하게 전체 하위 탐색을 중단한다. 지원 API 외의 framework API와 그 별칭도 중립 영역으로 다시 탐색하지 않는다.

| API | 수용하는 직접 인자 문법 |
|---|---|
| Node test/it/default 및 describe/suite | inline `fn`, 명백한 문자열 리터럴/치환 없는 template `name + fn`, 직접 객체 `options + fn`, `name + 직접 객체 options + fn` |
| Bun test/it | `name + inline fn`, `name + options + inline fn`, `name + inline fn + options`. options는 숫자 리터럴 timeout 또는 직접 객체 |
| Bun describe | inline `fn` 또는 `name + inline fn` (설치 Describe 서명) |

Node 두 인자형의 동적 이름·옵션 변수는 모호하므로 제외한다. 동적 이름은 명시적인 빈 options를 넣은 세 인자형으로 연결할 수 있다. Node `(name, fn, options)`는 미지원 서명이므로 호출 전체를 제외한다. Node 직접 옵션 객체의 허용 필드는 설치된 `TestOptions`에서 확인한 `concurrency`·`expectFailure`·`only`·`signal`·`skip`·`tags`·`timeout`·`todo`·`plan`이다. 선별 옵션 `skip`·`todo`·`only`는 명시적 `false` 리터럴만 허용한다. 빈 문자열을 포함한 문자열·숫자·null·변수·계산식은 허용하지 않는다. Bun `TestOptions`의 허용 필드는 설치 타입의 `timeout`·`retry`·`repeats`뿐이며 미지원 `skip`·`todo`도 unknown 필드로 거절한다. 양쪽 모두 옵션 객체 전체 변수·계산식, spread(중첩 spread 포함)·계산키·축약·getter·method와 미지 필드를 거절한다. 허용 필드의 값 타입과 실제 실행은 strict 검사와 runner가 담당한다.

일반 functionlike 본문에는 들어가지 않는다. 유효하고 제외되지 않은 직접 suite의 inline arrow/function callback body에만 명시적으로 진입하며, 직접 test/it는 지원 서명과 inline callback이 있을 때 연결한다. 승인 호출 처리 후에도 일반 DFS로 우회하지 않는다. unknown helper·간접 별칭·foreach 콜백과 선언만 된 미호출 helper 안의 test는 미지원이라 등록으로 세지 않는다. 일반 module 문장·block·for 등의 선언 순회는 유지하지만 분기·반복의 실제 도달성, 이름 가림·런타임 재대입·함수 본문 의미나 성공을 증명하지 않는다. 범용 JavaScript 실행기나 이름 해석기를 제공하지 않는다.

문자열과 주석 속 가짜 호출은 AST 등록이 아니다. 미지원 구문만 있는 검증 파일은 실제 `checkArchitectureContract`에서 거부되고 필수 검증 연결을 채우지 못한다. API 부정 예시는 실행 테스트를 skip/only로 등록하지 않고 격리 소스 문자열 fixture로 검사한다. 문자열 fixture의 등록 판정과 strict 타입 검사·실제 테스트 실행 결과는 별개다. Node 22.22.3의 이전 임시 실측에서 빈 skip/todo 문자열도 TAP에 SKIP/TODO로 표시됐고 `suite skip:''`의 자식이 취소됐으므로 본문 실행 여부와 일반 검증 연결을 구분한다.

등록 검사는 ID·계층·소속·필수 참조·허용 의존의 일관성을 검사하며 요구 의미의 정확성이나 현재 테스트 통과를 증명하지 않는다. 화면의 ‘검증 참조 / 선언’은 실행 결과 원장이 아니다. 책임 계층은 정본 선언이고 의존선은 실제 정적 import의 책임별 축약이다. IPC·함수 호출·실시간 tracing은 포함하지 않는다. 생성·stale 검사는 빌드·전체 check·typed 저작 하네스에 연결하며 snapshot은 공식 generator로만 갱신한다.

## Node Map 표시와 이동

`기능·책임 지도`는 정본 부모와 직계 자식만 계층선으로 연결한다. 회색 계층·파란 실제 import·점선 타입 전용 관계를 구별하고 실행 순서를 추정하지 않는다. `개념 처리 관계`는 수동 안내이며 실제 source 근거를 같은 구조 ID로 찾아 담당 코드 지도에 연결한다. 근거가 없으면 구조 ID 미제공을 표시한다.

지도 중심의 상세 패널은 기본 접힘이며 자세히 보기 버튼으로 명시적으로 연다. 노드·검색·참조 선택은 지도 아래 역할·구성 수 요약만 갱신한다. 기본 탐색은 64px 화면 전환 rail이고 프로젝트·대화 목록은 탐색 열기로 펼친다. 닫기와 Escape는 선택 노드로 초점을 돌려준다. 검색·breadcrumb·키보드·줌·맞춤·포인터 팬을 제공한다. 채팅과 지도, 두 지도 탭을 전환해도 선택·경로·검색·배율·이동을 보존하고 숨긴 뷰를 레이아웃이나 0치수 fit에 사용하지 않는다. 채팅 초안·읽기 상태는 별도 수명을 유지한다. 이 화면은 빌드에 포함된 WWW snapshot이며 선택 프로젝트 전체를 자동 분석한 실행 trace가 아니다.
