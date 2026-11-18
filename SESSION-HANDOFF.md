# WWW 원격 백그라운드 인수인계

요청과 목적: 사용자는 2026-11-16 현재 로컬 개발·검증을 멈추고 `ssh woojongho`에서 백그라운드로 남은 일을 계속하라고 명시했다. 커밋·푸시는 명시적으로 제외했다. 요구 R1=원래 남은 기능·검증·칸반·Skills 사용성 개선(진행 중), R2=현재 변경/기록 보존(이관 검증 대상), R3=원격 백그라운드 실제 실행(launcher와 JSONL로 관찰), R4=커밋·푸시 금지(유지).

## 1. 개요
원래 목표는 누적 기능과 유스케이스 검증 공백을 메우고 실제 근거가 갖춰진 일만 완료하는 것이다. 구현과 다수 실제 GUI 검사를 진행했지만 전체 완료는 아니다. 로컬 개발 실행은 사용자 요청으로 정지했고 현재 파일·Git 이력·실패를 포함한 근거를 전달한다. 이 문서를 읽고 원장의 현재 상태와 근거 적용성을 다시 계산하며 계속 진행한다.

## 2. 사용 시나리오
관찰된 흐름: 칸반 카드에서 같은 UUID의 명세·계획·검증 문서를 읽고 키보드로 복귀. 대화/모니터 왕복에서 초안·카드 펼침·읽기 위치 보존. 상태도에서 실제 근거를 조회하고 Escape로 원래 지도로 돌아오기. 이 흐름의 실제 source-machine 기록은 아래 단일 근거 원장으로 확인한다. 원격 머신에서는 새 검증 전 현재 PASS라고 주장하지 않는다.

## 3. 변경 사항
- C1/R1: 안전한 칸반 상세 reader, renderer IPC 연결, 문서/기준/계획 읽기와 stale 응답 격리. Home004 UUID work-84cda38b-7265-40d7-bf47-5a22ece1b3a2.
- C2/R1: Chat 단일 스크롤·카드 펼침·입력 로컬 상태·고정 Working·Mint·Steer, 프로젝트 목록/중앙 화면 분리와 5메뉴. Chat014 work-2d8887e6-0a74-40e4-8dc7-f000f8b3b118, Home003 work-0e282d77-1c00-4663-8860-483d28148f74.
- C3/R1: 실제 WWW 단계 선언 producer/main validation, 계획 없는 Progress, 실제 Subagent/미관측 구분. Chat015 work-36d312bc-a767-4e3e-a581-01898b35f75f. Chat013 native-activity 완료/지연 결함도 수정.
- C4/R1: 분업 소유/의존/산출물 수용과 공통 완료 core·저작 보고서 gate·속성/결함 검사, 기존 구조 ID의 상태도와 실제 근거/보고서 조회. Workflow019 work-048bfa71-3960-4ad0-a8fe-e6217100d6df.
- C5/R1: 여섯 절 보고서·legacy 의미 보존·offline/print. Reports003 work-dc931897-564a-4b95-a8c5-a23d7b03a8a3. 파일명/검색 보존/접기 직후 scroll probe 교정까지 반영했으나 공식 최종 전체 재실행은 남았다.
- C6/R1: 명세·설계·구현·검증 Skills/역할/템플릿에 유스케이스·인계 강화. Workflow020 work-d43bfed7-e705-4c22-aceb-f00dc1ede0b8. 여러 독립 실험의 실패는 보존. 마지막 Sol 실험도 README와 최종 blockedReason의 서술 차이로 의미 검토 PARTIAL이므로 전체 완료로 쓰지 않는다.
- C7/R1: API가 미검증인데 review로 승격하던 문제와 현재 실패 build를 후속 부분통과/문서/감사가 덮던 문제를 공통 requiredEvidenceAction으로 교정했다. 상태도 pending 중 BODY focus/Escape도 실제 GUI로 확인했다.

## 4. 단일 근거 원장 — source-machine 기록
공통 target은 이 사본의 원본 로컬 main HEAD a720468172a0ea64cb3b4a8e1de36289144df98d + dirty이며, 정확한 실제 source/criteria digest·시각·환경은 각 JSON/로그가 정본이다. 이 표는 2026-11-16 정지 시점의 recorded 요약이다.

