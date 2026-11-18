# Native 대화 재개 — 현재 경계와 과거 설계

UUID `work-baa0963b-ea71-48e7-a34f-0d229ba704b1`. 기준·권한은 work.json, 여정은 spec.md가 소유한다.

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

| 인계 | 현재 책임·수용 경계 | 검사할 실패와 정상 대조 |
|---|---|---|
| 선택→Native | renderer/preload→native-session의 selection/ownership→conversations의 list/read/resume/turns-list | cwd/originator/ephemeral·이전 client 응답·목록 실패와 정상 동일 thread 재개 |
| 준비→최종 수용 | lifecycle의 준비/accept 분리, native-session의 bounded raw queue·snapshot·예약·drain 뒤 scope 재확인 | count/bytes 초과·현재 실행/승인·명시 재열기 전 차단·성공 재열기 뒤 해제 |
| 저장 이력→본문 | conversations 공개 parser→scoped marker→chat-state→projection | 완료 권위·잠정 unknown·같은 scope 실제 시작·EOF/terminal/다른 scope 격리 |
| 완료 필드→정산 | projection의 text/output/changes 및 공개 snapshot 책임 | 명시 empty 제거·omitted/null/invalid 보존·혼합 malformed changes. 같은 scope 후행 완료 정산과 새 streaming 재개를 구분 |
| 본문/모니터→사용자 | 채팅 projection과 native-activity/Agent 개요의 서로 다른 표시 | 늦은 실행 시작·Subagent 작업 귀속·현재 Progress와 과거 본문의 격리·초안/승인/중단 보존 |

sameWorkspace는 실행 플랫폼의 Node path.isAbsolute/resolve로 경로를 판정한다. Windows drive·UNC 형태는 실제 소유 함수에 win32 의존성을 주입한 대조가 있지만 실제 Windows OS 실행 증거는 아니다. 경로를 무조건 거부한다는 과거 설명과 실제 Windows·OS 한국어 IME 미실행 한계를 구분한다.

과거 189/210/226/248/270개 검사, 초기 DOM 준비 중과 부모 typed 사전/사후는 아래 원문에 보존했다. 현재 source의 새 검증·실제 Electron·actual Native·고유 독립 감사는 같은 UUID의 최신 verification/status에서 판정하며 다른 UUID 영수증을 옮기지 않는다. 새 코드 교정의 성공이나 모든 플랫폼 수용을 설계 문서만으로 선언하지 않는다.

## 과거 문서 원문 — 당시 구현·검사·권한과 다음 행동

<details>
<summary>정정 전 원문 전체</summary>

# Native 대화 재개 현재 설계와 과거 이력

## 현재 재개 설계 — 2026-11-16

같은 UUID `work-baa0963b-ea71-48e7-a34f-0d229ba704b1`와 기존4AC를 유지한다. 이번 저작은 현행 구현·검증 경계를 회수하며 새 제품 구조를 만들지 않는다.

| 여정의 인계 | 실제 호출/상태 소유 | 실패·복원과 확인 |
|---|---|---|
| 사용자 선택→main→Native | renderer/preload의 제한 IPC→native-session의 selection/ownership guard→conversations의 list/read/resume/turns-list | cwd/originator/ephemeral 및 선택 세대 검사. read/resume 실패나 이전 client 응답은 준비 성공으로 수용하지 않음. Windows 경로 제한 유지 |
| 연결 복원→snapshot→화면 | native-session의 현재 thread raw ThreadTransition queue→lifecycle의 복원/ready→snapshot 교체+conversation/reconnected marker→현재 RPC 한 번 drain→기존 chat-state→projection | 2000건/4MiB 초과 명시 실패. terminal 같은 item late started/delta는 내용불문 억제. 변경 authoritative 완료·새 live·현재 승인은 raw로 배출하되 화면 투영도 별도 검사 |
| historical unknown→현재 live | restoreConversationEvents의 historical unknown 합성 종료→projection의 복원항목/범위 추적→실제 같은 scope/thread/turn live 시작 확인 | 이력만으로 working을 켜지 않음. current live 시작 뒤 해당 합성 종료만 해제. 실제 terminal/live 완료·EOF·다른 범위 guard 유지 |
| authoritative 완료→표시 | projection의 text/aggregatedOutput/changes 유효 필드 검사 | explicit empty는 교체, omitted/null/malformed는 기존 내용 유지. 빈 출력은 과거 truncated 표시도 제거 |
| 현재 승인/실행→새 입력 | lifecycle의 typed ID/token pending과 native-session의 activeTurn/interrupt 및 drain 후 idle 재확인 | 복원 중 현재 승인/실행을 받으면 새 prompt/turn/start 차단. 해소 뒤 수동 재시도하며 mutation 자동재전송 없음 |

