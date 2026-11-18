# Native 대화 재개 통합 — 현재 요구와 역사

UUID `work-baa0963b-ea71-48e7-a34f-0d229ba704b1`. 기존 AC-1~AC-4의 ID·정의·필수 여부·권한은 work.json 그대로 유지한다.

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

## 현재 범위와 사용자 여정

Ovis의 공개 행·입력·인용 동작만 개작하고 WWW Electron·Native JSON-RPC·선택/원장·승인·중단 경계를 유지한다. 새 DB·원격 실행·전체 앱 이식·provider 자동 전환은 추가하지 않는다. 지속 요구는 [Chat 명세](../../../specs/chat.md), 반입 고지는 [Ovis 고지](../../../third-party/ovis.md), 조사 권장은 Chat008이 소유한다.

| 여정 | 입력·기대 결과 | 기준·검사 경계 |
|---|---|---|
| UC-OSS | 공개 답변·설명·명령·변경·승인과 Markdown·복사·인용을 읽고 인용은 초안에만 추가 | AC-1: 반입 출처/고지·본문/입력 회귀·실제 Electron 합성 |
| UC-HISTORY | 선택 cwd·originator=www 대화를 list/read/resume하고 같은 thread에 후속 요청. 과거 승인/실행을 재생하지 않음 | AC-2: parser/lifecycle/session 실제 stdio 합성 및 제한된 actual Native 읽기 표본을 구분 |
| UC-QUEUE·UC-OPEN·UC-ACCEPT | read/resume 중 live를 현재 client/selection/thread의 2,000건·4MiB 큐에 보관. 준비·snapshot·queue/drain·예약 수용 뒤만 accept. overflow 실패 후 명시 재열기 전 전송 차단 | AC-2·AC-3: 성공/실패·현재 승인/실행·count/bytes·다른 scope와 명시 재열기 정상 대조 |
| UC-TIMESTAMP·UC-LIVE | 안전정수 completedAtMs의 0도 완료 권위로 보존. 완료정보 없는 잠정 이력만 같은 scope의 실제 시작 뒤 재개 | AC-1~3: 누락/null/invalid·terminal/EOF·다른 generation/process/selection·입력 가능 상태를 대조 |
| UC-EMPTY | 기존 text/output/changes 뒤 명시 빈 문자열·빈 배열은 제거하고 omitted/null/malformed는 기존 의미 보존 | AC-1~3: 저장 parser와 live projection을 구분. 유효/invalid 항목이 혼합된 changes 반례를 새 수정·검증에서 확인 |
| UC-REGRESSION | 초안·읽기·펼침·전송 실패·중복·승인·중단·composition과 화면 복원을 보존 | AC-3·AC-4: 집중/타입/build·실제 Electron 합성·actual Native 표본·고유 감사의 최신 적용성. 실제 OS IME·Windows는 별도 |

sameWorkspace는 실행 플랫폼의 Node path.isAbsolute/resolve로 경로를 판정한다. Windows drive·UNC 형태는 실제 소유 함수에 win32 의존성을 주입한 대조가 있지만 실제 Windows OS 실행 증거는 아니다. 경로를 무조건 거부한다는 과거 설명과 실제 Windows·OS 한국어 IME 미실행 한계를 구분한다.

공개 요약·설명·계획의 authoritative 완료 snapshot 정산은 같은 scope의 과거 본문 처리다. 종료 뒤 started/delta로 스트리밍이나 현재 실행을 되살리는 것과 구분하고, 조각 위치·빈 완료·정정 시간 대응 경고는 Chat 정본을 따른다.

## 현재 인계

v3의 과거 고유 감사 fail과 단위·GUI 표본은 원문으로 보존한다. 새 반례 교정의 완료와 실제 검사 수는 이 문서에 미리 쓰지 않는다. 소스 동결 뒤 같은 UUID의 실제 검증·문서 검토·고유 감사를 회수하며 GUI/build/actual Native 표본은 Root가 소유한다. 현재 DOM probe가 준비 중이거나 검증됐다는 과거 문구는 아래 당시 기록이며 최신 verification/status를 대신하지 않는다.

## 과거 문서 원문 — 당시 구현·검사·권한과 다음 행동

<details>
<summary>정정 전 원문 전체</summary>

# 오픈소스 채팅 뼈대와 Native 대화 재개 통합

작업 UUID는 `work-baa0963b-ea71-48e7-a34f-0d229ba704b1`다. 기존 네 수용 기준의 정의·필수 여부·과거 결과 정본은 work.json이며 변경하지 않는다.

## 현재 요청과 범위

