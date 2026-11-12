# 검증 기록

## 실제 변경과 관찰 범위

2026-11-12에 실제 Codex 개발 호스트로 같은 작업을 실행했다. 첫 실행은 회귀 검사를 추가한 뒤 `attempt-c1b85ef3-2515-4c17-83bc-f73b1e935bd0`에서 실패했고, 두 번째 실행은 RPC 접수만으로 `acknowledged`로 바꾸던 한 줄을 제거한 뒤 `attempt-3859ce07-31e5-404a-a326-e471de017758`에서 통과했다. 실패 기록은 보존했다. 회귀 검사는 실행 중 접수 응답, 실제 interrupted·정상·실패·미확인 종료, 늦은 응답과 다른 턴의 응답을 구분한다.

이전 대화 없이 저장소 진입점과 이 UUID만 전달한 새 Codex 세션은 과거 통과 이후의 소스 변경을 찾아 공개 API의 `resume → verify → resume/status`를 실제 수행했다. 같은 UUID를 유지했고 검증 시도 수는 2에서 3으로 늘었으며 다음 행동은 `review`였다. 새 작업 생성, 구현 재승인 요청, commit·push는 없었다. 전문은 `.www/scratchpad/www-dev-architecture/fresh-resume-result.json`에 보존했다.

최종 Electron 실행 산출물 `.www/evidence/www-dev-architecture/final-negative/probe.json`에서 실제 렌더링된 중단 버튼은 RPC 접수 후에도 비활성 상태였고 두 번째 클릭을 시도한 뒤 fixture가 관찰한 중단 요청은 1회였다. 실제 interrupted 이벤트 후 종료 표시를 확인했다. 같은 창의 실제 상태·완료 IPC는 현재 검증을 수용하면서도 `필수 독립 검토 없음`만을 이유로 완료를 거부했다. 이는 실제 Electron과 fixture 서버 사이의 관찰이며 실제 Native Codex 승인 경로 전체를 검증한 결과는 아니다.

공통 정책 해시는 `65aa42f0e1108d6bd5851986660b3fc17dd9f116daf9c25c3c72f9eb2cea00a0`이며 앱 응답도 일치했다. 이후 정책·소스·수용 기준의 적용 가능 여부는 완료 시 공통 core가 다시 계산한다. 별도 독립 검토와 완료 결과는 실제 실행 후 추가한다.

## 독립 검토와 실제 완료

실제 읽기 전용 Opus 검토 `review-74fc2b2f-d263-48c8-a9b5-983315625650`는 2026-11-12T01:16:23Z에 `pass`로 끝났고 관측 모델은 `claude-opus-5-5`였다. 현재 소스 `9691695691164b302ee2c9180fc1e1338e1d60efdea7656f8b5afe466634ffbc`와 기준 정의 `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`를 검토했다. 원문은 `.www/evidence/reviews/review-74fc2b2f-d263-48c8-a9b5-983315625650/opus.json`에 있고 `work.json`의 검토 기록이 그 내용 지문을 연결한다. Terra로 대체하지 않았다.

검토자는 접수와 최종 종료 사이의 중복 방지와 회귀 검사의 실제 실패→성공을 확인했다. 접수 단계의 별도 요약 표시와 연결 불확실 후 상태 조합은 후속 검토 후보로 남겼다. 이 작업의 AC는 접수만으로 중단 성공으로 오인하지 않고 중복 요청을 막는 범위다. 새 세션 전문은 이 파일럿 검토 입력에 포함하지 않았으므로 이 검토자가 재개 실행까지 직접 확인했다고 확대하지 않는다. 동시 진행한 Workflow 작업의 renderer·공유 타입·package 변경과 이 버그 수정의 소유 범위를 구분했다.

