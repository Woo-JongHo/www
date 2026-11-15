# 검증 기록

<a id="attempt-10f6d1c1-7dfa-4291-b525-7a75adbe8856"></a>
## 검증 시도 — 2026-11-15T09:48:32.659Z

- 시도 ID: `attempt-10f6d1c1-7dfa-4291-b525-7a75adbe8856`
- 실행 시각: 2026-11-15T09:48:23.411Z ~ 2026-11-15T09:48:32.659Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `bed0b888e7d0253f59188ac07fee32bd493e98e77b94a9b1ca96af5884851b4a`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37605바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-a8f8dcdb-d458-4e1c-886e-dfd1510d61dd"></a>
## 검증 시도 — 2026-11-15T09:48:42.620Z

- 시도 ID: `attempt-a8f8dcdb-d458-4e1c-886e-dfd1510d61dd`
- 실행 시각: 2026-11-15T09:48:24.504Z ~ 2026-11-15T09:48:42.620Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `bed0b888e7d0253f59188ac07fee32bd493e98e77b94a9b1ca96af5884851b4a`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 481바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## Worktree에서 이어간 검증

사용자 지시에 따라 codex/canvas-focus, ../www-canvas-focus로 작업 상태를 복사해 격리했다. 원본 파일은 이후 수정하지 않았다. 복사한 다른 작업과 이전 004 기반은 .www/worktree-baseline.json에 식별하고 새 저작과 구분한다. 개발 설정·dist·증거는 분리하고 기존 node_modules만 설치물 읽기 링크로 재사용한다.

원본에서 첫 마우스 GUI 검사(.www/evidence/architecture-OWHzwi)는 통과했다. 이후 native HTML 버튼을 키보드로 검사한 시도는 실패했다. 원인은 제품 핸들러가 아니라 CDP key helper가 HTML 기본 활성화에 필요한 virtual key/text를 누락한 것이었다. worktree의 probe에서 실제 Enter/Space 입력 필드를 보완한 뒤, .www/evidence/architecture-C5btwq의 동일 GUI 검사가 통과했다. 새 worktree의 증거 디렉터리가 없던 초기 실행 실패도 보존하고 probe가 디렉터리를 만들도록 수정했다. 실패를 통과로 덮지 않는다.

캡처에서 기본 rail 64px, 중앙 viewport 가로 90%·main 높이 60% 이상, 선택한 대화 세션의 요약과 접힌 상세를 직접 확인했다. 탐색 버튼 Enter/Space와 자세히 보기 Space, 닫기/Escape 포커스 복귀, 노드·검색·참조 요약, Chat 복귀의 목록·초안 보존을 실제 Electron/CDP로 검사했다. Native는 합성 fixture이며 실제 모델·Windows·OS 한글 IME를 새로 검증하지 않았다.

worktree의 npm run build/typecheck/check:source는 통과했다. 원문: .www/canvas-isolated-build.log, .www/canvas-isolated-types.log, .www/canvas-isolated-source.log. BoxBox 원본 project mode off를 새 worktree에만 복원했고 전역 mode는 변경하지 않았다. guide/source 형식 검사나 별도 typed subprocess 저작 호스트의 실행으로 해석하지 않는다.

<a id="attempt-12e04515-a952-4c3b-add5-948854a77a76"></a>
## 검증 시도 — 2026-11-15T09:53:11.432Z

- 시도 ID: `attempt-12e04515-a952-4c3b-add5-948854a77a76`
- 실행 시각: 2026-11-15T09:52:58.198Z ~ 2026-11-15T09:53:11.432Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `72dc061f591509709d6fc85a13ff0dd7db9a59d0c498507a50de6b1921353086`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37645바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-94a42629-9982-4385-aea1-bc72ca027c42"></a>
## 검증 시도 — 2026-11-15T09:53:15.138Z

- 시도 ID: `attempt-94a42629-9982-4385-aea1-bc72ca027c42`
- 실행 시각: 2026-11-15T09:52:58.671Z ~ 2026-11-15T09:53:15.138Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `72dc061f591509709d6fc85a13ff0dd7db9a59d0c498507a50de6b1921353086`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4446바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-3c11cf3d-318b-42c5-bd40-8110a4018806"></a>
## 검증 시도 — 2026-11-15T09:54:55.346Z

