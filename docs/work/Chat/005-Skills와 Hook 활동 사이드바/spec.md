# Skills와 Hook 활동 사이드바 — 현재 재개

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

작업 UUID는 `work-16362e60-e269-4d5d-bf38-2869496efd2c`다. 기존 수용 기준의 ID·설명·필수 여부는 work.json 그대로 유지한다. 최신 TASK-RESUME 전체 requestHash와 문서/승인 exact 검증권한을 사전 대조해 같은UUID에 연결했다. source·generated·전역·인증·commit/publish 쓰기는 불허이며 과거 레코드 전체를 잠금/공식직렬화/atomic 저장 전에 백업했다.

## 현재 사용자 흐름과 검증 연결

| 여정 | 실제 입력·행동 | 기대 결과 | 기준 | 검사 방법과 구분 |
|---|---|---|---|---|
| UC-CATALOG | skills/list와 hooks/list 최신/지연/실패/부분응답 및 thread전환 | 고정순서·scope·완전목록/감지목록 구분. stale 응답이 최신목록을 덮지 않음 | AC-1 | catalog parser/실제 stdio 목록race·Electron 상세 리소스 |
| UC-PULSE | 정확한 구조화 SKILL.md 읽기 시작과 sync hook/started, 대조로 이름언급·완료·중복·다른thread | 해당행만 반응하고 읽기/사용성공을 혼동하지 않음 | AC-2·AC-3 | activity-sidebar 회귀·시작/완료/turn/startedAt handler 재사용 대조 |
| UC-RESTORE | snapshot 요청중 live 도착·재진입·취소·복원·같은handler 다음실행 | 과거는 새 pulse가 아니고 경계 뒤 현재live만 반응. 식별정보 없는 반복은 확정하지 않음 | AC-3 | ActivitySnapshotBoundary/renderer consumeEvents 및 실제 Electron |
| UC-READ | 행고정순서·0.7초반응·reduced-motion·좁은패널·초안/승인/중단 | 행 재정렬 없이 절제된 반응, 모션축소시 최근관측정적표시·기존조작 유지 | AC-4·AC-5 | 실제 Electron computed style/geometry·합성 Native 표본 |

## 현재 source 관찰과 남은 실행

현재 실행 대상 소스와 문서가 고정되면 이 UUID의 허용 exact 명령과 최신 증거를 연결한다. GUI·build·실제 Native 읽기 표본은 Root가 소유한다. 과거 Opus/Terra fail·원문·시도는 보존하고 현재 적용성은 공식 status로 재평가한다. 최종 고유 감사 전에는 수정 계획이나 단위 결과를 전체 완료로 표시하지 않는다.

설정 모델 이름과 model/rerouted 관측, 실제 서버선택 감사모델을 구분한다. 실제 stdio 합성/SSR·순수투영·actual Electron·actual Native 표본은 각자의 명령/source로 연결하고 다른UUID의 영수증을 복사하지 않는다. Windows/OS IME·비공개추론·계정별과금·임의모델의 항상같은도구선택은 입증하지 않았다. BoxBox는 현재프로젝트 off/disabled 출처이고 이를 PASS로 표시하거나 과거REFUSE를 지우지 않는다.

현재 sidebar는 동일handler의 turn/startedAt·완료 lifecycle을 구분하고 renderer는 snapshot과 arrived live를 consumeEvents로 처리한다. 상세 native-activity는 같은 thread/turn/handler entry를 newer startedAt에서 재개해 최신상태를 갱신하며 호출별 전체횟수/무제한 타임라인을 보장하지 않는다. startedAt/구분근거 없는 반복은 관측한 한계로 남긴다. 과거 반복Hook 지적을 이 코드와 새 검증으로 다시 대조한다.

후속 Chat013 요구에 따라 기본오른쪽화면은 Agent/고정5skills/Plan·Progress이고 Hook목록은 기본개요에서 제외된다. 이005의 목록/반응 기능은 상세모니터 리소스 화면에서 평가하며 Hook실행 자체를 끈 것으로 해석하지 않는다. 과거기본배치 이력과 현행표현을 구분하고 기존5AC의 정의를 바꾸지 않는다. notebook·과거Terra문서는 수정하지 않는다.

## 과거 명세 원문 — 아래 현재/권한은 당시를 뜻함

<details>
<summary>기존 명세와 결정 이력</summary>

# Skills와 Hook 활동 사이드바

## 요청과 목적

오른쪽 사이드바를 현재 작업공간의 Skills와 Hooks 목록 중심으로 단순화하고, 새 활동이 실제로 관측된 행만 짧게 반응하게 한다. 기존 Native 활동 패널이 계획·모델·토큰·실행 타임라인을 한 화면에 함께 표시하는 상태에서, 사용자가 확정한 목록과 반응을 기본 표면으로 바꾼다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

- 포함: 로컬 app-server의 `skills/list`와 `hooks/list`를 사용한 현재 작업공간 등록 목록, 구조화된 Skill 문서 읽기 시작과 동기 Hook 시작의 행 반응, 고정 순서, 연결·목록 범위 안내, 모션 축소, 중복·재생·오귀속 방지.
- 포함: 기존 AppEvent 수집과 `Chat/003`의 Skill·Hook 관측 경계를 재사용하고 직접 영향받는 fixture·투영·Electron GUI 검사를 갱신한다.
- 제외: 계획·모델·시간·토큰·계정 한도의 재배치, 호출 상세 연결, 과거 답변 탐색, 영속 저장, 토큰 그래프, 자동 작업 단계 연결, 전역 세션 감시.
- 제외: 구조화된 `SKILL.md` 읽기를 독립 Skill invoke나 적용 성공으로 표현하는 것, Hook 완료를 새 실행으로 반응시키는 것.
- 커밋·push·배포와 전역 설정 변경은 하지 않는다. 변경 경로·검증 명령의 기계 권한은 `work.json.workflow.authorization`을 따른다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준은 `AC-1`~`AC-5`이고 현행 요구 `CHAT-ACTIVITY-01`과 연결한다.

