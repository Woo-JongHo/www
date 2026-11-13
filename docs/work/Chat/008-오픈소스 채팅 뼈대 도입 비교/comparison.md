# 오픈소스 채팅 뼈대 도입 비교

## 사용자 정정 — Herdr 같은 완성 앱을 기준으로 비교

사용자는 후속 답변에서 “내가 말한 오픈소스는 Herdr 같은 인기가 많은 것들”이라고 비교 대상을 구체화했다. 아래 초기 assistant-ui 우선 권장은 사용자 선택이 아니며 현재 도입안으로 확정하지 않는다. 비교의 중심을 재사용 UI 라이브러리에서 실행·세션·채팅을 갖춘 에이전트 작업 앱으로 바꾼다. 기존 보고서는 정정 이전의 조사 이력이다.

2026-11-12 공식 GitHub에서 Herdr main 50,471 stars, Herdr desktop 2,771 stars, Ovis 2,034 stars를 조회했다. 수치는 조회 시점의 인지도 지표이며 실제 품질·안정성의 증거가 아니다.

| 후보 | 공식 소스에서 확인한 뼈대 | WWW와의 중요한 차이 |
|---|---|---|
| Herdr runtime | 터미널을 백그라운드에서 유지하고 클라이언트 재접속·에이전트 상태를 제공 | 구조화된 Chat RPC가 중심인 현재 WWW와 실행 계층이 다름 |
| Herdr desktop | Rust·GPUI·Ghostty 기반 창, space/tab/pane, JavaScript mod와 layout | Electron·React 화면을 그대로 교체할 컴포넌트가 아님. 외부 runtime 연결과 전체 포크를 구분해야 함 |
| Ovis | Herdr 생태계의 React·TypeScript 채팅·승인 카드·라이브 터미널, Electron 앱 | Codex transcript·pane/process 연결을 사용해 WWW app-server 이벤트와 단순 호환하지 않음 |
| T3 Code | Electron·Codex 연계·대화 영속성·복구를 갖춘 전체 앱 구조 | 큰 server/client-runtime/contracts/Effect 경계와 WWW 고유 기능 이주 비용 |

근거:

