# 채팅과 실시간 사이드바 및 프로젝트 Node Map 개편 설계

## 작업과 합의 상태

- UUID: `work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b`
- 요구·수용 기준·결과·권한의 정본: [spec.md](spec.md), [work.json](work.json).
- 구현 단위 탐색: [tasks.md](tasks.md). 이 파일과 tasks.md는 동일 합의의 WWW 보기이며 별도 대안 계획이 아니다. GJC 세션 파일이 없어도 아래 계약으로 재개할 수 있다.
- 이 설계판의 저장 당시 상태는 구현 승인 대기였다. 이후 사용자가 동일 최종 계획의 구조화 구현 승인을 선택했다. 현재 실행 상태·권한·기준 결과는 work.json, 실제 시도는 verification.md를 따른다. commit·push는 미승인이다.
- 별도 BoxBox 승인 후 P1의 공식 하네스·집중 검증을 통과했고 원래 순서대로 P2~P4를 재개했다. 이 진행 기록은 합의 계약이나 최종 검토 의무를 변경하지 않는다.
- 합의 대상 revision 3의 SHA256: `ceb79d6300ec31ee5b0b96cff3026e41fefb622ded8f2a5a720ce5f564af3b24`.
- 최종 native 계획 SHA256: `4caecc67c5624053b2965412a273db364389c47c5537a1be59fb9a60bc6e02c6`.
- native 산출물 위치: `.gjc/_session-01a1d728-f356-755f-995a-cb761f2a24ad/plans/ralplan/01a1d728-f356-755f-995a-cb761f2a24ad/stage-03-final.md`. 이 문서는 해당 최종 합의의 결정·계약·순서·검증 의무를 WWW 형식으로 옮긴 파생 보기다. 독립적으로 결정을 바꾸지 않는다.

## 기준선과 재사용

정식 기반인 Electron·TypeScript·React를 유지한다. runtime 의존성은 react/react-dom/react-markdown/remark-gfm이며 새 DB·그래프·아이콘 패키지 설치를 전제로 하지 않는다.

현재 main의 `seq`와 사건 시각은 프로세스 안에서 만들어지고, 대화 복원에도 새 seq/at가 붙는다. main과 renderer 사건은 최근 2,000개 한도이므로 원장 식별·완전한 이력의 근거가 아니다. `workspace:choose`는 첫 thread 뒤 폴더 변경을 막고 renderer도 threadId가 있으면 선택을 비활성화한다. 확정한 프로젝트 탐색을 제공하려면 이 영구 차단을 idle 전환 보호로 함께 바꿔야 한다.

기존 `conversationKey`별 초안·읽기 위치·follow-tail·행 상태, 목록/전환 세대, `ActivitySnapshotBoundary`, `ResizeObserver`와 스크롤 처리, 승인·전송·전환 보호를 재사용한다. 동일 책임의 자동스크롤·복원 모델을 병렬로 만들지 않는다.

활동 쪽은 기존 관측 파서·PlanStep·미제공 상태를 재사용하되, 카탈로그 전체 행을 먼저 만드는 기본 화면을 실제 관측 중심으로 바꾼다. Hook은 현재 코드에서도 turn 없이 thread 수준 활동에 속할 수 있다. 문서 읽기·Skill 요청·실제 실행은 별개다.

지도는 기존 `docs/architecture/structure.json`의 안정 구조 ID·명세·생성기와 `src/architecture.generated.json`, architecture/tree, 기존 SVG 검색·줌·팬·상세를 재사용한다. 생성물은 손으로 고치지 않는다.

스크롤 버그 원인은 아직 실행 재현하지 않았다. grid/flex 최소 크기·overflow·observer 대상·화면 복귀 경쟁은 정적 후보이며 특정 CSS 값이 원인이라고 확정하지 않는다. 현재 Electron 최소 창 1040×680과 999px 이하 renderer 표현의 검증 범위도 구분한다.

## 원칙과 판단 기준

