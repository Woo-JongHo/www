# 실행 지연 진단과 현재 세션 전달 지침

기록 시각: 2026-11-14T09:48:47.688Z
대상: work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b / GJC owner session 01a1d728-f356-755f-995a-cb761f2a24ad.
사용자 요청: 문제점을 확인·기록하고 가재코드에 명시해 빠르게 마무리한다. 기존 승인 범위·21개 수용 기준·최종 검증을 유지한다. 새 계획·목표·모델 실행을 추가하라는 요청이 아니다.

## 확인된 지연 요인

1. **소스 변경과 생성물 갱신 순서 불일치.** 최근 normalizer 두 번은 host.ok=true와 타입 통과, BoxBox disabled였지만 모두 “코드 설계도 snapshot이 현재 소스와 다릅니다.”로 하네스가 실패했다. 자식은 두 TS만 수정하고 생성기 실행을 금지받았다. 부모 생성보다 먼저 typed 사후 architectureGate가 실행돼 같은 실패를 반복한다.
2. **읽기·쓰기 범위 혼동.** 첫 normalizer는 두 파일만 읽으라는 지시로 shared.ts의 실제 타입을 읽지 못해 helper만 추출하고 중단했다. 재시도에서 읽기를 허용하자 normalizer와 행동 테스트8개를 작성했다.
3. **같은 main 작업 트리의 동시 쓰기.** 원장 첫 하네스에서 이 진단 세션의 보고서 reader/테스트 다섯 파일 변경이 미선언 TS 변경으로 감지됐다. 반대편에서도 새 원장 세 파일이 감지됐다. 쓰기 소유권이 분리되지 않아 서로의 사후 검사를 무효화했다.
4. **짧은 단위마다 부모·자식·하네스의 반복 인계.** 현재 작업은 G002에 P2~P4가 묶여 있고 P5~P6가 이를 기다린다. 같은 계약을 반복 설명하거나 중간 상태를 검토하는 동안 실제 main/IPC/UI 수직 연결이 늦어진다.

## 시간 근거와 해석 한계

06:58:47Z 목표 생성부터09:32:39Z 최근 normalizer 종료까지 약2시간34분이다. runtime/events.jsonl에서 running→host_result를 짝지은 하위 작성 호스트10회 합계는1,550.326초(약26분)다. 나머지는 부모의 조사·검사·승인·조율 등을 포함하며 전부 유휴나 낭비라고 확정하지 않는다. 최근 두 호스트는 각각170.955초,172.317초다.

## 즉시 적용할 실행 지침

- **현재 live-integration을 계속한다.** 09:36:34Z에 시작한 www-ui-p2-p4-live-integration-01a1d728을 먼저 확인한다. 같은 파일의 두 번째 작성 호스트를 시작하거나 실행 중 작업을 강제 종료하지 않는다. 현재 자식이 실행 중이면 안전한 인계 지점에서 이 지침을 적용한다.
- **생성물을 같은 승인 변경 단위에 포함한다.** managed TS가 바뀌면 src/architecture.generated.json도 바뀔 수 있다. 이를 실제 writes/승인 범위에 포함하고 기존 공식 생성기로 갱신한 뒤 --check와 typed 사후 검사를 받는다. 원래 승인 경로에 없으면 필요한 정확 경로만 정식 권한 연결로 반영한다. 생성기 금지 지시와 필수 사후 gate를 충돌시키지 않는다. 생성물을 수동 편집하거나 검사를 끄지 않는다.
- **쓰기는 소유 파일로 한정하고 의존 코드 읽기는 허용한다.** 기존 shared/IPC 타입·파서를 읽지 못해 다시 물어보는 왕복을 없앤다. 읽기 허용을 쓰기 권한 확대로 해석하지 않는다.
- **이 진단 세션은 제품 코드 쓰기를 중단한다.** 현재 작업 트리의 G002 제품 구현은 가재코드 한 소유자가 진행한다. 다른 작성자가 있으면 겹치는 파일과 검사 시점을 먼저 조율한다. 임의 stash/reset/checkout이나 새 작업 트리 생성으로 미커밋 변경을 이동하지 않는다.
- **기존 계약으로 실제 수직 연결을 마친다.** normalizeNativeResources → main의 ledger scope/select/upsert/gap → IPC/preload → 현재 요청/누적 sidebar·상세 monitor → 프로젝트 전환의 순서로 끝낸다. 새 저장 프레임워크·대안 설계·새 UUID를 만들지 않는다.
- **검사는 변경 묶음당 한 번, 실패하면 원인에 맞춰 한 번 보완한다.** 자식에게 자체 검사 실행을 맡겼다면 부모가 같은 검사를 즉시 반복하지 않는다. 필수 typed/source/strict/집중 기능/GUI/최종 전체 검사와 필수 Opus·경계 검토는 유지한다. 같은 snapshot 오류만 반복되면 모델 재실행 전에 생성·권한·검사 순서를 수정한다.
- **BoxBox 임시 off를 유지한다.** 사용자 승인된 프로젝트 범위의 off는 disabled/skipped로 기록한다. 통과로 위장하거나 전역 설정·formatter·새 규칙 승인을 확대하지 않는다. source/strict/구조·기능 검사는 유지한다.
- **상태 관리보다 사용자 기능과 증거를 우선한다.** 기존 G001 receipt, G002 active, G003 선행 의존성을 재작성하지 않는다. 진행 전달은 완료한 실제 연결·남은 연결·현재 blocker의 세 항목으로 짧게 하고, 재계획·동일 중간 리뷰·목표 원장 장문 갱신을 반복하지 않는다.