Native provider 의미는 현재 parser와 부모가 실제 설치 Codex0.167.2에서 modelCalls=0으로 생성한 schema를 기준으로 확인했다. parent native-history/native-projection-authoring-result.json은 Workflow021 UUID work-40ae2dc5-86db-4b52-b1fc-09ca61c58898의 injected 협업 저작을 감싼 typed pre/post이고 toolExecutor=process, sourceStable=true, 타입·구조 accepted, BoxBox disabled다. disabled는 통과가 아니며 이 통합 UUID의 새 저작/검증/감사 영수증으로 옮기지 않는다.

확보된 검사 원문은 queue경계189개(실제 stdio 합성 포함)와 투영 수정 뒤210개(새 경계는 순수 parser/project) 집중 PASS 및 각각 엄격 타입검사다. 실제 Native 새 모델/실제 GUI 복합 race·Windows/IME는 이 검사로 입증하지 않았다. root의 Electron/preload/main/합성 stdio DOM probe는 준비 중이며 실행 결과를 미리 쓰지 않는다. 최종 source 종합 GO 뒤 이 UUID에서 검증·문서 영향 검토·고유 actual Terra를 새로 실행한다.

## 과거 설계 원문 — 당시 환경과 권한

아래 경로/버전/도구/미해결 및 Opus 설명은 원래 저작 시점의 기록이다. 현재 source/정책/실측으로 승격하지 않는다. 현재 직접 Terra 권한은 최신 TASK-RESUME 원문과 공식 ReviewAuthority 경로가 소유한다.

# 오픈소스 채팅과 Native 대화 재개 설계

## 요청과 판단

사용자는 채팅 뼈대를 WWW 요구에 맞게 오픈소스로 통합하고 SSH woojongho에서 구현하도록 요청했다. Herdr·Ovis 같은 실사용 에이전트 앱의 실제 코드가 대상이며 단순 UI 라이브러리 선정으로 끝내지 않는다.

Herdr desktop의 Rust/GPUI 창과 terminal runtime 전체를 도입하면 기존 Electron·Native JSON-RPC·승인 의미와 현재 Skills/Hook 변경을 함께 교체하게 된다. 따라서 Herdr 생태계 Ovis의 React 채팅에서 logical row 상태와 입력·인용 처리 코드를 반입·개작하고, WWW 고유 AppEvent 투영과 main의 Native 권한을 유지한다. Markdown 표현은 react-markdown 10.1.0과 remark-gfm 4.0.1을 고정한다. 실제 사용하지 않는 upstream 조각을 의례적으로 복사하지 않는다.

## 실제 코드 경계

- upstream Ovis revision: d505c75e26c54f31573057d1e9aa431ecc56677f.
- 실제 이식 후보: src/lib/chatRowState.tsx, composerLength.ts, chatQuote.ts의 독립 처리. 반입 파일·함수·변경은 docs/third-party/ovis.md와 저작 헤더로 추적한다.
- Ovis의 PTY submit/terminal 화면 파싱은 Native JSON-RPC를 대체하지 않는다. 도구 실행을 UI에서 다시 수행하지 않는다.
- UI는 대화목록·메시지·입력·읽기 상태를 소유하고, main은 목록 조회·읽기·resume·선택 guard·외부 URL 검증을 소유한다.
- 설치 Codex 0.166.0이 생성한 schema를 검사해 thread/list/read/resume와 history pagination 필드를 정한다. 기억에 의존한 params는 사용하지 않는다.

## 현재 저장소와 보존 범위

원격 /Users/woojongho/woo/00_project/www, main, HEAD 4ef13d29b18188642bf7f7bef6c7d1bb60bfc3c8. Chat 005의 Skills/Hook 사이드바 미커밋 변경과 검토 실패 이력은 다른 작업이므로 보존한다. 로컬 머신의 번호가 같은 조사 작업은 원격에 덮어쓰지 않는다. 이번 원격 통합 작업은 Chat 006과 UUID work-baa0963b-ea71-48e7-a34f-0d229ba704b1다.