1. 관측만 사용하고 미제공·불완전·실패를 숨기지 않는다.
2. 현재 요청은 turn, 누적은 workspace+thread, 실시간 반응은 live 연결 수명으로 분리한다. 저장과 전환의 단일 소유자는 main이다.
3. 기존 정본·승인 보호·읽기 동작을 확장하고 경쟁 원본을 만들지 않는다.
4. 스크롤부터 끝까지 동작하는 작은 단위로 검증하고 뒤 기능을 더한다.

판단 기준은 증거 정합성·격리, 저장 복구 가능성·부담, 단계적 사용성·검증 가능성이다.

## 대안과 ADR

### 결정

단일 인스턴스 main이 제한된 원자 JSON 메타데이터 원장을 소유한다. renderer는 읽기 DTO와 사용자 의도만 전달한다. 프로젝트 전환은 비동기 준비 후 동기 커밋 경계를 두고, 지도는 기존 구조 ID와 SVG 탐색을 개선한다.

| 대안 | 장점 | 감수할 비용·채택 여부 |
|---|---|---|
| 대화별 원자 JSON + 작은 프로젝트 인덱스 | 내장 fs/crypto로 구현, 추가 패키지 없음, 파일별 손상 격리 | 단일 writer·재직렬화·용량·종료 복구를 직접 검증. 선택 |
| SQLite | unique/upsert·트랜잭션·조회 | 현재 드라이버와 Electron node:sqlite 지원 미확인. ABI·배포까지 가정하지 않고 미채택 |
| renderer localStorage/IndexedDB | UI 접근 용이 | writer·권한·격리·종료 책임이 분산되므로 제외 |
| 기존 구조 ID + SVG 개선 | 정본·근거·검색·탐색 재사용 | 레이아웃·키보드 개선 필요. 선택 |
| 새 그래프 라이브러리 + 파일 자동 군집 | 대규모 배치에 유리할 수 있음 | 미설치 의존성과 임의 기능 분류를 추가하므로 제외 |

JSON은 나중에 DB로 바꾸기 위한 임시 계층이 아니라 현재 요구를 완결하는 선택이다. 실제 병목과 별도 의존성 결정 없이 DB 전환을 미리 설계하지 않는다. 저장 한도·종료 지연·재직렬화 비용과 Native 식별 부족의 한계를 명시적으로 감수한다. 후속 조치는 아래 순서와 장애 검증이며, 설계 합의를 제품 검증으로 바꾸지 않는다.

## 경계와 데이터 흐름

### 1. 프로세스·저장 소유권

시작 순서는 테스트/PROBE의 격리 userData 설정 → `app.requestSingleInstanceLock()` 획득 → 원장 접근·Native 시작·창 생성이다. 같은 userData에서 lock을 얻지 못한 main은 IPC·원장·Native·창을 시작하지 않고 종료한다. 내부 큐만으로 다중 프로세스를 허용하지 않는다. 별도 분산 락이나 DB는 추가하지 않는다.

main이 Native 사건 검증·정규화·원장 upsert·저장을 맡는다. 순수 정규화/집계는 기존 파서와 공유하는 작은 TypeScript 모듈로 분리한다. renderer에 원장 내용·revision·파일 경로를 지정하는 쓰기 API는 제공하지 않는다. 즐겨찾기/프로젝트 전환은 검증할 사용자 의도로만 받는다.

workspace는 main이 선택 디렉터리를 realpath로 정규화한 실제 경로의 SHA256으로 식별한다. 임의 소문자화는 하지 않는다. symlink 별칭은 같은 실제 경로에 합치고 다른 worktree·실제 경로는 분리한다. 접근 실패는 기존 프로젝트를 유지하고 오류로 표시한다.

저장 위치는 `app.getPath("userData")/activity-v1/<workspaceKey>/<hash(threadId)>.json`이다. 프로젝트 인덱스도 앱 데이터에 두되 원장의 경쟁 정본으로 쓰지 않는다. main이 파일명을 만들고 내부 workspaceKey/threadId도 검증한다. 임의 경로 IPC·path traversal·저장영역을 벗어나는 symlink를 거부하고 가능한 플랫폼에서 디렉터리/파일 권한은 0700/0600으로 둔다.

