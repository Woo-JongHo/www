# 문서 검증 기록

## 2026-11-16 문서 작성 범위의 확인

- 대상: 이번 작업의 명세·설계·실행 계획·작업 레코드와 목차 링크.
- 실제 실행: `node scripts/check-workflow.ts`.
- 결과: 종료 코드 0. 스킬 6개, 중첩 작업 기록, 목차, 템플릿, 예시의 워크플로 계약 검사 통과.
- 별도 문서 대조: 기준 10개가 명세와 실행 계획에 각각 참조되고, 제품 구현 권한은 false, 초기 작업 상태는 ready, 기준 결과는 모두 unverified임을 확인했다. 새 문서의 TODO·TBD·템플릿 자리표시와 불필요한 EOF 빈 줄은 발견하지 않았다.
- 현행 문서 영향: 제품·구조·개발 안내·공통 작업 계약·대시보드·Chat 명세 6개에 대해 현재 구현을 보존하고 이번 목표는 작업 문서에 두는 판단을 공식 document-review action으로 원장에 기록했다.
- 변경 경계: 본 작업은 Home 003 문서와 목차의 해당 항목만 작성했다. 작성 중 다른 세션의 Chat 014 명세·원장·보고서 변경을 관측했으며 해당 파일을 덮어쓰거나 되돌리지 않았다.
- 원문 보존: `.www/evidence/home-navigation-docs-9e2af1dc/`의 접수 결과, 문서 대조와 검토 실행 기록. 이 로컬 자료는 Git 게시 대상이 아니다.

## 증거의 적용 범위

위 결과는 문서 구조·참조·권한과 계획의 연결을 확인한 것이다. NAV-KEEP부터 ACCESS-VERIFY까지의 제품 행동을 실행한 증거가 아니다. 코드·테스트·GUI를 변경하거나 타입 검사·앱 빌드를 새로 실행하지 않았으며 실제 Electron·Native·IME·Windows 실기 검증과 필수 최종 감사는 미실행이다. 문서 작성과 보고서 생성으로 제품 수용 기준을 passed로 변경하지 않는다.

명세의 의미와 설계·계획 정합성은 별도 문맥의 읽기 전용 문서 검토로 다룬다. 해당 실행 결과와 공식 artifact-status의 현재성은 아래 후속 기록에 남기며, 도구 호출만으로 검토 승인을 인정하지 않는다.

## 별도 문맥의 문서 의미 검토 시도

- `www-spec`·`www-design`의 구현 전 산출물 검토 절차에 따라 공식 `artifact-context`로 spec·consistency의 문서 원문·기준·digest를 준비했다.
- Claude CLI에 `claude-sonnet-5`를 요청하고 도구 목록 비활성화, 빈 MCP 설정, 훅 비활성화, 세션 비저장을 지정해 별도 문서 검토를 시도했다. 이는 요청 옵션의 관측이며 OS 전체의 쓰기 차단을 입증한 것은 아니다.
- 실제 결과: 180초 응답 시간 초과. stdout·stderr는 각각 0바이트였고 유효한 검토 결과와 관측 모델 metadata를 받지 못했다. 요청한 모델의 실제 가용성이나 실패 원인은 확정하지 않는다.
- 공식 `artifact-status`는 spec과 consistency 모두 `not_run`을 반환했다. satisfied 검토를 자체 작성하거나 다른 모델로 자동 대체하지 않았다. 제품 최종 Opus 감사도 수행하지 않았다.
- 문서 영향 검토의 공식 기록 동작으로 원장의 현재 상태는 verifying, 다음 단계는 review가 됐다. 이는 검토 대기이며 제품 검증 통과를 뜻하지 않는다. 모든 수용 기준은 unverified다. 초기 보고서의 ready 표현은 이 현재 상태로 정정한 후속 저작 기록을 같은 보고서 묶음에 남긴다.
- 다음 행동: 구현 인계 전에 새 문맥의 읽기 전용 의미 검토로 명세·설계·계획을 대조하고, 유효한 응답을 받은 경우에만 공식 `artifact-review`에 기록한다. 현재 문서 작성과 계약 검사 통과는 이 미실행 검토를 대체하지 않는다.

