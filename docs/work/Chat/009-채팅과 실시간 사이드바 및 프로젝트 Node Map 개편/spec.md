# 채팅과 실시간 사이드바 및 프로젝트 Node Map 개편

작업 UUID: `work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b`

## 요청과 목적

사용자와 확정한 채팅 독립 스크롤, 실시간 상태/대화별 누적 리소스, 로컬 프로젝트 탐색, Node Map 개편 명세를 WWW 작업 체계에 등록했다. 이후 사용자의 “고”에 따라 [합의 설계](design.md)와 [구현 단위](tasks.md)를 작성했다. 사용자는 해당 최종 계획의 구조화 승인에서 `Approve execution via ultragoal`을 선택했고 같은 UUID로 P1 구현·검증을 시작했다. 제품·작업의 완료 여부는 현재 work.json과 verification.md로 판단한다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

사용자는 긴 채팅에서 화면 전체가 내려가는 버그를 보고하고, Skills 목록이 지나치게 많은 사이드바를 진행 확인 용도로 개편하며, Figma의 프로젝트 관리·아이콘과 Obsidian 모티브의 Node Map을 참고하도록 요청했다. 인터뷰에서 범위·해석·최종 목표 문장을 확정한 뒤 “이 명세를 gjcd에 말고 실제 우리 Www 시스템에도 만들어줘”라고 등록을 요청했다.

이 문서와 [작업 레코드](work.json)만으로 요구와 수용 기준을 확인할 수 있다. GJC 설치나 숨김 세션 파일은 재개에 필수인 의존성이 아니다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

### 채팅 독립 스크롤

긴 답변·연속 메시지에서도 대화 영역 내부에서 스크롤하고 입력창과 앱 프레임은 화면 안에 유지한다. 코드·URL·표의 넘침도 해당 영역에 가둔다. 과거 내용을 읽는 중 새 출력이 와도 읽기 위치를 빼앗지 않으며, 최신을 따라가는 경우에는 새 내용·레이아웃 변경 후에도 끝 위치를 유지한다. 모니터를 열고 닫거나 창 크기를 바꿔도 입력과 대화에 접근할 수 있어야 한다.

시나리오 연결: `AC-CHAT-01`부터 `AC-CHAT-04`.

### 실시간 사이드바와 상세 모니터

상단에는 현재 단계와 지금 수행 중인 작업을 체크리스트 같은 UI로 표시하고, 실제 Skill·Hook 호출이 관측되면 이름·상태를 즉시 알아볼 수 있게 반영한다. 설치된 전체 Skills 목록을 기본 화면에 나열하는 방식은 바꾼다.

하단에는 실제 사용 리소스를 보기 좋게 정리해 **대화(thread) 단위로 누적**한다. 같은 대화의 후속 질문에도 계속 쌓고 앱 재시작 후에도 같은 대화의 기록을 읽는다. 다른 대화·프로젝트와 섞지 않으며 중복 전달·복원으로 이중 계산하지 않는다. 과거 기록을 현재 호출 반응으로 재생하지 않는다.

체크리스트·호출·상태는 실제 관측 자료만 사용한다. 미제공·누락·불완전 이력은 명시하고 대화 내용으로 실행·성공을 추정하지 않는다. 문서 읽기와 실제 실행도 구분한다. 저장 실패·손상을 숨기지 않는다.

상세 흐름·이벤트와 필요한 전체 카탈로그는 사이드바와 분리된 상세 모니터에서 확인한다. 상세 조회로 초안이나 읽기 위치를 잃지 않아야 한다.

시나리오 연결: `AC-STATUS-01`부터 `AC-STATUS-07`.

### Figma를 참고한 프로젝트 탐색

로컬 최근 프로젝트·즐겨찾기·프로젝트별 대화를 구분하고, 일관된 선형 아이콘·선택 강조·간격·타이포그래피로 탐색 계층을 읽기 쉽게 만든다. 프로젝트 탐색과 현재 실행 상태는 역할을 구분한다. 프로젝트 전환 시 해당 프로젝트의 대화만 연결하고 기존 실행·승인 중 전환 보호와 저장 대화 재개를 보존한다. 아이콘에는 접근 가능한 이름과 키보드 포커스를 제공한다.

시나리오 연결: `AC-PROJECT-01`부터 `AC-PROJECT-04`.

### Node Map

기존 카드 배너 중심 화면을 **제품 기능 → 처리 흐름 → 담당 코드**를 읽는 관계 지도 중심으로 개편한다. 연결선·검색·확대/축소·이동·선택 상세가 필수다. 선택 상세에서 역할과 담당 파일·코드 근거를 확인하고, 큰 지도도 앱 전체를 밀어내지 않고 내부에서 탐색한다.

