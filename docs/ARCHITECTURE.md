# WWW 아키텍처

## 범위와 읽는 방법

이 문서는 제품의 실행 구조와 WWW를 개발하는 프로세스의 연결을 설명한다. [제품 기준](PRODUCT.md)은 목적과 범위, [Chat 명세](specs/chat.md)는 의도된 동작, [공통 계약](skills/WORKFLOW.md)은 작업·권한·증거·완료 규칙을 소유한다. 코드에 존재하는 구조와 새 개발 경로의 검증 상태를 구분해서 읽는다.

## 제품 실행 구조

```text
사용자
  → React 화면
  → context-isolated preload / 허용된 IPC
  → Electron main
  → JSONL / JSON-RPC 전송
  → 로컬 codex app-server
  → 응답·알림·서버 요청
  → 사건 투영
  → 대화·실행·파일·승인 화면
```

| 모듈 | 책임과 소유 상태 |
|---|---|
| `src/main.ts` | 앱·Native 프로세스 생명주기, 작업 폴더, 사건 순번, 미결 승인과 응답 시도, 검증된 IPC |
| `src/native-chat.ts` | 새 스레드의 한국어 진행 설명 지침과 기존 cwd·승인·sandbox를 보존하는 params, 턴의 text 입력·detailed 공개 요약 요청 |
| `src/rpc.ts` | JSONL 프레임과 JSON-RPC 요청 ID, 대기 응답, EOF·오류 처리 |
| `src/preload.ts`, `src/shared.ts` | renderer에 노출하는 제한된 인터페이스와 공유 계약 |
| `src/projection.ts` | 관찰 사건을 thread/turn/item/request에 연결하고 화면 블록·상태로 바꾸는 순수 투영 |
| `src/native-activity.ts` | 같은 사건을 답변 턴·활동·모델 관측·누적 토큰과 안전한 턴 차분·계정 한도로 바꾸는 순수 투영 |
| `src/activity-sidebar.ts` | 등록 Skills·Hooks snapshot과 구조화된 읽기·동기 Hook 시작을 고정 행·pulse로 바꾸고 thread/run/중복 경계를 지키는 순수 투영 |
| `src/native-activity-view.tsx`, `src/native-activity.css` | 오른쪽 최소 활동 패널, 행 반응·연결 상태·부분 목록·모션 축소 표시 |
| `src/renderer.tsx` | 입력 초안·전송 중 상태·펼침·읽기 위치와 화면 표현 |

renderer는 Node 기능을 직접 사용하지 않는다. 권한 있는 동작은 main의 허용된 IPC를 통한다. Native의 응답과 도구 출력은 관찰 데이터이며 권한을 확대하는 지시로 해석하지 않는다.

## 요청·사건·실패 흐름

Native 활동 패널은 기존 대화 투영과 같은 AppEvent를 읽는다. renderer가 제한된 IPC로 목록 새로고침을 요청하면 main은 같은 app-server 연결에서 `skills/list`와 `hooks/list`를 독립 호출하고 cwd·필수 배열·항목 shape를 검증한 최소 메타데이터를 `activity/skillsListed`·`activity/hooksListed` 사건으로 게시한다. `skills/changed`는 Skills 재조회 신호이며 스레드 시작 뒤에는 선택 환경을 포함한 Hook 목록을 다시 읽는다. workspace·thread별 최신 요청 세대는 요청을 시작할 때 main이 교체하고 응답 게시 전에 다시 대조하므로, 새 요청이 대기하거나 실패한 동안에도 이전 응답을 수용하지 않는다. 선택 thread 목록은 workspace 목록보다 우선한다. 한 목록의 실패가 다른 목록을 숨기지 않고 부분 응답은 전체 목록으로 표현하지 않는다.

실제 app-server 초기화 성공만 transport 연결 세대를 증가시킨다. 대화 복원·새 대화는 `transport/status`로 현재 표시 상태와 같은 연결 세대를 전달하므로 채팅 투영의 연결 표시는 유지하면서 사이드바의 연결 수명주기 중복 방지를 지우지 않는다. 사이드바는 단조 증가 AppEvent seq를 scalar high-water mark로 압축한다. Skill 읽기와 Hook run key는 연결 세대별 실제 문자열 집합으로 정확히 보존하며, 해시는 고정 64개 bucket을 고르는 용도로만 쓴다. reducer update마다 wrapper와 bucket 배열을 한 번 복사하고 변경된 bucket의 `Set`만 copy-on-write하므로 이전 React state를 변경하지 않으면서 전체 집합 복사를 피한다. 이 필수 상태는 연결 세대의 고유 key 수에 비례해 증가하고 실제 새 연결에서만 회수한다. 관측·pulse·thread 목록 cache는 각각 512·512·32개로 제한한다.