- 시도 ID: `attempt-3c11cf3d-318b-42c5-bd40-8110a4018806`
- 실행 시각: 2026-11-15T09:54:39.305Z ~ 2026-11-15T09:54:55.346Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `0a325dc6310a92f82ff2fa4350e288e5e8a59750fbbab753cce2017c2891bec8`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37721바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-e0acf838-0be7-450e-b685-0283183f6cbb"></a>
## 검증 시도 — 2026-11-15T09:54:58.654Z

- 시도 ID: `attempt-e0acf838-0be7-450e-b685-0283183f6cbb`
- 실행 시각: 2026-11-15T09:54:40.221Z ~ 2026-11-15T09:54:58.654Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `0a325dc6310a92f82ff2fa4350e288e5e8a59750fbbab753cce2017c2891bec8`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4446바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 소스 검사와 범위

최종 leaf 노드의 동작 안내를 '요약 보기'로 맞춘 뒤 공식 generator로 재빌드했다. 현재 worktree에서 집중 검사 attempt-3c11cf3d-318b-42c5-bd40-8110a4018806과 실제 Electron GUI attempt-e0acf838-0be7-450e-b685-0283183f6cbb가 모두 종료 0, sourceStable true, passed다. 이전 결과는 이전 소스의 이력으로 유지한다.

React 변경은 기존 화면 전환 상태와 DOM을 유지하는 label/접근 가능한 이름, 지도 로컬 상태와 선택 요약에 한정했다. 새 IPC·Native 요청·부수 효과·외부 의존성을 추가하지 않았다. native button의 Enter/Space는 실제 CDP 입력으로 검증하며 제품에 가짜 키 핸들러를 추가하지 않았다. TODO/FIXME/test.skip/only 검색에서 추가 미구현이 없음을 확인했다. 변경 파일 whitespace 검사도 통과했다.

집중 검사는 계층·snapshot·구조 계약·개념 모델 네 파일이며 전체 하네스 검사나 전체 저장소 검증 통과로 확대하지 않는다. 사용자 선택·입력 상태는 map/Chat 왕복으로 관찰한 범위만 주장한다. 자동 형식 검사 off와 직접 Codex 세션 저작, 실제 Electron＋합성 Native, 독립 검토의 책임을 구분한다.

<a id="attempt-b4e3050a-6d06-4d13-9875-dd529679b69c"></a>
## 검증 시도 — 2026-11-15T09:56:02.856Z

- 시도 ID: `attempt-b4e3050a-6d06-4d13-9875-dd529679b69c`
- 실행 시각: 2026-11-15T09:55:47.365Z ~ 2026-11-15T09:56:02.856Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `0a325dc6310a92f82ff2fa4350e288e5e8a59750fbbab753cce2017c2891bec8`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 통합 결과와 필수 검토 차단

통합 attempt-b4e3050a-6d06-4d13-9875-dd529679b69c는 종료 0, sourceStable true, passed다. 실제 Electron＋합성 Native의 화면 전환·초안/읽기 위치·승인/중단을 검사했다.

검토 review-0e0ea302-2ac6-4931-b453-483b69df65a6는 Opus 세션 한도(claude_usage_window_exhausted, HTTP 429)로 중단됐다. CLI는 Asia/Seoul 22:30 재설정을 알린다. 원문 .www/evidence/reviews/review-0e0ea302-2ac6-4931-b453-483b69df65a6/opus.json. 공유 core의 Terra 대체 시도도 소스 읽기 도구 부재 응답과 observedModel 누락으로 수용하지 않았다. 원문 .www/evidence/reviews/review-0e0ea302-2ac6-4931-b453-483b69df65a6/terra.json. 코드 결함의 확정과 검토 미완료를 구분한다.

기능 검사와 문서 검토는 통과했으나 필수 감사가 미완료이므로 done을 주장하지 않는다. Opus 한도 복구 후 같은 worktree·UUID·현재 digest에서 검토와 완료 판정을 이어간다. 원본 파일·스테이징·커밋·push는 이후 변경하지 않았다.


## 종료 준비 중 Terra 재시도

사용자가 미완료 검증에 Terra를 사용하라고 명시했고 이후 재진행을 요청했다. 실제 `codex exec --model gpt-6.1-terra --sandbox read-only --ignore-user-config --ephemeral`로 런타임 확인을 시도했다. CLI 헤더는 모델 gpt-6.1-terra·provider openai·approval never·sandbox read-only를 표시했으나 실행은 사용량 제한으로 종료 코드 1이었다. READY 응답도 생성되지 않았으므로 코드 검토를 실행·통과한 것으로 세지 않는다. 원문은 `.www/evidence/terra-runtime-probe/stdout.txt`, `stderr.txt`에 보존했다. 로그는 2026-11-18 15:37 재시도 안내를 출력했으며 재설정 시각을 실제 복구나 자동 예약으로 해석하지 않는다.

