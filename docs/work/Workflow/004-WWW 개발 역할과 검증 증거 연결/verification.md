# 검증 기록

## 통합 확인과 증거 범위

현재 구현의 정보별 정본은 제품·구조·Chat 기준, WWW 개발 역할, 공통 작업 계약, `work.json`, 작업별 검증 이력으로 나눴다. 스킬 절차를 역할에 복제하지 않고 일반 요청의 접수·기존 UUID 재개·권한 승계·필요 단계 선택을 연결했다. v1 작업은 그대로 읽으며 현재 요청에 따른 명시적 채택으로만 v2에 편입한다.

`npm run check`는 현재 입력 상태에서 실제 실행해 종료 코드 0, 검증 중 소스 유지로 통과했다. 이 명령은 작업 검사기, TypeScript 검사, 전체 Bun 테스트와 Electron 빌드를 포함한다. 아래 기계 기록의 `AC-1`~`AC-6` 연결은 자동 검사 범위이며 실제 호스트·GUI 관찰을 아래 별도 근거로 보완한다. 실제 Opus 감사를 이 명령이 대신했다고 해석하지 않는다.

| 관찰 | 실제 결과와 원본 |
|---|---|
| Codex 역할 수용 | 실제 Codex의 회귀 검사 실패→수정→통과를 같은 Chat UUID에서 실행했다. `.www/scratchpad/www-dev-architecture/pilot-red-result.json`, `pilot-green-result.json`. 부모가 전달한 계약 내용과 호스트 실행을 구분하며 두 번째 실행에서 역할·스킬 파일의 직접 읽기도 확인했다. |
| 새 세션 재개 | 대화 이력 없이 진입점·UUID만 받은 실제 Codex가 변경된 소스로 이전 증거의 무효화를 확인하고 `resume → verify → resume/status`를 수행했다. `.www/scratchpad/www-dev-architecture/fresh-resume-result.json`. UUID 유지, 검증 시도 증가, 다음 행동 review를 확인했다. |
| 앱 정책 수용과 완료 거부 | 실제 Electron renderer→preload→main→공통 core를 통과해 배포 정책 해시를 읽고, 필수 검토가 없는 작업의 완료를 거부했다. `.www/evidence/www-dev-architecture/final-negative/probe.json`. |
| Chat 사용자 동작 | 같은 Electron 실행에서 중단 접수 후 버튼 비활성, 두 번째 클릭 시도, fixture 관찰 요청 1회, 실제 interrupted 종료를 확인했다. 원본은 같은 probe와 `electron-chat.png`다. 실제 Native 서버 승인 왕복은 이 fixture 관찰 범위에 포함하지 않는다. |
| 호스트 간 증거 적용 | 실제 Bun 검증 실행 파일은 같은데 Electron 제어 Node 버전만 달라 무효화되던 문제를 실측·수정했다. 제어 버전은 출처로 보존하고 실제 실행 파일 경로·내용과 플랫폼을 대조한다. 최종 Electron은 `environment_changed` 없이 현재 검증을 수용했다. |

정책 정본은 `agents/www/review-policy.json`이고 빌드는 이를 `dist/agents/www/review-policy.json`에 포함한다. 앱은 배포 정책과 선택한 저장소 정책이 다르면 완료를 거부한다. 검토는 항상 Opus이며 입증된 Opus 사용량 소진만 Terra 대체를 허용한다. 인증·네트워크·불명 오류나 검토 반려는 대체 사유가 아니다. 실제 계정 할당량 소진과 Terra 대체 실행은 수행하지 않았고 분류·대체 경계만 자동 검사했다.

이 구현은 advisory 실행 연결이며 모든 도구의 파일 쓰기를 OS 수준에서 차단하지 않는다. verifier는 stdout/stderr 원문을 보관하지 않고 크기·지문을 기록한다. 독립 검토 원문은 해당 review receipt에 보존하며 이 사적 증거가 없는 다른 환경은 완료 증거를 다시 확보해야 한다. 소스·수용 기준·범위 변경은 과거 기록을 삭제하지 않고 현재 적용성을 다시 판단한다.

TypeScript·JSON의 BoxBox 작성 전후 검사는 구문 유효성을 확인했다. 기존과 신규의 `FIXABLE`·`REFUSE`, JSON의 승인 가능한 열 규칙 부재는 가독성 통과로 바꾸지 않았다. `.mjs`는 지원 언어 밖이다. 수동 열 정렬이나 format·align은 실행하지 않았다. 파일별 원본은 `.www/scratchpad/www-dev-architecture/*boxbox*`와 작성 기록에 보존했다.