## remote-20261116 — 현재 머신 범위와 미실행

기존 탐색·모니터링 구현과 source-machine GUI는 보존한다. 현 단위 검사는 별도 통과했지만 선택·키보드·왕복·세션 격리의 현재 실제 GUI와 필수 감사는 실행 조건이 갖춰지기 전 미검증이다.

실측 환경: macOS 26.5.1 arm64, Node22.23.1, Bun1.4.0, Electron39.8.10. 원문은 .www/evidence/remote-20261116/ 기준 scratch/local-remaining.md / electron-crash-summary.json. 실제 Opus 공유 core는 allowFallback=false, executor=process, not_run/authentication, observedModel=null이며 통과가 아니다. 실제 Native 두 검사도 실패했고 추가 시작 진단은 Codex 전역 상태 SQLite 초기화 오류를 관측했다. 승인·인증·설정을 변경하지 않았다.


## native-summary-recovery — 2026-11-16T09:16:18.085Z

현재 직접 사용자 요청에 따라 Native 실행 요약과 원작업의 relates_to 관계를 상호 연결했다. 대상 UUID: work-40c12cb7-9a53-4ead-b872-8c16d9525f67, work-65af9476-ebae-4edf-989b-012196fd0e1c. 원문 공개 입력/답변 절단·과거 명령/보고서 관측 한계는 보존한다. 새 기능 구현·자동 수용·취소·새 검증 PASS를 만들지 않았다. 요약은 역사 자료이며 실제 기능·현재 문서 수용은 원작업의 기준별 실제 검사와 독립 검토로 판정한다. 매핑 조사 전문은 .www/evidence/resume-20261116/scratch/native-summary-recovery.md다.

## 현재 소스의 실제 실행과 기준 연결 준비 — 2026-11-16T14:35:18.304524+00:00

Home002/003의 입력·기준을 실행 전후 별도로 captureSource/criteriaDigest로 관측했다. `home23-functional-v1-before.json`과 after.json, steps.json에서 두 UUID 모두 sourceStable true다. 같은 프로세스에서 집중 99건/658 expect, Node 개발 하네스 26건, 실제 Electron Sessions·Chat·Architecture·Reports가 모두 code 0으로 끝났다. 원문은 `.www/evidence/resume-20261116/home004-repair/scratch/home23-functional-v1-step-0~5.log`에 있다.

다른 UUID의 verification/review 영수증을 복사하지 않는다. 이 UUID의 현재 source/criteria와 실제 command/code·before/after manifest·원문 SHA를 다시 검사하는 공식 composite를 별도 실행해 연결한다. 실제 Home empty/multiple의 다섯 메뉴·좁은 상세·키보드 및 선택 경계 관측은 Home004 시도의 원문과 현재 제품 소스 일치 범위에서 참고한다.

NAV-KEEP/NAV-SELECT는 Chat의 프로젝트 목록 탐색·현재 프로젝트 재선택·초안/읽기 보존과 NativeSession 선택 경계를, NAV-GUARD는 실제 세션의 실행·승인·전송 보호와 탭 격리 회귀를 확인했다. NAV-MENU/MON-ENTRY는 메뉴 및 기존 토글 DOM 부재, MON-SCOPE는 실제 별도 child/session과 승인 토큰 격리, MON-STATES는 Chat의 복원/활성/잘못된 JSON/저장 실패·과거 관측을 확인했다. STATE-RETURN은 Chat/모니터/탭 초안·읽기·출력과 지도 선택/배율/읽기 및 리포트 초안 보존의 실제 assertion 범위다. 프로젝트 목록만 열고 닫았을 때 각 report/map 내부 모든 상태를 별도 전용 GUI 시나리오로 전수 확인한 것은 아니다. 숨긴 기존 컴포넌트를 유지하는 소스 책임과 독립 검토를 함께 대조한다. ACCESS-VERIFY의 좁은 viewport와 CDP 키보드는 실제 Electron이나 Native 최소 창보다 작은 viewport 시뮬레이션과 구분한다. DOC-HANDOFF는 같은 UUID의 명세/설계/tasks와 현재 원장·권한·실제 시도/미검증 경계의 연결을 읽고 대조한다.