등록 목록과 새 활동은 다른 입력이다. 최신 목록 snapshot은 최근 2,000개 AppEvent ring과 독립한 renderer 상태로 유지한다. Skill은 등록 path와 구조화된 `commandActions.read`의 `SKILL.md` path가 일치할 때 읽기 시작에서 반응하며 한 commandActions의 여러 읽기를 각각 보존한다. Hook은 event name·source path·display order·handler type의 단일 일치와 run ID를 사용하며 시작에서만 반응한다. 읽기와 run 중복 억제는 연결 수명주기 상태라 이력 절단으로 풀리지 않고 완료 뒤 늦은 시작도 막으며, 새 `transport/connected`에서만 초기화한다. renderer는 bootstrap·대화 전환마다 snapshot 경계를 시작하고 그동안의 live 사건을 큐에 둔다. snapshot과 큐를 seq로 병합하고 snapshot에 실제 포함된 사건은 복원으로, 큐에만 있는 live 사건은 snapshot 최대 seq보다 낮아도 새 pulse로 적용한다. 실패 때도 큐를 현재 thread에 배출한다. 경계 token은 취소된 StrictMode effect나 이전 전환 응답이 새 경계를 drain하지 못하게 한다. reducer는 일반 사건 watermark보다 오래된 catalog·transport 사건도 요청/연결 세대와 별도 lifecycle watermark가 최신일 때 안전하게 수용하되 최신 catalog나 연결 상태를 역행시키지 않는다. 매핑이 없거나 불명확하면 감지 행으로 분리하고 기존 행을 추정해 켜지 않는다.

`native-activity.ts`의 답변 턴·모델·사용량 투영은 기존 의미 경계와 검사에서 유지되지만 기본 사이드바의 표시 입력은 아니다. tokenUsage.total은 스레드 누적 snapshot이고 last는 최근 모델 요청의 사용량이다. 새 스레드 영점 또는 안전한 이전 턴 누적값을 확보했을 때만 턴 차분을 제공하며 기준 누락·감소·절단·늦은 이전 턴 갱신으로 정합성이 깨지면 미제공으로 둔다. 모델 설정과 model/rerouted 관측, 턴 토큰과 계정 quota bucket은 서로 다른 상태다. 비공개 reasoning 본문과 Hook 내부 출력은 활동 상태로 복제하지 않는다. 실제 화면 검증·감사 상태는 해당 작업 증거를 따른다.

대화 투영은 공개 commentary·계획과 reasoning의 공개 summary를 시간순 explanation으로 표시한다. 요약 상태는 thread/turn/item별 Map과 섹션 index로 분리하며 빈 섹션 알림으로 희소 배열을 만들지 않는다. seq 중복을 억제하고 완료 summary snapshot으로 대체하며 턴 종료·EOF 뒤 델타는 다시 열지 않는다. 원문 reasoning content·textDelta·analysis는 제외한다. 요약은 앞 32,768 UTF-16 코드 단위로 제한하고 renderer가 절단 안내와 출처별 접근성 이름을 제공한다. 본문 앞의 고정 출처 라벨은 붙이지 않는다. 자동 보고서의 최종 answer 선택 경로는 유지한다.

main은 Native와 초기화한 뒤 스레드·턴 시작, 턴 중단, 지원되는 승인 응답을 전달한다. 문자열·숫자 JSON-RPC ID를 보존하고, 승인 응답 시도는 main에서 중복을 구분한다. 요청 전달 결과가 불명확하면 변경 명령을 자동 재전송하지 않는다.

전송 연결, 요청 전송·접수, 턴 실행·종료, 중단 요청·접수·최종 결과, 승인 응답은 별도 상태로 다룬다. Native loop 종료나 명령 종료 코드 0을 업무 수용으로 승격하지 않는다. EOF 이후 대기 요청은 불확실한 실패로 끝내고 실행 중 사건은 관측 가능한 범위에서 결과 미확인으로 표시한다.

