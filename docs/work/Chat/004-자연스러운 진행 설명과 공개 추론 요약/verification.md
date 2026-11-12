# 검증 기록

## 로컬 프로토콜 확인

codex-cli 0.167.2에서 `codex app-server generate-json-schema --out /tmp/www-chat-public-schema-20261112`를 실행했다. ThreadStartParams.developerInstructions와 TurnStartParams.summary의 detailed, 공개 요약 알림의 threadId·turnId·itemId·summaryIndex·delta 필드를 확인했다. 공식 문서 https://learn.chatgpt.com/docs/app-server 에서 summaryTextDelta와 raw textDelta의 구분도 대조했다.

## 실제 Native 읽기 전용 표본

로컬 codex app-server의 일시적 read-only 스레드에서 실제 nativeThreadStartParams·nativeTurnStartParams를 사용했다. 테스트 폴더의 notes.md를 확인하고 없으면 README.md를 읽는 요청을 보냈다. sandbox는 read-only, approvalPolicy는 never로 제한했고 기본 모델·추론 노력은 바꾸지 않았다. thread/start 응답의 설정 모델은 gpt-6.1-sol이며 모든 추론 요청의 실행 모델 관측으로 확대하지 않는다.

Native는 한국어 commentary와 summaryTextDelta 1개, 최종 답변을 제공하고 정상 종료했다. project 결과에서 commentary·reasoningSummary가 각각 별도 explanation으로 남았고 streaming은 false였다. 요약은 “지침을 확인합니다.”라는 짧은 공개 문장이었다. 명령은 notes.md 존재 여부를 조건문으로 검사한 뒤 README.md를 읽었으며 종료 코드 0이었다. 따라서 실제 실패 명령 이후의 설명 빈도나 장기 작업의 상세함을 확인한 표본은 아니다.

정제한 원본은 `.www/evidence/work-17ba7e7d-64e2-4450-b637-2c5f1c7ce0b2/native-sample.json`에 보관한다. 원문 reasoning·도구 출력은 보고서에 복제하지 않았다. 이 표본은 구현 도중 수행했으며 최종 소스 전체의 통과 근거는 아래 실제 검증 시도와 구분한다.

## 실제 Electron 화면 관측

새 코드가 포함된 dist/renderer.js 빌드(2026-11-12 16:05:26 KST)와 fake-app-server.ts를 사용해 별도 Electron 프로필 `/tmp/www-chat-summary-ui-20261112`를 실행했다. CUA로 한국어 요청을 붙여넣고 보내기 버튼을 눌렀다. 화면을 위로 스크롤해 공개 요약과 공개 commentary 본문을 직접 확인했다.

- 가시 화면에서 Native 공개 설명·단계 라벨 없이 두 설명의 본문만 표시됐다. fixture 본문의 “fixture 공개 추론 요약:”은 합성 입력 내용이며 UI가 붙인 라벨이 아니다.
- 접근성 트리에서는 Native 공개 추론 요약과 Native 공개 설명이라는 이름으로 각각 구분됐다.
- 같은 화면에 명령 실행·실패·파일 변경·승인 대기와 오른쪽 활동 패널이 표시됐다.
- PRIVATE_REASONING_SENTINEL은 접근성 트리의 채팅 본문에 없었다.
- 한국어 붙여넣기·전송을 확인했다. 실제 한국어 IME 조합 입력 전체나 Windows 실기는 검사하지 않았다.

CUA 화면과 접근성 출력은 이 세션 도구 결과에 남는다. 별도 스크린샷 파일은 저장하지 않았다. 구현 도중 빌드의 관측이므로 이후 소스 변경이 있으면 적용 범위를 다시 판단한다. 기능의 자동 회귀 검사·최종 타입·빌드·독립 감사는 아래에 실제 결과로 연결한다.

## 통합 보완과 실제 실패 표본

기존 activity fixture는 공개 summary와 private content 모두에 PRIVATE_REASONING_DO_NOT_RENDER를 넣고 있었다. 공개 summary를 허용한 변경에 맞춰 summary만 실제 공개 한국어 요약으로 바꾸고 private content의 sentinel 및 UI 원문 미노출 검사는 유지했다. 소스 문자열을 비교하던 배선 검사는 실제 fixture subprocess·JsonRpcClient·project를 통과하는 통합 검사로 교체했다. 보완 후 집중 테스트 86개가 통과했다.

설명 지침에 관찰한 사실과 추정의 구분, 다음 행동의 근거와 예상 결과를 중요한 시점에 2~4문장 정도로 설명하도록 추가했다. 짧은 작업을 불필요하게 늘리지 않는다는 조건은 유지했다.