지도는 제품 구조를 이해하는 공간이지 실시간 실행 추적이나 할 일·계획 관리 화면이 아니다. 개념적 처리 관계와 실제 실행 순서·호출 추적을 구분하고, 코드 의존 관계를 함께 표시하면 관계 유형을 구별한다. 없는 연결·근거를 만들어내지 않는다. 참고 HTML의 계층·연결·선택 상세를 모티브로 삼되 RPA의 Process·Task·Unit 용어를 WWW에 억지로 적용하지 않는다.

시나리오 연결: `AC-MAP-01`부터 `AC-MAP-06`.

### 제외 범위

- 팀·공유·권한·클라우드 프로젝트 서비스와 Figma 전체 서비스의 복제.
- 참고 HTML의 미니맵·코드 변경 이력·판단 상세 탭 전체 복제는 필수가 아니다.
- Node Map을 실행 추적 시스템 또는 계획/Roadmap 관리 도구로 바꾸는 작업.
- 미관측 정보로 단계·호출·성공을 추정하는 동작.
- 이번 명세 등록을 근거로 한 제품 소스 변경·커밋·push.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `AC-CHAT-01`, `AC-CHAT-02`, `AC-CHAT-03`, `AC-CHAT-04`, `AC-STATUS-01`, `AC-STATUS-02`, `AC-STATUS-03`, `AC-STATUS-04`, `AC-STATUS-05`, `AC-STATUS-06`, `AC-STATUS-07`, `AC-PROJECT-01`, `AC-PROJECT-02`, `AC-PROJECT-03`, `AC-PROJECT-04`, `AC-MAP-01`, `AC-MAP-02`, `AC-MAP-03`, `AC-MAP-04`, `AC-MAP-05`, `AC-MAP-06`.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.

21개 기준은 원래 확정 명세에서 같은 ID·설명으로 등록했으며 모두 `unverified`다. 명세 등록을 제품 테스트 통과로 바꾸지 않는다. 현재 제공 동작과 이번 개편 목표를 구분하기 위해 [Chat 명세](../../../specs/chat.md)와 [아키텍처 명세](../../../specs/architecture.md)는 아직 변경하지 않는다.

| 주제 | 사용자 확정 결정 |
|---|---|
| 지도 대상 | 제품 기능 → 처리 흐름 → 담당 코드 |
| 지도 조작 | 연결선·검색·확대/축소·이동·선택 상세 |
| 사이드바 상단 | 현재 작업 체크리스트·실제 Skill/Hook 호출 |
| 사이드바 하단 | 실제 사용 리소스의 대화별 누적 |
| 세션 식별과 수명 | 대화(thread) 단위이며 앱 재시작 후에도 보존 |
| 미관측 자료 | 추정하지 않고 누락을 명시 |
| 프로젝트 UI | 로컬 최근 프로젝트·즐겨찾기·프로젝트별 대화 |
| 상세 모니터 | 실시간 사이드바와 별도 분리 |

요구사항의 중요한 미결정 사항은 없다. 화면 배치·좁은 창 대응, 저장 형식·용량·중복·손상 처리와 Native 복원 책임, 지도 정본·데이터 연결은 [합의 설계](design.md)에 구체화했다. 스크롤 실제 원인은 구현 승인 후 P1 재현으로 확인한다. 설계 합의를 제품 구현이나 테스트 통과로 바꾸지 않는다.

## 관련 구현과 검증 시나리오

- `src/renderer.tsx`, `src/index.html`, `src/chat.css`: 앱 프레임·대화·모니터. 스크롤 원인은 아직 실행 재현으로 확정하지 않았다.
- `src/activity-sidebar.ts`, `src/native-activity.ts`: 카탈로그·관측·계획 단계·활동 상태.
- `src/conversations.ts`: 대화 복원·식별 경계. 리소스 영속화의 합의 계약은 design.md에 있으며 제품 적용은 아직 하지 않았다.
- `src/ecosystem-view.tsx`, `src/architecture.ts`, `src/architecture-tree.ts`: 기존 지도·책임 구조·파일·역할·간선.
- `scripts/verify-chat.ts`, `scripts/verify-architecture.ts`: 구현 뒤 활용할 기존 GUI 검증 경로. 이번 등록에서 실행한 것으로 주장하지 않는다.

구현 후 긴 대화·코드·창 크기·모니터 토글·읽기 위치, 단계 변경·호출·누락·중복·대화 격리, 재시작 후 누적 복원·손상, 프로젝트 탐색, 지도 검색·줌/이동·선택 상세를 검증한다. 집중 테스트·타입 검사·빌드와 실제 GUI 증거를 구분하고 TypeScript·BoxBox·독립 검토는 저장소 계약을 따른다.

