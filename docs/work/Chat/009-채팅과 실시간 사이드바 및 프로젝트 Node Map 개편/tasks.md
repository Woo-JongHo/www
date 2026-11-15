# 구현 작업

작업 UUID: `work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b`

이 문서는 [design.md](design.md)의 P1~P6 순서와 검증 연결을 추출한 파생 보기다. 독립적인 두 번째 계획이 아니며 새 요구·우선순위·승인을 만들지 않는다. 동일 최종 native 계획 SHA256은 `4caecc67c5624053b2965412a273db364389c47c5537a1be59fb9a60bc6e02c6`이다. 사용자가 동일 계획의 구조화 구현 승인을 선택했다. 현재 상태·수용 기준 정의·결과·권한은 [work.json](work.json)이 정본이다.

## P1: 채팅 스크롤 단독 회귀

- 대상: `src/renderer.tsx`, `src/index.html`, `src/chat.css`, `test/chat-state.test.ts`, `scripts/verify-chat.ts`.
- 진행: G001 중간 완료 checkpoint 수용. 사용자 별도 BoxBox 승인과 공식 Align 후 9개 그룹 PASS, 공식 typed 하네스·집중 테스트·빌드·실제 Electron GUI 재통과. `.www/evidence/chat-ui-Qwj7yJ` 및 verification.md에 현재 증거와 한계를 연결했다. 최종 경계 검토는 G003으로 이연했으며 전체 제품 완료를 의미하지 않는다.
- 긴 대화에서 실제로 body와 내부 컨테이너 중 무엇이 움직이는지 재현하고 DOM 치수·overflow·observer·화면 복귀 경계를 측정한다. 원인을 미리 단정하지 않는다.
- 입력창과 프레임을 화면 안에 유지하고 대화만 스크롤시킨다. 코드·표 넘침은 해당 영역에 가두고 기존 과거 읽기·최신 추종·초안·행 상태를 보존한다.
- 관련 기준: `AC-CHAT-01`, `AC-CHAT-02`, `AC-CHAT-03`, `AC-CHAT-04`.
- 확인: 집중 chat-state 테스트와 `node scripts/verify-chat.ts`의 긴 답변/코드·표/URL/모니터 토글/창 크기/화면 왕복. 1040×680 이상 Native와 999px 이하 renderer 증거를 나눈다.
- 통과 전에는 원장·사이드바 확장을 시작하지 않는다. 같은 가정의 두 번째 수정도 실패하면 세 번째 수정 전에 가정을 직접 측정한다.

## P2: main 관측 원장 수직 절편

- 진행: main의 소유권·원장·정규화·필수 scoped IPC를 실제 연결했다. 저장·프로젝트 집중 테스트 48개와 이후 관련 92개 테스트, 실제 Electron 재시작·동일 profile의 비소유 main 종료·동일 thread 문자열의 프로젝트 격리를 확인했다. 과거 checkpoint 재생·초기 수용·지연 load 유실의 세 결함은 수정 후 독립 advisory CLEAR를 받았다. 최종 cohort/Opus와 전체 기준 수용은 P6에 남긴다.
- 계약 owner 한 명이 `src/main.ts`, `src/shared.ts`, `src/preload.ts`와 필요한 main 전용 원장 모듈을 책임지고 모든 호출부·fixture를 같은 단위로 갱신한다. 기존 관측 파서를 공유하며 범용 저장 프레임워크는 만들지 않는다.
- 격리 userData 설정 뒤 Electron 단일 인스턴스 lock을 획득한 프로세스만 원장·Native·창을 시작한다.
- 관측 하나 → 안정 ID upsert → 원자 JSON → 실제 프로세스 재시작 → 같은 thread 조회까지 끝낸다. 대화 본문·명령출력은 저장하지 않는다.
- turn 없는 안정 thread Hook도 보존하되 현재 요청으로 추정하지 않는다. 시작/완료의 optional ID 차이와 복원에도 같은 관측은 같은 키다.
- 단기 배달 세대/seq와 영속 ID, revision과 durableRevision, 저장 성공과 coverage를 분리한다. 상한·손상·종료·저장 실패는 설계대로 명시한다.
- 관련 기준: `AC-STATUS-03`, `AC-STATUS-04`, `AC-STATUS-05`, `AC-STATUS-06`.
- 확인: 기존 runner에 원장 집중 테스트를 연결한다. 두 main 동시 시작, 중복/역순/terminal 충돌, turn 없는 Hook, optional invocation ID, 연결 seq reset, snapshot/live 경쟁, rename 전후 kill·timeout·ENOSPC·권한·손상·미지원 schema·용량을 주입한다. 실제 사용자 원장/Native 대화는 사용하지 않는다.

