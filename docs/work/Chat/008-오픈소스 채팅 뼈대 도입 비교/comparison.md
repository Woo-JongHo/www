# 오픈소스 채팅 뼈대 도입 비교

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

작업 UUID: `work-029fb7e2-61fa-4014-9362-5e915ab13197`. 기준 정의와 결과의 정본은 work.json이다.

## 현재 결론

Herdr 같은 완성 앱의 실행·세션·채팅 경계를 비교한 결과, **Ovis의 필요한 채팅 동작만 개작**하고 WWW의 Electron·Native JSON-RPC·원장·관측·보고서를 보존하는 방식을 권장한다. Ovis의 행 상태·입력 길이·인용 세 동작은 이미 개작돼 있다. 전체 앱 교체·새 DB 도입이나 추가 코드 반입을 이 조사에서 실행하지 않았다. 정정 전 assistant-ui 우선안은 과거 이력이다.

이 비교의 완료는 현재 소스·고정 원문·라이선스·의존 경계와 단일 권장안의 정확성에 관한 것이다. 외부 앱 설치/실행·제품 이식·Windows/IME 실기를 새 완료 조건으로 추가하지 않는다. **외부 앱 호환 PASS가 아니다.**

## 현재 WWW의 구현·검증·한계 — AC-1

| 사용자 흐름 | 직접 읽은 현재 책임 | 실제 근거와 남은 한계 |
|---|---|---|
| 프로젝트/새 대화/저장 대화 선택 | renderer/preload의 제한 IPC, native-session의 선택/소유 guard, conversations의 list/read/resume/turns-list | cwd·originator=www·비임시 thread를 검증한다. sameWorkspace는 실행 플랫폼의 Node path.isAbsolute/resolve를 사용한다. Windows drive/UNC의 win32 주입 대조와 실제 Windows OS 미실행을 구분한다. 다른 앱의 모든 원장을 가져오는 기능이 아니다. |
| 자동 재연결·명시적 열기 | 둘 다 현재 thread의 제한된 원본 큐를 snapshot과 대조해 배출한다. completed·interrupted·failed 턴은 같은 thread의 턴 시작과 상태가 같은 턴 완료를 큐 재생에서 제외한다. 이 턴의 최종 snapshot에 있는 같은 item은 item 시작, 코드에 열거된 답변·요약·명령·파일 델타, 공개 필드가 일치하고 선택 공개 필드가 보강되지 않은 item 완료를 제외한다. snapshot에 없는 item의 알림, 목록 밖 델타, 상태나 공개 필드가 바뀐 완료 및 다른 thread·미완료 턴은 이 필터를 통과한다. | read 응답 전 live 유실과 explicit open의 terminal 재활성화를 실제 stdio 합성 red로 먼저 입증한 뒤 수정했다. 현재 승인·새 turn·변경된 정식 완료와 다른 thread를 구분하는 회귀가 있다. 실제 Native/GUI의 임의 race 전체는 미측정이다. |
| 복원 실패 뒤 재시도 | lifecycle.open의 준비와 accept를 분리한다. main이 queue/예약/snapshot/drain 및 현재 scope를 수용한 뒤 ready/interrupted를 확정한다. | active disconnect와 idle 기존ready 모두 동일대화 overflow 뒤 전송을 차단하고 성공 재열기 뒤에만 허용하는 실제 stdio 회귀를 실행했다. 2000건/4MiB 초과는 명시 실패이며 이미 유실된 사건을 되찾는 기능은 아니다. |
| unknown 이력과 현재 진행 | 현재 설치 schema의 유효 completedAtMs 또는 지원되는 terminal status를 보존하고 확인된 완료 항목은 닫힘을 유지한다. 미완료 잠정 항목만 같은 scope의 실제 live 시작에서 재개한다. |0은 유효 안전정수 시각이며 unknown과 다르다.0은 합성 경계값 검사이지 실제 Native가0을 보냈다는 관측이 아니다. 누락/null/invalid timestamp와 완료정보 없는 legacy의 실완료 여부를 발명하지 않는다. |
| 답변/공개 요약/파일 변경 읽기 | Markdown/GFM·코드복사·인용·초안/펼침은 WWW 구성요소가 맡는다. live item/completed 투영에서 본문/출력의 explicit empty와 빈 changes 배열은 기존 값을 교체한다. 혼합 malformed live changes가 유효 항목만 남겨 기존 목록을 지운 반례는 과거 실패다. 현재 수용 요구는 명시 빈 배열의 제거·전체 유효 배열의 교체와 omitted/null/malformed의 보존을 구분하는 것이며, 교정 완료와 실제 결과는 최신 verification/status에서 확인한다. 저장 parser와 live projection의 검증 범위를 혼동하지 않는다. fileChange declined도 거절된 종료로 보존한다. | completed/failed/declined 파일의 late started는 상태와 diff를 바꾸지 않으며 새 authoritative 완료는 갱신한다. 저장 reasoning.summary와 live 완료 요약은 배열 전체가 문자열일 때만 유효한 공개 요약으로 받는다. 예를 들어 ["공개",42]처럼 혼합된 배열은 기존 요약을 덮어쓰지 않으며 명시 빈 배열은 공개 요약을 비운다. 저장 parser와 live projection의 해당 보존·빈값 경계는 각각 회귀로 확인하며, 다른 항목의 모든 정규화가 동등하다고 확대하지 않는다. 저장 이력의 정규화는 공개 요약만 복원한다. 전환 중 수신한 사건의 재생 경계는 아래 한계에 포함한다. HTML 실행·외부 링크/이미지 처리는 기존 제한을 따른다. |
| 승인·중단·리소스/모니터·리포트 | typed ID/token·서버 해소·실제 종료와 요청 접수를 구분한다. 리소스 읽기/역할 선언/하네스·업무완료는 다른 사실이다. | 현재 구조와 회귀를 확인한 범위다. 실제 모델의 일반 승인/변경 전 구간·모든 Hook 실행·비동기 내부 작업·Windows/OS IME까지 통과했다고 쓰지 않는다. |