제품 사건은 메모리에서 최근 2,000개, 명령·변경 출력은 현재 코드의 제한 범위만 보관한다. 절단과 미제공을 표시하며 확보하지 않은 원본을 복원 가능하다고 약속하지 않는다. 장기 보관·공유 원본과 서버 색인은 [후속 제품 방향](PRODUCT.md#후속-방향)이다.

## 개발 프로세스 구조

```text
사용자 요청 / 작업 재개
  → WWW 개발 역할의 요청·맥락·권한 판단
  → 기존 작업 식별 또는 최소 신규 등록
  → 필요한 스킬 선택
  → 저작 단계이면 typed 진입점의 작성 계획·소스 정책·타입·BoxBox 사전 검사
  → 개발 호스트에서 실행
  → 저작 단계의 사후 검사와 검사 중 소스·설정 지문 유지 확인
  → 검증 시도의 소스·기준·결과 연결
  → 현행 정본의 문서 영향 검토 기록
  → 현재 증거·문서 검토·최종 감사의 적용 가능성 확인
  → 현행 문서·작업 상태 갱신과 다음 행동 인계
```

에이전트가 자연어 요청의 의미와 필요한 단계를 판단한다. 코드가 작업 식별·허용 경로·기준 정의·실행 결과·증거 연결의 형식을 확인한다. 역할과 스킬마다 별도 프로세스를 의무 생성하지 않는다.

| 위치 | 책임 |
|---|---|
| `AGENTS.md` | 저장소 규율과 WWW 개발 역할을 읽는 진입 조건 |
| `agents/www/AGENT.md` | 요청 분류, 맥락 선택, 접수·재개, 스킬 선택, 권한 승계, 실패·완료 인계 판단 |
| `skills/www/` | 명세·설계·구현·진단·검증·커밋 각 단계의 수행 절차 |
| `docs/skills/templates/` | 사람이 읽는 산출물의 항목과 표현 |
| `scripts/workflow/` | 작업 접수·기록, 단계 선택 확인, 실행 전 조건, 호스트 연결, 증거 적용성 확인 |

현재 새 개발 경로의 구현·실측 상태는 [작업 목차](work/INDEX.md)의 해당 Workflow 작업과 검증 기록에서 확인한다. 역할 파일이나 어댑터 파일이 존재한다는 사실만으로 호스트 수용을 완료로 판단하지 않는다.

현재 구현의 책임 분리는 다음과 같다. 단계의 의미는 역할이 결정하고 코드 모듈은 아래 인터페이스를 통해 연결 조건을 확인한다.

| 모듈 | 책임 |
|---|---|
| `scripts/workflow.ts` | 공식 저작 진입점, 쓰기·삭제 계획과 전후 소스/타입/BoxBox 검사를 기존 실행부에 연결 |
| `scripts/source-policy.ts` | 새 JavaScript 금지, legacy·과거 실험 해시 동결, strict 프로젝트 범위와 타입 우회 지시문 확인 |
| `work.ts` | 신규 접수·기존 UUID 조회, 상태·다음 행동, 실제 검증 연결, 현재 적용성·재개·완료 판단 |
| `route.ts` | 직접 선택과 역할 선택, 요청·작업 상태·권한에 맞는 단계 확인 |
| `preflight.ts` | 실행 시작 전 저장소·브랜치·HEAD·전체 dirty 내용과 경로·변경 표면 확인 |
| `evidence.ts` | 구현 후 검사 입력·기준·실행 환경 식별, 실제 검사와 현재 증거 적용성 |
| `documentation.ts` | 필수 현행 문서 범위·검토 판단의 형식과 소스·기준·문서 지문 적용성 확인 |
| `review.ts` | 프로젝트 정책 읽기, 검토 모델 선택·오류 분류·결과의 현재 적용성 확인 |
| `run.ts`, `adapters/` | 선택한 단계와 호스트·검사 실행을 연결 |
| `record.ts` | 로컬 runtime 사건의 순서·멱등성·재생과 실행 상태 |
| `types.ts` | 작업·기준·권한과 현행·과거 작업의 공용 TypeScript 계약 |
| `scripts/test.ts` | 이관한 Node 테스트와 기존 Bun 테스트를 각 실행기로 연결 |

새 schema2 작업은 작업 상태와 AC 정의·결과 외에 `workflow`에서 역할·접수 식별·요청 해시·권한·검사 입력·다음 행동·검증 및 검토 시도를 연결한다. 구체 필드 의미는 [공통 계약](skills/WORKFLOW.md#workjson-규칙), CLI는 [개발 안내](DEVELOPMENT.md#개발-역할의-작업-인터페이스)가 소유한다.

## 작업과 검증의 저장 경계

| 자료 | 소유 정보 |
|---|---|
| 작업의 `work.json` | UUID, 상태, 수용 기준 정의·결과, 현행 기능 요구 참조와 증거 연결 |
| 작업의 `spec.md` | 이번 변경의 배경·목표·포함/제외 범위·시나리오와 수용 기준 ID |
| 작업의 `design.md`, `tasks.md` | 필요한 설계와 구현 단위·다음 행동 |
| 작업의 `verification.md` | 각 시도의 명령·관찰·한계와 정제한 증거 요약 |
| `.www/runtime/` | 로컬 실행 사건과 재생 가능한 실행 상태 |
| `.www/evidence/` | Git에 넣지 않는 민감 원본과 큰 실행 자료 |

실행 상태의 종료와 작업 수용 완료를 구분한다. 로컬 runtime 파일이 없어도 공유 작업 기록에서 목표·현재 기준·기존 권한의 근거·미완료·다음 행동을 찾아야 한다. 실행 이력만으로 새로운 권한을 만들지 않는다.

문서 영향 검토도 공유 완료 core가 확인한다. 최종 감사의 소스 식별에는 검사 입력과 검토 대상 정본을 함께 넣는다. 따라서 검사 입력 밖의 정본이 바뀌면 문서 검토·최종 감사를 다시 적용해야 하지만 무관한 제품 검사 증거는 보존할 수 있다. 의미 판단과 형식 검사의 경계는 [문서 영향 검토 계약](skills/WORKFLOW.md#문서-영향-검토)을 따른다.

검증 시도는 구현 후 검사 대상 코드·테스트·설정과 기준 정의를 식별한다. 실행 전 세션 binding은 다른 작업 트리에서의 오실행을 확인하는 자료이며, 검증 시점의 소스 식별을 대신하지 않는다. 관련 변경 후 증거의 적용성을 다시 판단하고 과거 시도는 보존한다. 세부 계약은 [검증 증거의 적용성](skills/WORKFLOW.md#검증-증거의-적용성)을 따른다.

## 기존 실행부와 새 호스트 연결

기존 개발 하네스는 GJC 비대화형 CLI에 스킬 본문을 context로 전달하는 opt-in 경로다. native Skill invoke나 OS sandbox, 모든 쓰기의 hard gate를 제공한다고 보지 않는다. 기존 경로를 유지하면서 WWW 개발 역할에 맞춘 접수·재개·증거 연결과 Codex 호스트 경로를 정비한다.

Codex 경로의 역할 로딩·일반 요청·같은 작업의 재개는 실제 호스트에서 검증해야 한다. fixture subprocess 검증은 계약과 실패 경로의 증거이고 실제 모델의 행동과 구분한다. 관측할 수 없는 모델·호스트 메타데이터는 미확인으로 남긴다.

## 교차검증과 훅의 책임

공통 계약이 검토 조건·미실행 처리, WWW 개발 역할이 검토 준비·실행·원문 회수, 검토 어댑터가 공유 정책에 따른 읽기 전용 호출, 완료 판단이 증거·필수 검토 충족을 맡는다. 정확한 모델·대체 조건은 `agents/www/review-policy.json`, 실행과 판정은 `scripts/workflow/review.ts`가 소유한다. 앱과 CLI는 같은 파일과 core를 사용한다.

앱은 권한 있는 프로세스에서 배포된 정책을 읽고 renderer에 제한된 결과만 노출한다. renderer가 임의 정책 경로나 모델·대체 조건을 주입하는 구조로 만들지 않는다. 적용 범위는 WWW 개발 역할이며 모든 제품 Chat 요청을 자동 감사하는 기능과 구분한다. 패키징 때 정책 파일과 core의 실재·로딩을 확인하고 실행 결과가 완료 판단에 수용되는지 검증해야 한다.

현재 연결은 개발 역할이 이행하는 절차이며 자동 훅의 설치·발화를 전제하지 않는다. 훅을 추후 연결하면 트리거 역할만 맡기고 실제 호스트의 결과 수용을 별도로 확인한다. 책임과 미실행 규칙은 [공통 계약](skills/WORKFLOW.md#독립-검토의-책임)을 따른다.

모듈 책임·상태 소유·프로세스·외부 연결이 달라질 때 이 문서를 갱신한다. 실행 환경과 명령은 [개발 안내](DEVELOPMENT.md), 개별 변경의 판단과 과거 소스 검증은 작업 기록에서 찾는다.

## 코드 설계도와 생태계 안내

scripts/generate-architecture.ts는 TypeScript compiler API로 현재 src와 개발 workflow 핵심 모듈의 참조·파일·행·원문·내용 해시를 추출한다. build.ts는 번들 전에 결정적인 src/architecture.generated.json을 생성하며 추출 실패를 빌드 실패로 전달한다. src/architecture.ts가 계층·모듈 검색과 참조 탐색·결정적 배치를, src/ecosystem-view.tsx와 src/ecosystem.css가 계층 개요·모듈 상세와 직각 방향 연결을 표현한다. 모듈 보기에서는 선택한 모듈의 직접 참조만 연결선으로 보여 준다. 계층·역할 이름은 수동 분류이고 타입 전용 참조는 값·혼합 참조와 구분한다.

src/ecosystem.ts의 정적 노드·방향 관계·후속 방향은 별도 생태계 안내에 보존한다. renderer는 대화 DOM을 유지한 채 화면을 전환하며 기존 IPC 권한과 Native 실행 경로를 확장하지 않는다. 이 지도는 실시간 실행 그래프나 서버 색인 결과가 아니다. 구조 변경 시 [코드 설계도](CODE_BLUEPRINT.md), 생성 자료와 [생태계 명세](specs/ecosystem.md)를 함께 검토한다.

## 작업 보고서 저장과 보기

scripts/workflow/reports.ts는 작업별 reports의 불변 JSON·독립 HTML, 안전한 읽기·목록·현재성 비교를 맡는다. report-lifecycle.ts의 검증·검토·완료 훅과 공식 typed 하네스의 종료 훅이 실제 기록을 생성한다. 저작 서술은 report action에서 입력하고 자동 투영과 구분한다.

src/reports-service.ts가 선택 저장소와 report ID만 사용해 읽는다. main의 제한된 reports IPC가 서비스와 저장 대화상자를 소유하며 renderer는 sandbox iframe으로 파생 HTML을 표시한다. 읽기 폴더 선택은 진행 중 Native 작업 폴더를 바꾸지 않는다. 보고서 생성 실패와 핵심 기록 저장은 별도 결과다. 업무 완료 조건과 연결 범위는 [보고서 계약](skills/REPORTS.md)이 소유한다.

Native 자동 보고서는 src/native-report-input.ts의 공개 사건 수집 → src/native-reports.ts의 프로젝트별 중복 억제·직렬 큐 → src/report-judge.ts의 별도 읽기 전용 Codex subprocess → 구조화 보고서 저장으로 연결된다. main이 수명주기와 취소를 소유하며 renderer는 상태·이유·토글·재시도를 제공한다. 원문 재시도 입력은 메모리에만 보관하고 디스크에는 상태 메타데이터만 남긴다. Native 종료는 신규 작업의 수용·검증 결과를 만들지 않는다.

보고서의 선택적인 narrative.reader는 독자용 이야기·요구와 결과·검사 시나리오·주요 결정·목적 있는 자료·해소 행동을 보존한다. 파서는 scripts/workflow/reports.ts가 소유하고 수동 저작·Native 판단·큐가 같은 타입을 보존한다. scripts/workflow/report-view.ts는 안전한 정적 HTML을 생성하며 구형 JSON의 재배치는 원본을 수정하지 않는다. 보고서 현재성과 저장된 검증 이력의 현재 적용성을 같은 판정으로 설명하지 않는다.

## 오픈소스 채팅과 저장 대화 연결

src/conversations.ts는 Native thread/list·read·resume·turns/list 응답을 검증하고 공개 이력을 AppEvent snapshot으로 변환한다. Native가 대화 저장의 원본이며 WWW는 새 메시지 DB를 만들지 않는다. main은 현재 선택·진행 중 턴·승인·전환 guard를 소유하고 preload는 제한된 목록·선택·신규·외부 링크 IPC만 노출한다.

renderer는 thread/cwd별 초안·읽기 위치·따라가기와 logical row 상태를 소유한다. 전환 세대와 사건 seq로 복원 snapshot·전환 중 도착한 live 사건을 병합하며 historical은 liveEvents에서 제외한다. src/chat-row-state.tsx와 chat-state.ts는 Ovis의 행 상태·입력·인용 코드를 개작하고 chat-message.tsx는 react-markdown/GFM을 실제 메시지에 연결한다. 출처·고정 revision·변형은 docs/third-party/ovis.md가 소유한다.

복원은 기존 publish의 실시간 자동보고 경로를 항목마다 재호출하지 않는다. 원문 reasoning·과거 승인 요청은 복원 대상이 아니다. 완전한 snapshot marker와 실제 이력 절단을 구분하며 사용자 전송 결과 불확실을 자동 재전송으로 해결하지 않는다. 재개 정책은 Native 저장 설정을 보존한다.