그 후 실제 Electron 완료 IPC를 실행했다. `.www/evidence/www-dev-architecture/final-positive/probe.json`에는 완료 전 `canComplete: true`, 실제 완료 응답 `status: done`, 재조회 `statusAfter: done`과 `canCompleteAfter: true`가 기록됐다. 완료 성공을 flag나 renderer가 제출한 PASS로 만들지 않고 공통 core의 실제 판정을 사용했다. 같은 실행의 중단 요청 수는 1회이고 최종 상태는 interrupted였다. commit·push는 수행하지 않았다.

<a id="attempt-c1b85ef3-2515-4c17-83bc-f73b1e935bd0"></a>
## 검증 시도 — 2026-11-12T00:44:08.159Z

- 시도 ID: `attempt-c1b85ef3-2515-4c17-83bc-f73b1e935bd0`
- 실행 시각: 2026-11-12T00:44:08.069Z ~ 2026-11-12T00:44:08.159Z
- 명령과 인자: `["bun","test","test/projection.test.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `package-lock.json`, `package.json`, `src/projection.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/projection.test.ts`, `tsconfig.json`
- 소스 식별: `6c0f7df08b8ae8e2d2ce6f304ed8c38e50a703678f86d99f8cfc269db22acfc2`
- 기준 정의 식별: `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 11160바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-3859ce07-31e5-404a-a326-e471de017758"></a>
## 검증 시도 — 2026-11-12T00:45:47.681Z

- 시도 ID: `attempt-3859ce07-31e5-404a-a326-e471de017758`
- 실행 시각: 2026-11-12T00:45:47.552Z ~ 2026-11-12T00:45:47.681Z
- 명령과 인자: `["bun","test","test/projection.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `package-lock.json`, `package.json`, `src/projection.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/projection.test.ts`, `tsconfig.json`
- 소스 식별: `fac153904ebbdd07cf627972013e9c2d3f274e4b2ee04d486abc844442243b56`
- 기준 정의 식별: `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 3101바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-55cc8e67-fdea-4ca6-bf9e-e5ac004a9677"></a>
## 검증 시도 — 2026-11-12T00:49:47.864Z

- 시도 ID: `attempt-55cc8e67-fdea-4ca6-bf9e-e5ac004a9677`
- 실행 시각: 2026-11-12T00:49:47.701Z ~ 2026-11-12T00:49:47.864Z
- 명령과 인자: `["bun","test","test/projection.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `package-lock.json`, `package.json`, `src/projection.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/projection.test.ts`, `tsconfig.json`
- 소스 식별: `250b535c8a6e66ad84e03b2a993ba570fe4251ccad10619ee8e8136c927eedab`
- 기준 정의 식별: `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 3074바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-fbe6fcbe-9e9f-44f7-b723-31323dddfaae"></a>
## 검증 시도 — 2026-11-12T00:56:21.949Z

- 시도 ID: `attempt-fbe6fcbe-9e9f-44f7-b723-31323dddfaae`
- 실행 시각: 2026-11-12T00:56:21.769Z ~ 2026-11-12T00:56:21.949Z
- 명령과 인자: `["bun","test","test/projection.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `docs/specs/chat.md`, `package-lock.json`, `package.json`, `src/projection.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/projection.test.ts`, `tsconfig.json`
- 소스 식별: `d30ed99db4168811e4e59809fe6d9615acfed2f4625bd8459583ff79631d8b38`
- 기준 정의 식별: `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 3065바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-ff875fe7-5a93-4942-8586-3a0a4cdb1097"></a>
## 검증 시도 — 2026-11-12T01:12:31.321Z

- 시도 ID: `attempt-ff875fe7-5a93-4942-8586-3a0a4cdb1097`
- 실행 시각: 2026-11-12T01:12:31.029Z ~ 2026-11-12T01:12:31.321Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/projection.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `docs/specs/chat.md`, `package-lock.json`, `package.json`, `src/projection.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/projection.test.ts`, `tsconfig.json`
- 소스 식별: `9691695691164b302ee2c9180fc1e1338e1d60efdea7656f8b5afe466634ffbc`
- 기준 정의 식별: `c8ae71b6600f9bb5778281db43b21e6c9245628a5afa064c9f92babb044fd4b5`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 3074바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

