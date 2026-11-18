# Native 실시간 작업 흐름과 사용량 — 현재 재개

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

작업 UUID는 `work-005bdf73-4e11-441b-a485-51468cc8acf4`다. 기존 수용 기준의 ID·설명·필수 여부는 work.json 그대로 유지한다. 최신 TASK-RESUME 전체 requestHash와 문서/승인 exact 검증권한을 사전 대조해 같은UUID에 연결했다. source·generated·전역·인증·commit/publish 쓰기는 불허이며 과거 레코드 전체를 잠금/공식직렬화/atomic 저장 전에 백업했다.

## 현재 사용자 흐름과 검증 연결

| 여정 | 실제 입력·행동 | 기대 결과 | 기준 | 검사 방법과 구분 |
|---|---|---|---|---|
| UC-TURN | 새 턴→계획/명령/파일/공개답변→종료, 대조로 실패·중단·종료누락·지난턴선택 | 현재/과거턴 격리와 unknown 보존, 새 수신이 지난 선택을 강제로 바꾸지 않음 | AC-1·AC-2 | native-activity/projection 및 실제 Electron 합성 |
| UC-RESOURCE | 정확한 SKILL.md 구조화 읽기/명시 Skill 요청, sync Hook 같은 handler/다른turn/startedAt 반복 | 읽기·요청·실행 관측을 분리하고 handler 재사용을 호출별 고유ID로 단정하지 않음 | AC-3 | activity-sidebar/native-activity 회귀와 실제 목록/관측 표본 |
| UC-USAGE | total/last 누적값·감소·중복·절단·quota sparse update·model/rerouted | 안전한 턴차이만 제공. 설정모델/관측전환/미제공과 계정한도를 비용·모델별청구로 만들지 않음 | AC-4·AC-5 | usage/한도/모델 투영 단위와 actual Native telemetry 표본 |
| UC-VIEW | 340px·키보드·모션축소·초안/승인/중단·다른보기 전환 | 상태읽기와 기존 조작 보존, CSS 반응에 정보의미를 의존하지 않음 | AC-6·AC-7 | 새 독립 profile의 실제 Electron+합성 stdio, Root slot 뒤만 |

quota의 sparse update는 bucket·부가 메타데이터의 생략을 뜻한다. 설치 Codex 0.167.2가 생성한 `RateLimitWindow`는 `usedPercent`가 필수이고 `resetsAt`·`windowDurationMins`는 선택·nullable이다. 따라서 `{primary:{resetsAt:200}}`은 지원되는 창 갱신으로 취급하지 않는다. 유효한 창과 생략된 bucket의 보존, 명시 null의 미제공 표시를 각각 확인하며 잘못된 입력을 새 정상 API 계약으로 확대하지 않는다. 원문 schema와 SHA는 `.www/evidence/resume-20261116/native-closeout/final-current/quota-schema-reference.json`에 보존했다.

340px은 `--observability`에서 실제 Electron의 모니터 컴포넌트 폭을 340px로 제약하고 bounding rect·client/scroll width·동일 본문·5개 역할·공개 Progress·조작 초점·모션 축소를 관측한다. 기존 760px viewport 검사도 유지한다. 물리 Electron 창의 최소 폭이나 OS IME 입력을 입증하지 않으며, 실행 전에는 이 문서와 probe 작성만으로 통과를 선언하지 않는다.

## 현재 source 관찰과 남은 실행

현재 실행 대상 소스와 문서가 고정되면 이 UUID의 허용 exact 명령과 최신 증거를 연결한다. GUI·build·실제 Native 읽기 표본은 Root가 소유한다. 과거 Opus/Terra fail·원문·시도는 보존하고 현재 적용성은 공식 status로 재평가한다. 최종 고유 감사 전에는 수정 계획이나 단위 결과를 전체 완료로 표시하지 않는다.

설정 모델 이름과 model/rerouted 관측, 실제 서버선택 감사모델을 구분한다. 실제 stdio 합성/SSR·순수투영·actual Electron·actual Native 표본은 각자의 명령/source로 연결하고 다른UUID의 영수증을 복사하지 않는다. Windows/OS IME·비공개추론·계정별과금·임의모델의 항상같은도구선택은 입증하지 않았다. BoxBox는 현재프로젝트 off/disabled 출처이고 이를 PASS로 표시하거나 과거REFUSE를 지우지 않는다.

현재 sidebar는 동일handler의 turn/startedAt·완료 lifecycle을 구분하고 renderer는 snapshot과 arrived live를 consumeEvents로 처리한다. 상세 native-activity는 같은 thread/turn/handler entry를 newer startedAt에서 재개해 최신상태를 갱신하며 호출별 전체횟수/무제한 타임라인을 보장하지 않는다. startedAt/구분근거 없는 반복은 관측한 한계로 남긴다. 과거 반복Hook 지적을 이 코드와 새 검증으로 다시 대조한다.