### 2. 제안 계약

아래는 구현할 계약이지 현재 Native가 모든 필드를 제공한다는 주장이 아니다. P2에서 실제 Native 필드·ID 유일성·미제공 분기를 먼저 확인한다.

```ts
type Scope = { workspaceKey: string; threadId: string };
type Delivery = {
  processEpoch: string;
  connectionGeneration: number;
  seq: number;
  selectionEpoch: number;
  workspaceKey: string | null;
};
type Observation = {
  id: string;
  source:
    | { kind: "hook"; hookRunId: string; turnId: string | null }
    | { kind: "item"; itemId: string; turnId: string; nativeInvocationId?: string };
  resource: {
    kind: "skill" | "hook" | "document" | "tool";
    identity: string;
    label: string;
  };
  action: "invoke" | "read";
  status: "observed" | "running" | "completed" | "failed" | "unknown";
};
type ResourceSnapshot = {
  scope: Scope;
  processEpoch: string;
  selectionEpoch: number;
  revision: number;
  durableRevision: number;
  observations: readonly Observation[];
  coverage: {
    startedAt: string | null;
    completeness: "partial" | "complete-for-covered-range";
    gaps: readonly (
      "native-missing" | "unstable-id" | "disconnect" | "unclean-exit" |
      "retention-limit" | "write-failed" | "corrupt" | "unsupported-version"
    )[];
  };
  storage: "saved" | "saving" | "volatile" | "full" | "corrupt" | "unavailable";
};
```

`WwwApi` 확장은 main의 선택 scope만 조회하는 `activityResources(): Promise<ResourceSnapshot | null>`, `onActivityResources(listener): () => void`, 최근 프로젝트를 반환하는 `listProjects()`, 등록된 workspaceKey와 boolean을 받는 `setProjectFavorite()`, 등록된 workspaceKey를 받는 `switchProject()`다. 전환 응답은 workspace/키/selectionEpoch, `threadId: null`, 초기 events, `resources: null`을 함께 반환한다. `listProjects()`의 항목은 workspaceKey/name/path/favorite다.

기존 `chooseWorkspace`는 main 소유 선택·등록·전환 절차에 통합한다. AppEvent 배달에 Delivery의 scope/세대를 연결하고 main/preload/shared/renderer/fixture 소비자를 함께 변경한다. 식별 없는 구형 배달을 추정 수용하는 호환 경로는 남기지 않는다. snapshot은 raw params·본문 복제가 아니며 필요하면 같은 revision의 집계 행을 반환하되 정본은 관측 upsert 집합 하나다. coverage 시작은 WWW 관측 시작이지 Native 전체 이력 시작이 아니다.

### 3. 영속 식별과 실제 사용 집계

공통 scope는 workspace+안정 threadId다. 일반 item에는 실제 turnId/itemId가 필요하다. Hook은 안정 threadId와 유일성이 확인된 runId가 있으면 turn이 없어도 영속화한다. thread 미제공과 turn 미귀속은 다르다.