사용자의 최신 TASK-RESUME.md는 기존 실패를 고친 현재 제품·개발 작업의 검증·문서·독립 감사·보고서를 회수하도록 한다. 원문과 정확 requestHash를 같은 UUID의 현재 권한에 연결하며 commit/publish=false다. 이번 문서 패스는 Native 재연결 두 수정의 현재 사실과 여정을 회수한다. 제품 변경은 이미 별도 부모 Workflow021 호스트 범위에서 저작했고 여기서 다시 실행/귀속하지 않는다. 소스 종합 GO 전 최종 검증·감사는 실행하지 않는다.

Ovis의 공개 행·입력·인용 동작 개작과 WWW Electron·Native JSON-RPC·원장·승인·중단 경계는 유지한다. 전체 Herdr/Ovis 앱 이식·새 중앙DB·provider 자동 전환·인증/전역/일반 검토 정책 변경은 없다. 현재 비교의 Ovis 부분 개작 판단은 Chat008이며 이 통합 UUID와 섞지 않는다.

## 현재 요구와 구현의 구분

CHAT-RENDER-01/CHAT-HISTORY-01/CHAT-APPROVAL-01/CHAT-STOP-01 등 현행 Chat 명세를 참조한다. 구현은 native-session의 raw queue와 lifecycle·projection이 소유하고, renderer는 기존 선택·marker·세대 guard를 유지한다. 현재 queue 한도는 2000건/4MiB이며 초과하면 새 prompt 없이 명시 실패한다. Windows 드라이브/역슬래시 UNC를 sameWorkspace가 거부하는 제한과 한국어 OS IME 실기 미측정은 남는다.

현재 확인한 두 수정은 ① read/resume 동안 snapshot에 없는 live를 보관해 marker 뒤 한 번 배출하고 terminal snapshot과 같은 late started/delta를 억제하며 현재 실행/승인 도착 시 새 prompt를 막는 것, ② historical unknown 합성 종료를 같은 선택·thread/turn의 실제 live 시작에서만 해제하고 explicit empty 완료를 omitted/null/malformed와 구분해 반영하는 것이다. 과거 저장 이력만으로 실행·승인을 재생하지 않고 실제 terminal/live 완료·EOF guard는 유지한다.

## 사용자 여정과 기준별 검사

| 여정 | 구체 입력과 행동 | 기대 결과 | 기준 | 실제 확인 방법·현재 한계 |
|---|---|---|---|---|
| UC-OSS | 고정 Ovis revision의 행/입력/인용 코드와 고지를 읽고 Markdown 답변·공개 설명·명령·변경·승인을 표시, 코드복사·인용 | 출처/변형이 추적되고 비공개 reasoning/raw HTML을 표시하지 않으며 인용이 초안에만 들어감 | AC-1 | 출처/반입 코드 대조와 기존 input/row/projection/GUI 검사. 현재 전체 build·GUI 영수증은 source GO 후 이 UUID로 새 연결 |
| UC-HISTORY | 같은 cwd·originator=www 저장 대화 선택→list/read/resume/turns-list→같은 thread 후속 입력 | 공개 이력 복원, 과거 승인/실행 재생 없음, read/resume 실패 시 새 prompt·turn/start 없음 | AC-2 | conversations/lifecycle/session 실제 stdio 합성 검사 및 과거 실제 Native 단문 재개 표본을 구분. 새 실제 계정 crash 복합 실측 아님 |
| UC-QUEUE | idle child 종료 뒤 새 연결 read 응답 전에 snapshot에 없는 item/completed를 주입. 동일 완료·새 item·현재 승인·2001건 초과도 비교 | marker 뒤 새 live 한 번, 중복 완료/late terminal delta 억제, 현재 승인/실행 시 새 prompt 차단·해소 뒤 수동 재시도, 초과 명시 실패 | AC-2·AC-3 | native-history-implementation의 baseline red와 189개 집중 검사. 실제 stdio 합성 child이며 모델/GUI race 검증 아님 |
| UC-OPEN | 명시적 저장 대화 open의 첫 read 응답 전에 terminal turn/started·중복 완료를 주입하고 다른 새 turn/현재 승인/변경 완료를 대조 | terminal 실행 재활성화·중복 없음, 후속 선택·전송 가능. 현재 실행/승인만 전송·선택을 차단하고 해소 뒤 해제 | AC-2·AC-3 | 실제 stdio red→226개 집중 묶음. 실제 Native 모델/GUI race는 별도 미실측 |
| UC-ACCEPT | 동일 대화의 active disconnect/idle ready 상태에서 명시 open 중2001건을 주입하고 새 전송을 시도 | open 실패 뒤 ready/interrupted를 확정하지 않고 재열기 전 전송 차단. 성공 snapshot/queue/예약 수용 뒤만 accept | AC-2·AC-3 | 실제 stdio red→248개 집중, Root post. 실제 모델/GUI race 아님 |
| UC-TIMESTAMP | inProgress 턴에 완료시각0/정수·null/누락/invalid·terminal status·빈완료 summary와 미완료 항목을 복원해 현재 같은scope 시작/delta 제공 | 유효 완료 권위는 닫힘 유지, 잠정 항목만 재개. 완료정보 없는 legacy는 완료를 발명하지 않음 | AC-1·AC-2·AC-3 | 현재 설치 schema 공통 속성 대조와 순수 parser/project 회귀, 실제 Native 시각0 관측 아님 |
| UC-LIVE | inProgress 저장 이력을 순수 restore→project하고 같은 scope/thread/turn의 현재 turn/started+delta를 제공. no-start·다른 thread/turn/process/generation/selection·terminal/EOF 비교 | historical만이면 unknown/working=false, 현재 시작에서만 새 공개 진행 표시. 실제 완료/EOF 이후 늦은 delta는 차단 | AC-2·AC-3 | native-projection-implementation의 red와 최종 210개 집중 검사. 순수 parser/project 경계이며 실제 DOM은 아직 별도 probe 준비 중 |
| UC-EMPTY | 기존 text/output/changes 후 정식 완료에 명시 빈 문자열/빈 배열, 대조로 누락/null/잘못된 값 제공 | 명시 empty는 기존 값과 절단 표시 제거. omitted/null/malformed는 기존 의미 유지 | AC-1·AC-2·AC-3 | 순수 projection red→green, 설치0.167.2 schema의 필수 text/changes·선택 aggregatedOutput 대조. 실제 DOM 새 probe 미실행 |
| UC-REGRESSION | 대화별 초안/읽기/펼침, 전송 실패·중복·중단·composition 이벤트와 실제 Electron 합성 transport를 대조 | 기존 초안/선택/승인/중단 의미 유지하고 실제 모델·OS IME·Windows 미실측을 분리 | AC-3·AC-4 | source GO 후 이 UUID의 집중·타입·build·실제 Electron 합성 검증과 직접 Terra 독립 감사. 과거145/246/UI20 표본은 당시 source 증거 |

