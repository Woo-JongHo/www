# 검증 기록

<a id="2026-11-12-구현-검증"></a>
## 2026-11-12 구현 검증

- 소스: `028b4a378885938c43e9172b7534fc4e83e7d57e` 위 dirty 작업 트리
- `npm run check`: 통과. Bun 테스트 37개, TypeScript 검사, 번들 빌드 통과.
- `node scripts/check-workflow.mjs`: 통과.
- `node scripts/check-skill-library.mjs`: 통과.
- `git diff --check`: 통과.
- Electron fixture GUI probe: 숫자 승인 ID `42`의 거절 왕복, 스트리밍 알림, 명령·파일 사건, 중단 요청과 `interrupted` 완료를 실제 Electron 브리지에서 확인했다. 로컬 원본은 Git에서 제외된 `.www/evidence/work-e2419fa7-3d27-4c77-812b-2b825326dc70/electron-probe.json`에 있다.
- 같은 probe에서 입력 초안과 선택 범위가 스트리밍 사건 뒤에도 유지됨을 확인했다. 실제 창 캡처 `electron-chat.png`에서 실행 박스, 응답 완료 카드, 공개 설명 미제공, 관측 결과, 검증 비자동 승격, 미해결 요약과 sandbox 한계 문구를 확인했다.
- 실제 Native: `codex login status`는 `Logged in using ChatGPT`; read-only `codex exec`는 `package.json`의 `name`을 `www`로 응답했다. Vercel MCP의 `invalid_token` 경고가 있었으나 해당 로컬 읽기는 완료됐다. 실제 app-server GUI의 승인 edge는 실행하지 않았고 fixture 증거와 구분한다.
- BoxBox `check --source`: 수정 TypeScript/TSX 구문은 유효했다. `shared.ts` 4개, `projection.ts` 5개 그룹은 `FIXABLE`; `main.ts` 4개, `renderer.tsx` 5개 그룹은 승인되지 않은 형태로 `REFUSE`; 테스트는 감지 그룹이 없었다. 작성 전 guide를 누락했으므로 자동 훅 적용이나 정렬 완료를 주장하지 않는다.

### 판정

- AC-1~4, AC-6, AC-7: 단위/fixture/GUI probe 근거로 통과.
- AC-5: 선택 기준이며 영속화는 구현하지 않음.
- AC-8, AC-9: 공개 설명, 관측 결과, 검증, 미해결을 별도 행으로 표시하며 실제 화면 캡처로 통과.
- AC-10: 입력 초안·선택 범위 probe와 하단 추적 조건·새 내용 이동 동작, 실행 박스의 비제어 펼침 상태 구현을 확인해 통과.
- Windows와 한국어 IME 실기, 실제 Native 승인 왕복은 미검증이다.

<a id="2026-11-12-재검토-재검증"></a>
## 2026-11-12 재검토와 재검증

### 앞선 판정의 정정

앞선 검사는 전체 수용을 입증하지 못했다. 부모 검토에서 다른 턴의 완료가 현재 실행을 종료시키는 회귀를 실제로 재현했고, 상태를 `in_progress`로 돌려 재검증했다. 실행 박스의 `toggle.isTrusted`는 프로그램에 의한 토글에서도 참이어서 성공 자동 접힘을 막았다. 실제 Electron에서 이 실패를 확인한 뒤 사용자 클릭·키보드 활성화와 프로그램 갱신을 구분하도록 수정했다. 이전 통과 기록은 당시의 제한된 검사 이력이며, 현재 수용 판정은 이 절의 근거로 대체한다.

### 소스와 검사

- 기준 HEAD: `c6c846c431e45bace81d2760589034c193691443` 위의 수정 작업 트리. 원본 연구 보관소와 그 검사기는 게시 후보에서 제외한다.
- `npm run check`: TypeScript, Bun 63개 테스트, 빌드 통과.
- `node --test test/workflow-harness.test.mjs`: 17개 통과.
- `npm run test:comparison`: 공유 fixture와 Bun 63개, Rust 2개 통과.
- `node scripts/check-workflow.mjs`, `git diff --check`: 통과.
- `test/projection.test.ts`: 다른 턴·스레드의 완료/중단, 늦은 접수 응답, 후속 요청 실패, EOF·미확인 상태, 중복 item, 종료 코드 0/null, 완료에 포함된 긴 출력, 공개 commentary와 비공개 reasoning 분리, 원래 승인 ID를 확인한다.

### 실제 Electron GUI와 Native의 구분