| ID | 판정 | 범위·한계 | source_ref (`.www/evidence/session-completion-20261116/` 기준) |
|---|---|---|---|
| E1 | passed | 실제 typecheck→build→37집중→Home GUI→별도 React/실제 IPC 응답 순서 주입. 기능3기준만 연결, KANBAN-VERIFY 미검증 | home-bound-verification.json, home-bound-step-0~4.log, home-bound-build-info.json |
| E2 | passed | Home004 실제 read-only Opus claude-opus-5-5, composite VERIFY/최종 보고서·complete는 아직 | home-bound-opus.json |
| E3 | passed | Chat 기본246/Steer17/cards54. 최초CDP timeout 실패 보존, 무수정 재시도 통과. OS IME/Windows/실제 Steer 의미 반영 별도 | final-chat-summary.md, final-chat-*.log |
| E4 | passed | actual Electron 단계 관측14. 실제 stdio fixture, actual 모델 tool-choice/하네스 결속 미실측 | final-observability-summary.md, final-observability-retry.log |
| E5 | passed | actual 구조지도/상태도95체크, pending actual IPC Escape·focus보존4대조(8초 관찰) | architecture-settled.log, statechart-pending-focus-report.md |
| E6 | passed | typed 최종 actual process source/type/architecture 사후검사 stable, BoxBox mode off=disabled | failure-priority-authoring-result.json, settled-authoring-result.json |
| E7 | passed | core work47/development26/completion8 집중. 주입 audit fixture는 실제 provider 감사 아님 | failure-priority-*-tests.log, next-action-current-failure-design.md |
| E8 | failed | 마지막 공식019 묶음은 Bun architecture 기본5초 timeout 33pass/1fail. Node step0 자체는73pass. budget30초 재검증 필요. 첫 실패 삭제 금지 | workflow-core-official.json, workflow-core-step-0/1.log |
| E9 | failed | 전체 npm test1031pass/1 hook timeout. 해당 development-policy 단독5pass. Node그룹203pass. 전체current clean 재실행은 남음 | final-test.log, final-development-policy-summary.md, final-node-test.log |
| E10 | failed | Reports 공식 전체 마지막은 접기 직후 과거scroll 위치 실패. source에2프레임 안정화+초기위치assert 교정 적용후 아직 공식전체재실행안함. CDP 독립진단은 Electron/A4/PDF 관측 | reports-official-current.json, reports-scroll-probe-fix.patch; .www/evidence/reports-3zls0X |
| E11 | failed | Skills Opus 세차례 fail, 잘못 연결한 현재 PASS 제거. 마지막 Sol 실제 원래 산출물의 의미검토 PARTIAL(README blockedReason 설명), 현재문맥 SHA 보존 | skills-opus-final.json, skills-author-sol-semantic-review.md, skills-forward-author-sol/ |
| E12 | unknown | 이전55건 inventory는 정지시점보다 오래됨. 최신 원장 상태는 pause-current-records.json/실제work.json. 기존done22는 역사이며 새전체재검증이 아님 | pause-current-records.json, final-backlog-inventory.json |

## 5. 남은 일과 재개 순서
담당은 원격 Codex 통합자, 기한은 지정하지 않았다. 다음 done_when을 실제로 충족할 때만 해당 원장을 완료한다.