기존 Terra JSONL 경로는 실제 모델 메타데이터를 제공하지 않고 소스 읽기도 수행하지 못했다. 비 JSON 런타임 헤더는 실제 CLI 모델 정보를 제공한다는 점만 확인했고, 검토 어댑터 수정이나 새 검토 결과 수용을 완료했다고 주장하지 않는다. 제품·실행 코드는 종료 준비 과정에서 추가 수정하지 않았다. spec/design/tasks의 현재 결정과 인수인계 문장만 보완한다.


## Terra 요청 독립 검토와 회귀 발견

사용자의 반복된 Terra 검증 요청에 따라 호스트의 gpt-6.1-terra 지정 읽기 전용 검토자를 실행했다. 원문은 .www/evidence/terra-host-review/review-1.md에 보존했다. 검토자는 실제 모델·호스트 메타데이터를 독립적으로 관측하지 못했다고 명시했으며, 요청한 모델을 CLI 관측값으로 바꾸어 쓰지 않는다. 이 결과를 기존 process 영수증으로 위조하거나 공유 core의 승인으로 등록하지 않는다.

검토는 상세를 연 뒤 returnTo(전체·ancestor·뒤로)로 이동하면 무조건 닫히는 결함과 현행 명세의 모순을 찾아 FAIL로 판정했다. 새 실제 Electron assertion을 먼저 추가해 .www/terra-red-gui.log 및 .www/evidence/architecture-ikNvgt/result.json에서 '열어둔 상세는 ancestor 이동에서도 유지' 실패를 재현했다. 기존 검사는 같은 경로에서 current ID만 검사했으므로 이 결함을 관찰하지 않았다.

구현의 강제 닫기 한 줄을 제거하고 현행 명세·코드 설계도·개발 안내를 맞췄다. 사용자 명시적 닫기 동작은 유지하며 ancestor·뒤로·전체 각각의 열림 보존 검사를 추가했다. 제품·검증 소스가 바뀌었으므로 과거 PASS를 새 소스의 PASS로 승격하지 않고 다시 검사한다. 후속 독립 검토 결과를 별도로 보존한다.

<a id="attempt-c5a0f2e1-6412-4d6a-845d-f4a40b553ccb"></a>
## 검증 시도 — 2026-11-15T10:12:06.416Z

- 시도 ID: `attempt-c5a0f2e1-6412-4d6a-845d-f4a40b553ccb`
- 실행 시각: 2026-11-15T10:11:50.350Z ~ 2026-11-15T10:12:06.416Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f4dd7a44fc2e0974caaca88142f265c609bcd889fdc89f06e92b643e1da735e9`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37663바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-bb1a2765-a7a0-4f4b-8103-8a822800c2ba"></a>
## 검증 시도 — 2026-11-15T10:12:09.934Z

- 시도 ID: `attempt-bb1a2765-a7a0-4f4b-8103-8a822800c2ba`
- 실행 시각: 2026-11-15T10:11:51.350Z ~ 2026-11-15T10:12:09.934Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f4dd7a44fc2e0974caaca88142f265c609bcd889fdc89f06e92b643e1da735e9`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4653바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-2c89027e-7b97-4390-ab81-5ba3e71d68a0"></a>
## 검증 시도 — 2026-11-15T10:12:48.760Z