Chat 파일럿의 실제 Opus 검토가 통과한 뒤 같은 Electron 창에서 양성 완료 IPC도 확인했다. `.www/evidence/www-dev-architecture/final-positive/probe.json`의 실제 완료 응답과 재조회가 모두 `done`이고, 이후 공개 CLI의 판정도 기준·검토가 현재 적용 가능하다고 확인했다. 파일럿 검토 원문과 남은 관찰은 해당 Chat 검증 기록에 보존했다. 전체 아키텍처의 최종 감사와 구분한다.

통합 검사 후 별도 Skills 라이브러리의 업스트림 Markdown 세 파일이 변경된 사실을 소스 지문 비교가 감지했다. 이전 통과를 현재 증거로 재사용하지 않고 통합 검사를 다시 실행했다. 해당 별도 변경을 되돌리거나 이 작업의 구현으로 주장하지 않았다.

별도 세션의 정적 `skill-library/` 문서 편집이 계속됨을 추가 관찰했다. 이 디렉터리는 제품·workflow 실행 코드의 의존성이 아니고 이번 수용 기준의 대상도 아니므로, 공개 `inputs` API로 현재 작업의 소스 식별 범위에서 제외했다. workflow·앱·실행 설정·기준·관련 검사 코드는 유지했다. 범위 변경으로 과거 증거를 자동 승격하지 않고 새 범위로 다시 통합 검사를 실행했다. 전체 명령의 통과가 별도 라이브러리 편집의 최신 품질까지 보증한다고 해석하지 않는다. 변경 파일 비교는 `.www/scratchpad/www-dev-architecture/concurrent-unrelated-changes.json`에 보존했다.

## Opus 최종 감사와 남은 한계

전체 변경의 실제 읽기 전용 Opus 감사 `review-57d9e7cd-3a6b-479f-9308-67a9dec302fa`는 2026-11-12T01:20:28Z에 `pass`로 끝났다. 관측 모델은 `claude-opus-5-5`, 소스는 `93275a44899998eb8a44a77caa0476206d3a980ee3767b9b1338361c06fdea7b`, 기준 정의는 `eda538f7d5bfd54af65e0ad2fe1a6fa0925f6dad22ae28893e0629c8a41483cf`다. 실제 원문 `.www/evidence/reviews/review-57d9e7cd-3a6b-479f-9308-67a9dec302fa/opus.json`과 정리 결과 `.www/scratchpad/www-dev-architecture/main-opus-audit-result.json`을 보존했다. fallback은 없었다.

검토자는 앱 완료의 이중 대조, 정책 불일치 거부, 실제 readonly argv·응답·영수증의 연결, quota만 허용하는 대체 조건, 소스·기준·범위별 증거 적용성을 대조했다. 실제 Codex 새 세션과 Electron의 거부→수용 기록도 읽었다. 검토자가 테스트를 직접 실행했다고 쓰지 않았으며 작성자가 실행한 명령 근거와 독립 소스 검토를 구분했다.

검토자가 남긴 비차단 한계는 다음과 같다.

- 전체 `npm run check`는 선언 입력 밖의 `docs/work/**`와 `skill-library/`도 읽는다. 작업 기록 갱신으로 자기 증거가 무효화되는 것을 피하려고 전자는 입력에 넣지 않는다. 따라서 별도 작업 기록·정적 문서의 변경 뒤에도 이 작업의 소스 증거가 유효하다고 나올 수 있다. 해당 자료까지 포함한 현재 저장소 전체의 일관성을 보증하려면 검사기를 별도로 다시 실행해야 한다.
- 호스트가 `modelUsage`를 반환하지 않으면 관측 모델을 null로 보존하며 정책에서 요청한 모델과 실제 모델을 완전히 대조할 수 없다. 이번 파일럿과 최종 감사에는 실제 Opus 관측값이 있다.
- 잠금을 보유한 프로세스가 강제 종료되면 `.www/work-records.lock`을 자동 회수하지 않는다. 이후 재개 전에 실제 소유 프로세스 종료를 확인하고 잠금을 복구해야 한다. 이번 새 세션 재개는 이를 자동 복구했다고 주장하지 않는다.

그 후 `AC-7`에 현재 소스·기준·정책과 실제 검토 영수증을 대조하는 별도 명령을 실행했다. `attempt-643c7aca-5198-4ad6-9caf-807ffa85dd34`가 실제 process, 종료 코드 0, 검증 중 소스 유지로 통과했다. 공통 완료 API를 실행한 뒤 재조회한 상태는 `done`, `canComplete: true`, 필수 기준 7개와 실제 독립 검토는 모두 현재 적용 가능이었다. 최종 상태와 각 시도는 `work.json`이 정본이다. 정리 결과는 `.www/scratchpad/www-dev-architecture/main-completion-result.json`에 보존했다. commit·push는 수행하지 않았다.