대화 전환 중 늦은 리소스가 들어오는 경계는 남아 있다. 현재 drainPreviousThread는 이전 대화의 원장 쓰기를 비동기로 예약한다. 같은 전환에서 reserve의 commit 또는 release가 먼저 완료될 수 있다. 이전 탭의 리소스 쓰기가 늦으면 새 탭의 currentResources가 이전 탭의 pending 수집을 기다리지 않아 첫 조회에서 빠진 항목을 볼 수 있다. src/native-session.ts의 배출·소유권 변경·조회 순서를 읽어 확인한 한계다. 지연된 저장과 탭 교대를 함께 재현하는 현재 테스트는 이 비교에서 실행하지 않았다. 구현 후속 범위는 Chat/006의 다른 탭 재열기·동일 대화 보존에 연결한다.

복원 큐에서 공개 요약이 달라진 reasoning 완료 사건은 저장 snapshot과 달라 이벤트 로그로 재생될 수 있다. 이 경로에서 원본 item이 넘어가면 서버가 함께 보낸 비공개 필드까지 renderer 경계에 들어갈 수 있다. src/native-lifecycle.ts의 중복 판정과 src/native-session.ts의 배출을 정적으로 확인한 결과다. 기존 테스트는 요약이 동일해 해당 사건을 제거하는 경우를 다룬다. 일반 live 알림에도 같은 전달 경계가 있다. 현재 thread의 일반 알림은 params를 그대로 publish하므로 비공개 추론 delta 또는 비공개 필드가 포함된 item도 로그와 renderer의 이벤트 입력에 들어갈 수 있다. 이 판단은 입력 전달 코드에 대한 정적 대조다. 화면 표시나 실제 Native 계정에서의 수신은 여기서 검증하지 않았다. 일반 알림과 복원 큐의 공개 필드 제한, 이를 증명할 합성 재현은 제품 보완 범위다.