OS 폴더 선택은 selector 및 저장 오류 주입의 공개 API 단위이며 실제 OS 대화상자·IME·Windows·실모델은 미실행이다. 기능 검사와 읽기 전용 Terra·저작 보고서·공식 완료/readback은 별도 단계다. 과거 문서 검토 timeout·remote Native/GUI 실패는 보존한다.

<a id="attempt-d66ced47-121e-42d3-8f9f-6f47021f9756"></a>
## 검증 시도 — 2026-11-16T14:35:30.997Z

- 시도 ID: `attempt-d66ced47-121e-42d3-8f9f-6f47021f9756`
- 실행 시각: 2026-11-16T14:35:30.761Z ~ 2026-11-16T14:35:30.997Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","-e","import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {readWork} from './scripts/workflow/work.ts';import {captureSource,criteriaDigest} from './scripts/workflow/evidence.ts';import {validateWorkRecord} from './scripts/workflow/schema.ts';import path from 'node:path';const base='.www/evidence/resume-20261116/home004-repair/scratch',workId='work-0e282d77-1c00-4663-8860-483d28148f74',w=await readWork({workId}),source=await captureSource({inputs:w.record.workflow.inputs}),steps=JSON.parse(await readFile(base+'/home23-functional-v1-steps.json','utf8')),manifest=JSON.parse(await readFile(base+'/functional-artifact-manifest-v1.json','utf8'));if(steps.results.length!==6||steps.results.some(r=>r.code!==0||r.signal||r.error)||steps.sourceStable!==true)throw Error('실제 기능 검사 실패/누락');const before=steps.before.find(x=>x.workId===workId),after=steps.after.find(x=>x.workId===workId);if(!before||!after||before.sourceDigest!==source.digest||after.sourceDigest!==source.digest||before.criteriaDigest!==criteriaDigest(w.record)||after.criteriaDigest!==criteriaDigest(w.record))throw Error('Home003 현재 source/criteria 불일치');for(const[file,saved]of Object.entries(manifest)){const bytes=await readFile(file);if(bytes.length!==saved.bytes||createHash('sha256').update(bytes).digest('hex')!==saved.sha256)throw Error('실행 원문 SHA 불일치: '+file);}const errors=validateWorkRecord(w.record,{baseDir:path.dirname(w.path)});if(errors.length)throw Error(errors.join(';'));for(const kind of ['spec','design','tasks','verification']){const text=await readFile(path.join(path.dirname(w.path),kind+'.md'),'utf8');if(!text.trim())throw Error('작업 문서 없음: '+kind);}console.log(JSON.stringify({workId,result:'passed',sourceDigest:source.digest,criteriaDigest:criteriaDigest(w.record),actualExecutionSteps:6,actualSourceStable:true,rawArtifactsValidated:Object.keys(manifest).length,scope:'실제 집중/개발하네스/Electron Session·Chat·지도·리포트 및 Home 관측과 같은 UUID 문서의 현재 결속. OS picker/IME/Windows/실모델 미실측.'}));"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `ACCESS-VERIFY`, `DOC-HANDOFF`, `MON-ENTRY`, `MON-SCOPE`, `MON-STATES`, `NAV-GUARD`, `NAV-KEEP`, `NAV-MENU`, `NAV-SELECT`, `STATE-RETURN`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `afd3a64110cb8db03b3248e34d66b99412e333cf5993201846abed4ed37e75ee`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/resume-20261116/home004-repair/scratch/functional-artifact-manifest-v1.json` (2915바이트, sha256 1b32235cec4b399016b3163665677521c7c3edfe302dc5035fb5883144f3b5a6)
- 검증 중 원문 유지: 확인
- 출력: stdout 498바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.



