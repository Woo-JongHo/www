# 검증 기록

## 2026-11-16 저장소 기준선과 작업 상태 확인

### 범위

이 기록은 작업 UUID `work-84cda38b-7265-40d7-bf47-5a22ece1b3a2`의 검증 이력을 시작한다. 공유 작업 트리에는 `src/dashboard.ts`, `src/shared.ts`, `src/preload.ts`, `src/native-session.ts`, `src/dashboard-view.tsx`, `src/dashboard.css`, `src/renderer.tsx`, `test/dashboard.test.ts`의 변경이 관찰되었으나 이 세션에서 해당 변경을 만든 사람·시점·시도는 확인하지 않았다. 다른 담당자의 변경을 본 작업의 검증 결과로 간주하지 않는다.

### 실제 수행 및 근거

- 실행 명령: `npm run check`
- 결과: 종료 코드 0. 저장된 로그는 `.www/evidence/session-completion-20261116/baseline-check.log`.
- 로그가 기록한 범위: 환경 확인, architecture 계약, source policy(TypeScript 152 / 기존 JavaScript 0), workflow 계약, TypeScript 검사, 전체 테스트(Bun 40개 파일 979 pass/0 fail, Node 12개 파일 198 pass/0 fail), build 성공.
- 적용 한계: 이 기준선은 Home004의 현재 구현 입력에 묶인 작업별 시도가 아니며, 실행 당시와 현재 작업 트리의 선후 관계도 이 로그만으로 확정하지 않는다. 작업 상세 기능의 정상·경계·실패·경합 동작, 실제 Electron GUI, 독립 감사 결과를 포함하지 않으며 KANBAN 기준을 통과 처리하지 않는다. 실행 시점의 정확한 source digest와 현재 작업 입력 범위의 동등성도 이 로그만으로 확인되지 않는다.

### 이번 기록 시점의 미실행 검증

아래 항목은 계획이며 실행 결과가 아니다.

- 작업별 `bun test test/dashboard.test.ts` 집중 시도 및 IPC/renderer 연계 동작 확인.
- `npm run typecheck`, `npm run build`, `node scripts/check-workflow.ts`를 현재 입력·기준과 묶은 공식 시도로 기록.
- `npm run check`를 구현 변경이 반영된 소스에서 재실행. 위 baseline 로그를 대체하지 않고 별도 시도로 남김.
- 실제 Electron GUI에서 카드 상세 열기, 비어 있거나 없는 문서, 읽기 실패 재시도, 좁은 창, 키보드 열기·닫기와 초점 복귀를 확인.
- 등록 프로젝트/UUID 안전 경계와 선택 변경 중 늦은 응답을 실제 호출 경로에서 확인.
- 작업 기준·현재 적용성·실패 표기가 요구와 일치하는지 읽기 전용 독립 검토.
- Windows 또는 다른 플랫폼, 실제 Native 실모델 동작은 수행하지 않았다. 이번 기능 요구의 통과 사실로 주장하지 않는다.

### 다음에 기록할 시도

실제 실행 전에는 `work.json`의 `workflow.authorization.verifierCommands`에 허용된 명령을 사용하고, 실행별 source/criteria/environment 식별자·종료 코드·대상 기준·관찰·미확인을 공식 원장 시도와 연결한다. 특히 다음 시나리오를 각각 구분해 기록한다.

1. 정상 카드에서 동일 `projectKey + workId`로 문서 네 종류와 원장 기준 표시.
2. 작업 계획 없음, 빈 문서, 문서 누락·읽기 실패·과대 파일.
3. 미등록 프로젝트·없는/중복 UUID·불완전 목록 및 외부 링크 탈출.
4. 프로젝트/카드 선택 변경 뒤 이전 요청의 늦은 응답, snapshot 갱신, 닫기 후 focus 복귀.
5. 좁은 창과 키보드만으로 상세·문서 내용을 탐색.

실행하지 않은 시나리오는 결과를 쓰지 않고 미실행으로 유지한다. 필수 기준 4개는 현재 모두 `unverified`이며 이 baseline으로 바꾸지 않는다.


## 기준선 수치 정정과 첫 구현 관찰

초기 수집 문구의 파일 수와 테스트 수가 서로 다른 실행기를 섞은 부분을 로그 원문 대조로 정정했다. Bun은 40개 파일 979건, Node는 12개 파일 198건이며 두 실행기 모두 실패 0건이었다. 기준선 성공은 새 칸반 상세 기능의 통과로 승격하지 않는다.