## P3: 실시간 사이드바와 상세 모니터

- 진행: 기본 현재 요청/누적 사이드바와 전체 카탈로그를 포함한 상세 모니터를 분리했다. 새 토글을 각각 식별하는 실제 Electron GUI와 기존 활동 UI 검증을 통과했다. 저장된 이력·불안정 Hook 식별·미제공 상태를 현재 성공이나 정확 횟수로 바꾸지 않는다.
- 대상 책임: `src/activity-sidebar.ts`, `src/native-activity.ts`, `src/native-activity-view.tsx`, `src/renderer.tsx` 및 직접 관련 CSS.
- P2 계약을 사용해 상단 현재 요청 계획/호출과 하단 thread 누적을 분리한다. 카탈로그-only 행을 기본 화면에서 제거하고 상세 모니터로 보낸다.
- Native PlanStep·호출·읽기·요청을 구분하고 미제공은 명시한다. 저장 완료 전에도 live를 표시하고 복원 이력을 pulse나 현재 성공으로 재생하지 않는다.
- 상세 모니터를 열어도 채팅 초안·읽기 위치·현재 작업 수집이 유지된다. 좁은 창·키보드·포커스 복귀·reduced-motion을 확인한다.
- 관련 기준: `AC-STATUS-01`부터 `AC-STATUS-07`.
- 확인: 기존 activity-sidebar/native-activity/projection 집중 테스트, `node scripts/verify-native-activity.ts --ui-only`, `node scripts/verify-chat.ts`. 실제 Native Skill/Hook 경로와 합성 fixture를 구분한다.

## P4: 로컬 프로젝트 탐색과 안전한 전환

- 진행: 최근·즐겨찾기·필수 선택 참조·전환 직전 동기 guard를 연결했다. `.www/evidence/chat-ui-6Ja6jx/project-isolation.json`에서 실제 앱 재시작의 즐겨찾기·원장 복원, A/B 동일 thread의 관측 ID·초안 격리, 과거 요청 거부, 승인 중 선택 보전과 비소유 프로세스의 Native 미시작을 확인했다. 모든 OS/실제 모델이나 각 I/O 경합의 완전 탐색을 뜻하지 않는다.
- 대상 책임: main/shared/preload/renderer의 프로젝트 API·탐색과 `src/conversations.ts`의 workspace 소속·복원, 관련 fixture.
- 최근 프로젝트·즐겨찾기·프로젝트별 대화를 표시하고 선형 아이콘·접근 가능한 이름·선택 강조를 적용한다.
- 첫 thread 뒤 영구 차단을 idle 전환으로 교체한다. realpath/flush 준비 후 client 무효화 직전 동기 구간에서 실행·전송·승인을 다시 검사한다. busy가 새로 생겼으면 기존 선택·승인을 보존해 취소한다.
- 성공하면 thread는 null, 이전 model/activity/event/list 상태는 초기화하고 대화 목록에서 명시 재개한다. 이전 client·목록·복원 응답이 새 프로젝트를 건드리지 못하게 한다.
- 관련 기준: `AC-PROJECT-01`, `AC-PROJECT-02`, `AC-PROJECT-03`, `AC-PROJECT-04`, `AC-STATUS-04`, `AC-STATUS-05`, `AC-STATUS-06`.
- 확인: 프로젝트 A→B busy 거절/idle 성공, flush 중 승인·turn 도착, 옛 client 종료/지연 응답, 같은 thread 문자열의 workspace 격리, 원래 대화 복귀와 메모리·원장 복원, favorite 저장 실패와 Native 연결 실패를 분리 검사한다.