## 과거 명세 원문 — 아래 현재/권한은 당시를 뜻함

<details>
<summary>기존 명세와 결정 이력</summary>

# Native 실시간 작업 흐름과 사용량

## 요청과 목적

오른쪽 Native 패널에서 답변 턴별 작업 흐름과 현재 실행 단계를 실시간으로 읽는다. Native가 보낸 계획·명령·도구·파일·공개 답변과 Skill·Hook 관측을 연결하고 모델·토큰·계정 한도의 근거를 구분한다. 짧은 답변에서 긴 작업까지 현재 무슨 일이 진행되는지 읽을 수 있어야 한다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`.

| 기준 | 이번 작업의 관찰 가능한 시나리오 |
|---|---|
| AC-1, AC-2 | 요청→계획→명령/도구/파일→공개 답변을 턴별로 읽는다. 실패·중단·종료 누락을 구분하고 늦은 ACK와 과거 턴 사건을 새 턴에 섞지 않는다. 과거 턴 선택을 새 수신 때문에 바꾸지 않는다. |
| AC-3 | 구조화 Skill 입력은 요청으로, 구조화 commandActions read의 SKILL.md는 읽기 시도로 표시하고 시작·완료 성공·실패·결과 미확인을 구분한다. 이름 언급과 skills/changed는 사용 성공이 아니다. 동기 Hook run만 처리하고 turn 없는 Hook은 세션 활동에 둔다. |
| AC-4 | tokenUsage.total 누적 snapshot을 더하지 않고 last를 최근 모델 요청으로 구분한다. 명시 새 스레드 영점 또는 안전한 이전 누적값이 있을 때만 턴 차분을 제공한다. 기준 누락·감소·절단·늦은 이전 턴 갱신은 미제공으로 남긴다. |
| AC-5 | 설정 모델과 model/rerouted 관측, 계정 quota bucket을 구분한다. 계정 한도를 턴·모델별 청구액으로 해석하거나 비용을 추정하지 않는다. |
| AC-6 | 기존 개요·사건·대화 초안·승인·중단·생태계·리포트를 유지한다. 좁은 패널과 키보드·모션 축소 환경에서 확인한다. |
| AC-7 | 순수 투영 경계 테스트·타입·빌드와 실제 Electron+합성 Native 왕복, 실제 Native 텔레메트리 표본 및 독립 검토의 증거와 한계를 별도로 기록한다. |

활동 패널은 공개 사건의 관찰 보기다. 비공개 reasoning 본문과 Hook의 raw stdout/stderr·context 지침은 표시하거나 별도 보관하지 않는다. 최신 [Chat 지속 명세](../../../specs/chat.md)의 제한 진단에 따라 sourcePath·statusMessage와 제공된 error/warning/stop 항목만 길이를 제한해 상세에서 표시한다. 최초 문서의 “Hook 내부 출력은 표시하거나 별도 보관하지 않는다”는 절대 표현은 최신 제한 진단 요구와 충돌했으며, 당시 원문과 Terra 실패는 이력·검증 증거에 보존한다. reasoning 토큰은 수신 숫자만 다룬다. 최근 2,000개 사건 한계를 표시하며 누락된 원본·모델별 사용량·비동기 Hook을 생성하지 않는다.

현행 요구 연결은 [CHAT-ACTIVITY-01](../../../specs/chat.md#chat-activity-01), [CHAT-USAGE-01](../../../specs/chat.md#chat-usage-01)과 기존 공개 사건·실패·읽기 상태 요구다. 대화 영속 저장·원격 실행·모델 자동 전환·비용 추정·자동 게시를 추가하지 않는다.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.

설계와 구현은 [design.md](design.md), 다음 행동은 [tasks.md](tasks.md)에서 확인한다. 순수 투영 집중 테스트와 타입 검사를 실행했으나 최종 소스 고정 후 통합·실제 Native·GUI 검증 및 독립 감사는 아직 완료 판정하지 않았다. BoxBox의 미승인 형태와 FIXABLE도 통과로 기록하지 않는다. work.json 결과는 부모가 실제 증거를 회수해 갱신한다.

</details>

현재 재개에서 직접 읽은 정본25의 source/copy SHA는 `.www/evidence/resume-20261116/chat008/methodology-manifest.go8.json`에 보존했다. Native8 뒤 주요21 선택은 local-source-manifest.go8.json이며 전체 official source digest와 다르다. 앞선214/226/248개 등은 각 명령/시점의 범위이고, 이UUID 현재 실행 수와 적용성은 뒤의 새 공식attempt/status에서 판단한다.