1. SSH target의 이 새 snapshot이 정본. 기존 `/Users/woojongho/woo/00_project/www`와 글로벌 `~/.codex/woo.yaml`(다른 universe 프로젝트)은 변경하지 않는다. 새 사본 root의 AGENTS/역할/WORKFLOW/DEVELOPMENT와 원격 coding-guidelines를 읽는다. 필요한 스킬은 새 사본의 `skills/www`를 명시 사용한다.
2. Node22/원격 Codex·Claude·BoxBox 경로/의존성을 실제 확인. 머신간 환경·실행파일·절대경로가 다르므로 과거 PASS의 environment/current성을 자동승격하지 않는다. `.www/development.local.json`은 원본 로컬경로 설정이므로 새 사본에서 원격 실제 설치본 경로로 설정해야 한다. 전역 설정·승인·BoxBox mode 변경하지 않는다.
3. Home004: E1/E2는 source-machine 범위에서 유효. 마지막 KANBAN-VERIFY는 감사 포함 기준이라 미검증 유지했다. 실제 현재 기능검사+mandatory 감사의 합성 적용성을 별도 실제 명령에 연결하고 저작보고서→complete/readback. 원격환경에 맞춰 필요한 재검증 후에만 완료. 단계가 review 필요하면 audit 접수의 공식 advance 사유를 기록(미검증을 passed로 꾸미지 않음).
4. Reports003: `node scripts/verify-reports.ts`는 type/semantic/focused/build/actualElectron/PDF를 내부 수행하므로 build slot 단독 소유. 현재 source의 patch반영상태로 공식전체재실행하고 실패를 해결. print 이력 open/closed source-machine 관측의 실제/모사 범위를 유지.
5. Workflow019: E8 단순5초timeout과 실제assertion을 구분. 동일 assertions/input을 `--timeout 30000`으로 예산 분리 검증 가능(기존 Reports harness도30초 사용). 공식검증에 정확argv를 연결. core/API47+26+8, statechart 모델/반례/속성304유한표본, 실제GUI95+pending4를 원격 source/current환경에 맞게 연결. FLOW-REGRESSION은 필수감사 포함이므로 감사전 선행PASS 금지. 독립감사→현재저작보고서→완료.
6. Workflow020 Skills: 잘못된 수동/사후수정 fixture를 현재 행동 성공으로 승격하지 말 것. 마지막 Sol 산출물의 계획현재/이력·원장/보고서 연결은 맞지만 README의 blockedReason 서술은 최종record와 상충. raw 실패·freeze 보존, 필요한 최소지침/새독립적용 검증. 형식 quick_validate/check-workflow와 실제행동은 각각scope구분. 현재정본문맥25개복사+SHA를갖춘독립실험 사용. completion=false와 actual complete 호출 거부는 다른 사실.
7. Chat014/015/Home003/Chat013: 실제 GUI/단위 근거는 위/각verification에 있음. OS IME/Windows, actual Native 모델의 Steer 반영과 API접수를 구분. 실제live표본은 sameTurn 접수됐으나 최종모델응답 추가지시미반영. 자동재시도·새turn/서버모델반영을 발명하지 말 것.
8. 기존 local 후보 Workflow016/009/Home001의 현재원장·새로그를 먼저 읽는다.016 30초fault재검사pass후 Node검증진행중 정지/자연종료한 흔적을확인.009 source/Node/type일부진행, full/build미실행. Home001은 정지직전 actualOpus·보고서/완료가 끝났을수있으므로 실제원장/보고서 readback으로확인. 준비계획은 legacy-*-closeout-plan.md 3개. 과거done를새미완료로 만들거나 중복 요구를취소해공백숨기지 말 것.
9. 부모 Workflow021 work-40ae2dc5-86db-4b52-b1fc-09ca61c58898에서 전체 통합/최종검사/보고서·칸반현재성 회수. 동시 빌드로 dist 덮지 말 것. 동일source/shared dist의 독립GUI는임시profile로병렬, 무거운CPU/I/O테스트는호스트예산에맞춰묶음제한. 성능측정은단독slot.

### 권한·모델·외부 경계
- 커밋·푸시·PR·게시·릴리스·메일·외부이슈쓰기 금지. 사용자는 원격백그라운드 계속작업만 명시했다.
- user 요청으로 병렬과 단계별모델배치 허용. Sol저작/통합, Terra일상검증, Luna수집, Astra반박. 필수최종감사는 실제Claude Opus 고정, `allowFallback:false`. 미실행이면 blocker. 주입실행을provider/model실행으로꾸미지않음.
- RPA실프로젝트는ssh chacada에있고 WWW완료 선행조건에서제외했다. 접속/변경/운영실행하지않음. Windows/OSIME/격리Macmini/remoteRelease/원래122초지연자료부재등은미실행/미확인표시. woojongho는실제Macmini여도별도실측전해당기준통과아님.
- 현재직접요청으로기존schema2권한재연결필요시전체원장history백업·withWorkLock·serialize·atomicrename·요청hash/auth일치를유지. schema2 adopt가no-op인공백을우회해몰래PASS로만들지말것. 제품쓰기/검증/게시권한을분리.
- 로컬BoxBox mode off는disabled이며PASS가아님. 전역설정/승인/레지스트리변경금지.

## 상세 부록
세션전문은 `.www/evidence/session-completion-20261116/`, provider감사원문은 `.www/evidence/reviews/`, 잔여수용결과회수는 `.www/pending-results/`, 실행영수증은 `.www/runtime/`. 원본계정인증은복사하지않았고원격기존Codex로그인사용. node_modules/dist와evidence속의node_modules/.git/브라우저cache는전송제외; bytes원문로그·스크린샷·PDF·시나리오파일·Git bundle과dirty작업파일은보존한다. 제외목록은packaging-manifest.json으로확인. 원격의실제실행상태는handoff상위디렉터리 run.pid/run.jsonl/final.md/run.exitcode가정본이다.