첫 구현은 Terra 두 명이 backend/API와 화면을 독립 소유했고 Sol이 실제 renderer 연결과 명세·구조 생성·통합을 맡았다. 외부 협업 호스트를 감싼 typed authoring은 executor=injected, 도구 검사는 process다. authoring-result.json, selector-authoring-result.json, correction-result.json은 실제 strict 두 프로젝트·소스 정책·신뢰한 구조 생성·sourceStable=true를 기록하며 BoxBox는 off/disabled다. 실제 모델 호출 근거는 협업 도구와 각 인계 원문에서 구분한다.

Astra 반박에서 카드 선택자, 열 이동 후 초점, 목록/상세 시점 혼합과 단계 정본 우선순위를 지적했다. 수정 후 네 집중 파일은 99 pass/0 fail, 1165 expect였으며 원문은 correction-focused.log다. 이것은 비동기 GUI와 실제 Native의 통과가 아니다.

실제 npm build 성공 후 node scripts/verify-home.ts를 실행했다. RPA 0개 모드는 통과했고 다중 프로젝트 모드는 카드 선택→실제 IPC→네 문서→동일 원장 요약·기준→안전 Markdown→계획 표→빈 검증 문서→재수집 완료 후 펼침 유지→640px 가로 넘침 없음→열 이동 후 카드 초점 복귀까지 13개 관찰을 통과했다. 이후 실제 Enter 재열기 단계에서 실패했다. 관찰과 실패 DOM은 .www/evidence/home-multiple-P7TG3I에, 실행 전체는 batch1-home-ui.log에 보존한다. rawKeyDown이 문자 사건을 만들지 않는 probe 조건은 후속 검증에서 보완하며 기능 성공으로 추정하지 않는다. 정상 카드 B 전환·이후 전체 여정은 이 실패 시도에서 통과하지 않았다.

<a id="attempt-742d6cb6-06ad-49aa-be8f-651f217d3702"></a>
## 검증 시도 — 2026-11-16T07:32:05.414Z

- 시도 ID: `attempt-742d6cb6-06ad-49aa-be8f-651f217d3702`
- 실행 시각: 2026-11-16T07:31:20.471Z ~ 2026-11-16T07:32:05.414Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import {spawnSync} from 'node:child_process';import {writeFileSync} from 'node:fs';const commands=[['bun',['test','test/dashboard.test.ts','test/native-session.test.ts']],['node',['scripts/verify-home.ts']],['node',['scripts/verify-dashboard-race.ts']]];for(let i=0;i<commands.length;i++){const [cmd,args]=commands[i];const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:4000000});writeFileSync('.www/evidence/session-completion-20261116/home-official-step-'+i+'.log',(r.stdout??'')+(r.stderr??''));process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);}"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `KANBAN-DETAIL`, `KANBAN-SCOPE`, `KANBAN-TRUTH`, `KANBAN-VERIFY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/specs/dashboard.md`, `package.json`, `scripts/verify-dashboard-race.ts`, `scripts/verify-home.ts`, `src/dashboard-view.tsx`, `src/dashboard.css`, `src/dashboard.ts`, `src/main.ts`, `src/native-session.ts`, `src/preload.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/dashboard.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `95b0501d590cf2ea5240c782893261e3024fc4c1d9ab80ba6f16df7a7b138a4a`
- 기준 정의 식별: `06ebb9a8a9c841f5d7cd577c5639c4ea78c3a4138e5ab23b3a9e9fd912d604e8`
- 검증 중 소스 유지: 확인
- 출력: stdout 4714바이트, stderr 5296바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 실제 검증 2026-11-16