- 시도 ID: `attempt-2c89027e-7b97-4390-ab81-5ba3e71d68a0`
- 실행 시각: 2026-11-15T10:12:32.855Z ~ 2026-11-15T10:12:48.760Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f4dd7a44fc2e0974caaca88142f265c609bcd889fdc89f06e92b643e1da735e9`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## Terra 요청 호스트 재검토 PASS

읽기 전용 검토자 /root/terra_verify의 2차 판정은 PASS다. 전문은 .www/evidence/terra-host-review/review-2.md에 보존했다. 요청 모델은 gpt-6.1-terra이며 검토자도 실제 모델·호스트 메타데이터는 독립 미관측으로 명시했다. 검토자는 핵심 4개 파일의 SHA-256을 상태 기록과 대조했고 추가 차단 결함을 발견하지 못했다. 부모도 검토 전후 전체 공유 assessment source digest a124ae0a334cbd6248e5b4919e309c1a902bd216544103c695163208255251e6가 같은 것을 확인했다.

현재 GUI attempt-bb1a2765-a7a0-4f4b-8103-8a822800c2ba, 집중 검사 attempt-c5a0f2e1-6412-4d6a-845d-f4a40b553ccb, 통합 attempt-2c89027e-7b97-4390-ab81-5ba3e71d68a0는 passed/종료 0/sourceStable true다. 실제 red 재현 후 수정·green과 별도 저자/검토자 패스로 확인했다.

호스트 검토 PASS와 공유 core의 process 영수증 수용은 구분한다. 이번 결과를 CLI stdout·observedModel·서명 영수증으로 꾸미거나 기존 Opus/Terra 실패 이력을 바꾸지 않는다. 현재 core는 이 호스트 검토 형식을 수용하지 않으므로 최종 done은 기록하지 않는다. 사용자 요청의 Terra 검토 결과와 해결한 결함은 보고서에 반영하고, 자동 완료에는 실제 모델 관측과 수용 가능한 검토 영수증 연결이 남는다.

<a id="attempt-4040015d-bd6a-4876-b0a8-5c9fbf092888"></a>
## 검증 시도 — 2026-11-15T12:45:44.121Z

- 시도 ID: `attempt-4040015d-bd6a-4876-b0a8-5c9fbf092888`
- 실행 시각: 2026-11-15T12:45:19.226Z ~ 2026-11-15T12:45:44.121Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `62d56f00e0393144c472159a81a6394ce54d07d57c2254ed36612a6499a81607`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4653바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-29ddfd7f-8010-40ca-a7fe-f442072c1761"></a>
## 검증 시도 — 2026-11-15T12:48:41.389Z

- 시도 ID: `attempt-29ddfd7f-8010-40ca-a7fe-f442072c1761`
- 실행 시각: 2026-11-15T12:48:26.555Z ~ 2026-11-15T12:48:41.389Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `c03e2379bf2137cc1eb19c72dd551e8563907a527e373bd2be3aef209ddaca55`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4653바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-21b1177e-de1a-49d0-a548-cdd29a54f71b"></a>
## 검증 시도 — 2026-11-15T12:51:30.863Z

- 시도 ID: `attempt-21b1177e-de1a-49d0-a548-cdd29a54f71b`
- 실행 시각: 2026-11-15T12:51:14.433Z ~ 2026-11-15T12:51:30.863Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `1136f15bde889d4563d364a31dc2eab38221a1d9472acdaa48810d843a9c347b`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4888바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 실제 CLI Terra 추가 발견과 회귀 수정

review-24d020b9-f6ee-48aa-8d7d-685e954e47cf는 실제 gpt-6.1-terra process FAIL로 탐색 토글 시 자동 배율·위치 초기화와 계층 이동 뒤 선택/포커스 불일치 2건을 발견했다. .www/ui-terra-regression-red.log에서 자동 배율·지도 이동 후 탐색 열기의 실패를 재현했다. 탐색 열림 변경을 layout effect에서 관측해 수동 뷰 상태를 유지하고, 키보드 이동 뒤 현재 parent 노드를 포함해 초점을 찾도록 수정했다. .www/ui-terra-green.json과 .www/evidence/architecture-ADeBry/result.json에서 실제 Electron의 두 회귀 조건 및 기존 UI 전 시나리오가 통과했다. 타입·소스 정책·공식 빌드는 .www/ui-terra-*.log에 통과 근거를 보존했다.

<a id="attempt-6bea6d55-7326-430d-9ba4-7d4a738ce974"></a>
## 검증 시도 — 2026-11-15T12:53:40.820Z

- 시도 ID: `attempt-6bea6d55-7326-430d-9ba4-7d4a738ce974`
- 실행 시각: 2026-11-15T12:53:25.664Z ~ 2026-11-15T12:53:40.820Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `bd5471d10664a9bd8e866bd671417d267497b32ec6d73629a0885cc7472eff98`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 4888바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 현재 소스 최종 실제 검토

review-1ee6eeeb-d130-4087-a592-9e6d43384f5e는 실제 process·읽기 전용·관측 모델 gpt-6.1-terra·종료 0·PASS이며 공유 core가 현재 소스/기준/정책·초기 CLI 헤더·정확 argv·원문 해시·Opus 소진 영수증을 대조해 수용했다. 서버 내부 모델 라우팅의 독립 증명은 아니다. 원문은 .www/evidence/reviews/의 같은 검토 ID 폴더에 보존했다. 이전 FAIL과 중간 검토의 한계를 지우지 않았다. 커밋·push·병합·원본 변경 없이 worktree 결과를 보존한다.
