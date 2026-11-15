# 환경 사전점검 검증

## 격리 저작과 집중 검사

전체 Git 이력을 보유한 clone과 실제 tracked index, 상속 PATH의 codex·Node 22 실행파일을 확인하고 공식 typed 진입점으로 저작을 한 번 실행했다. 실행 executor/toolExecutor는 process다. 요청 모델은 gpt-6.1-sol이고 실제 모델 식별은 observedModel:null로 미확인이다. host는 exit 0, thread.started와 turn.completed가 관측되고 출력 요약 절단은 false다. 새 호스트 재호출과 전체 npm check 반복은 하지 않았다.

- `bun test test/workflow-environment.test.ts`: 8 통과, 0 실패. 환경 상속, 읽기 전용 진단, unknown 설정과 CLI 오류, Git ref/index/얕은 이력, 설치·출력 위치와 파일·심볼릭 링크 경계, 실제 실행 경계 failfast, 1MiB 초과 JSONL·완료·usage, 큰 오류·spool 실패, 일반 프로세스 원문 보존을 검사했다.
- `node --test test/workflow-codex.test.ts test/workflow-development.test.ts test/workflow-harness.test.ts`: 34 통과, 0 실패.
- `npm run typecheck`: 앱과 도구 strict 프로젝트 exit 0.
- `npm run check:source`: TypeScript 124, 기존 JavaScript 0, exit 0.
- 공식 하네스 사후 구조 생성·검사는 통과했다. 저작 중 읽기 전용 구조 검사는 stale을 관측했고 하네스가 공식 생성기로 갱신했다.
- 변경한 여섯 소스에서 TODO, test.skip/test.only, it.skip/it.only, describe.skip/describe.only, not implemented 자리표시를 직접 검색했으며 발견하지 않았다.

전문은 Git 제외 격리 실행의 author-result.json·author-summary.log·author-test.log·author-regression.log·author-typecheck.log·author-source.log에 보존했다. 공유 공개 문서에 사용자 절대경로나 기밀 원문을 넣지 않는다. 각 파일 SHA와 before/after는 로컬 handoff/manifest.json에 보존한다.

## BoxBox 환경 차이

root와 clone의 development.local.json 내용은 동일했지만 공식 런처의 project mode는 root=off, clone=check였다. 양쪽 환경에 BOXBOX 관련 변수는 없었다. 경로별 프로젝트 상태가 새 clone에 승계되지 않은 관측이며 모드나 승인 DB를 변경하지 않았다. 최초 하네스는 check를 context로 수용했고 사후에 syntax valid·REFUSE 0·misaligned 31(기존 run.ts 2 포함)을 관측하여 harness.ok:false와 exit 1이었다. 기능 검사 성공과 이 형식 실패를 분리한다. root 통합에서 기존 명시 off 정책은 disabled로 기록해야 하며 BoxBox PASS로 바꾸지 않는다.

## 로컬 설정 누락과 검사 한계

별도 후보 clone에서 development.local.json 누락으로 구조 생성이 ENOENT였다는 통합 담당 관측을 연결했다. 새 CLI에 누락 설정 경로를 toolPaths로 명시한 실제 probe는 ok:false/installation 실패였다. 기존 typed settings 검사는 같은 누락을 모델 시작 전 차단한다. 신규 진단은 명시한 도구·설정 파일의 실재와 위치를 검사하며 설정 내부의 runtime/cli 경로를 자동 파싱하거나 모든 설치물을 자동 열거하지 않는다. caller는 필요한 Git refs·fullHistory·trackedIndex와 toolPaths를 실제 검증 의존성에 맞게 명시한다.

## 실제 사용량 관측

이번 고유 host 1개의 turn.completed 실제 보고값은 input_tokens=4,115,157, cached_input_tokens=3,996,544, output_tokens=24,973, reasoning_output_tokens=7,878이다. cached는 input에, reasoning은 output에 포함될 수 있으므로 별도 더하지 않는다. 실제 모델명·전체 세션 소비·청구 금액은 미확인이며 절감률이나 금액을 추정하지 않는다.

## 인계와 미실행

현재 기준 결과는 통합 소스의 최종 증거 연결과 독립 검토 전까지 미검증으로 유지한다. Windows 실제 실행·패키징, 제품 GUI, 전체 저장소 검사·앱 빌드·독립 검토는 이 저자 패스에서 미실행이다. 통합 담당이 공유 run.ts의 최신 receipt 변경과 patch를 조정하고 root의 mode off 정책을 유지한 최종 전체 검사 한 번 및 독립 검토를 수행한다. 커밋·게시도 부모만 수행하며 이 기록은 완료 승인이 아니다.

저장소 루트의 17개 JavaScript 설치물 오염을 신규 환경 모듈이 자동 탐지하는 회귀는 제공하지 않았다. 기존 source-policy가 이를 탐지하며, 그 실패를 모델 시작 전 차단에 연결할 추가 배선 필요성은 통합 담당이 판단한다.

