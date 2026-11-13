# Skills와 Hook 활동 사이드바 설계

## 기준선과 재사용

`src/main.ts`는 app-server의 모든 알림을 seq가 있는 `AppEvent`로 수집하고 최근 2,000개를 보관한다. `src/native-activity.ts`는 구조화된 Skill 문서 읽기와 동기 Hook run을 이미 구분한다. 새 사이드바는 이 원시 사건과 경계를 재사용하되, 답변별 계획·사용량·타임라인 투영과는 별도의 작은 목록 투영으로 둔다.

기존 `Chat/003` 작업은 더 넓은 답변 흐름과 사용량을 다루며 현재 `verifying`이다. 이번 작업은 그 레코드를 재개하거나 과거 증거를 승격하지 않고 `relates_to`로 연결한 새 UI 범위다.

## 경계와 데이터 흐름

1. renderer가 시작되면 preload의 최소 IPC로 main에 목록 새로고침을 요청한다.
2. main은 현재 app-server 연결에서 `skills/list({ cwds: [workspace] })`와 `hooks/list({ cwds: [workspace] })`를 각각 호출하고, 경계 검증을 거친 최소 메타데이터만 `activity/skillsListed`, `activity/hooksListed` 사건으로 게시한다. 한 목록의 실패가 다른 목록을 숨기지 않는다.
3. `skills/changed`는 Skills 재조회 신호로만 사용한다. 스레드 생성 뒤에는 `hooks/list({ threadId })`로 선택 환경을 포함한 Hook 목록을 다시 게시한다.
4. 새 순수 투영은 최신 목록 snapshot을 기준 순서로 사용한다. 등록에 없는 구조화 관측은 감지 행으로 뒤에 추가하되 전체 등록 목록처럼 표현하지 않는다.
5. Skill 읽기는 `commandActions`의 `type: read`와 정확한 `SKILL.md` path를 사용한다. 사용자 메시지의 이름·command 문자열 검색은 사용하지 않는다.
6. Hook 시작은 현재 thread의 sync run만 사용한다. `run.id`로 중복과 시작/완료를 묶고, 완료에서 새 반응을 만들지 않는다. 등록 행 매핑은 event/source path/display order/handler type의 단일 일치만 허용한다.
7. renderer는 bootstrap·대화 전환 snapshot 요청 전에 경계를 열고 그동안 실시간 구독으로 받은 사건을 큐에 둔다. snapshot과 대기 live를 seq 순서로 병합해 snapshot cutoff까지는 관측 상태만 복원하고 그 뒤 live만 pulse 입력에 추가한다. 요청 실패 때는 큐를 live로 배출하고, 취소된 경계 token은 새 경계를 drain하지 못한다. 패널은 숨김 전환에도 마운트 상태를 유지한다.

목록 요청 실패나 잘못된·중복 식별자가 있으면 snapshot의 `complete`를 false로 두고 UI 제목을 `감지된 Skills` 또는 `감지된 Hooks`로 바꾼다. 연결 종료는 상단 상태로만 알리고 각 행의 성공·실패를 추정하지 않는다.

## 영향 파일

- `src/main.ts`, `src/preload.ts`, `src/shared.ts`: 목록 요청·검증·최소 IPC와 목록 snapshot 사건.
- `src/activity-sidebar.ts`: 고정 목록, 정확한 매핑, run 중복·순서·thread 경계를 맡는 순수 투영.
- `src/native-activity-view.tsx`, `src/native-activity.css`, `src/renderer.tsx`: 최소 목록 UI, 실시간 pulse와 모션 축소.
- `test/activity-sidebar.test.ts`: 목록·매핑·중복·늦은 시작·다른 thread·복원 경계.
- `test/fixtures/activity-app-server.ts`, `scripts/verify-native-activity.ts`: 실제 Electron과 합성 app-server의 등록 목록·행 반응 확인.
- `docs/specs/chat.md`와 필요 정본: 사용자에게 보이는 새 기본 사이드바와 검증 한계 반영.

## 위험과 검증 전략

- `AC-1`: schema에만 있는 API를 실제 연결처럼 쓰는 위험은 fixture의 실제 JSON-RPC 요청 수신과 가능한 Native 표본으로 구분한다.
- `AC-2`: 이름 언급·문자열 오탐은 순수 투영 negative test로 막는다. 시작과 완료가 같은 행을 두 번 반응시키지 않는지 pulse 목록을 직접 검사한다.
- `AC-3`: path normalization과 Hook 단일 매핑, 목록 식별자 중복, run ID 중복, 완료→늦은 시작, 다른 thread를 독립 사례로 검사한다. 스레드 생성 직후 renderer 상태 갱신보다 사건이 먼저 오는 경우에는 기록된 `thread/configured`를 선택 thread로 사용한다.
- `AC-4`: CSS animation은 행 remount 없이 pulse sequence가 바뀔 때 다시 시작하게 하고, `prefers-reduced-motion`에서 animation을 제거한 computed style을 Electron probe로 확인한다.
- `AC-5`: 기존 대화 초안·선택·승인·중단 검사를 유지하고 좁은 340px 패널의 overflow와 목록 순서를 실제 DOM에서 확인한다. 합성 검사는 실제 Native 전체 동작으로 확대하지 않는다.