## P5: 구조 ID 기반 Node Map

- 진행: 정본 부모·직계 자식의 계층선, 계층/import/type 구분, 개념 source→실제 구조 ID 이동, 기본 접힌 상세·Escape/초점 복귀, 화면·탭 왕복 상태 보존을 구현했다. 15개 구조 테스트/122137 expect와 실제 Electron 지도 검증을 통과했다. 최신 GUI는 `.www/evidence/architecture-Ute7oS/result.json`이며 전체 수용과 구별한다.
- 대상: `src/ecosystem-view.tsx`, `src/ecosystem.css`, `src/architecture.ts`, `src/architecture-tree.ts` 및 해당 구조 테스트.
- 기존 안정 ID의 계층/검색/줌·팬/선택 상세를 지도 중심으로 정리한다. 실제 근거가 필요한 경우 구조 정본·명세를 먼저 바꾸고 기존 생성기를 실행한다. `architecture.generated.json`을 손으로 편집하지 않는다.
- 계층·개념 처리·실제 import·type 관계를 구분하고 없는 처리 근거는 미제공으로 남긴다. 임의 파일 군집이나 가짜 실행 순서로 채우지 않는다.
- 관련 기준: `AC-MAP-01`, `AC-MAP-02`, `AC-MAP-03`, `AC-MAP-04`, `AC-MAP-05`, `AC-MAP-06`.
- 확인: 기존 architecture/tree 테스트, `node scripts/verify-architecture.ts`, 검색→동일 ID/상세·배율·이동·맞춤·키보드·대형 지도·상세 닫기/화면 왕복과 채팅 보존.

## P6: 통합 증거와 독립 검토

- 진행: 조인된 G004 수정으로 미등록 문서의 main 소유 cwd/경로 해시 식별, 실제 실패 scope만 담는 별도 전환 진단, 동명 Hook 핸들러 분리와 기본 사이드바 실제 GUI 검증을 구현했다. generation2에서 새로 발견한 aggregate flush 오귀속도 조인 후 수정했다. flush는 clean/failedScopes 사본을 반환하고 정상 프로젝트에서 재전환해도 다른 프로젝트의 저장 실패를 가로채지 않는다. `.www/evidence/chat-ui-knafX4`에서 기본 사이드바 A→B의 plan/호출·미제공, 두 handler 상태, hash 문서·비노출, 실제 저장 경로 방해→전환·왕복·정확 실패 scope·원장 null, 긴 한국어 탐색 경계·즐겨찾기 키보드를 확인했다. 집중 158개/123076 expect와 strict/build가 통과했다. wait의 Promise 참 오판은 실제 await와 false 음성 회귀로 제거했다. 전체 check의 두 미승인 key와 실제 Opus fail은 해소하지 않았으며 현재 공식 증거·delta 검토·최종 전체 검사·보고서·판정은 verification.md에서 구분한다. 임시 off 해제·승인 확대·테스트 약화·형태 회피는 하지 않는다.
- 앞 단계 회귀를 깨뜨린 채 외형 구현을 우선하지 않는다. 집중 테스트 후 `npm run check`로 구조·소스·워크플로·타입·전체 테스트·빌드를 확인한다.
- TypeScript·strict·BoxBox 공식 작성 경로를 사용하고 모든 직접 영향 호출부·fixture·현행 기능 명세·구조·개발 안내를 갱신한다. 기존 동결 비교 실험은 정책에 따라 다룬다.
- 21개 기준 각각에 실제 시나리오·명령·관측·한계를 연결한다. 합성/실제 Native, renderer/실제 창, OS IME/Windows 실기 미실행을 구분한다.
- WWW 공유 core로 Opus 기본/확인된 quota 소진 때만 Terra 대체 검토를 실행하고 실제 모델과 원문을 회수한다. native 계획 합의로 대체하지 않는다.
- 최종 제품 완료는 적용 가능한 기준 증거·필수 독립 검토·문서 영향 검토·저작 보고서를 충족해야 한다. 실행 프로세스 종료와 업무 수용·게시를 섞지 않는다.