verify intent는 기존 verifyWork 분기로 먼저 위임되므로 신규 환경 사전점검을 자동 실행하지 않는다. 이번 실제 배선과 failfast 회귀는 개발 모델 host 실행 경계에 적용된다. 검증 명령 자체의 자동 환경 guard로 확대해 주장하지 않는다.

<a id="attempt-94d16a72-59e6-4478-b1fc-1452611230cf"></a>
## 검증 시도 — 2026-11-15T15:17:10.986Z

- 시도 ID: `attempt-94d16a72-59e6-4478-b1fc-1452611230cf`
- 실행 시각: 2026-11-15T15:14:59.043Z ~ 2026-11-15T15:17:10.986Z
- 명령과 인자: `["/bin/sh","-c","npm run check > .www/final-npmcheck.log 2>&1"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `ENV1`, `ENV2`, `ENV3`
- 소스 HEAD: `92b1b31fc77c9555f83a48a0cf998ad8abd3f5de`
- 검증 입력: `docs/architecture/structure.json`, `package.json`, `scripts/check-environment.ts`, `scripts/source-policy.ts`, `scripts/test.ts`, `scripts/workflow/adapters/codex.ts`, `scripts/workflow/adapters/gjc.ts`, `scripts/workflow/environment.ts`, `scripts/workflow/run.ts`, `source-policy.json`, `test/workflow-environment.test.ts`, `tsconfig.tools.json`
- 소스 식별: `f828b4fff7795ac1d21ea077658fe85aa4e6c76520cad6d7f5625a9a9dd73f9a`
- 기준 정의 식별: `ec83a61df45f44cf7409b18592f6dcd7f9014ed47e618dd18736953cfdbe1410`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 잔여 원인 보강과 추가 저작

첫 시도의 17JS 자동탐지·verify 선언 환경 guard·Node 실행기 등록 누락을 같은 UUID에서 보강했다. source-policy 정본은 읽기 전용으로 재사용했다. 먼저 새 회귀 세 개가 실제 0 통과/3 실패인 red를 관측한 뒤 추가 Sol typed 저작을 한 번 실행했다. 모델 추가 호출 없이 작성한 변경은 다음과 같다.

- 무인자 기본 doctor가 실행파일/PATH, HEAD·전체 이력·tracked index, 로컬 설정 파일, Git 제외 출력과 기존 checkSourcePolicy API를 검사한다. package.json의 npm check 맨 앞에서 항상 실행한다. 새 소스 정책이나 예외·자동 삭제는 만들지 않았다. installer0.js부터 installer16.js까지 루트 오염을 옵션 없이 진단하는 회귀를 확인했다.
- verify intent에서 options.environment를 명시했을 때 선언된 Git/toolPaths와 실제 verifier 실행파일을 검사한다. 실패 시 실제 verifier 카운터 0, 정상 조건에서 1을 관측한다. 환경 선언이 없는 일반 검증은 기존 비Git 작업 계약을 유지한다.
- 환경 Node API 파일을 scripts/test.ts의 Node 목록에 등록하고 실제 Node 하위 프로세스 분류를 확인했다.

추가 실제 host는 exit 0·turn.completed를 관측했다. 요청 모델은 gpt-6.1-sol이고 실제 모델 식별은 null로 미확인이다. sourceStable:true였으나 당시 하네스는 BoxBox와 arch.development.execution→arch.tooling.source-policy 미허용 의존성으로 false였다. summaryTruncated:true, rawOutputTruncated:false이며 원문 stdout 176,580바이트와 stderr 1,169바이트를 spool하고 실제 usage를 별도 회수했다. 추가 usage는 input_tokens=1,207,108, cached_input_tokens=1,123,456, output_tokens=6,462, reasoning_output_tokens=1,658이다. 캐시·추론을 각각 입력·출력에 다시 더하지 않으며 전체 비용을 추정하지 않는다. 전문은 Git 제외 followup-author-result.json과 spool에 보존했다.

## 실제 host 이후 최소 delta와 최종 합성 증거

추가 host가 끝난 뒤 별도 저자 delta로 두 계약을 수정했다. 기존 verifier는 model-only options.env를 전달받지 않고 부모 process.env로 실행하므로 사전진단도 그 실제 환경을 검사한다. 모델용 빈 PATH override를 전달한 성공 회귀에서 verifier가 실제 한 번 실행되는 것을 확인했다. 소스 정책 재사용에 필요한 구조 계약 단일 edge를 추가한 뒤 공식 canonical 생성기로 갱신했다. 이 delta를 실제 모델이 작성·검증했다고 주장하지 않는다.

최종 npm check를 한 번 실행했으나 새 guard가 환경 미선언 비Git 보고서 fixture까지 차단하는 계약 회귀를 발견했다. 기본 doctor·구조·source·workflow·strict 타입까지 통과했고 Bun 850 통과/1 실패 뒤 중단됐다. 실패 전문은 final-npmcheck.log와 같은 UUID의 실패 검증 시도에 보존했다. 이후 options.environment를 명시한 verify에만 guard를 적용하는 최소 수정으로 기존 일반 계약을 복원했다. 기본 npm check의 무인자 doctor는 계속 항상 실행된다.

수정 후 다음 실제 검사를 실행했다. 변경하지 않은 전체 Bun 851개를 다시 수행하거나 npm check exit 0으로 바꾸어 기록하지 않았다.

- 환경·개발 집중 Node 회귀: 18 통과, 0 실패.
- 보고서 수명주기 Bun 회귀: 6 통과, 0 실패. 이전 npm check에서 실패한 실제 CLI 보고서 회귀도 통과했다.
- 기본 실행기의 Node 목록 12파일 전체를 실제 Node로 실행: 177 통과, 0 실패.
- npm run build: exit 0.
- 마지막 소스 변경 후 strict 앱·도구 typecheck와 source 정책: exit 0.
- 구조 계약 단일 edge를 반영한 공식 생성·현재성 확인: 통과.
- 변경 대상의 TODO·skip/only·미구현 자리표시 검색은 발견 없음.

따라서 현재 근거는 이전 Bun 850개 성공과 수정 영향 24개 성공, 최종 Node 전체 177개 성공·빌드·타입·소스·canonical의 합성 증거다. 최종 소스 전체 npm check exit 0을 관측했다고 주장하지 않는다. 마지막 BoxBox 검사는 syntax valid이나 clone check의 형식 미해결을 유지하며 root off 정책과 구분한다. 같은 소스에 대한 불필요한 전체검사·유료 재호출은 하지 않았다.

통합 담당은 이 합성 근거를 검토하고 최신 root 소스에 적용한 뒤 읽기 전용 Terra 검토를 수행한다. 기존 실패 시도와 자기 승인 금지 규칙을 보존하며 완료·게시 여부는 독립 판단으로 남긴다.

## 최종 소스의 실제 Electron 통합 확인

같은 고정 후보에서 node scripts/verify-chat.ts를 추가 한 번 실행해 exit 0, 205개 확인과 result:passed를 관측했다. 실제 Electron DOM·preload IPC·stdio·합성 Native 원장·앱 재시작을 포함한다. 실제 모델·Windows·실제 한국어 IME는 미검증이며 999px 이하 폭은 실제 최소 창보다 작은 합성 CDP viewport다. 원문과 UI 증거는 Git 제외 final-chat.log 및 해당 chat-ui 증거 폴더에 보존했다.

src/scripts/test 전체와 build.ts, package·lock, strict tsconfig, source-policy와 구조 계약을 포함한 관리 코드·설정 140파일의 GUI 전후 source digest는 모두 5b66858df3804f0b5573c983e3a1b4bb01d96ed9cf6358cf7f13f6e78f381224로 동일했다. 파일별 SHA·명령별 exit·합성 범위·고정 입력은 로컬 handoff/manifest.json과 final-source-snapshot.json/final-source-after-gui.json에 보존했다. GUI 성공은 미실행 모델·Windows 검증이나 최종 전체 npm check 성공으로 확대하지 않는다.

<a id="attempt-1de40eb7-5c2c-4762-a998-e8e23d8006f4"></a>
## 검증 시도 — 2026-11-15T15:23:36.090Z

- 시도 ID: `attempt-1de40eb7-5c2c-4762-a998-e8e23d8006f4`
- 실행 시각: 2026-11-15T15:23:30.059Z ~ 2026-11-15T15:23:36.090Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--test","test/workflow-environment.test.ts","test/workflow-development.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `ENV1`, `ENV2`, `ENV3`
- 소스 HEAD: `92b1b31fc77c9555f83a48a0cf998ad8abd3f5de`
- 검증 입력: `docs/architecture/structure.json`, `package.json`, `scripts/check-environment.ts`, `scripts/source-policy.ts`, `scripts/test.ts`, `scripts/workflow/adapters/codex.ts`, `scripts/workflow/adapters/gjc.ts`, `scripts/workflow/environment.ts`, `scripts/workflow/run.ts`, `source-policy.json`, `test/workflow-environment.test.ts`, `tsconfig.tools.json`
- 소스 식별: `d39b41c92684b6b159c21f7f38b3434cec98f74d2ec39b8eb78d4f88b878283d`
- 기준 정의 식별: `ec83a61df45f44cf7409b18592f6dcd7f9014ed47e618dd18736953cfdbe1410`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/environment-preflight-20261115/.www/followup/.www/handoff/final-source-snapshot.json` (24918바이트, sha256 863961c17f637b897b1a297d59781521c6d46c51b58a2c0292570fceebd24403), `.www/environment-preflight-20261115/.www/followup/.www/handoff/manifest.json` (4655바이트, sha256 2b576950c8ede34daa4f5b6eb75d7c292f43ffae9d2197b840b6e0613f30d376)
- 검증 중 원문 유지: 확인
- 출력: stdout 5022바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
