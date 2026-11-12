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
