# WWW 개발

작업 문서는 `docs/work/<영역>/<최소 3자리 번호>-<작업명>/`에 두며 UUID는 폴더명이 아니라 `work.json`의 기계 식별자다. 기존 작업은 UUID로 스캔해 실제 경로를 찾고, 사람이 보는 목록은 [작업 목차](work/INDEX.md)에서 확인한다. 세부 생성·충돌 규칙은 [공통 작업 기록 계약](skills/WORKFLOW.md)을 따른다.

## 범위와 초기 흐름

이 저장소는 기존 WWW 기능을 계승하지 않고 빈 저장소에서 시작한 Electron 데스크톱 앱이다. 현재 범위는 기존 화면의 3열 배치와 어두운 시각 스타일, 그리고 로컬 `codex app-server`와의 최소 연결뿐이다. 레이아웃은 [runkids/skillshare의 herdr/skillshare](https://github.com/runkids/skillshare/tree/main/herdr/skillshare)를 디자인 참고 자료로만 사용했고 코드는 가져오지 않았다.

사용자는 첫 스레드 전 작업 폴더를 고른 뒤 메시지를 보낸다. 앱은 `initialize`/`initialized`, `thread/start`, `turn/start`, `turn/interrupt`를 수행하고 알림을 화면에 투영한다. 명령 실행과 파일 변경을 표시하며, 지원하는 명령/파일 승인 요청에는 원래 JSON-RPC ID(문자열 또는 숫자)를 보존해 응답한다. 그 외 구조화 요청은 임의 결정을 만들지 않고 지원하지 않는 요청으로 표시한다. 계정 로그인이나 자격 증명 저장·전달은 다루지 않는다.

## 실행과 구성

요구 사항은 Node.js/npm, Bun, Electron 실행 환경, PATH의 `codex` CLI다.

```sh
npm run setup
npm run check
npm start
```

`WWW_CODEX_BIN`은 실행 파일 경로만 바꾼다. 사용자 입력으로 임의 spawn 옵션이나 환경을 받지 않는다.

- `src/main.ts`: Electron 생명주기, 폴더 선택, 검증된 IPC, Codex 프로세스 연결
- `src/rpc.ts`: 크기 제한 JSONL/JSON-RPC 전송, 요청 라우팅, EOF/오류 처리
- `src/projection.ts`: 이벤트를 화면 블록으로 바꾸는 순수 투영
- `src/preload.ts`, `src/shared.ts`: context-isolated 브리지와 공유 계약
- `src/renderer.tsx`: React 화면
- `test/`: 가짜 JSONL child transport와 이벤트 투영의 행동 테스트

전송 프레임은 4 MiB로 제한한다. EOF나 오류가 나면 대기 요청을 실패시키며, 결과가 불확실한 변경 요청을 자동 재시도하지 않는다. 이벤트는 메모리에서 최근 2,000개만 보관하고 개인 원장을 파일로 쓰지 않는다.

## 제외한 기능과 Skills 정책

기존 TUI/PTY 탭, xterm/node-pty, 요청/REPORT/WES 7단계 체계, 기존 에픽·규칙·영수증 훅·런타임 파일과 제어판 기능은 가져오지 않았다. 이 저장소의 `AGENTS.md`가 일반적인 저장소/브랜치/dirty 확인과 변경 보존, 검증, 커밋·푸시 제한을 직접 규정하므로 `woo-entry`는 대체됐다. `woo-feature-template`과 `session-goal`은 옛 TUI 흐름, `woo-commit`·`woo-issue`·`woo-pr`은 옛 control-plane, `html-error-report`는 현재 필요가 없어 제외했다. 깨진 `woo-code-readability` 심볼릭 링크도 복사하지 않았다.

WWW 프로젝트 유형(Desktop 포함)의 `www-spec`, `www-design`, `www-build`, `www-diagnose`, `www-verify`, `www-commit` 여섯 Skills를 `skills/www/`에 채택했다. `.agents/skills/`에는 Codex 호환 클라이언트가 발견할 수 있도록 저장소 내부 정본을 가리키는 상대 심볼릭 링크만 둔다. 이는 현재 GJC 세션을 포함한 모든 클라이언트의 동적 호출 지원을 보장하지 않는다. 이들은 자동 워크플로가 아니며 사용자가 이름을 명시한 경우에 적용한다. `www-commit`은 커밋 준비·실행의 직접 요청에도 적용한다. 준비 요청은 실행하지 않으며 명시적 “커밋해” 요청은 기본 commit + push, “로컬에만” 요청은 commit만 수행한다. 원격 대상·미게시 이력·공개 안전성을 확인하고 force push·merge·release는 제외한다. 상태·증거·파일 생성 시점은 [공통 작업 기록 계약](skills/WORKFLOW.md), 현재 프로젝트 유형의 추가 경계는 [데스크톱 프로필](skills/profiles/desktop.md), 실제 요청의 상세 흐름은 [승인 대기 카드 합성 예시](skills/examples/approval-waiting.md)를 따른다. 미래의 `skills/rpa/`, `skills/web/`, `skills/plugin/`은 필요할 때 별도 채택하며 현재 생성하지 않는다.

첫 제품 목표와 연결 작업의 실행 순서는 [Chat 통합 실행 계획](work/Chat/001-Native%20흐름%20통제와%20가독성/tasks.md)에 모은다. 이는 준비·BoxBox·개발 하네스·Chat 구현·실제 검증·승인된 게시를 잇는 계획이며 현재 구현 완료를 뜻하지 않는다.

개발 세션에서 요청 의도·명시 권한·작업 상태에 맞춰 이 Skills를 불러오고 설계·개발·명세 기록을 잇는 실행 하네스는 [별도 설계 작업](work/Workflow/001-Skills%20실행과%20개발%20기록%20자동화/spec.md)이다. 현재는 설계 초안이며 자동 실행, 전역 훅 설치, 모델 전환, 제품 Chat의 Native 주입이 활성화되지 않았다. 최소 구현안도 프로젝트별 명시 실행 런처와 기록·검증 CLI부터 시작하고, 호스트 adapter는 실제 지원 표면을 검증한 뒤 연결한다.

장기 제품 방향은 별도 브라우저 UI가 아닌 하나의 WWW 데스크톱 앱에서 shared React view와 로컬 Codex 실행·승인을 제공하고, 이후 GitHub의 코드·구조화 기록을 Mac mini가 지정 브랜치별로 검증·색인해 Roadmap/Node/Canvas API 보기를 제공하는 것이다. 이는 목표 설계이며 현재 제품은 메모리 전용이고 서버 통합이 없다. Electron과 Tauri 중 선택도 확정되지 않았다. push 성공과 서버의 commit 색인은 별개이며 원격 실행·소스 동기화는 범위 밖이다.

## 샌드박스 한계

스레드는 `sandbox: workspace-write`, `approvalPolicy: on-request`로 시작한다. 이는 선택한 작업 폴더 쓰기를 허용하는 Codex 정책 설정이지 “폴더 밖의 모든 작업은 반드시 질문한다”는 보장이 아니다. 실제 제한과 승인 발생 여부는 Codex 버전, 플랫폼 샌드박스, 구성, 명령 종류와 서버 정책에 좌우된다. UI는 관찰한 요청만 표시하며 보안 경계가 아니다.

## 검증과 알려진 한계

검증은 `npm run check`로 타입 검사, fake JSONL transport 테스트, 이벤트 투영 테스트, Bun 번들을 수행한다. 테스트는 응답/알림 라우팅, 스트리밍 완료, 숫자 승인 ID 보존, EOF 시 불확실 실패와 무재시도, 지원하지 않는 요청 표시를 다룬다. 합성 fixture 기반이라 실제 사용자 내용은 포함하지 않는다.

주간 사용량을 소비하지 않기 위해 실제 Codex 추론은 실행하지 않았다. 따라서 설치된 CLI의 schema/help로 프로토콜을 확인했지만 live Codex 세션, 실제 승인 왕복, 플랫폼별 샌드박스 동작과 headless Electron 화면은 아직 검증하지 않았다.

## Electron과 Tauri v2 비교 스파이크

`spikes/tauri`는 제품 마이그레이션이 아니라 격리된 비교 구현이다. `src/renderer.tsx`, `src/projection.ts`, `src/index.html`의 React UI·투영·스타일을 그대로 빌드하고, `src/shared.ts`의 `WwwApi`와 동일한 API를 `@tauri-apps/api` invoke/event 위에 얇게 연결한다. 기존 Electron 실행 경로는 바꾸지 않았다. Tauri 백엔드는 Node sidecar가 아니라 Rust가 직접 `codex app-server`를 spawn하고 JSONL JSON-RPC를 처리한다.

### 설정과 실행

Electron:

```sh
npm install
npm start
npm run package:electron
```

Tauri(macOS arm64):

```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o /tmp/rustup-init.sh
sh -n /tmp/rustup-init.sh
sh /tmp/rustup-init.sh -y --profile minimal --default-toolchain stable
npm install --prefix spikes/tauri
PATH="$HOME/.cargo/bin:$PATH" npm run tauri -- dev
npm run package:tauri
```

두 실행 경로 모두 기본적으로 PATH의 `codex`를 사용하며 `WWW_CODEX_BIN`으로 fixture나 다른 실행 파일을 지정할 수 있다. 실제 Codex 추론 없이 재현하는 검증과 번들 비교는 다음과 같다.

```sh
npm run check
npm run test:comparison
npm run package:electron
npm run package:tauri
npm run benchmark:comparison
```

`test/fixtures/fake-app-server.mjs`는 두 백엔드가 공통으로 실제 stdio 프로세스 경계를 통과해 사용하는 fixture다. 스트리밍 delta, 명령 완료, 파일 이벤트, 숫자 ID `42` 승인 응답, interrupt, EOF와 존재하지 않는 CLI를 다룬다. EOF에서 대기 요청은 결과 불확실 오류가 되고 자동 재시도하지 않는다. 렌더러 투영은 기존 테스트를 그대로 공유한다. fixture는 `codex`를 실행하지 않으므로 비교 테스트가 실제 추론을 시작하지 않는다.

### 관찰 결과

2026-11-11 15:57 KST에 Darwin 25.2.0, Apple arm64, Node 22.22.3, Electron 39.8.10, Rust/Cargo 1.99.1, Tauri CLI 2.12.4에서 release 앱을 각각 한 번 만들었다. 원시 결과는 무시된 `.www/evidence/tauri-comparison.json`에 있으며 `npm run benchmark:comparison`으로 다시 생성한다.

| 항목 | Electron | Tauri v2 |
|---|---:|---:|
| unpacked `.app` 실제 파일 합계(심볼릭 링크 중복 제외) | 276,377,104 bytes | 10,916,596 bytes |
| 백엔드·브리지 구현 줄 수(단순 물리 줄) | 204 | 587 |
| WebView 비용 | Chromium을 앱에 포함 | macOS의 공유 WKWebView 사용 |

크기 차이는 관찰됐지만 동일 비용 비교는 아니다. Tauri 수치는 운영체제 WebView 바이너리를 포함하지 않고 Electron 수치는 Chromium을 포함한다. `node_modules`, Rust `target`, 소스 트리는 앱 크기에서 제외했으며 개발 의존성과 빌드 산출물 크기는 앱 번들 결과로 해석하지 않았다.

시작 시간은 프로세스 spawn 시간을 UI 준비 시간으로 오인하지 않기 위해 수치화하지 않았다. 현재 양쪽에서 “React가 렌더되고 입력 가능한 시점”을 동일하게 증명하는 계측이 없다. 메모리도 Electron renderer/GPU 전체와 WKWebView 공유 helper 전체를 신뢰성 있게 귀속하지 못해 parent RSS를 제시하지 않았다. 따라서 startup/memory 반복 횟수는 0이며 감소율을 주장하지 않는다.

이후 실제 release GUI 검증을 위해 두 브리지에 `WWW_PROBE_PATH`가 있을 때만 동작하는 probe를 추가했다. 정상 실행에서는 probe IPC/command가 비활성이고 자동 작업이나 종료가 발생하지 않는다. readiness는 **native entry에서 React mount 뒤 두 번째 `requestAnimationFrame` callback까지의 monotonic 경과 시간**이다. 이는 같은 React 조건을 재지만, 화면 paint 완료나 사용자가 실제 입력할 수 있는 시점의 보장은 아니며 user-interactive latency로 해석하면 안 된다. 그 뒤 공통 renderer probe가 실제 브리지를 통해 thread/turn을 시작하고, fake subprocess가 보낸 알림과 숫자 승인 ID `42`를 받아 `decline` 응답을 왕복한 다음 interrupt와 `interrupted` 완료 알림을 확인하고 JSON을 쓴 뒤 앱을 종료한다.

2026-11-11 KST에 위에서 만든 두 release `.app`의 실제 macOS 실행 파일을 `WWW_CODEX_BIN=test/fixtures/fake-app-server.mjs`로 직접 실행했다. 각 shell의 첫 실행은 warm-up으로 제외하고, 이후 4회는 Tauri/Electron 선행 순서를 바꿔 실행했다. build 시간은 포함하지 않았다.

| readiness 경과 시간 | Electron | Tauri v2 |
|---|---:|---:|
| warm-up(제외) | 865.826 ms | 4,254.406 ms |
| 포함한 warm runs | 1,041.638 / 715.753 / 569.335 / 304.012 ms | 1,958.724 / 1,383.708 / 1,705.227 / 1,268.513 ms |
| warm median (범위) | 642.544 ms (304.012–1,041.638) | 1,544.468 ms (1,268.513–1,958.724) |

원시 결과는 무시된 `.www/evidence/runtime-{electron,tauri}-{1..5}.json`이다. 모든 파일이 숫자 ID, 승인 왕복, `turn/completed`의 `interrupted`, 그리고 fixture 알림 목록을 기록한다. 이 제한된 한 장비 표본에서는 Electron readiness가 더 짧았지만 일반 성능 결론은 아니다. 특히 WKWebView/웹 자산과 OS page cache의 cold/warm 상태, 프로세스 스케줄링, 첫 실행 초기화가 결과에 영향을 줄 수 있다. 전체 helper를 빠짐없이 안정적으로 귀속할 방법을 이 실행에서 확보하지 못했으므로 whole-process memory는 계속 미측정이다.

### 동등성, 비용, 권고

확인한 코어 동등성은 workspace 조회/선택, thread/turn 시작, interrupt, 이벤트 replay/구독, 문자열·숫자 승인 ID 보존, 지원 승인만 응답, 4 MiB frame 제한, 최대 2,000 이벤트, EOF/error 시 pending 실패와 무재시도다. UI는 동일 소스이므로 투영과 스타일 차이는 의도적으로 없다.

587 대 204는 단순 원시 물리 줄 수일 뿐 유지보수 비용의 2.8배라는 증거가 아니다. Rust 수치에는 이 파일에 함께 둔 embedded tests, 더 세로로 펼쳐지는 `rustfmt` 형식, 명시적인 타입·오류 처리도 포함되고 두 경로의 코드 구성도 다르다. 다만 이 스파이크에서 Tauri 쪽이 Rust 소유권·스레드·동기화와 command/event 직렬화를 추가로 가진다는 정성적 차이는 있다. 반면 배포 앱은 훨씬 작았다. Rust 자체가 안전을 보장하지는 않는다. child lifecycle, 승인 ID 검증, IPC 입력 검증, uncertain mutation 무재시도 정책이 실제 안전 경계이며 두 구현 모두 계속 테스트해야 한다.

현재 근거만으로는 **제품을 즉시 Tauri로 전환하지 않는 것**을 권고한다. 앱 크기만이 최우선이면 Tauri의 이점이 크지만, 제한된 readiness 표본은 이 장비에서 Electron 쪽이 짧았고 코드량만으로 유지보수 비용 배수를 산정할 수는 없다. 전체 process-tree 메모리, 실제 Codex 세션, macOS 한국어 IME 수동 입력, Windows 빌드·WebView2·샌드박스가 검증된 뒤 기술 선택을 다시 판단해야 한다. 이 스파이크는 macOS arm64만 빌드했으므로 Windows 동작을 추론하거나 인증하지 않는다.
