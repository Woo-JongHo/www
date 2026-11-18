# Workflow019 검증 기록

## 범위와 실행 구분

2026-11-16 저작 단위의 집중 검증 기록이다. 원장의 모든 AC 결과는 root의 통합 검증과 현재성 판정 전까지 미검증을 유지한다. 실제 모델을 호출한 독립 감사·실제 Electron GUI 캡처·패키지 검증을 이 단위에서 수행하지 않았다. 부모 typed 하네스와 최종 공식 검증의 적용 소스·기준 연결은 root가 소유한다.

실제 Node verifier와 합성 JSONL 호스트 subprocess는 실제 프로세스로 실행했다. 합성 호스트를 실제 모델 호출로 보고하지 않는다. 완료 predicate 검사는 주입한 review fixture의 라벨을 명시적으로 구성해 보고서·현재성 게이트를 격리 검사한다. 이 영수증은 실제 모델 감사의 증거가 아니다. BoxBox mode off는 disabled이며 PASS가 아니다.

## 기준별 확인과 남은 검증

| 기준 | 저작 단위에서 실행한 검사 | root 통합에 남긴 것 |
|---|---|---|
| FLOW-PLAN | 공개 개발 진입 F01/F02, 정상 단일/두 단위, 부모·자식/기존 hardlink/신규 case/NFC-NFD 충돌, 160개 seed 계획 | 현재 통합 하네스·전체 계약 검사 |
| FLOW-ACCEPT | 호스트 exit 0 보존과 미실행/필수 산출물 누락 수용 거부, 실제 Node fixture 두 단위·통합 뒤 재검증 갱신 | 실제 사용자 업무 적용·최종 현재성 |
| FLOW-COMPLETE | 보고서 우회 재현 후 raw core·wrapper·공개 work CLI·앱 서비스 공통 거부, 정상 완료 대조 | 통합 실제 앱 완료 경로와 최종 필수 검토 |
| FLOW-FAULTS | F01–F11 및 C01/C02를 격리 원장·실제 공개 함수/CLI로 검사 | 전체 실행과 주입 fixture 범위를 최종 보고서에 분리 |
| STATE-LINK | 기존 구조 ID, 상태/전이/규칙/코드/행동 테스트 참조와 collector 검사 | root generator/구조 등록의 호스트 수용 |
| STATE-VIEW | 상태도/빈 모델/미실행/오래됨/실패/보고서 sandbox의 정적 화면 검사 | 실제 Electron 조작·복귀·좁은 화면·필수 캡처 직접 확인 |
| STATE-CHECK | F12 미정의/중복/고아/필수 근거, F13 내용 식별 변경, F14 잘못된 완료 guard 변형의 반례 | 현재 생성 snapshot과 실제 행동의 통합 현재성 |
| FLOW-REGRESSION | 기존 work/development·지도·report-lifecycle 집중 검사 | 전체 strict 타입·소스/구조 정책·빌드·독립 리뷰 |
| FLOW-PROPERTY | seed 16072026: 계획 160개, 수용 사건 144개, 실제 공통 완료 사건 열 12개 및 잘못된 현재성 변형 탐지 | 유한 검사 범위와 실제 모델 미실행을 유지한 최종 보고 |
| MAP-EVIDENCE | 같은 노드에서 상태/규칙/검사/반례/동일 UUID 보고서, 다른 보고서 프로젝트·조회 중 선택 변경 거부 | 실제 프로젝트 보고서·시도·환경·캡처 탐색 GUI 확인 |

## 결함 행렬의 실행 연결

| 행 | 실제 테스트 연결 | 종류 |
|---|---|---|
| F01/F02 | workflow-development.test.ts의 공개 진입 사전 거부, workflow-model-allocation.test.ts의 실제 FS 별칭, workflow-properties.test.ts의 계획 oracle | 격리 원장/호스트 호출 0/실제 FS |
| F03 | workflow-development.test.ts의 정상 종료와 미실행 구별 및 실제 프로세스 필수 산출물 누락 | 주입 대조와 실제 Node JSONL 프로세스를 구분 |
| F04–F11 | workflow-completion-faults.test.ts의 미실행/실패/소스·기준·범위/검토/보고서/주입/공개 CLI·앱 경로 | 실제 Node verifier + 명시적 review predicate fixture |
| F12–F14 | workflow-statechart.test.ts의 계약·내용 식별·완료 guard 변형, workflow-properties.test.ts의 실제 수용·완료 현재성 반례 | 모델 검사와 구현 행동 검사를 구분 |
| C01/C02 | completion-faults의 현재 보고서 완료 허용, development의 실제 두 단위/재검증 갱신 | 공개 CLI 및 실제 합성 subprocess |
| C03 | workflow-statechart-view.test.ts의 모델 없음 표시, 기존 지도 회귀 | 정적 화면 검사이며 실제 GUI는 별도 |

## 명령·원문

