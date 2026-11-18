# 연구 확인과 남은 검증

## 실제 조사 범위

2026-11-15에 연구 본문의 공식 출처 14개를 열어 확인했다. Figma·VS Code 공식 원문 6개는 독립 수집 에이전트가 읽고 `/private/tmp/www-entry-ui-research/reference-patterns.md`에 전문을 보존했으며, 저자가 이 내용을 읽고 Linear 공식 원문·W3C 지침·현재 WWW 소스 및 문서와 함께 종합했다. 이 에이전트는 최종 감사자가 아니며 연구 수집만 담당했다. 해당 로컬 scratchpad는 공유 가능한 영구 출처가 아니므로 주장별 공식 URL을 연구 본문에 회수했다.

현행 대조 대상은 `src/renderer.tsx`, `src/index.html`, `src/projects.ts`, `src/reports-service.ts`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/design-system.md`, `docs/specs/ecosystem.md`다. TypeScript나 제품 파일은 이번 작업에서 수정하지 않았다.

R1은 공식 패턴 표와 신뢰 한계, R2는 대안 비교·정보 구조·상호작용·상태 소유·너비 규칙, R3는 대표 여정과 열린 결정에 연결한다. 이 연결은 저자의 대응 설명이며 독립 감사 통과나 실행 시험 결과가 아니다. 원장의 기준 결과는 자동으로 통과 처리하지 않았다.

## 문서 구조 확인

- `git diff --check -- docs/work/Home docs/work/INDEX.md`: 출력 없이 exit 0. 공백 오류 검사이며 내용의 타당성 검증이 아니다.
- `node scripts/check-workflow.ts`: exit 0, ‘워크플로 계약 검증 통과: 스킬 6개, 중첩 작업 기록, 목차, 템플릿, 예시’. 기록 형식·참조 검사이며 UX와 연구의 사실성을 증명하지 않는다.
- 연구 본문에서 TODO·test.skip·test.only·자리표시·미구현 패턴 검색은 일치가 없었다. 실제 업무·승인 건수처럼 보일 수 있는 레이아웃 내용은 예시라고 명시했다.

공식 `scripts/workflow.ts`의 action open 호출은 `execute: true` 필요 오류로 접수를 수행하지 않았다. 문서의 action 인터페이스 안내와 실제 저작 실행 경로의 차이를 확인했고, 기존 내부 work API의 open으로 접수 기록만 생성했다. 개발 호스트나 제품 구현을 실행한 것으로 기록하지 않는다.

## 독립 감사 미실행

공유 `scripts/workflow/review.ts` core를 통해 읽기 전용 Opus 감사를 실제 요청했다. 요청 모델은 opus, 대체 실행은 비활성화했다. 검토 입력은 연구 본문과 기준 원장이며, 원문 영수증은 아래 위치다.

- review ID: `review-8c2d1472-1ec0-4cbc-8c78-861a4cf99eae`
- 영수증: `.www/evidence/reviews/review-8c2d1472-1ec0-4cbc-8c78-861a4cf99eae/opus.json`
- source digest: `6d6a6d1b795c995b107e8872267e96ad84a501bb6eb5bb7476ae3788c75ee812`
- exit 1, `verdict: not_run`, `observedModel: null`, modelUsage 비어 있음.
- 관측 오류: `Not logged in · Please run /login`.

모델 검토가 시작됐다는 증거가 없으므로 불합격도 통과도 아닌 미실행이다. 로그인 실패를 사용량 소진으로 분류하지 않고 모델을 낮춰 대체하지 않았다. 필수 감사가 남아 있어 최종 완료를 선언하지 않는다.

## 미실행과 다음 검증

실제 참고 앱 조작, WWW GUI 실행, 시제품 사용성 시험, 운영체제별 단축키·한글 IME·포커스·창 크기·날짜 경계 시험은 실행하지 않았다. 연구의 너비와 동작은 시험 가능한 권고안이며 제품 적용 상태가 아니다. 제품 파일 변경이 없으므로 타입·빌드·제품 테스트를 의례적으로 실행하지 않았다.

다음으로 Opus 인증이 복구되면 같은 연구 입력으로 독립 감사를 재실행한다. 이후 구현 파일럿에서 홈→업무 상세→관련 대화→복귀와 실행 중 승인 도착을 먼저 관찰하고, 연구 본문의 나머지 여정을 확인한다. 연구 기록의 검증 범위를 제품 완성도 통과로 확대하지 않는다.

<a id="attempt-56333c0d-4794-43a1-98a1-5bdedb81ca37"></a>
## 검증 시도 — 2026-11-16T07:47:29.203Z

- 시도 ID: `attempt-56333c0d-4794-43a1-98a1-5bdedb81ca37`
- 실행 시각: 2026-11-16T07:47:28.968Z ~ 2026-11-16T07:47:29.203Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node",".www/evidence/session-completion-20261116/legacy-home001-check.ts","R1"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `R1`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/work/Home/001-업무 진입점과 탐색 구조 연구/research.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/source-review.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/spec.md`, `scripts/workflow/documentation.ts`, `scripts/workflow/evidence.ts`, `scripts/workflow/review.ts`, `scripts/workflow/work.ts`
- 소스 식별: `eb05998d76edbd44b702f378afbf627dbcc8ba4c3a8527da0e0001d10c8aa44d`
- 기준 정의 식별: `380ea7f93cab33195eac378c52d74b1323bfaede315ed1f04dd842c323c79867`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/session-completion-20261116/home001-sources/01.html` (537276바이트, sha256 a73e1ea694a8507054ce3a68eccd0c63ecce62122f2fac48fa4811326f138910), `.www/evidence/session-completion-20261116/home001-sources/02.html` (549369바이트, sha256 be376b9abbbccb763d3601f7b1648c66593a116682ba6923188304c8d6116480), `.www/evidence/session-completion-20261116/home001-sources/03.html` (468160바이트, sha256 00dee097f673cb49e9ae1a47bb1d0304f4bf3a5ffb7015c8837fa98f8c1f3a1a), `.www/evidence/session-completion-20261116/home001-sources/04.html` (625884바이트, sha256 a3a7176c8e08d50084e3188793531341a36913e169a2b125ccffaa5e5655bb2a), `.www/evidence/session-completion-20261116/home001-sources/05.html` (587423바이트, sha256 410f99d51f91e39392267970a2d9aba15624243ae290ede283afa7f7f63bdc06), `.www/evidence/session-completion-20261116/home001-sources/06.html` (579307바이트, sha256 20ca119192c962fe9a2c1e58313271377b87475c196ace87db5e677e440dedb4), `.www/evidence/session-completion-20261116/home001-sources/07.html` (172140바이트, sha256 cd9ba84b973cd0cf17205e4427a35208f10b309fec78e678af8ac1be32a50099), `.www/evidence/session-completion-20261116/home001-sources/08.html` (253111바이트, sha256 76b3a2c1d2a9aee4552855ae307be5733a514a3ce3bc9de6952c97c31ab6a256), `.www/evidence/session-completion-20261116/home001-sources/09.html` (159992바이트, sha256 80e63cc6b0b07b9eab8212fc5e7c20fad75317ff047ab11c113d7dbb10375017), `.www/evidence/session-completion-20261116/home001-sources/10.html` (88421바이트, sha256 afe7dd0ad924612da91bba924b7bc9fb44d4cf9c12300628620c875c67f8f3ce), `.www/evidence/session-completion-20261116/home001-sources/11.html` (78792바이트, sha256 d48ca16d14e86d60f5d6ec75cf40aebfbe2a72c8882c3d68c4463f96e301aa84), `.www/evidence/session-completion-20261116/home001-sources/12.html` (73710바이트, sha256 332e44da566733c332a8b8ab25cfcbaac00aba3667165444fcb68db0c92ab2a1), `.www/evidence/session-completion-20261116/home001-sources/13.html` (43147바이트, sha256 f1835e5ee280329a4fb0e188114f711ea8d0260445052de53c3c82c78edc6d74), `.www/evidence/session-completion-20261116/home001-sources/14.html` (66123바이트, sha256 7735697bb0163a9cf05bdfacca9dd7a14cede9a733c7e236afefee8d5c1d1e5b), `.www/evidence/session-completion-20261116/home001-sources/manifest.json` (6265바이트, sha256 51d5454f00205cb3110430fe299549cda98008bf2257d41dceaa3c0d080b6109), `.www/evidence/session-completion-20261116/legacy-home001-check.ts` (2912바이트, sha256 9844c4751c0de747e7e4f8e290a65c7ee6fa16dbdb9658b341fc4ff99bc8e3cb)
- 검증 중 원문 유지: 확인
- 출력: stdout 2398바이트, stderr 496바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-84ef62c4-b35c-448f-84ec-5c03e9947d60"></a>
## 검증 시도 — 2026-11-16T07:47:29.615Z

- 시도 ID: `attempt-84ef62c4-b35c-448f-84ec-5c03e9947d60`
- 실행 시각: 2026-11-16T07:47:29.355Z ~ 2026-11-16T07:47:29.615Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node",".www/evidence/session-completion-20261116/legacy-home001-check.ts","R2"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `R2`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/work/Home/001-업무 진입점과 탐색 구조 연구/research.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/source-review.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/spec.md`, `scripts/workflow/documentation.ts`, `scripts/workflow/evidence.ts`, `scripts/workflow/review.ts`, `scripts/workflow/work.ts`
- 소스 식별: `eb05998d76edbd44b702f378afbf627dbcc8ba4c3a8527da0e0001d10c8aa44d`
- 기준 정의 식별: `380ea7f93cab33195eac378c52d74b1323bfaede315ed1f04dd842c323c79867`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/session-completion-20261116/legacy-home001-check.ts` (2912바이트, sha256 9844c4751c0de747e7e4f8e290a65c7ee6fa16dbdb9658b341fc4ff99bc8e3cb)
- 검증 중 원문 유지: 확인
- 출력: stdout 167바이트, stderr 496바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-a54082b1-4052-431e-b22f-d01784df84ce"></a>
## 검증 시도 — 2026-11-16T07:51:19.779Z

- 시도 ID: `attempt-a54082b1-4052-431e-b22f-d01784df84ce`
- 실행 시각: 2026-11-16T07:51:18.333Z ~ 2026-11-16T07:51:19.779Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node",".www/evidence/session-completion-20261116/legacy-home001-check.ts","R3"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `R3`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/work/Home/001-업무 진입점과 탐색 구조 연구/research.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/source-review.md`, `docs/work/Home/001-업무 진입점과 탐색 구조 연구/spec.md`, `scripts/workflow/documentation.ts`, `scripts/workflow/evidence.ts`, `scripts/workflow/review.ts`, `scripts/workflow/work.ts`
- 소스 식별: `eb05998d76edbd44b702f378afbf627dbcc8ba4c3a8527da0e0001d10c8aa44d`
- 기준 정의 식별: `380ea7f93cab33195eac378c52d74b1323bfaede315ed1f04dd842c323c79867`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/reviews/review-4a47d85d-ba47-4536-9794-2785e1d2bcb1/opus.json` (10791바이트, sha256 86df76232ca68dde5ee10dc95f2c20d500fb134916bdd52ea59082a8bdca68d0), `.www/evidence/session-completion-20261116/legacy-home001-check.ts` (2912바이트, sha256 9844c4751c0de747e7e4f8e290a65c7ee6fa16dbdb9658b341fc4ff99bc8e3cb)
- 검증 중 원문 유지: 확인
- 출력: stdout 99바이트, stderr 496바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 2026-11-16 연구 출처와 독립 검토 재검증

같은 UUID에 직접 요청을 재연결했고 변경 전 원장 bytes는 `history/before-20261116-research-verification.json`에 보존했다. 기존 권한의 제품 구현·게시 금지는 유지한다. 연구 정본·이번 출처 대조·검사 core를 입력으로 추가하고 출처와 문서 내용의 실제 검증 명령을 명시했다. 기존 검사·검토 이력을 대체하지 않는다.

[출처 재대조](source-review.md)에서 14개 공식 문서를 현재 열어 핵심 주장과 WWW 제안을 대조했다. 원문 상태·최종 URL·응답 내용·해시와 revision 헤더는 `.www/evidence/session-completion-20261116/home001-sources/manifest.json`과 같은 폴더에 있다. R1의 `attempt-56333c0d-4794-43a1-98a1-5bdedb81ca37`은 14개 HTTP 상태·원문 해시·링크 일치·각 문서의 핵심어 및 사실/추론 분리 문구를 확인한다. 이것만으로 모든 주장과 제품 동작이 증명되지는 않는다. R2의 `attempt-84ef62c4-b35c-448f-84ec-5c03e9947d60`은 대안·비용과 여정·실패·상태 소유·접근성 등 제안 항목이 연구에 존재하는지 확인하며 실제 사용성 시험을 대신하지 않는다. 원문을 읽은 수동 대조는 별도 표에 남겼다.

`review-4a47d85d-ba47-4536-9794-2785e1d2bcb1`은 실제 읽기 전용 `claude-opus-5-5`의 pass이고 원문은 `.www/evidence/reviews/review-4a47d85d-ba47-4536-9794-2785e1d2bcb1/opus.json`이다. 검토자는 연구·대조 문서와 원문 일부를 읽고 R1/R2 검사 범위를 구분했으며 검증 명령을 대신 실행하지 않았다. 잠금 경합으로 초기 기록이 보류되어 공식 `recover-result`로 같은 원문을 회수했다. R3의 `attempt-a54082b1-4052-431e-b22f-d01784df84ce`는 사용자 여정·열린 결정과 현재 입력에 적용되는 독립 검토를 확인했다.

실제 참고 앱 조작, 사용자 사용성 시험, OS 입력 및 제품 구현 검증은 실행하지 않았다. 이전의 2026-11-15 Opus 로그인 실패는 당시 시도로 보존하고 이번 실제 검토와 구분한다.