- Hook 키: `[schema, workspaceKey, threadId, "hook", providerRunNamespace, hookRunId, resourceIdentity, action]`을 순서 고정 JSON으로 직렬화한 hash. providerRunNamespace는 실제 확인된 provider ID 범위다. 선택적 turn은 키에서 제외하고 부가 귀속으로만 갱신한다.
- 일반 item 기본 키: `[schema, workspaceKey, threadId, turnId, "item", itemId, resourceKind, resourceIdentity, action]`의 hash. item 자체가 호출을 식별하면 optional invocation ID는 보조 근거다. 여러 호출 구분에 필수인 형태만 시작/완료/복원에서 동일하게 대응함을 확인해 구분 키로 쓴다. 일부 사건에만 오는 optional ID를 조건부로 붙여 중복을 만들지 않는다.
- 시작/완료는 같은 관측의 상태 변경이다. delta 수·메시지 수·승인 RPC ID·시각·seq·프로세스 UUID·본문 hash를 영속 호출 ID로 대용하지 않는다. terminal을 늦은 running으로 되돌리지 않고 상충하는 terminal은 임의 성공 대신 unknown/충돌로 표시한다.
- 안정 thread/run/item 또는 ID 유일성이 불명인 사건은 임시 모니터와 누락 상태로 구별한다. 이름만 보고 새 영속 사용을 가산하지 않는다. turn 없는 안정 thread Hook 자체는 누락 이유가 아니다.
- 실제 관측 행만 resourceKind+identity+action으로 묶고 안정 ID 집합의 건수를 센다. 이름 유사성으로 합치지 않고 한 item의 여러 참조도 실제 제공된 것만 센다. 전체 카탈로그 행을 먼저 생성하지 않는다.

P2 필수 대응표는 sync Hook의 turn 없음/뒤늦은 귀속·run ID 유일성, thread 없는 Hook의 미귀속, Skill 요청/pending과 실제 invoke의 구분, `SKILL.md` 읽기와 실행의 구분, 명령 참조와 실제 읽기의 구분, optional invocation ID 존재 차이를 다룬다. 실제 invoke 제공 여부는 미확인 상태로 남기고 없는 사건을 생성하지 않는다. ID 동등성을 입증하지 못하면 불완전 표시하며 성공·정확한 횟수를 주장하지 않는다.

### 4. live·복원·저장 경쟁

live 경로는 Native 사건 → main 검증/현재 client 확인 → 정규화 → scope 원장 upsert → 메모리 revision 증가/화면 즉시 통지 → 저장 큐 → 원자 교체 → durableRevision·저장 상태 통지다. 표시됐다고 저장됐다는 뜻은 아니다.

복원 Native 사건도 같은 키로 저장 관측과 합치지만 historical로 처리해 pulse·현재 실행·새 호출 알림을 만들지 않는다. 과거 running은 현재 실행이 아닌 과거 미확정/unknown이다. Native 대화 복원 complete와 WWW 관측 원장 coverage complete는 다르다. eventLog 2,000개 절단 전에 수집하며 도입 전 이력은 제공된 범위만 복구한다.

구독을 먼저 하고 main의 scope 큐에서 원장 읽기/live upsert를 순서화한다. renderer는 scope·selectionEpoch·revision으로 역전 snapshot을 거부한다. 같은 revision의 저장 완료는 durableRevision/storage 변경으로 처리한다. 읽기 실패에도 live는 버리지 않고 volatile로 표시한다. 기존 `ActivitySnapshotBoundary`를 일원화해 복원·live 이중 반응을 막는다.

배달 키는 processEpoch+connectionGeneration+seq이고 영속 키와 분리한다. 실제 새 연결에서 seq가 작아져도 새 배달이며 같은 Native 관측은 다시 가산하지 않는다. 오래된 snapshot·카탈로그·client의 message/closed/initialize 콜백은 현재 client token·선택 세대를 확인해 새 연결·프로젝트 상태를 건드리지 못하게 한다. workspace 불명 사건을 현재 thread로 추정하지 않는다.

### 5. 저장·종료·손상·한도

단일 인스턴스 main의 단일 큐에서 scope 쓰기와 전체 용량을 관리한다. UI는 즉시 반영하고 저장은 최대 100ms 배치, turn 종단과 정상 종료에 flush한다. 같은 디렉터리 임시 JSON → 크기/스키마/scope 검증 → fsync/close → rename으로 교체하며 지원 환경에서 디렉터리 fsync도 한다. 이전 최종 파일을 먼저 지우지 않는다. rename 실패는 이전판 유지+volatile이다. 전원 장애 내구성을 검증하지 않은 플랫폼은 한계를 표시한다.