### 공식 review 접수 — 2026-11-16T14:36:19.165Z

문서 영향 검토 documentation-231d8f7e-86d3-4854-9084-64d1f95cf20c를 기록하고 실제 advance review를 실행했다. 현재 기능 근거 뒤 필수 직접 Terra 독립 감사와 감사 포함 의미 기준을 평가하려는 단계 접수이며 업무 완료·미검증 기준 통과를 뜻하지 않는다. Home003은 고유 공식 current functional composite attempt-d66ced47-121e-42d3-8f9f-6f47021f9756의 sourceStable/artifactsStable true를 확인했다.

## Native001·002 요약의 원작업 수용 경계

`work-40c12cb7-9a53-4ead-b872-8c16d9525f67`의 `report-deff3aa1-f428-4b87-b0d5-dda8441c7a22`는 사이드바/중앙 분리의 **평가·제안**을 기록한 원본이다. 실제 구현·UI 검증을 하지 않았고 입력 절단·명령 원문 부족을 명시한다. 그 제안의 목록 열기/현재 프로젝트 재선택/다른 프로젝트 전환은 Home003 NAV-KEEP/NAV-SELECT/NAV-GUARD의 현재 구현·검증과 연결한다. Native 요약의 당시 미구현 판단을 현재 실행 결과로 덮어쓰거나 Home003 영수증을 Native 새 실행처럼 복사하지 않는다.

`work-65af9476-ebae-4edf-989b-012196fd0e1c`의 `report-cd2be1bd-c026-4578-8830-d8ee0083ed85`는 Home003 **문서화와 당시 의미 검토 timeout**을 기록한 원본이다. 당시 제품 코드·기능 검증이 없었다는 사실, 첫 검사 실패/후속 정상 종료와 원문 부족, Sonnet 180초 timeout을 보존한다. 같은 UUID Home003의 현재 full TASK 구현 권한, 실제 focused/Electron 검사, 현재 직접 Terra 독립 검토가 이후 원작업의 수용 여부를 판정한다. 이 요약을 별도 기능으로 다시 구현하거나 취소로 집계하지 않는다.

양방향 relates_to는 이미 원장에 존재한다. 이번에는 두 원본 JSON·spec·관계와 Home003의 기준/실제 증거를 읽어 대조했다. 보고서 생성은 업무 수용이 아니며 Native의 AC-NATIVE 미검증 상태와 현재 원작업의 기준별 수용은 구분한다. 최종 원작업 수용 여부는 아래 실제 감사·현재성 composite·완료/readback에서 확인한다.

<a id="attempt-5ebecbe0-d89a-49f6-a988-52470b9e86cd"></a>
## 검증 시도 — 2026-11-16T21:43:24.338Z

- 시도 ID: `attempt-5ebecbe0-d89a-49f6-a988-52470b9e86cd`
- 실행 시각: 2026-11-16T21:43:10.137Z ~ 2026-11-16T21:43:24.338Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","test","test/dashboard.test.ts","test/native-session.test.ts","test/session-registry.test.ts","test/session-tabs.test.ts","test/www-activity-view.test.ts","test/www-activity.test.ts","test/input.test.ts","test/workflow-model-allocation.test.ts","--timeout","30000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `ACCESS-VERIFY`, `DOC-HANDOFF`, `MON-ENTRY`, `MON-SCOPE`, `MON-STATES`, `NAV-GUARD`, `NAV-KEEP`, `NAV-MENU`, `NAV-SELECT`, `STATE-RETURN`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `02b00e61ba1334cb625fb2d89ac7d0bf7b1f1ef1b3dea877785f02d9ef835d8b`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 출력: stdout 143바이트, stderr 13992바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 현재 집중 검사 해석 — 2026-11-17