실제 시도 attempt-742d6cb6-06ad-49aa-be8f-651f217d3702: dashboard/native-session 집중 37개 통과, 실제 Electron 빈/다중 프로젝트·읽기 전용 IPC·동일 UUID·문서 누락/빈 문서/HTML 및 링크 무실행·상태 변경 뒤 초점·Enter 복귀·5메뉴/모니터 왕복 통과. 별도 실제 DashboardView mount에서 실제 backend 응답을 받은 뒤 전달 순서만 주입해 A→B→A→B 역전 및 닫기 뒤 지연 응답을 검사해 통과했다(실제 IPC 5건). 이는 자연 발생 스케줄러 경합이나 앱 전체 경합의 완전한 검증을 뜻하지 않는다. 세부 전문 home-official-step-0/1/2.log, dashboard-race-Y2q9vk/summary.json, home-multiple 관련 화면은 세션 evidence에 보존했다. strict·소스·신뢰 생성 및 빌드 실행은 최종 하네스 실제 process 근거와 별도로 확인했다. RPA 실제 코드·운영 실행과 Windows/OS 대화상자는 범위 밖이다.

## 필수 감사 지적의 수용

review-f10adac1-d1c2-4ca7-a03a-36cbf064c5a4는 실제 구현 결함은 찾지 못했지만 빌드된 dist와 현재 소스의 결속 및 KANBAN-VERIFY의 감사 전 선행 통과를 지적해 fail이다. 현재 기준을 모두 미검증으로 돌리고 이력을 보존했다. 같은 실제 시도에서 strict·build→GUI 순서를 실행하고, 감사 자체를 포함하는 KANBAN-VERIFY는 독립 감사 기록 이후에만 별도 연결한다. 임시 audit 단계 선택은 미완료 기능 통과나 완료 처리가 아닌 읽기 전용 검토 접수이며 근거를 기록한다.

<a id="attempt-d13616ac-9758-406f-b7ff-84061b0d62da"></a>
## 검증 시도 — 2026-11-16T07:45:15.814Z

- 시도 ID: `attempt-d13616ac-9758-406f-b7ff-84061b0d62da`
- 실행 시각: 2026-11-16T07:44:12.424Z ~ 2026-11-16T07:45:15.814Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import {spawnSync} from 'node:child_process';import {writeFileSync,readFileSync} from 'node:fs';const commands=[['npm',['run','typecheck']],['npm',['run','build']],['bun',['test','test/dashboard.test.ts','test/native-session.test.ts']],['node',['scripts/verify-home.ts']],['node',['scripts/verify-dashboard-race.ts']]];for(let i=0;i<commands.length;i++){const [cmd,args]=commands[i];const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:4000000});writeFileSync('.www/evidence/session-completion-20261116/home-bound-step-'+i+'.log',(r.stdout??'')+(r.stderr??''));process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);if(i===1)writeFileSync('.www/evidence/session-completion-20261116/home-bound-build-info.json',readFileSync('dist/build-info.json'));}"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `KANBAN-DETAIL`, `KANBAN-SCOPE`, `KANBAN-TRUTH`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/specs/dashboard.md`, `package.json`, `scripts/verify-dashboard-race.ts`, `scripts/verify-home.ts`, `src/dashboard-view.tsx`, `src/dashboard.css`, `src/dashboard.ts`, `src/main.ts`, `src/native-session.ts`, `src/preload.ts`, `src/renderer.tsx`, `src/shared.ts`, `test/dashboard.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `458e9916ac8a4cba9204d13e46e18b8e544b5567cdc5816672b472bec80c8387`
- 기준 정의 식별: `06ebb9a8a9c841f5d7cd577c5639c4ea78c3a4138e5ab23b3a9e9fd912d604e8`
- 검증 중 소스 유지: 확인
- 출력: stdout 4876바이트, stderr 5294바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 빌드 결속 교정 후 독립 감사 접수

attempt-d13616ac-9758-406f-b7ff-84061b0d62da에서 실제 npm typecheck→npm build→집중 37개→실제 Home GUI→실제 IPC 응답 순서 제어의 5개 명령을 같은 process 시도에서 직렬 실행해 통과했다. home-bound-step-0~4.log와 home-bound-build-info.json을 보존했고 build sourceDigest=87d1ff991cd2f765c2c83f706665fd3cb93bbf31a0e422e379933adffc35adfb다. 이 시도는 기능 기준 세 개만 연결했고 KANBAN-VERIFY는 독립 감사 미기록으로 unverified 유지했다. 해당 기준이 감사 기록 자체를 포함하므로 읽기 전용 감사 접수를 위해 공식 advance(review)를 명시 선택하며, 이는 그 기준 통과나 done을 뜻하지 않는다. 감사 기록 이후 현재 기능 시도·빌드·타입·GUI·필수 감사의 합성 적용성을 별도 실제 검사로 연결한다.