실제 Native의 두 번째 읽기 전용 표본에서는 cat notes.md가 종료 코드 1로 실패했고 그 뒤 별도 cat README.md가 종료 코드 0으로 성공했다. Native는 시작 시 한국어 commentary와 최종 답변을 제공했지만 이 표본에서는 실패 직후 추가 commentary나 공개 요약을 제공하지 않았다. 따라서 모든 실패의 중간 설명이나 일정한 설명 빈도를 보장한다고 보고하지 않는다. 결과는 `.www/evidence/work-17ba7e7d-64e2-4450-b637-2c5f1c7ce0b2/native-failure-sample.json`에 보관한다.

## 공식 저작 하네스와 BoxBox 한계

공식 node scripts/workflow.ts의 www-build를 두 번 실제 Codex 호스트로 실행했다. 요청 모델은 gpt-6.1-sol이며 어댑터의 실제 관측 모델은 null이므로 요청값을 실행 모델 관측으로 쓰지 않는다. 호스트는 두 번 모두 정상 종료했고 guide·사전 검사 컨텍스트를 수용해 코드와 검사를 수행했다. 첫 실행은 집중 테스트 85개·타입·소스 정책·빌드 통과, 두 번째는 통합 보완 후 집중 테스트 86개 통과를 보고했다.

저작 호스트의 정상 종료와 하네스 통과는 다르다. 두 실행의 harness.ok는 false다. 첫 실행에서는 병행 작업의 scripts/verify-eight-items.ts와 tsconfig 변경도 감지했고, 두 실행 모두 BoxBox의 FIXABLE 또는 REFUSE가 남았다. 승인되지 않은 형태를 align·formatter·수동 공백 수정으로 우회하지 않았다. 이 미해결 사항은 기능 테스트 통과로 덮어쓰지 않고 최종 작업 상태에 차단 사유로 남긴다.

실행 전문은 `.www/evidence/work-17ba7e7d-64e2-4450-b637-2c5f1c7ce0b2/`의 하네스 영수증에서 eventId `chat-public-summary-build-1`과 `chat-public-summary-fix-2`로 식별한다. 최상위 하네스 결과는 로컬 /tmp/www-chat-build-20261112.json과 /tmp/www-chat-fix-20261112.json에도 보존한다.

## 최종 소스의 회귀·빌드와 Electron 확인

집중 검사·타입·소스 정책·빌드는 모두 같은 소스 digest `05c8f923f5ae1ad373c6f3e3d4e83bd7c1d4924264b8616f9fe2223057ca63b7`에서 실제 자식 프로세스로 통과했고 검사 중 입력 유지가 확인됐다. 각 자동 시도의 정의와 결과는 아래 attempt 섹션과 work.json에 연결한다.

최종 보완 후 `node scripts/verify-native-activity.ts --ui-only`를 별도로 실행해 종료 코드 0과 result passed를 확인했다. 이 명령 자체는 전체 타입 검사를 실행하지 않아 typecheck는 not_run이며, 위 별도 타입 검사 통과와 구분한다. 실제 Electron+합성 Native에서 두 턴 구분·Skill 읽기·동기 Hook·사용량 중복 억제·모델 전환·과거 턴 선택 유지·원문 미노출이 통과했다. 좁은 패널 340px에서 overflow false, 모션 축소에서 beaconAnimation none이었다.

증거는 `.www/evidence/native-activity-BINdE8/summary.json`, `electron-chat.png`, `activity-narrow.png`에 있다. 최종 electron-chat.png를 직접 열어 공개 요약과 commentary가 본문으로 표시되고 기존 명령·실패·활동·입력 초안이 함께 남는 것을 확인했다. fixture 본문의 공개 요약이라는 표현은 테스트 데이터이며 UI가 붙인 고정 라벨은 아니다. 실제 Native·모델·Windows 실기는 이 합성 GUI 검사의 범위가 아니다.

## 독립 Opus 감사와 반환 상태

공유 review core의 실제 읽기 전용 감사 `review-122ebbfc-0b5e-4b01-ba9b-a1df18d4c759`가 pass를 반환했다. 요청 모델은 opus, 실제 관측 모델은 claude-opus-5-5이며 대체 모델은 사용하지 않았다. 실행 종료 코드 0과 영수증 `.www/evidence/reviews/review-122ebbfc-0b5e-4b01-ba9b-a1df18d4c759/opus.json`을 확인했다. 감사는 파일을 읽어 판정했으며 테스트를 직접 실행한 것으로 쓰지 않는다.

감사는 AC-1~AC-3의 구현·검증 근거를 수용했다. 비차단 의견으로 이전 소스의 검증 요약에 남은 현재 적용 가능 문구, BoxBox 미해결과 blockedReason null의 불일치를 지적했다. 이전 증거를 삭제하지 않고 당시 통과라는 문구로 바로잡았고, work.json에 BoxBox 차단을 기록했다. 최종 소스의 기능 검사 통과와 감사 pass는 유지하되 전체 작업을 done으로 승격하지 않는다.

현재 반환 상태는 기능 구현·검사·감사 통과, BoxBox 미해결로 전체 완료 보류다. 실제 Native의 모든 실패 설명 빈도·모든 모델 호환성과 Windows·한국어 IME 실기는 미확인이다. 이 한계를 근거 없는 fallback이나 가짜 통과로 대체하지 않는다.