<a id="attempt-4d8b5eff-4182-46aa-b2c6-bbd7380c32f0"></a>
## 검증 시도 — 2026-11-12T01:12:45.776Z

- 시도 ID: `attempt-4d8b5eff-4182-46aa-b2c6-bbd7380c32f0`
- 실행 시각: 2026-11-12T01:12:31.080Z ~ 2026-11-12T01:12:45.776Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","check"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `AGENTS.md`, `agents/www`, `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills`, `docs/specs`, `package-lock.json`, `package.json`, `scripts`, `skill-library`, `skills/www`, `src`, `test`, `tsconfig.json`
- 소스 식별: `974222a7c4b49df0383fbcc93b24097d8a18b51727f47ef823881bf5ed196246`
- 기준 정의 식별: `eda538f7d5bfd54af65e0ad2fe1a6fa0925f6dad22ae28893e0629c8a41483cf`
- 검증 중 소스 유지: 확인
- 출력: stdout 437바이트, stderr 16202바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-0de51d00-1a55-490a-8e33-31614e21dfd8"></a>
## 검증 시도 — 2026-11-12T01:17:31.210Z

- 시도 ID: `attempt-0de51d00-1a55-490a-8e33-31614e21dfd8`
- 실행 시각: 2026-11-12T01:17:16.559Z ~ 2026-11-12T01:17:31.210Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","check"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `AGENTS.md`, `agents/www`, `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills`, `docs/specs`, `package-lock.json`, `package.json`, `scripts`, `skill-library`, `skills/www`, `src`, `test`, `tsconfig.json`
- 소스 식별: `f946a46445b0d97e1c6c8e529aab025780fb6252aed90e4ae534d25fd977c0a4`
- 기준 정의 식별: `eda538f7d5bfd54af65e0ad2fe1a6fa0925f6dad22ae28893e0629c8a41483cf`
- 검증 중 소스 유지: 확인
- 출력: stdout 437바이트, stderr 16194바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-d4d9cecb-f8bd-439a-b22c-49ae8ee6ef88"></a>
## 검증 시도 — 2026-11-12T01:18:13.150Z

- 시도 ID: `attempt-d4d9cecb-f8bd-439a-b22c-49ae8ee6ef88`
- 실행 시각: 2026-11-12T01:17:59.153Z ~ 2026-11-12T01:18:13.150Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/lib/node_modules/npm/bin/npm-cli.js","run","check"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `AGENTS.md`, `agents/www`, `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills`, `docs/specs`, `package-lock.json`, `package.json`, `scripts`, `skills/www`, `src`, `test`, `tsconfig.json`
- 소스 식별: `93275a44899998eb8a44a77caa0476206d3a980ee3767b9b1338361c06fdea7b`
- 기준 정의 식별: `eda538f7d5bfd54af65e0ad2fe1a6fa0925f6dad22ae28893e0629c8a41483cf`
- 검증 중 소스 유지: 확인
- 출력: stdout 437바이트, stderr 16193바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-643c7aca-5198-4ad6-9caf-807ffa85dd34"></a>
## 검증 시도 — 2026-11-12T01:21:52.475Z

- 시도 ID: `attempt-643c7aca-5198-4ad6-9caf-807ffa85dd34`
- 실행 시각: 2026-11-12T01:21:52.330Z ~ 2026-11-12T01:21:52.475Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import {readWork} from './scripts/workflow/work.mjs';import {captureSource,criteriaDigest} from './scripts/workflow/evidence.mjs';import {loadReviewPolicy,validateReview} from './scripts/workflow/review.mjs';const repo=process.cwd();const {record}=await readWork({repo,workId:'work-d5528c42-2849-48bd-9a9f-d8c80bf67f07'});const p=await loadReviewPolicy({root:repo});const s=await captureSource({repo,inputs:record.workflow.inputs});const r=validateReview({repo,policy:p.policy,review:record.workflow.reviews.at(-1),sourceDigest:s.digest,criteriaDigest:criteriaDigest(record),policyHash:p.hash});if(!r.usable)throw new Error(r.reasons.join(';'));console.log('현재 소스의 실제 독립 검토 영수증 확인');"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-7`
- 소스 HEAD: `012b4f8c67321b26c12b81b85e5da9754fb601da`
- 검증 입력: `AGENTS.md`, `agents/www`, `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills`, `docs/specs`, `package-lock.json`, `package.json`, `scripts`, `skills/www`, `src`, `test`, `tsconfig.json`
- 소스 식별: `93275a44899998eb8a44a77caa0476206d3a980ee3767b9b1338361c06fdea7b`
- 기준 정의 식별: `eda538f7d5bfd54af65e0ad2fe1a6fa0925f6dad22ae28893e0629c8a41483cf`
- 검증 중 소스 유지: 확인
- 출력: stdout 55바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