## 결정하지 않은 미래 범위

목록 행에서 관련 답변으로 이동하는 상세 연결, 답변별 계획·모델·시간·사용량의 새 배치, 과거 실행 탐색, 영속 저장, 전역 감시와 독립 Skill invoke 신호는 이번 설계에서 정하지 않는다.

## Terra 재검토 보완 설계

### 연결과 복원

main은 app-server `initialize`가 성공할 때만 `connectionGeneration`을 증가시키고 실제 `transport/connected` 사건에 싣는다. 대화 열기·새 대화의 사건 원장을 교체할 때는 현재 상태와 같은 generation을 가진 `transport/status`를 사용한다. 채팅 투영은 이 상태로 연결 표시를 복원하지만 사이드바 reducer는 generation이 바뀌지 않았으므로 읽기·Hook run 중복 방지 상태를 보존한다. fixture는 현재 thread의 Hook 완료 뒤 저장 대화로 전환하고 같은 run의 늦은 시작을 보낸 다음 원래 thread로 돌아와 행이 다시 반응하지 않는 경로를 사용한다.

### 장기 상태 경계

main이 게시하는 seq는 한 프로세스 수명에서 단조 증가하고 renderer 전달도 이 순서를 따른다. reducer는 일반 사건의 모든 seq 집합 대신 마지막 처리 seq 하나만 보존한다. Skill 읽기와 Hook run key는 연결 세대별 실제 문자열 `Set`에 정확히 보존한다. 해시는 고정 64개 bucket을 선택하는 partition 용도뿐이고 판정은 원문 문자열로 하므로 false positive가 없다. update마다 wrapper·bucket 배열을 한 번 복사하고 바뀐 bucket의 `Set`만 copy-on-write해 이전 React state 불변성과 처리 비용을 함께 지킨다. exact 상태는 그 연결 세대의 고유 key 수에 비례해 증가하며, 실제 transport 연결 세대가 교체될 때만 회수한다. 같은 연결의 대화 복원에서는 유지한다.

동적 관측과 pulse는 최신 512개, thread Hook catalog는 최신 32개로 제한한다. catalog에서 밀린 thread는 다시 열 때 main이 수행하는 thread scope 목록 요청으로 회복한다. 20,000개 일반 사건으로 scalar watermark를, 20,000개 고유 Hook run을 한 건씩 처리해 모든 새 활동의 반응 수를 직접 세고, 오래된 동일 ID·완료 뒤 늦은 시작을 다시 세지 않는지 확인한다. exact 상태 크기는 고유 key 수라는 필요한 의미로 보고하고 단순 고정 크기를 통과 조건으로 삼지 않는다.

### renderer snapshot 경계

bootstrap과 대화 전환은 `ActivitySnapshotBoundary` token을 먼저 연 뒤 snapshot 요청을 보낸다. 응답이 오면 snapshot과 queued live를 seq로 정렬하고 snapshot 최대 seq까지는 historical로, 그 뒤 live만 pulse 후보로 적용한다. 실패는 큐를 live로 배출한다. cleanup은 자기 token만 취소하므로 StrictMode의 이전 effect나 늦은 전환 응답이 다음 경계를 비우지 못한다. reducer는 일반 사건 watermark보다 늦게 도착한 catalog·transport snapshot도 요청 generation·catalog seq와 connection generation·transport seq가 최신일 때 수용하되 lifecycle을 역행시키지 않는다.

### 목록 요청 최신성

main은 `skills + cwd`, `hooks + cwd + workspace/threadId`를 요청 scope로 사용한다. 요청 시작에서 전역 증가 generation을 해당 scope의 최신값으로 교체하고, 성공·실패 응답 모두 publish 직전에 같은 generation인지 확인한다. 최신 요청이 끝나면 scope entry를 제거하되 이전 요청은 `undefined`와도 불일치하므로 뒤늦게 게시될 수 없다. fixture는 요청 1 보류, 요청 2 시작, 요청 1 stale 응답, 요청 2 지연 실패, 요청 3 복구 순서를 실제 JSON-RPC로 주입한다.