출처 고지는 `docs/third-party/ovis.md`다. main 패키징 커밋 `956b848fde782b91c22197717302f9141772c46e`는 이 파일을 앱에 포함하고, 정식 ZIP을 만들기 전에 패키지 내부 고지를 저장소 원문과 바이트 단위로 비교했다. 고정 Ovis의 chatRowState/composerLength/chatQuote를 WWW 행·100,000자 입력·thread/cwd 초안에 맞게 개작했고 Ovis의 전역 store·PTY·터미널 전송·DB 읽기층은 반입하지 않았다. [실제 main 배포 실행](https://github.com/Woo-JongHo/www/actions/runs/45099232114)

### 검사와 provenance

Native 수정은 별도 부모 Workflow021(`work-40ae2dc5-86db-4b52-b1fc-09ca61c58898`)의 협업 저작으로 수행됐다. 이008의 새 검증/감사 영수증으로 복사하지 않는다.

| 출처 | 실제 관찰 | 범위 |
|---|---|---|
| native-history-implementation | stdio read 전 유실 red→189개 집중/strict | 자동재연결 queue/marker·승인·한도 |
| native-projection-implementation | 순수 red2→210개 집중/strict | historical unknown live와 explicit empty |
| native-explicit-open-implementation | stdio red1→입력 포함226개 집중 | explicit open terminal 필터. worker 당시 병렬 파일 strict exit2 원문도 보존했고 이후 aggregate 검사와 구분한다. |
| native-atomic-timestamps/worker | stdio/순수 red2→248개/936 expect·strict0 | open 최종수용, 유효 완료시각·빈 요약·legacy/종료/scope |
| native-declined-completion/worker | 순수 red2→270개/962 expect·strict0 | 실제 PatchApplyStatus.declined·파일 late started 상태/diff guard |

위270개는7파일/input 포함 worker 검사다. 이008의 별도 공식 집중은6파일이며 현재 실제 수와 sourceStable은 새 verification/status에서 확인한다. 합성 stdio·순수 투영·SSR은 actual Native 모델이나 실제 Electron을 대신하지 않는다.

마지막 declined typed wrapper는 core 반환 뒤 보고서 enableReports의 전역 원장 잠금 경합으로 실패했다. 실패 원문과 원래 host 종료를 보존하고 원본 post JSON을 재구성해 PASS로 쓰지 않았다. `native-declined-completion/authoring-result.json`의 recovery는 별도 공식 멱등 pre/post 현재 재조회이며 ok/sourceStable/errors0·BoxBox disabled다. injected 협업과 실제 tool process를 구분하고 disabled를 PASS로 바꾸지 않는다.

과거 Chat006의 실제 Native 단문·동일 thread 재개, 실제 Electron+합성145/246 항목 및 부모 UI20/관측14/unit159 표본은 각 당시 source의 관측이다. 과거122초 원인을 확정하지 않는다. 이 조사에서 upstream 앱이나 새 Native/GUI 복합 시나리오를 실행하지 않았고, 변경 뒤 현재 GUI 수용은 별도006 등의 작업이 회수한다.

## 완성 앱의 고정 소스 비교 — AC-2

2026-11-15에 선택한 고정 revision의 참조를 보존 Git 문서에서 확인했다. 2026-11-23에 원문 참조 45개를 GitHub의 같은 고정 commit URL에서 새로 받아 모두 HTTP 200을 관찰했다. 각 문서 URL, 요청한 raw URL, 수집 시각, 바이트와 SHA256은 `.www/evidence/resume-20261116/chat008/upstream-fetch-manifest.json`에 있다. 초기 수집은 당시 이력으로 남기며 현재 매니페스트는 이번 재수집의 근거다. 버전은 해당 revision의 manifest 선언으로, 설치된 버전·배포 최신 버전·WWW 호환 성공을 뜻하지 않는다. 별 수는 2026-11-12의 과거 인지도 관측만 이력에 보존하고 현재 추천 점수로 사용하지 않는다.

| 후보·고정 revision | 실제 코드·패키지·라이선스 근거 | 가져오는 실행 경계와 WWW 비용 |
|---|---|---|
| Herdr runtime `ee5bfb5041bb3e4a49d591c72308aae3c81ecdde` | [Cargo.toml](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/Cargo.toml): Rust `herdr` 0.9.5, `portable-pty =0.9.0`와 vendor patch. [PTY actor](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/pty/actor.rs): master reader/writer·입력·resize·shutdown. [session.rs](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/src/session.rs): 명명 세션·local socket·중지/삭제. [LICENSE](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/LICENSE): Apache-2.0 | 터미널/프로세스·세션의 기반. [README](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/README.md)는 클라이언트 detach 뒤 작업 유지와 서버/머신 재시작 후 layout·지원 agent 재개를 구분하며 원 프로세스 생존은 부정. WWW 외부 runtime으로 연결 가능성을 언어만으로 제외하지 않지만, 구조화 RPC의 승인·중단·이력 의미를 PTY와 대응하는 새 adapter가 필요 |
| Herdr desktop `4c8c622d7965a6f6787f55b1896b70795fc68918` | [Cargo.toml](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/Cargo.toml): Rust `herdr-app` 0.1.15, `gpui-pre =0.3.8`·`ghostty-sys`. [main.rs](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/src/main.rs)와 [terminal.rs](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/src/terminal.rs): GPUI/terminal 연결. [LICENSE](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/LICENSE): Apache-2.0 | [hc.rs](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/src/hc.rs)는 **별도 herdr-core**의 `hc connect` framed JSON-RPC와 `terminal.run/attach/kill` 등을 사용. 위 herdr runtime 저장소와 같은 API라고 가정하지 않음. 전체 포크는 GPUI 화면·core 운영과 WWW 기능 이주, mod는 앱의 별도 확장 계약. React 위젯 교체가 아님 |
| Ovis `d505c75e26c54f31573057d1e9aa431ecc56677f` | [package.json](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/package.json): 0.5.3, React `^19.3.0`, Bun `1.4.2`, node-pty·xterm. [Electron package](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/app/electron/package.json): desktop version 0.0.0, Electron 45.2.2. [LICENSE](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/LICENSE): MIT | [codex.ts](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/server/codex.ts)는 rollout/transcript와 Herdr pane/process를 연결한다. WWW Electron/React와 가깝지만 전체 포크는 Bun server·PTY·store·인증/연결 경계의 채택도 수반한다. WWW는 현재 Electron `^39.2.1`·React `^19.2.0`를 선언하므로 manifest 차이를 무검증 호환으로 취급하지 않는다 |
| T3 Code `ee90bdc9405d8d4b8ff78ce2133ccb04844298ab` | [README](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/README.md), [desktop package](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/desktop/package.json): 0.1.9, Electron 44.10.1. [구조 문서](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/docs/internals/overview.md): server·client-runtime·영속 projection·outbox. [LICENSE](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/LICENSE): MIT | Codex 지원·대화 영속성의 전체 앱 비교 후보. 사건·projection·outbox를 DB transaction으로 묶는 자체 orchestration을 수용하고 WWW 원장·리포트·관측과 중복/이주를 정해야 함. 현재 POSIX 범위의 Native 단문 재개는 존재하므로 “저장이 없으니 교체” 논거는 맞지 않음. 플랫폼별 경로 처리·bounded 복원과 실제 Windows OS·Native/GUI 임의 race 미실측은 별도 검증 비용 |

Ovis의 codex.ts는 `bun:sqlite`도 import하며 이는 전체 앱의 transcript/Native 상태 읽기 결합 경계다. 이 코드나 DB 읽기층을 WWW에 반입했다고 주장하지 않으며 부분 개작 세 파일에는 이 전송/저장 계층을 포함하지 않았다.

Ovis의 [codex-daemon.ts](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/server/codex-daemon.ts#L13-L20)는 기존 Codex 제어 socket에 읽기 전용 연결하며 `initialize`·`initialized`·`skills/list`만 보내고 thread·turn·approval 메서드를 보내지 않는다고 명시한다. 실제 `REQUESTS`와 요청 타입도 `initialize | skills/list`로 제한돼 있다. 이 파일에 app-server가 등장한다는 사실은 WWW의 stdio thread/turn/approval 전송 호환 근거가 아니다. README의 기능 소개도 해당 코드와 별도인 제품 실행 주장으로 구분한다.

MIT/Apache-2.0 표시는 위 고정 revision의 실제 루트 LICENSE와 manifest를 읽은 결과다. 이 표의 전체 앱 라이선스만으로 vendor/native 의존성의 모든 고지 의무를 대조했다고 주장하지 않는다. 부분 반입은 가져온 파일·revision·원본 고지와 결합 경계를 함께 보존해야 한다. Ovis 세 파일과 현재 개작본·docs/third-party/ovis.md를 다시 대조했으며 chatQuote 원본의 pane/draft store·compose/replyComments 결합은 그대로 반입하지 않았다. Herdr의 portable-pty vendor patch, desktop의 GPUI/ghostty vendor 경계, T3의 private Effect workspace 의존도 전체 채택 비용에 포함한다. 외부 설치·실행·호환 성공은 측정하지 않았다.

초기 이력의 AionCore 라이선스 불일치는 같은 고정 commit의 LICENSE를 보충 회수해 확인했다. [루트 LICENSE](https://github.com/iOfficeAI/AionCore/blob/503a87199eb978790ca77675b39c84b241535bf3/LICENSE)는 Apache-2.0이고 이미 회수한 Cargo workspace.package.license는 MIT다. 보충 URL은 기존 comparison에서 직접 추출된 45개와 구별해 supplemental-license-fetch.json에 기록했다. 이 차이는 해소됐다고 판단하지 않는다. 이번 중앙 DB 구축·원장 이전은 범위 밖이며 T3/AionCore의 DB 책임은 후보 교체 비용 비교일 뿐 WWW 중앙 DB 도입 권장이 아니다.

Herdr desktop의 프로세스 지속성은 별도 core가 소유한다. 이번에는 desktop의 core 연결 코드까지 확인했으며 herdr-core 전체의 저장·crash 복구·라이선스 전파·WWW adapter 실행은 조사하지 않았다. 이 미확인을 runtime README의 복구 약속으로 채우지 않는다. AionUi·Cline·assistant-ui의 초기 조사와 라이선스는 아래 2026-11-12 이력이며 이번에 다시 검증한 현행 비교 후보와 구분한다.

## 보존 경계와 권장 이유 — AC-3

| 방식 | 가져올 것과 비용 | 판단 |
|---|---|---|
| Herdr runtime 연결 | PTY·세션 운영을 얻지만 구조화 승인/중단/원장/관측 adapter가 필요 | 외부 runtime 가능성은 언어만으로 제외하지 않는다. 현재 구현을 대체할 동기와 새 검증 범위가 필요하다. |
| Herdr desktop 전체 포크 | GPUI·별도 herdr-core 운영과 WWW 고유 화면/보고서 이주 | 작은 React 부품 반입과 다른 규모다. |
| Ovis 전체 기반 | Bun server·PTY·store·버전/인증 경계 수용 | Electron/React가 비슷하다는 사실만으로 현재 Native 의미가 유지되지 않는다. |
| Ovis 필요한 동작 개작 | 기존 세 동작과 추가로 필요한 공개 UI 패턴을 파일별 출처/결합 분리 | 권장안이다. WWW Native/원장/관측·보고서를 보존하고 추가 파일마다 라이선스/회귀를 확인한다. |
| T3 전체 기반 | 영속 projection/outbox·DB transaction 기반 orchestration과 이주 | 중앙 DB를 이번 범위에 추가하지 않는다. 필요한 기능/이주 비용을 별도 결정한다. |

다음 부분 반입은 가져올 파일·revision·고지와 실제 사용자 이득을 정한 뒤 현재 Native/선택/승인/중단/복원 회귀와 비교한다. 실제 성능·비용 시간을 측정한 값은 없으며 전체 앱 실행/이식 성공도 주장하지 않는다.

## 현재 증거와 과거 이력

고정45 URL과 보충 LICENSE의 새 원문·HTTP 시각·bytes/SHA는 chat008 증거에 있다. 옛 `.www/comparison-evidence`는 이 사본에 없으며 당시 원문을 복구했다고 쓰지 않는다. 현재 source 선택/정본 SHA는 최신 local-source-manifest/methodology-manifest에, 전체 source는 공식 capture에 기록한다.

과거 Terra1~8의 실제 fail·권한·canonical 원문·당시 문서 SHA와 원장 summary는 보존한다. 좁은 Astra terminal 반박은 기존 late-delta 계약의 설명을 지지한 읽기 전용 판단이며 전체008 감사나 후속 실제 제품 수정 PASS가 아니다. 과거 evidence.summary의 “현재 적용 가능”은 기록 당시 요약이고 현재 적용성은 공식 status/evaluateEvidence가 계산한다.

이 정리 전의 문서 전문은 [이력 사본](history/before-final-closure-comparison.md.txt)이다. 정정 전 assistant-ui 우선안, 옛 구현 공백·미실행/성공/실패·누적 정정 문구를 그 원문에서 읽는다. 현재 권장안과 남은 행동은 이 문서/spec/tasks와 마지막 read/status를 따른다.

## 이전 수정·검증 기록 — 아래 현재와 수치는 당시를 뜻함

<details>
<summary>Terra8 이후와 통합 반례 수정의 당시 기록</summary>

## Terra8 이후 수정과 현재 검증 범위

고유 actual Terra8(`review-6714dd3d-9aca-4f6c-8912-3f294687f7f5`)의 당시 fail은 보존한다. 이후 Native 수정은 A→B open 중 A의 실행·승인 사건을 A/B 합산 2,000건·4 MiB 한도 안에서 보관하며, 성공·실패 전환에서 기존 선택의 활성 상태와 승인을 잃지 않고 overflow의 불확실한 전송을 차단한다. 개별 완료 없는 running file은 turn 종료에서 결과 미확인으로 닫고 변경 내용을 보존한다. 현재 집중검사 429개(12파일, 실패 0)는 이 두 경계의 실제 stdio·순수 투영 회귀를 포함한다. 현재 Electron+합성 stdio의 Native UI·Chat 전체·관측 DOM 검사를 실행했으며 실제 모델·OS 한국어 IME·Windows 검증으로 확대하지 않는다. 새 UUID별 독립 감사와 복합 완료 판정은 별도다. 혼합 changes 및 저장/live 요약의 정규화 차이는 위 표의 현재 한계로 유지하며 코드 해결로 주장하지 않는다. 과거 원문은 `.www/evidence/resume-20261116/chat008/audit8-result.json`과 canonical review 경로, 새 실행 전문은 `.www/evidence/resume-20261116/native-closeout/focused.*` 및 `gui-*`에 보존한다.


## 통합 반례 수정 뒤 최종 검증

후속 actual Terra가 발견한 terminal 복원 뒤 live 늦은 시작, 전환 overflow 뒤 재열기 차단, 공개 진행 조각의 위치·누락 완료 처리, 거절 집계, 사용량·Hook·Subagent 현재성 경계는 같은 작업 범위에서 수정했다. 과거 fail과 재현은 삭제하지 않았으며 `repair-wave-2`와 `repair-integration`에 실제 red/green·공식 사후 결과를 보존한다. classifier는 구조 허용 책임에 맞춰 기존 `chat-status`로 통합했고 문자열 언급을 실제 검사로 세지 않는다. 최종 실행 원문은 `.www/evidence/resume-20261116/native-closeout/final-current`에 별도로 수집한다. 새 고유 독립 감사와 복합 완료 판정 전 이 문서만으로 제품 또는 조사 작업의 완료를 선언하지 않는다. 혼합 malformed changes의 부분 투영과 저장/live reasoning summary 정규화 차이는 여전히 위 표의 한계다.


</details>