## 참고 자료와 한계

사용자의 읽기 전용 탐색 허용으로 SSH `chacada`의 `/mnt/c/Users/woo/woo/00_project/05_GMBKOREA/RPA/rpa-NODE-MAP/rpa-NODE-MAP.html`을 확인했다. 과제 탐색, Task 안 Unit, 연결 지도·목록, 검색·확대/이동·미니맵과 업무·판단·코드/이력 상세를 참고한다. 원격 파일은 수정하지 않았고 브라우저 시각 검증은 수행하지 않았다. Figma 특정 파일·캡처는 제공받지 않아 확정된 탐색 원칙을 참고한다.

원래 인터뷰 기록: `.gjc/_session-01a1d728-f356-755f-995a-cb761f2a24ad/specs/deep-interview-www-ui-node-map.md`. 최종 모호성 평가는 3.65%였으며 이는 요구 명확성의 보조 기록이지 제품 검증이나 독립 Opus 승인이 아니다. 이 숨김 파일이 없어도 WWW 명세와 작업 레코드로 요구를 확인할 수 있다.

## 요청에서 받은 권한

명세 등록과 합의 설계에 이어 사용자는 최종 계획 SHA256 `4caecc67c5624053b2965412a273db364389c47c5537a1be59fb9a60bc6e02c6`의 구조화 gate에서 `Approve execution via ultragoal`을 선택했다. 같은 작업의 P1~P6 구현·검증 권한이며 기계 레코드에는 현재 실행 단위의 정확한 파일·표면·검사 명령을 연결한다. commit·publish는 계속 false이고, 별도 승인이 필요한 BoxBox convention·align·formatter 권한을 자동으로 만들지 않는다. 기존 `main`의 예상하지 못한 변경과 원래 인터뷰 파일은 보존한다.

이후 사용자 원문 `boxbox 승인하자 진행해`로 P1의 별도 BoxBox 승인을 받았다. `scripts/verify-chat.ts`의 5개 exact key/9개 선언 그룹만 등록·공식 Align으로 정렬했고 다른 파일·전역·JSON·formatter로 확대하지 않았다. 같은 UUID의 당시 P1 재승인 요청은 `www-ui-boxbox-reapproval-01a1d728`, 원문 SHA256은 `8da55a09bf8fdd3209ac233195a6be16edb75c2d6a6328d95f56a047f7910a98`다. 이전 구조화 구현 승인 식별값과 실패·중지 기록은 보존한다. P1의 공식 작성 하네스와 집중 검증은 재통과했고 원래 순서의 P2~P4를 재개했다. 전체 21개 기준과 최종 독립 검토는 아직 완료하지 않았다.

### 2026-11-15 인계와 두 규칙 직접 승인

사용자는 현재 Codex 세션에서 가제코드 작업의 인계를 요청했고, 두 정확 file/key의 승인 등록·해당 두 파일 공식 Align·전체 검사·Opus 독립 검토 진행 여부를 묻는 질문에 `진행하자.`라고 직접 답했다. 현재 요청 ID는 `www-ui-boxbox-final-two-20261115`, 원문 SHA256은 `43a441a2494516ba603ffdb84254c611f89d15ff07e3e28aa7224345b43a947a`이며 workflow.requestHash와 authorization.requestHash에 같은 값을 연결한다.

승인은 `scripts/workflow.ts`의 `v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon`, `src/architecture-tree.ts`의 `v1|typescript|ObjectLiteralExpression|registration|colon>value>comma` 두 조합에 한정한다. 새 승인 응답 `.boxbox/approvals/chat-final-two-response.json`과 승인 문서 `.boxbox/rules/www-chat-final-two-approved.md` 두 경로를 workflow.authorization.writePaths에 추가했다. 기존 boxbox-rules·boxbox-alignment 표면과 두 TS 파일 권한은 유지한다. 추가 규칙·다른 파일·glob·전역·formatter·설치본 변경으로 확대하지 않는다. project off를 유지하고 commit/publish는 false다.

이전 구현·P1 승인·temporary off 요청과 검증 이력은 삭제하지 않는다. 전환 직전 기계 레코드 전체와 요청/권한 전후 자료를 `.www/handoff-boxbox-20261115/authorization-before-work.json`, `authorization-transition.json`에 보존했고 과거 요청은 당시 이력으로 구분한다. Opus가 지적한 두 새 경로 누락과 오래된 요청 ID/hash는 이 보완으로 수정하며 과거 검토 fail 자체는 보존한다.
