# 검증 기록

<a id="attempt-fb01768d-e731-4fc9-8561-f894cd02b53c"></a>
## 검증 시도 — 2026-11-15T12:45:20.220Z

- 시도 ID: `attempt-fb01768d-e731-4fc9-8561-f894cd02b53c`
- 실행 시각: 2026-11-15T12:45:17.647Z ~ 2026-11-15T12:45:20.220Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-review.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-MODEL`, `TERRA-READ`, `TERRA-RECEIPT`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `31433ec15c64efe74837e9d05d8841c2fd5dfd66208528420b5b365e814696cc`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 5705바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-b6da71a4-b559-4280-930c-25a4f1850711"></a>
## 검증 시도 — 2026-11-15T12:48:15.405Z

- 시도 ID: `attempt-b6da71a4-b559-4280-930c-25a4f1850711`
- 실행 시각: 2026-11-15T12:48:15.105Z ~ 2026-11-15T12:48:15.405Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-review.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-MODEL`, `TERRA-READ`, `TERRA-RECEIPT`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `dd918aeae623d58bf0fc614dba245d7ada24fc2c69e7ba939ddd0d448ac87a7e`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 5700바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-96da4f88-8624-4e53-b206-ce9ccc3b10e7"></a>
## 검증 시도 — 2026-11-15T12:49:07.340Z

- 시도 ID: `attempt-96da4f88-8624-4e53-b206-ce9ccc3b10e7`
- 실행 시각: 2026-11-15T12:49:06.972Z ~ 2026-11-15T12:49:07.340Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-review.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-MODEL`, `TERRA-READ`, `TERRA-RECEIPT`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `1f6270d0ad5a9ff17aa2d95842c9e5288d776656da8a2421aa76f39305698c28`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 5701바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 실제 Terra 검토와 수정

첫 새 CLI 실행 review-4105855e-7483-4210-8ec3-8c8e5589300e는 실제 process·관측 모델 gpt-6.1-terra·종료 0으로 FAIL을 반환했다. JSONL 임의 model 필드 수용 결함을 발견해 해당 필드를 관측 근거에서 제외했다. 기존 JSONL 판정 읽기는 유지하고 모델 미관측 영수증은 재검토가 필요하다. .www/gate-live-review.json과 같은 review 디렉터리 opus.json/terra.json에 실제 원문을 보존했다. fixture는 실제 모델 실행으로 세지 않는다.

수정 후 집중 22·통합 41·앱 23 검사가 통과했다. 타입·소스 정책·공식 빌드 통과, UI 작업의 최신 GUI attempt-29ddfd7f-8010-40ca-a7fe-f442072c1761도 통과했다. 로그는 .www/gate-final-*에 보존한다. 과거 source 변경 시도는 현재 증거로 옮기지 않는다.

<a id="attempt-0e2d8081-2120-42ab-97d3-b51d8305b94f"></a>
## 검증 시도 — 2026-11-15T12:51:34.482Z

- 시도 ID: `attempt-0e2d8081-2120-42ab-97d3-b51d8305b94f`
- 실행 시각: 2026-11-15T12:51:34.155Z ~ 2026-11-15T12:51:34.482Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-review.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-MODEL`, `TERRA-READ`, `TERRA-RECEIPT`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `7c398c9a93f7a73b503d1eef003a6658f43cb7d73f28917a643812d798ed8dcc`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 5702바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-154f212b-6b8d-49a8-b0f8-a79207d25aa6"></a>
## 검증 시도 — 2026-11-15T12:53:17.065Z

- 시도 ID: `attempt-154f212b-6b8d-49a8-b0f8-a79207d25aa6`
- 실행 시각: 2026-11-15T12:53:16.630Z ~ 2026-11-15T12:53:17.065Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-review.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-MODEL`, `TERRA-READ`, `TERRA-RECEIPT`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `089a2a8c676266224ea448bfb9abe22413c62e4591c9b3b871b4e23b13b18283`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 5713바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 기존 영수증 호환성의 최종 보완

review-354db954-33bb-4551-ad97-9b7ae26a5ad6의 추가 지적에 따라 기존 JSONL을 모두 모델 미관측으로 바꾸는 중간 수정 대신 최초 thread.started 제어 사건의 thread_id와 선택적 model을 읽는다. 응답·도구 사건의 model은 무시하고 중복·늦은 시작 사건·thread_id 누락을 거부한다. 기존 유효한 시작 메타데이터 fixture는 수용되며 모델 없음/다른 모델 뒤의 가짜 응답 model은 거부된다. 현재 CLI의 모델 없는 JSONL은 여전히 미관측이다. .www/gate-compat-verified.json의 22개 집중 검사와 .www/gate-compat-integration.log의 41개 통합 검사가 통과했다. 실제 live 기준은 최종 현재 소스 검토의 공유 core 수용을 별도 검사할 때만 통과한다.

<a id="attempt-d168fb8a-9f55-44bb-9884-2560e00a04cd"></a>
## 검증 시도 — 2026-11-15T12:54:16.510Z

- 시도 ID: `attempt-d168fb8a-9f55-44bb-9884-2560e00a04cd`
- 실행 시각: 2026-11-15T12:54:16.255Z ~ 2026-11-15T12:54:16.510Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import {assessWork} from \"./scripts/workflow/work.ts\"; const a=await assessWork({workId:\"work-a427c2c5-c900-48d8-b3ca-31e9f1422410\"}); const r=a.record.workflow.reviews.at(-1); const ok=a.review.usable && r?.provider===\"openai\" && r?.observedModel===\"gpt-6.1-terra\" && r?.executor===\"process\" && r?.verdict===\"pass\"; console.log(JSON.stringify({usable:a.review.usable,reasons:a.review.reasons,reviewId:r?.id,provider:r?.provider,observedModel:r?.observedModel,executor:r?.executor,sourceDigest:a.source.digest})); if(!ok)process.exit(1);"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `TERRA-LIVE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `agents/www/review-policy.json`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `scripts/workflow/adapters/windows-command.ts`, `scripts/workflow/review.ts`, `src/architecture.generated.json`, `test/workflow-review.test.ts`
- 소스 식별: `089a2a8c676266224ea448bfb9abe22413c62e4591c9b3b871b4e23b13b18283`
- 기준 정의 식별: `4a8f904ef9bc70cb7dff2a968906c0cd9ae7430c51e104b4c084d2763e2bb75d`
- 검증 중 소스 유지: 확인
- 출력: stdout 241바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 현재 소스 최종 실제 검토

review-0725d0b8-ba59-4b2c-9c4f-602828f8c9f2는 실제 process·읽기 전용·관측 모델 gpt-6.1-terra·종료 0·PASS이며 공유 core가 현재 소스/기준/정책·초기 CLI 헤더·정확 argv·원문 해시·Opus 소진 영수증을 대조해 수용했다. 서버 내부 모델 라우팅의 독립 증명은 아니다. 원문은 .www/evidence/reviews/의 같은 검토 ID 폴더에 보존했다. 이전 FAIL과 중간 검토의 한계를 지우지 않았다. 커밋·push·병합·원본 변경 없이 worktree 결과를 보존한다.