## 재개할 다음 행동

같은 UUID의 work.json에서 현재 권한·기준·증거 적용성을 읽는다. G001/G002는 중간 완료 receipt가 있고 G003/P5 구현·집중 GUI 검증까지 진행됐다. P6의 전체 검사 실패 두 건, 공식 증거 연결·필수 독립 검토·현재 보고서·최종 판정을 이어간다. 제품 코드·테스트·개발 도구를 수정하거나 하네스를 실행하기 전 `docs/DEVELOPMENT.md`의 TypeScript 작성 및 하네스 절을 읽는다. 새 파일·새 key에 기존 BoxBox 승인을 전용하거나 미완료 gate를 완료로 만들지 않는다.

## 2026-11-15 Codex 인계 재개

사용자 `진행하자.`는 직전 두 정확 file/key의 승인 등록과 공식 Align·전체 검사·독립 검토에 대한 직접 승인이다. 새 승인 문서와 실제 응답을 추가하고 기존 원장 bytes를 보존했다. 두 파일의 공식 dry-run·Align·재Align 고정점·source check에서 미정렬/거부0, syntax valid와 줄·들여쓰기 보존을 확인했다. formatter 미실행·project off 유지. 공식 generator로 snapshot을 갱신했다. 첫 전체 검사 영수증은 내부 종료1/sourceStable true였고 원문 미보관으로 원인은 미확정이다. 원문을 남긴 재실행은 Bun778/0·Node147/0·빌드 종료0이었다. GUI·필수 Opus·보고서·최종 수용은 새 증거를 연결해 별도로 판단한다. 원문은 `.www/handoff-boxbox-20261115/`다.

### 현재 권한 연결 보완

Opus review-99f49aea는 승인·정렬 자체는 적절하나 새 승인 두 경로의 writePaths와 최신 requestId/hash 연결 누락을 차단으로 지적했다. 직접 사용자 승인에 따라 같은 UUID의 권한 목록에 두 metadata 경로만 추가하고 현재 요청 ID/hash 및 spec을 일치시켰다. 이전 원장 전체·요청/권한 전후와 과거 fail을 보존했다. 명세/승인 입력이 바뀌므로 기능 증거·문서 영향·Opus를 새 내용 식별에서 재확인한다.

## 2026-11-15 문서와 완료 기록 대조

위 재개 절의 실패·대기는 당시 상태다. 그 뒤 기록된 실제 GUI·Opus·저작 보고서가 연결돼 이번 확인 시작 시 `work.json`은 `done`, status의 `complete`와 `review.usable`은 모두 true였다. 현재 제품에는 채팅 내부 스크롤, 현재 요청/누적 리소스 사이드바, 프로젝트 전환·격리와 책임 단계별 Node Map이 반영돼 있다.

문서 대조에서 구조 명세의 프로젝트·원장 IPC 설명이 아직 후속 단계로 남은 것을 발견해 실제 연결에 맞게 정정했다. 이 명세와 생성 snapshot·현재 진행 문서가 새 입력이므로 과거 완료를 지우지 않고 현행 GUI·문서 영향·독립 검토·저작 보고서를 다시 연결한다. 최신 판정은 재계산한 status와 마지막 보고서로 확인한다. OS 한국어 IME·Windows 실기와 설치 앱 교체·원격 게시는 이번 소스 검증과 별도다.