공식 시도 `attempt-5ebecbe0-d89a-49f6-a988-52470b9e86cd`는 실제 Bun 집중 검사의 exit 0 및 sourceStable=true를 기록했다. 이 시도는 합성 fixture와 순수 상태/경계 동작을 확인하며 Electron 화면·OS picker·IME·Windows·실제 모델·독립 감사를 실행하지 않았다. 기준에 연결된 집중 증거만으로 복합 기준 전체의 관측을 완료로 판단하지 않는다. Root의 현재 GUI 결과와 최종 문서 정정 이후 source 시점, 문서 영향 검토, 별도 Terra actual process/receipt가 남아 있다.

<a id="attempt-889f6a50-ae31-47a4-b2c3-7811fa63840d"></a>
## 검증 시도 — 2026-11-16T21:50:44.598Z

- 시도 ID: `attempt-889f6a50-ae31-47a4-b2c3-7811fa63840d`
- 실행 시각: 2026-11-16T21:50:29.981Z ~ 2026-11-16T21:50:44.598Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","test","test/dashboard.test.ts","test/native-session.test.ts","test/session-registry.test.ts","test/session-tabs.test.ts","test/www-activity-view.test.ts","test/www-activity.test.ts","test/input.test.ts","test/workflow-model-allocation.test.ts","--timeout","30000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MON-SCOPE`, `MON-STATES`, `NAV-GUARD`, `STATE-RETURN`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `e53b045a96fb12118489a9a255a9e73e3e62fbfaac7e889315f82d9d415e30a3`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 출력: stdout 143바이트, stderr 13985바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-76fdc565-22d9-4071-9474-235188661756"></a>
## 검증 시도 — 2026-11-16T23:11:39.042Z

- 시도 ID: `attempt-76fdc565-22d9-4071-9474-235188661756`
- 실행 시각: 2026-11-16T23:11:23.129Z ~ 2026-11-16T23:11:39.042Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","test","test/dashboard.test.ts","test/native-session.test.ts","test/session-registry.test.ts","test/session-tabs.test.ts","test/www-activity-view.test.ts","test/www-activity.test.ts","test/input.test.ts","test/workflow-model-allocation.test.ts","--timeout","30000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MON-SCOPE`, `NAV-GUARD`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `c79fa1ea9f7d787f3b9a3fa06a4911d222122afb5abd472df311d036643f2fe5`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 출력: stdout 143바이트, stderr 13990바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-d16486fd-0d65-482f-a93e-5a02854230d5"></a>
## 검증 시도 — 2026-11-16T23:22:25.123Z