## 이력과 현재 인계

변경 전 전체 문서/원장/보고서는 chat008/chat006-integration/before와 before-manifest.json에 원문 SHA로 보존한다. 과거 Opus fail·실제 Native/GUI 관측·criteria evidence summary는 당시 이력이고 현재 적용성을 override하지 않는다. 이 UUID의 read/status와 tasks.md의 단일 현재 단계로 재개한다. 부모021 typed 호스트와 worker189→210 결과는 출처이며 이 UUID의 새 verification/review로 복사하지 않는다. 최종 보고서는 이 UUID에서 새 검증·문서 검토·고유 독립 감사 뒤 저작한다.

## 명시적 대화 열기 terminal 경합 수정 회수

Chat008의 실제 Terra6 fail은 명시적 open이 자동 재연결과 달리 queue를 무필터 replay하는 차이를 찾았다. 완료 snapshot의 늦은 turn/started가 activeTurnId를 다시 켜 입력/선택을 막는 실제 stdio red를 먼저 확인했다. 별도 부모021 aggregate host 범위에서 native-session.ts/test 두파일의 두 줄 filter 적용과 새 실제 stdio4회귀를 저작했다. 기존 raw queue·selection/candidate/client·현재 승인/새 실행·bounded 실패/rollback guard는 유지한다.

입력 composition 이벤트 포함 Native7파일226 PASS/0 FAIL·877 expect와 source diff/SHA는 chat008/native-explicit-open-implementation에 동결했다. actual Native 모델/GUI/Windows/OS IME 실기는 아니며, worker의 병렬 파일 typecheck exit2 원문은 그대로다. 이후 followups-authoring-result.json에서 부모021 UUID의 aggregate typed post ok/sourceStable/errors0·실제 타입/구조 accepted·BoxBox disabled를 읽었다. 이006의 고유 영수증으로 복사하지 않는다.

현재 Root check/build가 진행 중이므로 새 제품verify/감사를 시작하지 않는다. 기존006 선행 attempt-62221972의210개 검사는 그 source의 당시 PASS이며 이번 변경 뒤 현재 적용성은 공식 status로 다시 평가한다. build/source GO와 별도 DOM probe 결과 뒤 이006의 입력·초안/composition·Native226개 및 GUI 기준을 새 실행으로 연결한다. 과거4AC 정의·fail·summary를 수동 변경하지 않는다.

## 현재 Native8 원자적 수용·완료 시각 수정 뒤