원장에는 schemaVersion/scope/revision·제한된 관측·coverage·dirty 종료 표시·checksum만 저장한다. checksum은 손상 검사용이지 서명이 아니다. 프롬프트·본문·명령 전문/출력·diff·raw params·비공개 추론·전체 카탈로그를 저장하지 않는다. label은 최대 256자, identity는 최대 2KiB이며 잘린 label을 ID로 쓰지 않는다.

최초 live 수집 전 dirty=true를 원자 저장하고 실패하면 저장 불가로 표시한다. checkpoint도 dirty를 유지한다. before-quit은 재진입을 막고 수집을 멈춘 뒤 최대 2초 flush를 확인한 경우에만 dirty=false를 기록한다. 새 사건을 받은 뒤 clean으로 만드는 경쟁을 막는다. kill·timeout 뒤에는 이전 checkpoint와 unclean-exit/누락 가능성을 알린다. 임시 파일을 시각만 보고 최신판으로 채택하지 않는다.

크기·schema·checksum·scope가 잘못된 원장과 미지원 version은 조용히 초기화하거나 덮지 않고 격리 보전하고 알린다. Native 일부 복구나 저장 재시도 성공이 잃어버린 구간의 복구라는 뜻은 아니다.

설계 기본값은 thread당 **10,000개 안정 관측 또는 4MiB**, 전체 **64MiB**다. 자동 시간 만료·무단 삭제는 없다. 한도에서 기존 ID를 버리고 다시 가산하지 않고 신규 unique 영속 추가를 멈춰 full/retention-limit/누락을 표시한다. 기존 ID 상태 변경도 크기 안에서만 허용한다. 파일 헤더 8KiB, 전체 한도/종료 상태 64KiB를 한도 안에서 예약한다. 무한 누락 목록을 별도로 만들지 않는다.

ENOSPC·권한 오류로 경고조차 저장할 수 없으면 현재 UI에 저장 불가와 마지막 durableRevision을 표시한다. 다음 실행이 그 원인을 반드시 복원한다고 약속하지 않는다. clean 확인 없는 구간을 완전하다고 하지 않는다. 원장 오류가 채팅·승인을 막지는 않는다. 이 용량·시간 값은 측정 결과가 아니라 검증할 설계값이다.

### 6. 현재 요청과 대화 누적

현재 요청은 workspace+thread+명시적 현재 turn이다. userPrompt부터 startAccepted까지는 clientRequestId에 연결한 전송 중 상태로 보이고 이전 turn의 체크리스트를 복사하지 않는다. 실제 PlanStep만 쓰며 없으면 단계 미제공이다. turn 종료를 모든 계획·리소스 성공으로 바꾸지 않는다.

turn 없는 안정 thread Hook은 대화 수준 live 활동으로 즉시 표시하고 하단 누적에 포함하지만 현재 요청의 체크리스트나 성공으로 추정 귀속하지 않는다. 나중에 명시 turn 근거가 오면 같은 관측의 부가 귀속만 갱신한다. 모니터를 닫아도 main 수집은 계속된다.

### 7. 프로젝트 전환의 커밋 경계

thread 존재에 따른 영구 차단을 실행·전송·승인·전환 중 보호로 교체하고 main이 강제한다. 순서는 입구 idle 확인 → switchingConversation 잠금 → 대상 realpath/권한/등록 검증 → 이전 원장 flush 시도 → 소유자 내부 커밋 재검사 → 이전 client/선택 세대 무효화 및 대상 workspace 확정 → 초기화 → 대상 연결/snapshot이다.

realpath/flush의 await 뒤 이전 client 무효화 직전에 `turnStarting || activeTurnId !== null || pendingApprovals.size > 0`을 다시 검사한다. 자신의 switchingConversation 때문에 항상 거절되는 일반 idle 함수를 다시 호출하지 않는다. 검사부터 client 무효화·workspace 확정까지 **await가 없는 동기 구간**이다. 새 busy이면 잠금만 풀고 이전 workspace/thread/client/승인을 유지해 전환을 취소한다. 승인·사건을 삭제하거나 무시해서 통과시키지 않는다.