- 시도 ID: `attempt-d16486fd-0d65-482f-a93e-5a02854230d5`
- 실행 시각: 2026-11-16T23:21:54.851Z ~ 2026-11-16T23:22:25.123Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","test","test/dashboard.test.ts","test/native-session.test.ts","test/session-registry.test.ts","test/session-tabs.test.ts","test/www-activity-view.test.ts","test/www-activity.test.ts","test/input.test.ts","test/workflow-model-allocation.test.ts","--timeout","30000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MON-SCOPE`, `NAV-GUARD`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/evidence-current-v5.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/home-empty-tSIcnL/electron.stderr` (98바이트, sha256 7e493111b03e3c83f7d281a5e231f78a1be9a3103ec9d6532bbaf82824f4f02d), `.www/evidence/home-empty-tSIcnL/electron.stdout` (0바이트, sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855), `.www/evidence/home-empty-tSIcnL/empty-view-page.png` (122324바이트, sha256 1144d1c2c77aec1cba0e8d6618f092e477ab5d471242099ea03477cfa2b7f183), `.www/evidence/home-empty-tSIcnL/empty-www-dashboard.png` (130695바이트, sha256 2b235307425b70ea22a101b026d55c681c4b2af7413cd4734287a0620c38afa7), `.www/evidence/home-empty-tSIcnL/summary.json` (801바이트, sha256 a44890bc1129b877f785d71f449819f0606c220ca881ac36ceb9d8f805e2a47a), `.www/evidence/home-multiple-3znLzs/RPA-chat-nav.png` (108373바이트, sha256 eb3d702189906e7b134239ee18780b0612d2eaeed6c09b32f9d051dc1b40d708), `.www/evidence/home-multiple-3znLzs/RPA-dashboard-nav.png` (74761바이트, sha256 040511d26b8bf3919029d082e385b1664bb4391e20567730ad2a653db0839ba8), `.www/evidence/home-multiple-3znLzs/RPA-ecosystem-nav.png` (136136바이트, sha256 021fbffc4e390344cbc5467d2c0d96d59aca7c6e504fc098b029bf86ed66443f), `.www/evidence/home-multiple-3znLzs/RPA-monitoring-nav.png` (89096바이트, sha256 0f41c17f51b0cd3feb12880906baffc94f48f237d7782ecf5180807e6cb5bfaa), `.www/evidence/home-multiple-3znLzs/RPA-reports-nav.png` (102891바이트, sha256 604cd4a23d29996a2a5b7ece9867f81872040a4d433a3c6766c1816cd8516e27), `.www/evidence/home-multiple-3znLzs/WWW-chat-nav.png` (116489바이트, sha256 3bfb43e414a17576b180f386994d1f802a52cb18353372b05d2d011a8cb274ea), `.www/evidence/home-multiple-3znLzs/WWW-dashboard-nav.png` (129208바이트, sha256 9815586a571eae2a3d03fd9dd39b481c4332a258c66c76f9a113f4153080e01b), `.www/evidence/home-multiple-3znLzs/WWW-ecosystem-nav.png` (136290바이트, sha256 0d9dd039f666f1a573bfbdaca11dcf777dbb8f869bc1a4700a51a47bc611eeaa), `.www/evidence/home-multiple-3znLzs/WWW-monitoring-nav.png` (89673바이트, sha256 1fab8af5741a542b38795dc29a6d0da0510988e9a6e5039822d50dfa0e0e4e4f), `.www/evidence/home-multiple-3znLzs/WWW-reports-nav.png` (88281바이트, sha256 4d528bb18b9016fdcb13097c74887a5bedcc5fe896190d7c290a44fc08efcbba), `.www/evidence/home-multiple-3znLzs/calls.jsonl` (4656바이트, sha256 1507191a5ad93554a5b2625f17e5c52707bfdf64eeb253957ac42b7de42c93fe), `.www/evidence/home-multiple-3znLzs/electron.stderr` (1176바이트, sha256 b063aa75f0276cf9f68fd030eb4d2e389a676eb30ea81060118b1eee32a2db8f), `.www/evidence/home-multiple-3znLzs/electron.stdout` (0바이트, sha256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855), `.www/evidence/home-multiple-3znLzs/kanban-detail-narrow-bounds.json` (1377바이트, sha256 857e9032fd978446b0c788f021e65757d626348ea2b7fddd2a8be08779dc7ffa), `.www/evidence/home-multiple-3znLzs/kanban-detail-narrow.png` (68300바이트, sha256 71ab36328a1d3e07b091a0411f39efd0784995b9c31a7eb32a2955b809399723), `.www/evidence/home-multiple-3znLzs/kanban-permission-stale.png` (136412바이트, sha256 2b787aa597e7c9b27db37911491671b2e39598c9d3b0a0dd6f0f54fb0777cbe7), `.www/evidence/home-multiple-3znLzs/multiple-global-board.png` (128822바이트, sha256 0cddddf24ba8f57a0bcdc8ef66967a6eb7ab9933d352a6071903616cd4c767fe), `.www/evidence/home-multiple-3znLzs/multiple-rpa-board.png` (71531바이트, sha256 d52ea678ce5418b1719df8f69db0f730ea891dae179a401f7950ef32775545d1), `.www/evidence/home-multiple-3znLzs/multiple-www-board.png` (130807바이트, sha256 4f2d0db180b69f62b8d22524186dff13fa3edb8de6ddbcdea5bdc34d0c959c9e), `.www/evidence/home-multiple-3znLzs/permission-failed.json` (487바이트, sha256 d42b8b1d0f019c0240e7f542752a2baa8f58f513217908e063319136a9db4dfe), `.www/evidence/home-multiple-3znLzs/permission-partial.json` (957바이트, sha256 685a691b5f0b78179d98852c87157e0b7dbb89766e48df4bb1fd378b6f1eb7f5), `.www/evidence/home-multiple-3znLzs/summary.json` (5317바이트, sha256 d2569a9ff836a401b02c317d33c588943cac0e1266fd0fead0daef90a3d23b1b), `.www/evidence/home-multiple-3znLzs/view-page-return.png` (124531바이트, sha256 aedc4e86718f4efd25ac6da515bd79c7384acc3ca5c1d49b245227ae13dade39), `.www/evidence/reuse-integrate-resume-20261117/final/home003-gui-v5.process.json` (6520바이트, sha256 cd56b1f215d4f4cc07d8a6324803f5cfbae5a781c24fabba328f76855abff3bc), `.www/evidence/reuse-integrate-resume-20261117/final/home003-gui-v5.stderr` (494바이트, sha256 4580f6c1e24bed1a4b88cee0f68eed51a6641ba04747b5761a38adc9693b9576), `.www/evidence/reuse-integrate-resume-20261117/final/home003-gui-v5.stdout` (5657바이트, sha256 6bba836554cd6feab59a87c4b3cfc5fccc0847a02118cd5d5147936cf0006d9e)
- 검증 중 원문 유지: 확인
- 출력: stdout 143바이트, stderr 14868바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-6210c47e-aad3-481b-8349-2d7d80ffc66a"></a>
## 검증 시도 — 2026-11-16T23:26:28.589Z