- `node --test test/workflow-work.test.ts test/workflow-development.test.ts`: 중간 통합 66 pass, 0 fail. 원문 `.www/evidence/session-completion-20261116/workflow-core-node.log`.
- 마지막 run 배선 보강 뒤 `node --test test/workflow-development.test.ts`: 26 pass, 0 fail. 원문 `.www/evidence/session-completion-20261116/workflow-development-final.log`.
- `bun test test/workflow-model-allocation.test.ts`: 실제 FS 별칭 반례 보강 후 6 pass, 0 fail. 원문 `.www/evidence/session-completion-20261116/workflow-case-regression.log`.
- 최종 합동 집중 명령: `bun test test/workflow-model-allocation.test.ts test/workflow-completion-faults.test.ts test/workflow-properties.test.ts test/workflow-statechart.test.ts test/workflow-statechart-view.test.ts test/report-lifecycle.test.ts test/architecture-tree.test.ts test/ecosystem.test.ts`. 원문 `.www/evidence/session-completion-20261116/workflow-focused-final.log`. 완료 결과는 root 인계에서 확인하며, 실행 중인 기록을 통과로 미리 적지 않는다.
- seed 재현: `WORKFLOW_PROPERTY_SEED=16072026 bun test test/workflow-properties.test.ts`. 분업/수용/완료 oracle과 재현 범위는 `.www/evidence/session-completion-20261116/workflow-properties.md`.
- 공통 완료 생성 검사 최종 단독 결과: 12개 사건 열, 허용 3/거부 9, 현재성 무시 변형 6건 탐지. 원문 `workflow-completion-properties.log`. 앞선 저작판의 4/8/5와 구분한다. 반례 `verify → review → report → source → complete`를 보존한다.

## 별도 읽기 검토와 실제 확인

`.www/evidence/session-completion-20261116/decomposition-review.md`는 완료 core 담당자가 자신의 core를 제외하고 다른 저자의 분업/run 배선을 검토한 별도 패스다. 첫 case 별칭과 후속 빈 한글 디렉터리 case/NFC-NFD 별칭 세 반례를 실기 재현했다. 수정 뒤 세 반례의 충돌 거부 및 정상 독립 파일 허용을 읽기 전용으로 재확인했다. 최종 반대 provider 감사로 승격하지 않는다.

보고서 우회 최초 재현 원문은 `completion-repro.log`, core 저작과 실행의 한계는 `completion-gate.md`, 상태도 UI 계약·GUI selectors·보안 경계는 `state-ui.md`에 보존한다. 전문은 모두 위 session-completion 증거 디렉터리에 있다.

변경한 소스·테스트의 TODO, test.skip/.only 및 미구현 분기 표식을 직접 검색해 결과가 없음을 확인했다. root 전체 diff의 INDEX.md EOF 공백은 다른 소유자에게 전달했고 덮어쓰지 않았다. 형식 검사나 정적인 그림만으로 업무 완료·실제 GUI 통과·형식 증명을 주장하지 않는다.

최종 합동 집중 명령은 48 pass, 0 fail로 종료했다(36.32초). 마지막 Node development 명령은 26 pass, 0 fail로 종료했다(11.69초). 이후 root가 발견한 테스트 리터럴 타입 widening 두 건은 `allocation` helper의 반환 타입을 `ModelAllocation`으로 명시해 수정했다. 실행 동작을 바꾸지 않았으며 전체 strict 재확인은 root typed post에서 수행한다. 이 결과는 root가 이후 통합한 소스의 전체 검사·실제 GUI를 대신하지 않는다.

<a id="attempt-f4c36675-1291-4002-8262-5f5f18aef069"></a>
## 검증 시도 — 2026-11-16T07:49:44.140Z

- 시도 ID: `attempt-f4c36675-1291-4002-8262-5f5f18aef069`
- 실행 시각: 2026-11-16T07:47:41.273Z ~ 2026-11-16T07:49:44.140Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import {spawnSync} from 'node:child_process';import {writeFileSync,readFileSync} from 'node:fs';import assert from 'node:assert/strict';assert.equal(readFileSync('dist/build-info.json','utf8'),readFileSync('.www/evidence/session-completion-20261116/home-bound-build-info.json','utf8'));const commands=[['node',['--test','test/workflow-work.test.ts','test/workflow-development.test.ts']],['bun',['test','test/workflow-completion-faults.test.ts','test/workflow-properties.test.ts','test/workflow-model-allocation.test.ts','test/workflow-statechart.test.ts','test/workflow-statechart-view.test.ts','test/architecture.test.ts']]];for(let i=0;i<commands.length;i++){const [cmd,args]=commands[i];const r=spawnSync(cmd,args,{encoding:'utf8',maxBuffer:4000000});writeFileSync('.www/evidence/session-completion-20261116/workflow-core-step-'+i+'.log',(r.stdout??'')+(r.stderr??''));process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.status!==0)process.exit(r.status??1);}assert.equal(readFileSync('dist/build-info.json','utf8'),readFileSync('.www/evidence/session-completion-20261116/home-bound-build-info.json','utf8'));"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `FLOW-ACCEPT`, `FLOW-COMPLETE`, `FLOW-FAULTS`, `FLOW-PLAN`, `FLOW-PROPERTY`, `STATE-CHECK`, `STATE-LINK`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www`, `docs/architecture/statecharts`, `docs/architecture/structure.json`, `docs/skills`, `docs/specs/architecture.md`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/workflow`, `scripts/workflow.ts`, `src/architecture.generated.json`, `src/ecosystem-view.tsx`, `src/ecosystem.css`, `src/workflow-statechart-view.tsx`, `src/workflow-statechart.ts`, `test/architecture.test.ts`, `test/workflow-completion-faults.test.ts`, `test/workflow-development.test.ts`, `test/workflow-properties.test.ts`, `test/workflow-statechart-view.test.ts`, `test/workflow-statechart.test.ts`, `test/workflow-work.test.ts`
- 소스 식별: `d60b6daa2e5360ac68d4eb99b1df73ad43c24bcb4f91d36641d2585a962c1de3`
- 기준 정의 식별: `3e1a74529536b0447ddcb526d50a038540f9b7c1b51fe6d259ecd718d293ae9d`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/session-completion-20261116/home-bound-build-info.json` (218바이트, sha256 1e141304a9f6a199c819ea49cad5e6495b5e4648bdedbb9befab0423fc6e2720)
- 검증 중 원문 유지: 확인
- 출력: stdout 21411바이트, stderr 4736바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