actual Terra7 `review-ae76acf4-6213-4c34-9252-c59866c116f3`는 명시적 open의 ready/interrupted 확정이 queue 검증보다 앞서는 문제와, inProgress snapshot의 이미 완료된 item까지 잠정 재개하는 문제를 지적했다. 당시 문서4개는 Chat008의 history/before-native-atomic-fix-*.md.txt와 chat008/audit7-history-preservation.json에 SHA 일치로 보존했다. 이전 설계에서 ThreadItem의 variant만 보고 공통 completedAtMs를 놓친 범위도 정정한다. 현재 설치0.167.2 schema에는 completedAtMs integer|null 공통 속성이 실제 존재한다.

부모021 Native8 저작에서 lifecycle.open은 read/resume/history 준비와 최종 accept를 분리했다. 같은 대상의 기존 ready는 준비 시작에 무효화하고 queue 한도·예약·snapshot·필터/drain을 main이 수용한 뒤 현재 selection/client/thread를 다시 확인해 accept해야 ready를 확정하고 interrupted를 해제한다. 수용 실패/closed/대체된 준비는 옛 token으로 확정할 수 없다. 동일대화 active disconnect+overflow와 idle 기존ready+overflow 뒤 전송 차단·성공 재열기를 실제 stdio 합성으로 검사했다.

publicItem은 실제 제공된 유한 안전정수 completedAtMs만 보존한다. **0도 유효 시각이며 unknown으로 바꾸지 않는다.** 이는 합성 경계값 검사이고 실제 Native가0을 보냈다는 실측은 아니다. 누락/null/string/fraction/NaN/Infinity/정밀도 밖 값은 완료 권위로 발명하지 않는다. 유효 시각 또는 해당 종류의 terminal status로 완료된 항목은 unknown 턴의 실제 live 시작 뒤에도 닫힘을 유지한다. 완료 증거가 없는 잠정 item만 같은 scope에서 재개한다. 시각이 있는 빈 공개 reasoning summary와 뒤따른 historical 정식 완료도 종료 권위를 보존하며 private reasoning 본문은 내보내지 않는다. 본문 중복 비교는 완료 시각 metadata와 분리한다.

원문·diff·8 source SHA는 `.www/evidence/resume-20261116/native-atomic-timestamps/worker/`에 동결했다. red2 실패 뒤7파일 **248 PASS/0 FAIL·936 expect**, 실제 앱/도구 엄격typecheck exit0을 확인했다. parent authoring-result.json은 별도 work-40ae2dc5-86db-4b52-b1fc-09ca61c58898의 injected 협업/실제 tool process, aggregate post ok/sourceStable/errors0·BoxBox disabled 출처다. 이를006의 고유 새 검증/감사 영수증으로 복사하지 않는다.

actual Native 새 모델/GUI/Windows/OS IME·drive/UNC는 이248개에서 새 측정하지 않았다. 완료 metadata 없는 legacy 항목의 실완료 여부를 완벽히 알 수 있다고 주장하지 않으며, 과거 snapshot만으로 실행하지 않고 현재 실제 시작 뒤의 잠정 재개만 제공한다. 이미 유실된 사건·2000건/4MiB 초과 한계는 유지한다. 소스 동결 신호 뒤 이006의 current 입력을 새 공식 검증·문서 영향 검토·고유 actual Terra로 회수하며 GUI/buildslot은 침범하지 않는다.

현재 재개에서 직접 읽은 정본25의 source/copy SHA는 `.www/evidence/resume-20261116/chat008/methodology-manifest.go8.json`에 보존했다. Native8 뒤 주요21 선택은 local-source-manifest.go8.json이며 전체 official source digest와 다르다. 앞선214/226/248개 등은 각 명령/시점의 범위이고, 이UUID 현재 실행 수와 적용성은 뒤의 새 공식attempt/status에서 판단한다.

## 현재 fileChange 종료 보존 교정 회수

설치 schema의 PatchApplyStatus.declined를 public parser·종료권위·최종표시에 보존하고, 파일 late started의 closed/EOF/다른turn/nonrunning guard를 내용변경 전에 검사했다. 미완료 unknown 항목의 같은scope 현재 재개는 유지하고 정식 새 authoritative 완료는 갱신한다. 별도4파일 red2→270개/962expect·strict0은 native-declined-completion/worker의 실제 순수/stdio 묶음이며 actual Native/GUI/Windows 실측이 아니다.

원래 보고서잠금 실패와 이후 공식 멱등 현재 pre/post 재조회 PASS를 구분한다. 원본post 미회수 결과를 재구성하지 않았고 parent021 영수증을006 고유 검증/감사로 복사하지 않는다. 현재 source에서006 검사를 직접 재실행하고 GUI slot 뒤 고유 actual Electron 검증을 회수한 다음 모든4AC usable일 때 문서검토/감사/보고서/complete를 수행한다.

</details>