- `AC-1`: 등록 목록 응답이 있으면 비활성 항목까지 목록에 두고, 응답을 얻지 못한 경우에만 관측 범위를 명시한다.
- `AC-2`: 사용자 입력의 Skill 이름이나 임의 명령 문자열은 반응 근거가 아니다. 구조화된 `commandActions.read`가 `SKILL.md`를 가리킬 때 읽기 반응을 만든다. 동기 Hook은 `hook/started`에서만 반응한다.
- `AC-3`: Skill은 등록 path, Hook은 event/source path/display order/handler type의 단일 일치와 run ID로 연결한다. 불명확한 매핑은 기존 행을 추정해 켜지 않는다.
- `AC-4`: 새 활동은 행 표시점과 배경이 약 0.7초 반응하되 정렬을 바꾸지 않는다. 모션 축소에서는 애니메이션 없이 관측 상태만 남긴다.
- `AC-5`: 합성 투영 검사는 실제 Native 목록·Hook 실행 전체 검증으로 확대하지 않는다. 실제 Electron GUI와 가능한 실제 Native 표본을 별도 증거로 남긴다.

## 결정과 열린 질문

- 로컬 `codex-cli 0.166.0`의 생성 스키마에서 `skills/list`, `hooks/list`, `skills/changed`, `hook/started`, `hook/completed`가 `experimentalApi: false`에서도 제공됨을 확인했다.
- Skills와 Hooks는 목록 응답 순서를 유지하고, 등록 목록에 없는 관측 항목만 뒤에 붙인다. 활동 때문에 행을 재정렬하지 않는다.
- Hook 목록 행과 실행의 공통 key가 알림에 없으므로 event name·source path·display order·handler type이 정확히 하나의 등록 행과 일치할 때만 연결한다. 일치가 없거나 여러 개면 별도의 감지 행으로 둔다.
- 같은 run ID의 완료가 먼저 관측된 뒤 늦은 시작이 오면 새 반응을 만들지 않는다. 턴 없는 Hook은 같은 스레드의 세션 활동으로만 다룬다.
- 이 샌드박스에서 별도 app-server 실연결은 `Operation not permitted`로 시작되지 않았다. 스키마 확인과 구현은 진행하되 실제 목록 표본의 미실행 여부를 검증 기록에서 분리한다.
- 구현을 바꿀 열린 질문은 없다. 강조 시간과 색상은 실제 GUI에서 식별성과 과도한 점멸 여부를 확인해 같은 범위 안에서 조정한다.

## 요청에서 받은 권한

사용자는 이 checkout의 해당 사이드바 작업을 소유하라고 명시했고, 최소 사이드바의 실제 수집 경로 조사·설계·구현·검증을 이어가도록 요청했다. 나머지 배치·우선순위·확장 기능은 일괄 구현 승인이 아니며 후속 범위로 남긴다.

## Terra 재검토 뒤 확정한 보완 경계

- 대화 복원과 새 대화는 실제 app-server 재연결이 아니다. 실제 초기화 성공에서만 연결 세대를 올리고, 복원 화면에는 같은 세대의 `transport/status`만 제공한다.
- Skills와 Hooks 목록의 최신성은 응답 도착 순서가 아니라 workspace·thread scope별 요청 시작 순서로 정한다. 새 요청이 시작되면 이전 요청 응답은 새 요청의 지연·실패와 관계없이 게시하지 않는다.
- main이 부여하는 AppEvent seq의 단조 증가 순서를 이용해 일반 사건 처리 완료는 scalar high-water mark로 압축한다. 연결 세대 내 읽기·Hook run은 실제 문자열 key로 정확히 보존해 기록한 key를 잊어 재점멸시키지도, 해시 충돌로 새 활동을 누락하지도 않는다. exact 상태는 그 연결의 고유 읽기/run 수에 비례해 증가하며 실제 새 transport 연결에서 회수한다. 같은 연결의 대화 복원·전환에서는 회수하지 않는다.
- 최근 동적 관측과 pulse는 512개, thread Hook 목록 cache는 최근 32개로 제한한다. 제거된 thread 목록은 대화를 다시 열 때 실제 `hooks/list({ threadId })` 요청으로 복구한다.
- bootstrap·대화 전환 snapshot 요청 중의 live 사건은 renderer 경계 큐에 보존하고 snapshot과 seq 순서로 병합한다. snapshot cutoff까지는 복원으로 적용해 pulse를 만들지 않고, 이후 live만 새 반응을 만든다. 실패·취소·StrictMode 재진입과 다른 thread 전환에서도 사건 손실·오귀속을 허용하지 않는다.

</details>

현재 재개에서 직접 읽은 정본25의 source/copy SHA는 `.www/evidence/resume-20261116/chat008/methodology-manifest.go8.json`에 보존했다. Native8 뒤 주요21 선택은 local-source-manifest.go8.json이며 전체 official source digest와 다르다. 앞선214/226/248개 등은 각 명령/시점의 범위이고, 이UUID 현재 실행 수와 적용성은 뒤의 새 공식attempt/status에서 판단한다.
