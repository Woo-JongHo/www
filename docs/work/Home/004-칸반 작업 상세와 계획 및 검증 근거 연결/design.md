# 칸반 작업 상세 연결 설계

## 책임과 데이터 흐름

기존 `DashboardView`의 카드 선택 → 안정된 renderer 조회 함수 → `WwwApi.dashboardWork(selection, projectKey, workId)` → 기존 `dashboard:get` IPC의 선택적 상세 요청 → main의 등록 프로젝트 판별 → `readDashboardWork` → 같은 작업 폴더 문서 읽기 → 선택이 유효할 때 상세 표시 순서다.

새 IPC 채널이나 별도 작업 DB를 만들지 않는다. 기존 session/selection 검사를 await 전후에 유지한다. 조회로 Native 프로세스를 시작하거나 작업 원장·Git·thread 상태를 쓰지 않는다.

## 모듈 소유

| 경계 | 소유 코드 | 책임 |
|---|---|---|
| 정본 | 기존 작업별 work.json·spec.md·tasks.md·verification.md | 기준·시나리오·계획·실제 결과 |
| 안전 읽기 | src/dashboard.ts | UUID 유일성·고정 문서명·범위·파일 교체·크기·UTF-8 검사 |
| 프로세스 연결 | src/shared.ts·preload.ts·native-session.ts | 명시 타입과 승인 범위의 요청 전달 |
| 화면 연결 | src/renderer.tsx | 현재 선택에 묶인 안정된 callback |
| 상세 표시 | src/dashboard-view.tsx·dashboard.css | 기준·문서·로딩·오류·재시도·초점·읽기 보존 |

`DashboardWorkDetail`은 허용된 요약 필드와 기준, 네 문서만 전달한다. 요청 원문·권한 객체·사적 실행 로그를 통째로 renderer에 전달하지 않는다. Markdown은 HTML과 활성 링크·이미지를 실행하지 않는 표시로 제한한다.

## 상태와 실패

상세 조회 없음·조회 중·읽기 성공·조회 실패를 구분한다. 같은 UUID의 재조회에는 이전 자료를 유지하되 갱신 상태를 표시한다. 다른 카드 선택·닫기·범위 변경은 요청 순번으로 늦은 응답을 무효화한다. 원장 접근 실패는 상세 조회 오류이며 개별 문서 누락·읽기 실패는 다른 문서와 기준을 보존한다.

기준의 passed는 원장에 기록된 결과다. 현재 소스 적용성은 이 경로에서 계산하지 않으므로 미평가로 표시한다. 다음 단계가 없으면 미제공으로 두고 임의 실행 상태를 만들지 않는다. 주기 갱신과 문서별 읽기는 전역 원자 snapshot을 보장하지 않는다.

## 검증과 통합

구체 여정은 spec.md의 UC-01~09, 작업별 실행 순서는 tasks.md에 둔다. backend/SSR 검사는 파일 범위·부정 입력·문서 보존·안전 렌더를, 실제 Electron은 카드 선택→IPC→본문→재조회→닫기와 키보드·좁은 화면을 확인한다. 주입 응답으로 구성한 경합과 실제 파일 읽기는 구분해 기록한다.

전체 저작은 부모 typed 하네스의 단일 쓰기 범위에서 진행하고 끝에 소스를 동결한 뒤 strict 타입·소스 정책·공식 구조 생성을 검사한다. BoxBox mode off는 disabled로 기록한다. 저작 프로세스 주입과 실제 협업 모델 호출, 행동 테스트와 독립 승인은 각각 별도 근거다.