- fixture GUI: CDP 키보드 입력과 Space/Enter로 렌더된 전송·거절·실행 박스·중단 제어를 활성화했다. 성공 자동 접힘, 실패 기본 펼침, 수동 펼침 유지, 초안과 선택 범위, 과거 스크롤 0 유지와 새 내용 이동, 공개 설명·출력 제한을 확인했다.
- 이 GUI 증거는 로컬 `.www/evidence/first-chat-execution/parent-review/electron-final.json`과 `electron-final.png`다. 이후 파일별 제공 diff를 명령 출력과 분리하고 같은 길이 제한을 적용했다. 최종 빌드의 키보드 전송·거절·자동 접힘·수동 펼침·스크롤·중단과 파일 diff 상세는 `electron-acceptance.json`, `electron-acceptance.png`에서 재확인했다. fixture는 실제 Codex 추론이나 실제 파일 변경의 증거가 아니다.
- 실제 Native: 읽기 전용 app-server 계정·사용량 조회에서 인증과 주간 사용률 2%를 확인한 뒤, 실제 Electron → preload → stdio app-server 경로로 도구 없이 `READY`만 응답하도록 한 번 요청했다. `READY`, 턴 시작·완료, 오류 없는 실행 종료를 확인했다. 이후 변경은 늦은 접수·실패 상관관계의 순수 투영과 파일 diff 표현이며 단위 검사와 최종 fixture GUI로 별도 확인했다. 실제 Native 추론을 각 국소 UI 수정마다 반복하지는 않았다.
- Native 원본은 로컬 `native-final-preflight.json`, `native-final.json`, `native-final.png`에 있다. 계정 내용·원본 사건 payload·기기 경로·화면 원본은 공개하지 않는다. 실제 Native 승인 왕복과 변경 작업은 이번 단문 검증으로 입증하지 않는다.
- 마지막 연결 표시 보완에서는 초기값을 `disconnected`로 두고 실제 initialize 응답 뒤에만 `transport/connected`를 게시하도록 양쪽 백엔드를 맞췄다. 새 Electron 프로세스의 `electron-probe-current.json`에서 연결 사건·숫자 승인 ID 42·거절·중단·초안·선택·스크롤을 재확인했다. 기본 홈 폴더가 Git 저장소가 아니라는 stderr 경고는 관측했으며 이를 숨기거나 앱 연결 실패로 분류하지 않았다.
- 선택한 Git 트리를 따로 풀어 검사한 첫 시도에서 TypeScript·Bun·하네스·기록 계약은 통과했지만, Rust 매크로가 생성되지 않은 `frontendDist`를 요구해 실패했다. 빈 산출물로 우회하지 않고 `test:comparison`이 실제 Tauri UI 빌드를 먼저 수행하도록 고쳤다. 공개 후보 검사는 연구용 `skill-library/`와 검사 스크립트 없이 수행한다. 실패 원문은 로컬 `candidate-first-gate-4-failed.log`, 재검사 결과는 `candidate-gate-4.log`·`candidate.json`으로 구분해 남긴다.
- 두 번째 격리 시도는 UI 빌드 후 기본 아이콘 누락으로 실패했다. 전역 `*.png` 제외 규칙이 비교 앱 컴파일에 필요한 32×32 기본 아이콘까지 제외한 것이 원인이었다. 원본을 시각 검토하고 102바이트의 `IHDR`·`IDAT`·`IEND`만 있는 PNG임을 확인한 뒤 해당 한 경로만 예외로 포함했다. 화면 증거나 다른 PNG는 계속 제외한다. 이 자산은 비교용 기본 아이콘이지 제품 브랜딩 완료의 증거가 아니다. 두 번째 실패 원문은 `candidate-second-gate-4-failed.log`에 보존한다.
- 마지막 승인 검토에서 응답이 끝난 뒤 도착한 같은 ID도 막도록 시도 기록을 연결 수명 동안 유지했다. 첫 지연 중복 검사는 응답 1회 이후 중복 사건을 기다리다 10초에 실패했으며, fixture가 실제 `app-server` 인자를 환경 모드보다 우선한 것이 원인이었다. 인자 처리 회귀 검사를 추가한 뒤 실제 Electron IPC에서 ID 42의 요청 2회·첫 요청 지원·지연 중복 미지원·재응답 거부·fixture가 받은 응답 1회를 확인했다. 근거는 `approval-once.json`이며 실제 Native 승인 검증으로 바꾸지 않는다. 같은 화면의 과거 공개 설명에 만든 DOM Range 선택도 중단 사건 후 보존됐다. 이는 실제 드래그나 갱신 중인 텍스트의 선택을 검증한 것은 아니다.

### 수용 기준 대조

| 기준 | 근거 |
|---|---|
| AC-1 | 실제 Native 단문 요청/응답, GUI 입력·초안, RPC/EOF·요청 오류 검사 |
| AC-2 | thread/turn/item 상관관계·출처·공개 phase 투영 검사와 GUI |
| AC-3 | 숫자·문자열 ID, 중복 응답 방지 검사와 숫자 42 거절 왕복 |
| AC-4 | 독립 전송·턴·요청·승인·중단 상태, 불명확/EOF·늦은 응답 검사 |
| AC-6 | context-isolated preload 허용 목록, 텍스트 렌더링, sandbox 한계 표시 |
| AC-7 | item upsert, 양쪽 출력 제한 경로, 0/null 구분, 파일 diff 분리·제한, 자동·수동 접힘 GUI |
| AC-8 | Native 공개 설명과 관측/파생 요약 구분, 승인·실패 카드 GUI |
| AC-9 | 현재 턴별 결과·변경·검사 식별·미해결 표시, 완료와 검증 분리 |
| AC-10 | 초안·입력 선택·수동 펼침·과거 읽기 위치·새 내용 이동 GUI |

AC-5의 영속화·재개는 선택 기준으로 미검증을 유지한다. Windows·한국어 IME 실기와 전체 프로세스 메모리는 이 판정 범위가 아니다. 긴 기록은 최근 2,000개 사건, 명령 출력은 최근 32,768 UTF-16 코드 단위만 보관하므로 완전한 원본 복원이나 영구 읽기 상태 보존을 보장하지 않는다.

### BoxBox 경계

설치된 로컬 런처로 작성 안내와 읽기 전용 source 검사를 사용했다. 첫 작성의 guide 누락은 소급해 통과 처리하지 않는다. 후속 투영·렌더러·테스트·메타데이터 수정에서는 파일별 안내를 확인했다. TypeScript/TSX 구문 검사는 유효하지만 미정렬·`REFUSE`가 남아 있다. 자동 align·수동 공백 우회는 하지 않았으며 가독성 정렬 전체 통과를 주장하지 않는다. 파일별 결과는 로컬 `parent-review/boxbox/`에 있다. GJC 자동 훅 활성화·미지원 언어 검사·모델 전환의 증거가 아니다.