## 원문 위치

- .www/runtime/work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b/events.jsonl
- .www/evidence/work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b/p2-resource-normalizer/{request.json,retry-request.json,author.stdout.json,retry.stdout.json}
- 같은 evidence의 p2-activity-ledger·p2-project-index·boxbox-temporary-off
- scripts/workflow.ts:318(사후 architectureGate), scripts/generate-architecture.ts:49(본문 해시)

이 문서는 진단·전달 기록이다. 제품 완료·검사 통과·메시지 수신을 이 문서만으로 주장하지 않는다. 실제 전송·수신 확인은 별도 영수증에 보존한다.

## 실제 전달 결과

공식 GJC SDK MCP의 `turn.steer`로 위 지침을 기존 실행 중 세션에 전송했다. `turn.steer_status` 재조회에서도 `accepted`를 확인했다. 새 prompt·세션 생성·abort는 실행하지 않았다.

- 접수 시각: 2026-11-14T09:52:33.555Z
- clientRef: `www-work009-bottleneck-guidance-20261114-v1`
- commandId: `1fc87f41-31af-41b0-ba01-ba893b92020d`
- turnId: `90c4e34b-5267-44d2-b53e-8051fb755e29`
- 전문과 접수·재조회 영수증: [execution-guidance-receipt.json](execution-guidance-receipt.json)

접수는 확인했으나 지침 반영 회신·제품 완료는 아직 확인하지 않았다.

## 지침 소비와 후속 검증 확인

- 2026-11-14T09:53:00.457Z: 대상 세션이 이 진단 문서를 실제 read 도구로 읽었다.
- 2026-11-14T09:54:39.960Z: 기존 호스트 유지·중복 미실행, main→원장→IPC/preload→사이드바·상세 모니터·프로젝트 전환 연결, 생성기 선행 순서 적용 방침을 담당 세션이 회신했다.
- 2026-11-14T09:55:52.717Z: 담당 세션의 공식 생성→구조 검사→타입 검사→소스 정책→빌드→GUI 명령이 오류 없이 끝난 출력을 확인했다. GUI 원문 `.www/evidence/chat-ui-UuZaY5/summary.json`은 passed다. sidebar/detail 독립 토글, 초안·읽기 위치·포커스 보존을 포함한다.
- 실제 모델·Windows·실제 한국어 IME는 해당 GUI 증거 범위 밖이다. 프로젝트 전환 전체 및 Node Map·21개 수용 기준·최종 검토 완료로 확대 해석하지 않는다. 기존 두 작성 하네스의 snapshot 실패 기록도 통과로 덮어쓰지 않는다.
- 09:57:38Z 관찰에서 담당 세션은 구조 검사 순서가 있는 하네스 소스를 조사 중이며 실행 상태는 running이다.

정제한 수신 회신과 후속 근거: [execution-guidance-followup.json](execution-guidance-followup.json). 이 진단 세션은 제품 코드 변경·검사 중복 실행을 하지 않았다.