커밋하면 activeThreadId/activeTurnId를 null, threadStarted/turnStarting을 false로 하고 이전 endedTurns/eventLog/approvalAttempts/카탈로그 요청을 정리한다. pendingApprovals는 입구·커밋 양쪽에서 비어 있음을 확인한다. 이전 child 종료 대기는 무효화 이후 가능하나 그 콜백은 새 상태를 건드리지 못한다.

확정 전 실패는 이전 선택을 보존하고 확정 후 Native 연결/목록 실패는 대상 프로젝트의 빈 선택+오류로 표시한다. 다른 프로젝트의 마지막 thread를 자동 resume하지 않는다. 목록에서 명시 선택해야 재개한다. 이전 Native 대화·원장은 삭제하지 않는다.

renderer는 이전 workspace/thread의 초안·읽기·행 상태를 기억하고 새 selectionEpoch에서 events/model/activity/plan/list/cursor/search를 초기화한다. null-thread 초안도 대상 프로젝트 메모리만 쓴다. 원래 대화를 다시 열면 메모리를 복원하되 초안 재시작 영속화를 추가하지 않는다. 늦은 list/open/hooks/initialize도 선택 세대와 client로 거부한다. 성공한 전환만 최근 목록에 기록하고 favorite 저장 실패는 별도로 알린다.

### 8. Node Map의 정본과 표현

기존 rootId `arch.www`와 구조 ID/parent/title/description, 명세·코드 근거 → 기존 생성기 → 생성 JSON → tree/view 경로를 유지한다. 파일명·폴더·import에서 기능·처리 순서를 임의 생성하지 않는다. 처리 근거가 없으면 미제공으로 표시한다.

계층, 명세 근거 개념 처리 관계, 실제 import, type-only 의존을 라벨·선형·범례로 구분한다. 화살표는 관계 방향이지 Native 실행 순서가 아니다. 선택 상세는 구조 ID·역할·명세 참조·담당 파일·실제 코드 근거이며 없는 행번호를 만들지 않는다. 검색 결과·breadcrumb·선택·줌/팬은 같은 구조 ID를 따르고 결과를 고르면 같은 노드를 중심에 놓고 상세를 연다.

## 화면 구성과 접근성

```text
왼쪽 탐색             가운데 채팅                       오른쪽 상태
최근 프로젝트         대화: 내부 세로 스크롤              현재 요청/단계
즐겨찾기              코드·표: 자체 가로 스크롤            실제 Skill/Hook
선택 프로젝트 대화    과거 읽기/새 출력 복귀              대화별 누적 리소스
프로젝트 추가·전환    입력·전송·중단: 화면 안에 유지       저장·누락/상세 모니터

Node Map: breadcrumb·검색·배율·맞춤
왼쪽 구조/검색 결과 | 가운데 내부 줌/팬 관계 지도 | 오른쪽 선택 근거 상세
상세 모니터: 개요·이벤트·필요한 카탈로그를 요약과 별도 영역으로 표시
```

역할 배치이지 고정 폭 확정은 아니다. 기존 의미 토큰, 본문13px/코드12px, 16px 간격과 2px accent 포커스를 활용하고 새 아이콘 패키지 없이 선형 SVG를 사용한다. 선택은 문자·외곽선·aria 속성을 함께 쓴다.

로딩·빈 상태·미제공·불완전·오류·저장 불가는 구별한다. 카탈로그가 비었다고 사용 0회를 추정하지 않는다. 체크리스트는 관측 상태이지 사용자가 완료를 조작하는 checkbox가 아니다. 중요 단계/저장 장애만 aria-live polite로 알리고 stream의 매 문자를 읽지 않는다. 색만으로 상태를 표시하지 않고 reduced-motion에서 pulse를 멈춘다.