- [Herdr README](https://github.com/herdrdev/herdr/blob/ee5bfb5041bb3e4a49d591c72308aae3c81ecdde/README.md): runtime·세션 유지·재시작 뒤 복구 의미를 확인했다. 서버·머신 재시작 전 프로세스가 그대로 살아남는다고 해석하지 않는다.
- [Herdr desktop README](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/README.md), [Cargo](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/Cargo.toml), [mod 문서](https://github.com/herdrdev/herdr-app/blob/4c8c622d7965a6f6787f55b1896b70795fc68918/docs/mods.md): 실제 runtime과 화면의 책임, Rust/GPUI와 JavaScript mod 경계를 확인했다. 라이선스 표기는 Apache-2.0이다.
- [Ovis README](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/README.md), [package](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/package.json), [Electron package](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/app/electron/package.json): 채팅·승인·터미널과 React/TypeScript/Electron 소스를 확인했다. 라이선스 표기는 MIT이고 PTY 관련 Rust sidecar도 있어 전체 코드를 TS 전용으로 단정하지 않는다.
- [Ovis Codex 처리](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/server/codex.ts): rollout·transcript와 Herdr pane/process를 연결한다. [daemon 연결](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/server/codex-daemon.ts)은 skills 조회만 수행하고 thread·turn·approval을 보내지 않는다고 소스에 명시돼 있다. app-server가 언급된다는 이유만으로 현재 WWW의 전송 경로와 같다고 보지 않는다.
- [기존 skillshare 참고 경로](https://github.com/runkids/skillshare/blob/f1faa4bdd5faa163ce50dcf9350c3a2622884486/herdr/skillshare/README.md)는 Herdr용 skillshare 관리 패널이다. Herdr 본체의 채팅 엔진을 가져온 이력이 아니다.

현재 판단은 Herdr를 실행·세션 뼈대의 기준, Ovis와 T3 Code를 실제 채팅 앱 뼈대의 비교 대상으로 삼는 것이다. 단지 언어가 다르다는 이유로 Herdr 외부 runtime 연결까지 제외하지 않는다. 사용자 정정 이후 후보 설치·실행·이식과 새 독립 검토는 아직 수행하지 않았다. 아래 초기 비교와 검토 통과는 이 추가 조사의 실행 검증으로 승격하지 않는다.

## 결론과 결정 상태

사용자는 개발 작업용 채팅을 완성하고 싶으며, 이미 공개된 오픈소스의 실제 코드 뼈대를 가져오는 방법을 검토하길 원한다. 2026-11-12 조회 기준으로 전체 앱 기반은 T3 Code가 가장 직접적인 후보이고, 현재 WWW 안에 채팅 뼈대를 도입하려면 assistant-ui가 작은 경계를 제공한다. 이는 소스 조사에 근거한 저자 판단이며 실행·이식 성공 판정은 아니다.

권장은 **WWW의 Electron·Native 실행부를 유지하며 assistant-ui의 채팅 UI와 ExternalStoreRuntime을 도입하는 방식**이다. 대화 저장·Native 재개는 UI 라이브러리 도입만으로 해결되지 않으므로 별도 연결해야 한다. 전체 앱 기반 교체가 목표라면 T3 Code를 우선 비교 실행할 수 있지만, 현재 구조와 개발·보고서 기능의 이주 범위부터 결정해야 한다. 두 방법을 동시에 도입하지 않는다. 사용자 선택 전 제품 코드와 의존성은 변경하지 않았다.

## WWW의 현재 상태 — AC-1

확인 소스는 src/main.ts, shared.ts, renderer.tsx, projection.ts, input.ts, native-chat.ts와 현행 Chat 명세다. HEAD는 4ef13d29b18188642bf7f7bef6c7d1bb60bfc3c8이며 작업 시작 때 커밋 절차 관련 별도 미커밋 변경이 있었다. 이를 보존했다.

| 사용자 행동 | 코드에서 확인한 상태 | 남은 범위 |
|---|---|---|
| 폴더를 선택하고 요청 | startThread/startTurn과 중복 제출 방지, 실패 시 초안 복구 | 첫 스레드 후 폴더 변경 제한, 새 대화 관리 없음 |
| 답변·공개 설명 읽기 | 스트리밍과 공개 요약, 비공개 reasoning 제외 | 본문은 일반 텍스트, Markdown·코드 복사 UI 없음 |
| 명령·파일 변경 확인 | 명령 카드·출력·diff·미확인·절단 표시 | 긴 이력과 변경 검토의 사용자 경험 보강 |
| 승인·중단 | 승인 ID 보존, 중복 응답 억제, 중단 접수와 실제 종료 분리 | 실제 Native 변경·승인 전체 실기 검증 공백 |
| 작업 흐름·사용량 확인 | 턴별 활동·Skill 읽기·Hook·토큰·quota 투영 | 수신하지 않은 관측은 제공하지 않음 |
| 앱을 닫았다가 대화 재개 | API는 startThread/startTurn 중심, 메모리 최근 2,000개 사건 | 목록·영속 저장·읽기·동일 Native thread 복구 없음 |
| 개발 기록·리포트·생태계 | 별도 제품 기능이 존재 | 전체 앱 교체 시 다시 통합할 비용 |

이번 npm run check는 exit 0으로 끝났다. 소스 정책·작업 계약·앱/도구 타입 검사·Node/Bun 테스트·빌드가 실행됐다. Node 테스트 147개 통과를 확인했다. 이 결과는 현재 코드의 기준선이며 새로운 오픈소스 통합이나 실제 Electron GUI·Native 승인·Windows·한국어 IME 실기 통과를 뜻하지 않는다.

## 공개 코드와 도입 경계 — AC-2

외부 내용은 공식 저장소의 고정 SHA로 확인했다. README만으로 동작을 보증하지 않고 실제 소스·패키지 계약과 구분한다.

### assistant-ui: 현재 WWW에 넣을 채팅 뼈대

조회 SHA: 53ab9cbae076b569b37189795b93b71af0a40117.

- [공식 README](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/README.md)는 Thread·Message·Composer·ThreadList 같은 조합형 구성과 Markdown·코드 표시 등을 안내한다.
- [실제 ExternalStoreAdapter](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/packages/core/src/runtimes/external-store/external-store-adapter.ts)는 messages·convertMessage·onNew·onCancel·승인 응답 및 thread adapter 경계를 제공한다. 현재 AppEvent 투영을 상태 원본으로 유지할 후보다.
- [외부 상태 연결 문서](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/apps/docs/content/docs/runtimes/custom/external-store.mdx)는 상태와 저장을 호스트가 소유하고 callback에 따라 기능을 켜는 구조다.
- [예제](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/examples/with-external-store/app/MyRuntimeProvider.tsx)의 응답은 데모다. 해당 예제를 그대로 복사해 Native 연결 완료로 취급하지 않는다.
- [패키지](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/packages/react/package.json)는 React 18/19를 지원하고 다른 라이브러리에 의존한다. 최신 소스의 버전은 npm 배포·실제 설치 호환성을 검증한 값이 아니다.
- [MIT 라이선스](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/LICENSE)를 확인했다. 실제 도입 때 해당 고지와 도입 revision/패키지 버전을 보존한다.

직접 얻을 수 있는 것은 채팅의 화면·조합·상호작용 뼈대다. Native thread 영속성·승인 정책·명령 실행·재연결은 WWW 책임으로 남는다. 편집·재생성·분기 callback을 실제 Native 동작에 연결하지 않고 노출하면 대화와 실행 상태가 달라질 수 있다. 초기 이식에서는 지원한 기능만 켠다.

### T3 Code: 전체 개발 채팅 앱 기반

조회 SHA: ee90bdc9405d8d4b8ff78ce2133ccb04844298ab.

- [공식 README](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/README.md)와 [Electron package](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/desktop/package.json)에서 데스크톱·Codex 지원과 Electron 의존성을 확인했다.
- [구조 문서](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/docs/internals/overview.md)는 서버가 provider·파일·Git을 소유하고, client-runtime이 공유 상태를 소유하며, DB transaction으로 사건·projection·outbox를 기록하는 구조를 설명한다.
- [Codex client](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/packages/effect-codex-app-server/src/client.ts)는 Effect와 생성 protocol/schema에 의존한다. [패키지](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/packages/effect-codex-app-server/package.json)는 private workspace 패키지이며 단일 공개 npm 의존성처럼 넣을 수 있다고 확인하지 않았다.
- [ChatMarkdown](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/web/src/components/ChatMarkdown.tsx)과 [ChatComposer](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/web/src/components/chat/ChatComposer.tsx)는 contracts·client-runtime·Effect와 환경 상태 등에 연결돼 있다. 한두 파일 복사로 가져올 수 있는 독립 위젯으로 보기 어렵다.
- [MIT 라이선스](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/LICENSE)를 확인했다. 루트 build scripts에는 Rust resource-monitor도 있으므로 전체 프로젝트를 순수 TypeScript만으로 단정하지 않는다.

대화 저장·복구까지 포함한 완성 앱 기반을 원할 때 유력하다. 현재 WWW에 조각을 추출하기보다 별도 기반으로 실행·검증하고 WWW 고유 기능을 이주하는 접근이 더 명확할 수 있다. 하지만 재연결·보안·영속성의 의미가 같다는 실제 비교 실행은 아직 없다.

### AionUi와 Cline

별도 조사 전문은 .www/scratchpad/chat-skeleton-upstream.md에 보존했다. 다음은 회수한 실제 소스 근거다. 제품의 실행·이식 검증은 수행하지 않았다.

- AionUi의 [구조 문서](https://github.com/iOfficeAI/AionUi/blob/e108b6b56b1a6eb99a00904878d0582f657b2908/docs/architecture/overview.md)와 [개발 안내](https://github.com/iOfficeAI/AionUi/blob/e108b6b56b1a6eb99a00904878d0582f657b2908/docs/contributing/development.md)는 대화·영속성을 별도 공개 AionCore에 둔다. [Core Cargo](https://github.com/iOfficeAI/AionCore/blob/503a87199eb978790ca77675b39c84b241535bf3/Cargo.toml)는 Rust·HTTP/WS·DB 구조다. UI만 가져오면 저장 엔진까지 따라오는 것은 아니다. [UI 라이선스](https://github.com/iOfficeAI/AionUi/blob/e108b6b56b1a6eb99a00904878d0582f657b2908/LICENSE)는 Apache-2.0이고, Core 루트 LICENSE와 Cargo 메타데이터의 라이선스 표기가 달라 실제 반입 범위에서 대조가 남는다.
- Cline의 [desktop README](https://github.com/cline/cline/blob/50e77bc1e8f7ab023b7986821e4b5f82ff51b8c4/apps/examples/desktop-app/README.md)는 Tauri·Bun sidecar·Next.js를 사용한다. [실제 session](https://github.com/cline/cline/blob/50e77bc1e8f7ab023b7986821e4b5f82ff51b8c4/apps/examples/desktop-app/sidecar/chat-session.ts)은 자체 엔진에 연결돼 Native 대체 비용이 있다. [라이선스](https://github.com/cline/cline/blob/50e77bc1e8f7ab023b7986821e4b5f82ff51b8c4/LICENSE)는 Apache-2.0이다.
- 별도 [@cline/ui README](https://github.com/cline/cline/blob/50e77bc1e8f7ab023b7986821e4b5f82ff51b8c4/sdk/packages/ui/README.md)와 [ADOPTION](https://github.com/cline/cline/blob/50e77bc1e8f7ab023b7986821e4b5f82ff51b8c4/sdk/packages/ui/ADOPTION.md)은 대화·도구·diff 표현 계층을 분리한다. Native 실행·저장·승인과 Markdown 정책은 호스트가 소유한다. agent-chat은 React 18.3/19, message-scroller는 React 19가 필요하다. 조사 담당자의 npm view는 0.2.0을 반환했으나 설치는 하지 않았다. 초기 API의 정확한 버전 고정과 scroller 외부 패치 요구가 남아 assistant-ui보다 첫 연결의 불확실성이 크다고 판단했다.

| 후보 | 가져올 실제 뼈대 | WWW에서 추가할 책임 | 판단 |
|---|---|---|---|
| assistant-ui | 채팅 UI·외부 상태 runtime·Markdown 조합 | Native adapter·저장·재개 | 현재 앱 안에 도입할 우선 후보 |
| T3 Code | Electron 개발 채팅·서버·영속 projection·Codex 연결 | WWW 고유 기능 이주·큰 workspace 유지 | 전체 앱 기반 교체의 우선 후보 |
| AionUi + AionCore | Electron UI와 Rust 대화 backend | Rust·REST/WS·데이터 모델 수용 | 현재 TS 중심 기준에서 교체 범위 큼 |
| Cline 전체 / @cline/ui | 자체 엔진 앱 / 별도 대화·도구 UI | 엔진 교체 / Native와 저장 adapter | 전체 교체보다 UI 패키지의 후속 비교 가치 |

## 가져올 부분과 유지할 부분 — AC-3

| 경계 | 권장안에서의 소유 |
|---|---|
| Thread·Message·Composer·Markdown·코드 표시·일반 메시지 조작 | assistant-ui 패키지 및 공개 UI 뼈대 |
| AppEvent → 대화 메시지 변환 | WWW의 작은 연결 계층 |
| 명령·파일·승인 카드와 오른쪽 활동·사용량 | 기존 WWW 상태 의미를 유지하며 UI에 연결 |
| Native 프로세스·RPC·승인 ID·중단 결과·미확인 상태 | WWW main/preload/rpc |
| 대화 목록·읽기·재개·연결 복구 | 설치된 Native protocol을 확인한 뒤 WWW의 main에 연결 |
| 리포트·생태계·작업 기록 | 기존 WWW 기능 |

저장된 본문을 다시 보여 주는 것과 같은 Native thread로 후속 요청을 보내는 것은 다른 수용 조건이다. UI에서 취소를 눌렀다고 서버 종료가 확인된 것으로 바꾸거나, 결과 불명확 요청을 자동 재전송하는 기능을 도입하지 않는다.

권장 순서는 다음과 같다.

1. 도입 패키지 버전·공개 UI 소스·라이선스를 고정하고 현재 Electron 빌드에서 최소 연결을 검증한다.
2. 답변·공개 설명·명령·승인·diff를 실제 Native 사건으로 표시하고 현재 초안·읽기 위치·IME 동작을 회귀 확인한다.
3. 새 대화·프로젝트별 목록·읽기·동일 thread 재개를 연결하고 앱 재시작 뒤에도 후속 요청이 같은 맥락을 사용하는지 검증한다.
4. 연결 끊김·승인 대기·중단·실패·긴 출력의 복구를 확인한 뒤 채팅 완성을 판정한다.

필수 완료 시나리오는 일반 요청 → 도구 실행 → 승인/거절 → 중단 → 앱 재시작 → 저장 대화 재열기 → 같은 Native thread 후속 요청이다. 최소 macOS 실제 Electron·Native에서 확인하고 Windows는 별도 검증 상태로 남긴다. 첨부·편집·분기·다중 모델은 실제 요구와 backend 지원을 정한 뒤 추가한다.

## 아직 하지 않은 일

오픈소스 설치·실행·코드 도입, 패키지 배포 버전 호환성 시험, 제품 GUI 재검증은 수행하지 않았다. 전체 앱 기반 교체와 기존 앱 안의 UI 뼈대 도입 중 사용자 선택이 남아 있다. 이 문서는 조사·권장안이며 채팅 완성 보고가 아니다.