- 시도 ID: `attempt-6210c47e-aad3-481b-8349-2d7d80ffc66a`
- 실행 시각: 2026-11-16T23:25:54.269Z ~ 2026-11-16T23:26:28.589Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-chat.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `ACCESS-VERIFY`, `NAV-GUARD`, `NAV-KEEP`, `STATE-RETURN`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/evidence-current-v5.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 출력: stdout 30738바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-cabcf10f-a7c3-46f6-95d2-d46cdc49d780"></a>
## 검증 시도 — 2026-11-16T23:26:37.619Z

- 시도 ID: `attempt-cabcf10f-a7c3-46f6-95d2-d46cdc49d780`
- 실행 시각: 2026-11-16T23:26:30.834Z ~ 2026-11-16T23:26:37.619Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-sessions.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MON-SCOPE`, `STATE-RETURN`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/chat.md`, `docs/specs/dashboard.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/design.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/evidence-current-v5.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/spec.md`, `docs/work/Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편/tasks.md`, `package-lock.json`, `package.json`, `scripts/verify-chat.ts`, `scripts/verify-home.ts`, `scripts/verify-native-activity.ts`, `scripts/verify-sessions.ts`, `src`, `src/native-activity-view.tsx`, `src/renderer.tsx`, `src/session-api.tsx`, `src/session-tabs.tsx`, `test/input.test.ts`, `test/native-session.test.ts`, `test/session-registry.test.ts`, `test/session-tabs.test.ts`, `test/www-activity-view.test.ts`, `test/www-activity.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729`
- 기준 정의 식별: `a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393`
- 검증 중 소스 유지: 확인
- 출력: stdout 1704바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