<a id="attempt-50e5eaf8-4399-4172-bf71-ca7c004088a5"></a>
## 검증 시도 — 2026-11-12T07:11:38.005Z

- 시도 ID: `attempt-50e5eaf8-4399-4172-bf71-ca7c004088a5`
- 실행 시각: 2026-11-12T07:11:36.962Z ~ 2026-11-12T07:11:38.005Z
- 명령과 인자: `["<USER_HOME>/.bun/bin/bun","test","test/projection.test.ts","test/native-chat.test.ts","test/native-activity.test.ts","test/input.test.ts","test/native-report-input.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/fake-app-server.ts`, `test/native-chat.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `e95f927da76f0233bbbc15ec256c594c1926160a8c308b698751336eec660a9f`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 9327바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-85ffa423-0d53-4492-b205-dc570a985162"></a>
## 검증 시도 — 2026-11-12T07:12:25.706Z

- 시도 ID: `attempt-85ffa423-0d53-4492-b205-dc570a985162`
- 실행 시각: 2026-11-12T07:11:36.809Z ~ 2026-11-12T07:12:25.706Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","typecheck"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/fake-app-server.ts`, `test/native-chat.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `e95f927da76f0233bbbc15ec256c594c1926160a8c308b698751336eec660a9f`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 76바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-7655d366-45e1-41dd-9a00-3a8f36e7bdb9"></a>
## 검증 시도 — 2026-11-12T07:17:50.924Z

- 시도 ID: `attempt-7655d366-45e1-41dd-9a00-3a8f36e7bdb9`
- 실행 시각: 2026-11-12T07:17:48.747Z ~ 2026-11-12T07:17:50.924Z
- 명령과 인자: `["<USER_HOME>/.bun/bin/bun","test","test/projection.test.ts","test/native-chat.test.ts","test/native-activity.test.ts","test/input.test.ts","test/native-report-input.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/input.ts`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/activity-app-server.ts`, `test/fixtures/fake-app-server.ts`, `test/input.test.ts`, `test/native-activity.test.ts`, `test/native-chat.test.ts`, `test/native-report-input.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `05c8f923f5ae1ad373c6f3e3d4e83bd7c1d4924264b8616f9fe2223057ca63b7`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 9429바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-438d245b-5ce3-49f2-bfbc-668435185655"></a>
## 검증 시도 — 2026-11-12T07:17:52.096Z

- 시도 ID: `attempt-438d245b-5ce3-49f2-bfbc-668435185655`
- 실행 시각: 2026-11-12T07:17:48.597Z ~ 2026-11-12T07:17:52.096Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","build"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/input.ts`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/activity-app-server.ts`, `test/fixtures/fake-app-server.ts`, `test/input.test.ts`, `test/native-activity.test.ts`, `test/native-chat.test.ts`, `test/native-report-input.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `05c8f923f5ae1ad373c6f3e3d4e83bd7c1d4924264b8616f9fe2223057ca63b7`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 86바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-96852d0a-7a77-4fce-a706-21908bfd682b"></a>
## 검증 시도 — 2026-11-12T07:18:13.251Z

- 시도 ID: `attempt-96852d0a-7a77-4fce-a706-21908bfd682b`
- 실행 시각: 2026-11-12T07:17:48.597Z ~ 2026-11-12T07:18:13.251Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","check:source"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/input.ts`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/activity-app-server.ts`, `test/fixtures/fake-app-server.ts`, `test/input.test.ts`, `test/native-activity.test.ts`, `test/native-chat.test.ts`, `test/native-report-input.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `05c8f923f5ae1ad373c6f3e3d4e83bd7c1d4924264b8616f9fe2223057ca63b7`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 118바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-de3c6f80-848b-46a9-aa00-815170cb10cd"></a>
## 검증 시도 — 2026-11-12T07:19:18.235Z

- 시도 ID: `attempt-de3c6f80-848b-46a9-aa00-815170cb10cd`
- 실행 시각: 2026-11-12T07:17:48.597Z ~ 2026-11-12T07:19:18.235Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","typecheck"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `package.json`, `src/input.ts`, `src/main.ts`, `src/native-activity.ts`, `src/native-chat.ts`, `src/native-report-input.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/rpc.ts`, `src/shared.ts`, `test/fixtures/activity-app-server.ts`, `test/fixtures/fake-app-server.ts`, `test/input.test.ts`, `test/native-activity.test.ts`, `test/native-chat.test.ts`, `test/native-report-input.test.ts`, `test/projection.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `05c8f923f5ae1ad373c6f3e3d4e83bd7c1d4924264b8616f9fe2223057ca63b7`
- 기준 정의 식별: `e75249ba0eefaf305d5c4a12a3345d82c9560bd26f43400a0a34911254183023`
- 검증 중 소스 유지: 확인
- 출력: stdout 76바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
