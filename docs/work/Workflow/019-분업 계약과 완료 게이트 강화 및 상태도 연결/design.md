# 설계 — 프로젝트 지도와 검증·완료 흐름 연결

## 기준선과 재사용

이 문서는 다음 구현을 위한 설계안이다. 구현·실측·독립 승인은 아직 수행하지 않았다. 수용 기준의 정본은 [work.json](work.json), 사용자 시나리오와 경계는 [spec.md](spec.md)다.

현재 확인한 재사용점:

- `scripts/workflow/model-allocation.ts`의 `validateModelAllocation`: 단위 모델·입력·권한 배분 검사. 새 분업 검사와 기존 단위 검사 책임을 구별한다.
- `scripts/workflow/evidence.ts`의 `evaluateEvidence`, `work.ts`의 `assessWork`/`completeWork`: 현재 근거 적용성·수용 판단. UI에 별도 완료 규칙을 재작성하지 않는다.
- `scripts/workflow/report-lifecycle.ts`의 `assessReportedWork`/`completeReportedWork`: 보고서까지 포함한 공식 판정. raw 내부 함수와 공식 공개 경로의 차이를 먼저 조사한다.
- `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `src/architecture-tree.ts`: 구조 ID·요구·구현/검증 선언과 생성 snapshot·트리 탐색. 새 책임 트리를 만들지 않는다.
- `src/ecosystem-view.tsx`의 내부 구성/코드 의존 관계 보기, `scripts/verify-architecture.ts`: 지도 통합과 UI 검증의 출발점.
- 기존 `test/workflow-*.test.ts`, `test/architecture-*.test.ts`: 새 기능의 가까운 검증 소유자를 확인한 뒤 확장한다.

## 경계와 데이터 흐름

### 분업과 수용

최소 분업 단위는 ID, 목표, 입력, 소유/제외 경로, 선행 단위, 산출물, 수용 기준 ID, 검증 방법, 결과 위치를 가진다. 같은 계획 안에서 ID·경로 소유·의존 참조·순환을 검사한다. 파일/디렉터리와 실제 경로 판정은 기존 안전 경로 도구를 재사용한다.

의존성은 기존 호스트 실행 의존과 새 수용 조건을 구별한다. 과거 dependency의 의미를 조용히 바꾸지 않는다. 호스트 종료 뒤 단위의 필수 산출물과 검증을 평가하고 `미확인/수용/거부`를 파생한다. 이 결과는 OS 격리나 독립 감사의 대체물이 아니다.

모든 완료 요청은 기존 공유 판정에 연결한다. 새 분업 조건이 필요한 작업만 그 조건을 적용하고, 과거 작업을 일괄 변환하지 않는다. 상태·정책을 wrapper마다 중복 작성하지 않는다.

### 프로젝트 지도

프로젝트 지도는 기존 배치도의 확장이다. 책임 구조 ID를 연결 키로 삼아 다음 정보를 조회한다.

1. 구조: 기존 책임 계층·담당 코드·정적 import.
2. 동작: 선택 책임의 상태 모델·사건·조건·효과·불변식.
3. 근거: 요구/검증 선언과 실제 실행 기록·현재 적용성·반례·스크린샷.

정적 빌드 snapshot과 작업별 동적 검증 기록은 분리한다. snapshot의 테스트 선언을 실제 실행 통과로 해석하지 않는다. 앱에서 실제 기록을 보여줄 때는 승인 프로젝트와 UUID 범위에서 main의 읽기 전용 조회를 사용한다. renderer에 임의 파일 경로나 명령 실행 권한을 주지 않는다. 경로 이탈·symlink·읽기 상한·손상/누락은 기존 안전 읽기 정책과 일치시킨다.

첫 연결은 개발 작업 완료 책임과 이번 기능의 검증 근거로 제한한다. 전체 프로젝트의 기능/테스트 이관이나 일반화한 증거 플랫폼을 만들지 않는다.

### 상태도 계약

모델은 구조 ID·안정 모델/상태/전이/규칙 ID와 실제 소스 근거를 가진다. `work.status`와 검증/검토의 현재성은 별도 축으로 둔다. 실제 완료 허용 판단은 기존 core를 사용하고, 상태 모델은 이를 설명·검사한다.

편집 정의는 한 곳에 두고 화면용 데이터는 생성한다. 제안 저장 위치는 `docs/architecture/statecharts/`이며 기존 구조 계약과 generator에 최소 연결한다. 정확한 포맷은 착수 조사 뒤 확정하되 AST import에서 전이를 추정하지 않는다. 새 범용 DSL이나 두 번째 완료 엔진은 만들지 않는다.

모델과 구현이 분리되면 전이별 대응 함수·행동 테스트·내용 식별을 기록한다. 변경 감지는 재검토 필요를 알리는 것이며 의미 일치를 증명하지 않는다. 잘못된 완료 전이를 넣은 변형에서 검사가 실패하는지 확인한다.

### 검증 결과와 화면 표시

각 근거는 기준/요구 ID, 구조 ID, 검증 시도, 검사 방법, 실제/주입 구분, 소스/기준/모델 식별, 환경, 결과와 미확인 이유, 산출물 참조를 연결한다. 기존 필드를 우선 사용하고 필요한 최소 연결만 추가한다.

`선언만 있음`, `실행 미확인`, `통과`, `실패`, `오래됨`, `자료 없음`을 구별한다. 다른 환경의 성공과 현재 소스의 성공을 섞지 않는다. 상태도 검증과 형식 증명은 별도 표시한다. 스크린샷 원본은 기존 로컬 증거 위치를 사용하고 서버 가용성을 가정하지 않는다.

첫 UI는 기존 지도에 상태 전이 진입과 근거 상세를 추가한다. 거대한 화면 한 곳에 모든 선을 그리지 않는다. 선택·검색·이동·배율과 대화 초안의 기존 수명을 보존한다.

## 영향 파일과 소유 경계

아래는 다음 구현의 예상 경계이며 현재 세션의 쓰기 허가가 아니다. 실제 새 파일명과 소유자는 단위 시작 전 확정한다.

| 담당 | 예상 파일 범위 | 책임 |
|---|---|---|
| Sol 통합 | `scripts/workflow.ts`, `scripts/workflow/{types,schema,model-allocation,run,work,evidence,report-lifecycle}.ts` | 공통 타입·권한·수용/완료 core. 다른 워커 직접 쓰기 제외 |
| Terra 게이트 검사 | `test/workflow-{model-allocation,evidence,work,reports,development}.test.ts` 중 배정 파일 | 고정 결함 사례·정상 대조. 공통 fixture는 별도 단일 소유 |
| Terra 생성 검사 | 제안 `test/workflow-properties.test.ts`와 전용 fixture | seed 기반 속성/모델 검사. 기존 테스트 담당과 파일 분리 |
| Sol 구조 통합 | `scripts/{architecture-contract,generate-architecture,check-architecture}.ts`, `docs/architecture`, `docs/specs/architecture.md` | 상태도·근거 연결 계약과 구조 선언. 생성 JSON은 마지막에 단독 갱신 |
| Terra UI | `src/ecosystem-view.tsx`, `src/ecosystem.css`, 분리한 상태도 뷰와 테스트 | 동결한 인터페이스에 따라 화면 구현. core·generator 쓰기 제외 |
| Sol 앱 연결 | 필요한 경우 `src/{main,preload,shared}.ts` 및 승인 프로젝트의 읽기 서비스 | 실제 검증 근거의 제한된 읽기. 기존 서비스로 충분하면 새 IPC 생략 |
| Sol 문서 통합 | 역할·관련 스킬·개발/구조 안내, 같은 작업 기록 | 한 곳의 규칙을 참조하고 중복 정책을 만들지 않음 |

`package.json`/lockfile과 모든 generated snapshot은 Sol만 소유한다. fast-check 등 속성 검사 의존성은 현재 설치 여부·실행기 호환성을 확인하고 적합한 최소 도구를 택한다. 검증 도구를 명목상 호출하는 것보다 반례 생성·재현 능력을 우선한다.

## 위험과 검증 전략

| 위험 | 기준 | 확인 |
|---|---|---|
| 경로 겹침·순환·호스트 종료의 오수용 | FLOW-PLAN, FLOW-ACCEPT | F01–F03과 정상 단위 대조 |
| 내부 함수 검사만 통과하고 공개 경로는 우회 | FLOW-COMPLETE, FLOW-FAULTS | F04–F11, CLI/앱 공유 core와 실제 진입 배선 대조 |
| 생성기가 중요한 순서를 만들지 못함 | FLOW-PROPERTY | 알려진 오류 변형 탐지, seed·생성 범위·반례 보존 |
| 모델과 코드가 달라짐 | STATE-LINK, STATE-CHECK | 전이 대응과 F12–F14, 구현 재현 |
| 지도에서 선언과 실제 통과를 혼동 | MAP-EVIDENCE | 선언만/현재 통과/과거 통과/누락/다른 환경의 표시 검사 |
| 정적 화면이나 캡처가 실동작을 대체 | STATE-VIEW | 실제 조작·좁은 창·복귀·필수 캡처 직접 확인 |
| 기존 작업과 지도 회귀 | FLOW-REGRESSION | 영향 테스트·strict 타입·빌드·실제 앱 여정 |

## 결정하지 않은 미래 범위

Runtime verification은 사건 누락을 구별하는 오프라인 재생부터 후속 실험한다. 즉시 차단·복구는 별도 권한/실패 정책이 필요하다. TLA+는 동시성·순서 문제, Lean은 작은 핵심의 명제·구현 연결에서 이득이 있을 때 별도 작업으로 결정한다. 이번 기준 통과를 위해 이 도구를 모두 설치하지 않는다.

Pre-production은 패키징 앱의 격리 확인이고 Deploy는 설치/배치, Release는 사용자 노출, Post-release는 공개 후 관찰이다. 실제 공개·운영 테스트는 이번 계획 작성에 포함된 실행 권한이 아니다. 배포 방식·관찰 기간·실패 한도·복구 책임을 정하기 전 운영 실험을 수행하지 않는다.

## 검토와 인계 상태

저작 패스 이후 기준별 연결·링크·스키마의 별도 점검은 수행한다. 의미 검토와 읽기 전용 독립 리뷰/최종 감사는 아직 실행하지 않았다. 다음 메인 세션은 공식 artifact-context에서 spec/consistency 검토를 준비하고 실제 검토 결과를 기록한 뒤 구현을 인계한다. 문서가 있다는 사실을 독립 승인으로 읽지 않는다.