999px 이하는 보조 패널·선택 상세를 drawer/overlay로 바꾸며 입력창을 계속 덮지 않는다. Escape·닫기·포커스 복귀, modal이면 focus trap/배경 비활성화를 제공한다. 현재 Native 최소 폭 1040은 별개이므로 999 이하 renderer 검증을 Native 실기로 쓰지 않는다. minWidth를 바꾸면 별도 실제 창 검증이 필요하다.

스크롤 수정은 실제 DOM 치수·overflow·observer 측정 뒤 최소로 한다. body overflow만 숨겨 내용 접근을 차단하지 않는다. 지도는 drag 외에 줌 버튼·맞춤·키보드 노드/결과 이동을 제공하고 상세를 닫으면 선택 원점으로 포커스를 돌린다.

## 영향 파일과 순서

| 단위 | 주요 파일/책임 | 관련 기준 |
|---|---|---|
| P1 스크롤 단독 | renderer.tsx/index.html/chat.css, 기존 읽기 메모리와 verify-chat | AC-CHAT-01~04 |
| P2 원장 수직 절편 | main.ts/shared.ts/preload.ts, 기존 활동 파서, 필요시 main 전용 activity-resource-store.ts와 집중 테스트 | AC-STATUS-03~06 |
| P3 상태/모니터 | activity-sidebar.ts/native-activity.ts/native-activity-view.tsx, renderer·CSS | AC-STATUS-01~07 |
| P4 프로젝트 | main/shared/preload/renderer, conversations.ts와 전환/복원 fixture | AC-PROJECT-01~04, AC-STATUS-04~06 |
| P5 지도 | ecosystem-view.tsx/ecosystem.css/architecture.ts/architecture-tree.ts, 구조 정본·기존 생성기/생성물 | AC-MAP-01~06 |
| P6 통합 증거 | 관련 테스트, verify-chat/verify-native-activity/verify-architecture, 실제 구현한 기능 명세·구조·개발 안내 | 21개 전체 |

기존 동등 책임이 없을 때만 새 TS 모듈을 추가한다. shared 계약을 바꾸면 모든 직접 소비자와 fixture를 같은 단위에서 갱신하고 과거 동결 Tauri 비교 실험은 현행 정책에 따라 다룬다. 기존 대량 미커밋 변경을 되돌리거나 일괄 덮어쓰지 않는다.

P1을 재현·단독 회귀 통과시키기 전 원장·사이드바 확장을 시작하지 않는다. P2는 관측 하나→upsert→파일→실제 프로세스 재시작→읽기까지 완성한다. P3~P5도 앞 단계가 동작하는 제품 위에 더한다. 저장 계약은 한 owner가 먼저 정하고 이후 독립 화면 작업을 분리한다. 구현은 별도 승인이 필요하다.

## 21개 기준의 검증 연결

정의·필수 여부·결과는 work.json만 정본이다. 아래는 ID별 검증 매핑이다.