원격 초기 node_modules에 types가 없어 npm ci --ignore-scripts로 복구했다. 이후 기존 native-activity-view.tsx configuredThread의 object.threadId 타입 오류 세 건이 남았다. 이 오류는 본 작업이 만든 회귀와 구분하고 동일 동작을 유지하는 좁히기만 적용한다.

## 대화 수명주기 — AC-2

1. cwd에 속하고 originator가 www인 Native 대화를 Native에서 조회하고 cursor 더보기를 제공한다.
2. 새 대화는 현재 턴·미결 승인이 없을 때만 선택을 해제한다.
3. 저장 대화는 읽기와 resume를 수행하고 같은 thread ID로 다음 요청을 보낸다.
4. 공개 user/agent/summary/plan/command/file만 과거 이벤트로 투영한다. private reasoning 본문은 제외한다.
5. 복원은 historical 표시와 complete metadata를 가진 snapshot으로 처리하고, 자동 보고서·Skill/Hook pulse·미결 승인으로 재실행하지 않는다.
6. 전송·승인·실행 중 선택을 차단하며 snapshot을 기다리는 동안 다른 선택이 완료돼도 generation이 다른 응답은 적용하지 않는다.

## 메시지와 입력 — AC-1·AC-3

Markdown은 raw HTML을 실행하지 않는 React 요소로 표현하고 링크는 http/https만 main에서 연다. 원문 줄바꿈·표·목록·코드블록을 읽을 수 있게 하며 코드복사 실패는 사용자에게 표시한다. 인용은 초안에 추가하며 전송하지 않는다.

현재 thread와 block ID로 logical row를 식별하고 대화별로 초안·읽기 위치·펼침을 보존한다. 새 요청을 보내며 최초 생성된 thread로 임시 초안 상태를 이관한다. 기존 Enter/Shift+Enter·한국어 composition 처리, 중복 제출 방지, 실패 초안 복구, 승인 ID와 중단 상태 구분은 유지한다.

## 검증과 위험 — AC-4

- 순수 상태/입력: upstream 이식 동작과 quote·길이 경계·row identity·읽기 상태.
- Native 경계: 실제 schema 기반 fake server와 목록·read/resume·실행중 guard·private 필터·EOF/late 사건·pagination·snapshot 절단.
- 전체 타입·소스 정책·테스트·빌드. 기존 사이드바 실패는 이번 회귀와 별도 기록.
- 실제 Electron과 합성 Native로 새대화·목록·복원·후속요청·Markdown·복사·인용·초안/읽기상태·기존 승인·중단을 검증.
- 실제 Native 표본은 인증·사용량을 이용하며 합성 검증과 구분한다.
- 필수 독립 검토는 공유 core와 Opus 정책을 사용한다. 사용할 수 없으면 미실행 사유를 남기며 대체 성공을 발명하지 않는다.

첨부·메시지 수정·재생성·분기·다중 모델·원격 실행 엔진 변경은 이번 통합에서 별도 요구로 확장하지 않는다.

## 실제 Native 목록 출처 보정

CLI 0.166.0의 app-server가 만든 실제 세션은 source:vscode로 기록된다. sourceKinds enum의 appServer를 실제 저장값으로 단정한 초기 필터가 실기에서 실패했다. appServer/vscode를 조회하되 cwd와 originator:www를 목록·열기에서 모두 검증해 WWW 소유 대화로 제한한다.

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

## 현재 fileChange 종료 보존 교정 회수

설치 schema의 PatchApplyStatus.declined를 public parser·종료권위·최종표시에 보존하고, 파일 late started의 closed/EOF/다른turn/nonrunning guard를 내용변경 전에 검사했다. 미완료 unknown 항목의 같은scope 현재 재개는 유지하고 정식 새 authoritative 완료는 갱신한다. 별도4파일 red2→270개/962expect·strict0은 native-declined-completion/worker의 실제 순수/stdio 묶음이며 actual Native/GUI/Windows 실측이 아니다.

원래 보고서잠금 실패와 이후 공식 멱등 현재 pre/post 재조회 PASS를 구분한다. 원본post 미회수 결과를 재구성하지 않았고 parent021 영수증을006 고유 검증/감사로 복사하지 않는다. 현재 source에서006 검사를 직접 재실행하고 GUI slot 뒤 고유 actual Electron 검증을 회수한 다음 모든4AC usable일 때 문서검토/감사/보고서/complete를 수행한다.

</details>