| 기준 | 검증 시나리오 |
|---|---|
| AC-CHAT-01 | 긴 답변·연속 stream, 문서 세로 넘침/내부 스크롤/입력창 가시 범위 |
| AC-CHAT-02 | 긴 코드·URL·표와 document.scrollWidth/요소 경계 |
| AC-CHAT-03 | 과거 anchor 보존·최신 추종, stream/지연 레이아웃 |
| AC-CHAT-04 | 모니터 토글·1040×680 이상 Native resize, 좁은 renderer 별도 |
| AC-STATUS-01 | A완료→B전송/수락, plan 미제공·갱신, 이전 완료 제외 |
| AC-STATUS-02 | 저장 전 live 이름/문자 상태, 카탈로그-only 행 제외 |
| AC-STATUS-03 | 빈 plan·ID 누락·read/request/invoke/참조 구별 |
| AC-STATUS-04 | 같은 thread 여러 turn·다른 thread·다른 workspace, turn 없는 Hook |
| AC-STATUS-05 | 실제 프로세스 재시작·과거 무반응·snapshot/live 역순·unclean-exit |
| AC-STATUS-06 | ID 중복/역순·optional ID 차이·두 main 소유권·저장 재시도/손상/상한 |
| AC-STATUS-07 | 별도 모니터 개요/이벤트/카탈로그와 채팅 초안·읽기 유지 |
| AC-PROJECT-01 | 최근·즐겨찾기·프로젝트별 대화, 목록/저장 실패 |
| AC-PROJECT-02 | 탐색 위계·아이콘·선택·간격·긴 한국어 GUI 확인 |
| AC-PROJECT-03 | idle 성공/busy 거절, flush 중 새 승인·turn, 이전 client/목록 지연, 명시 재개 |
| AC-PROJECT-04 | 접근 가능한 이름·키보드·포커스 이동/복귀 |
| AC-MAP-01 | 지도 중심 화면에서 기능·처리 근거·담당 코드 찾기 |
| AC-MAP-02 | 검색→동일 ID·선택 상세, 줌/팬/맞춤/키보드 |
| AC-MAP-03 | 역할·파일/코드 근거 위치와 미제공 구분 |
| AC-MAP-04 | 계층/개념/import/type 범례와 실행 추적 오인 방지 |
| AC-MAP-05 | 참고 탐색 방식 적용, 기존 구조 ID·WWW 용어 유지 |
| AC-MAP-06 | 대형 지도 내부 탐색·상세 닫기·화면 왕복·채팅 보존 |

검증 경로는 기존 `npm run check`(구조/소스/워크플로/타입/테스트/빌드), 해당 집중 테스트, `node scripts/verify-chat.ts`, `node scripts/verify-native-activity.ts --ui-only`, `node scripts/verify-architecture.ts`다. 실제 Native 관측은 `bun run test/verify-native-activity-live.ts` 등 기존 경로와 인증·사용량을 별도로 확인한다. 테스트 runner와 필요한 파일 존재를 먼저 확인하고 경고·타입·테스트를 억제하지 않는다.

장애 주입은 임시 쓰기/rename 전후 강제 종료, dirty/clean·2초 timeout, JSON/checksum/scope/version 오류, ENOSPC·권한·용량, 중복·역순·terminal 충돌·연결 seq reset·지연 snapshot·프로젝트 전환 중 사건을 포함한다. PROBE/단위 테스트는 실제 사용자 userData·대화와 분리한다. 실제 앱 재시작을 renderer 재마운트로 대체하지 않는다. 한국어 IME·Windows 실기·모션·접근성과 실제 Native 미실행은 분리 보고한다.

## 합의 검토와 남은 게이트

최초 검토의 프로세스 writer·thread Hook·전환 커밋 지적을 revision 3에서 반영했다. 두 번째 Architect는 CLEAR/APPROVE, 이후 순차 Critic은 OKAY이며 변경분과 범위 확대 여부를 확인했다. 부모가 각 파일 SHA와 같은 revision 바인딩·21개 원문 보존을 확인했다.

- Architect 회차2 SHA256: `0960c8c75b97e4144759a422a10d24325b13fe13307773e5e32afdaf76ebf227`.
- Critic 회차2 SHA256: `dbeee66c51150ce3cb310433cb9a76eaf60cc222934e6a40d7613bf77ec93103`.

합의 후 중요 의도 변화는 없고 추가 사용자 질문도 없다. 원래 `artifact:ui-spec`, `surface:chat`, `surface:status`, `surface:projects`, `surface:node-map`, `integration:reference`, `constraint:preserve`를 모두 유지한다. 팀·공유·권한·클라우드·실행 추적/계획 지도·미니맵/코드이력 전체 복제·원문 장기 보관은 추가하지 않는다.

native 계획 합의는 WWW 공유 core의 필수 Opus 검토를 대신하지 않는다. 실제 공유 검토 실행 결과는 검증 기록/보고서에 남긴다. 이 문서를 작성한 것으로 제품 UI·Native·영속화 시험이 통과한 것은 아니며 실제 구현·현행 정본 반영·done 판정은 별도 권한과 증거가 필요하다.
