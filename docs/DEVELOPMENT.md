# WWW 개발

제품의 목적·범위는 [제품 기준](PRODUCT.md), 모듈 책임·데이터 흐름은 [아키텍처](ARCHITECTURE.md), 의도된 Chat 동작은 [현행 기능 명세](specs/chat.md)에서 읽는다. 이 문서는 개발 환경·실행·검사 방법과 기술 선택의 근거를 다룬다. 일반 개발 요청과 작업 재개는 [WWW 개발 역할](../agents/www/AGENT.md), 기록·권한·완료 규칙은 [공통 계약](skills/WORKFLOW.md)을 따른다.

작업 문서는 `docs/work/<영역>/<최소 3자리 번호>-<작업명>/`에 두며 UUID는 폴더명이 아니라 `work.json`의 기계 식별자다. 기존 작업은 UUID로 스캔해 실제 경로를 찾고, 사람이 보는 목록은 [작업 목차](work/INDEX.md)에서 확인한다. 세부 생성·충돌 규칙은 [공통 작업 기록 계약](skills/WORKFLOW.md)을 따른다.

## 범위와 초기 흐름

이 저장소는 기존 WWW 기능을 계승하지 않고 빈 저장소에서 시작한 Electron 데스크톱 앱이다. 현재 범위는 3열 React 화면에서 로컬 `codex app-server`의 대화·공개 설명·실행 박스·승인·중단·결과를 관찰하고 통제하는 것이다. 레이아웃은 [runkids/skillshare의 herdr/skillshare](https://github.com/runkids/skillshare/tree/main/herdr/skillshare)를 디자인 참고 자료로만 사용했고 코드는 가져오지 않았다.

사용자는 첫 스레드 전 작업 폴더를 고른 뒤 메시지를 보낸다. 앱은 `initialize`/`initialized`, `thread/start`, `turn/start`, `turn/interrupt`를 수행하고 알림을 화면에 투영한다. 명령 실행과 파일 변경을 표시하며, 지원하는 명령/파일 승인 요청에는 원래 JSON-RPC ID(문자열 또는 숫자)를 보존해 응답한다. 그 외 구조화 요청은 임의 결정을 만들지 않고 지원하지 않는 요청으로 표시한다. 계정 로그인이나 자격 증명 저장·전달은 다루지 않는다.

## 기술 결정: Electron과 TypeScript

2026-11-12 사용자 결정으로 WWW의 정식 데스크톱 기반을 **Electron + TypeScript**로 확정했다. Tauri/Rust는 제품 개발 대안으로 계속 추진하지 않으며 기존 비교 스파이크와 측정 기록은 선택 과정의 이력으로 보존한다.

- WWW는 유지자가 직접 사용하는 개인용 앱이다. 불특정 사용자를 위한 범용성을 먼저 최적화하기보다 현재 사용 목적과 직접 유지보수할 수 있는 구성을 우선한다.
- 현재 요구와 개인 사용 흐름에서는 Rust를 선택해야 할 뚜렷한 이유가 없으며, 체감 속도 차이도 언어·프레임워크 전환과 추가 유지비용을 정당화할 만큼 크지 않다고 판단했다.
- 유지자는 Rust에 대한 이해도가 낮고 TypeScript에 익숙하다. Rust를 추가하면 언어·도구체인·프로세스 연동을 이해하고 수정하는 유지비용이 늘어날 수 있으므로 익숙한 TypeScript 중심 구성을 택한다.
- 비슷한 계열의 실사용 데스크톱 앱인 VS Code의 Electron·TypeScript 중심 구조를 참고한다. [VS Code 공식 코드 구조](https://github.com/microsoft/vscode/wiki/Source-Code-Organization)는 core가 TypeScript로 구현되고 데스크톱 workbench가 Electron을 사용하며 main·browser·Node 실행 환경을 분리한다고 설명한다. WWW도 화면과 권한 있는 프로세스, 외부 실행 프로세스의 경계를 명확히 유지하는 방향을 따른다.

이 결정은 이 프로젝트와 유지자의 비용·친숙도에 대한 판단이지 Rust와 TypeScript의 일반 성능이 같거나 Electron이 모든 용도에서 더 빠르다는 주장이 아니다. 아래 비교의 번들 크기·readiness 수치와 측정 한계는 그대로 유효하다. VS Code를 참고한다는 것도 WWW가 VS Code의 전체 계층·Monaco·확장 호스트를 도입하거나 같은 UI 프레임워크를 사용한다는 뜻은 아니다.

## 실행과 구성

요구 사항은 Node.js/npm, Bun, Electron 실행 환경, PATH의 `codex` CLI다.

```sh
npm run setup
npm run check
npm start
```

`WWW_CODEX_BIN`은 실행 파일 경로만 바꾼다. 사용자 입력으로 임의 spawn 옵션이나 환경을 받지 않는다.

## TypeScript 작성 및 하네스

WWW가 소유하는 새 실행 코드·테스트·개발 도구는 TypeScript(`.ts`, `.tsx`, 명시적 ESM 확장자가 필요할 때 `.mts`)로 작성하고 실제 strict 타입 검사 대상에 포함한다. 새 `.js`·`.jsx`·`.mjs`·`.cjs`는 허용하지 않는다. 기존 JavaScript는 `source-policy.json`의 정확한 경로와 SHA로 현재 내용을 동결한다. 그 파일을 수정해야 하면 호출부·테스트와 함께 TypeScript로 이관하며, baseline 자동 갱신이나 새 JavaScript 허용으로 검사를 통과시키지 않는다. 하네스는 저작 전 동결 목록을 보관하고, `source-policy.json`을 쓰기 계획에 선언했더라도 허용 항목 추가·해시 갱신은 거부한다. 예외 제거는 선언된 파일 삭제 또는 과거 TS 실험의 실제 검사 편입에만 허용한다. 직접 관리하던 JavaScript 소스·테스트·fixture·비교 도구는 TypeScript로 이관했고 현재 legacyJavaScript 허용 목록은 비어 있다. 외부 vendor와 빌드 생성물은 이관 대상이 아니다.

소스 정책은 Git에 보이는 추적·미추적 파일을 함께 검사하고 Git이 무시하는 생성물과 `skill-library/`의 vendor 자료는 제외한다. 현행 앱·Node 소스는 실제 `strict: true`, `noEmit: true` 프로젝트의 파일 목록에 포함돼야 한다. 과거 비교 실험인 `spikes/tauri/build.ts`와 `spikes/tauri/src/bridge.ts` 두 파일만 `source-policy.json`의 `archivedTypeScript`에 정확한 경로와 SHA로 동결한다. 현행 `WwwApi`의 개발·보고서 메서드를 구현하지 않은 당시 실험을 그대로 보존하는 예외이며 디렉터리 전체 제외가 아니다. 두 파일을 수정하려면 실제 타입 검사 프로젝트에 편입하고 예외를 제거한다. 새 `spikes/**/*.ts`를 포함해 새 파일이 타입 검사 `include` 밖에 있으면 실패한다. 경계 입력은 `unknown`에서 좁히고 타입 assertion으로 검사를 우회하지 않는다. 실제 `@ts-nocheck`, `@ts-ignore` 지시문과 `noCheck`, strict 하위 옵션의 명시적 해제는 허용하지 않으며 정당한 타입 negative test의 설명 있는 `@ts-expect-error`만 허용한다.

루트 `Bundler` 프로젝트는 `src`·`test`·`build.ts`를, 도구용 `NodeNext` 프로젝트는 `scripts/`와 `spikes/tauri/scripts/`를 실제 strict 타입 검사한다. `allowJs`·`checkJs` 예외는 제거했고 새 JavaScript는 소스 정책이 거부한다. 기존 `.d.mts`의 독립 선언은 해당 `.ts` 구현에 흡수해 구현과 타입 정의를 함께 검사한다. 개발 도구의 모듈 경계는 `scripts/package.json`의 `type: "module"`과 `tsconfig.tools.json`의 `NodeNext`, `allowImportingTsExtensions`, `erasableSyntaxOnly` 설정이 소유한다. `scripts/*.ts`는 Node로 직접 실행하고 Bun은 기존 테스트·빌드 역할을 유지한다. 이 방식에 `.mjs` 확장자는 필요하지 않다. 실행 전 Node 버전을 확인하며 이 작업에서 확인한 런타임은 Node 22.22.3이다.

- `npm run check:source`는 `node scripts/source-policy.ts`로 소스 정책을 검사한다.
- `npm run typecheck`는 기존 타입 검사와 도구 프로젝트 검사를 함께 실행한다.
- `npm run check`는 소스 정책·타입 검사와 기존 테스트·빌드를 함께 실행한다.
- `npm test`는 `scripts/test.ts`로 테스트를 찾는다. `.mjs`에서 이관한 Node 전용 테스트 목록은 실제 `node --test`로, 기존 TS 테스트와 새 테스트는 Bun으로 실행한다. Node 전용 테스트를 추가하거나 이름을 바꾸면 같은 실행기의 목록도 갱신한다. 목록에 지정한 테스트 파일이 없으면 조용히 생략하지 않고 실패한다.
- 구현 실행의 공식 진입점은 `npm run workflow -- '<JSON>'` 또는 `node scripts/workflow.ts '<JSON>'`다. 기존 `scripts/workflow/run.ts`는 내부 실행부로 남는다.

typed 진입점은 `build` 또는 `writes`·`deletePaths` 계획이 있는 authoring 실행에서 사전·사후 검사를 수행한다. 코드 수정이 필요한 build는 변경 계획이 필수이며 새 TypeScript는 `writes`, 삭제할 기존 JavaScript·TypeScript는 `deletePaths: string[]`에 선언한다. 내부 legacy 권한 검증에는 두 목록의 합집합을 전달한다. `writes`의 JavaScript 대상과 안전하지 않은 경로는 실행 전에 거부한다. 사후에는 삭제 대상이 실제 없어졌는지와 선언하지 않은 TS·기존 JS·소스 정책·명시 프로젝트 설정 변경도 확인한다. 기존 JavaScript를 수정한 채 남기면 소스 정책 실패다.

사전 소스 정책·타입·BoxBox 검사에서 발견한 기존 오류는 호스트의 작성 context로 전달해 수정할 수 있게 하며, 기존 오류 자체로 호스트 실행을 막지 않는다. 로컬 설정 누락, 도구 실행·JSON 파싱 실패와 안전하지 않은 쓰기 계획은 실행 전 실패한다. 사후 소스 정책·타입·BoxBox의 미해결 오류는 전체 하네스의 `harness.ok: false`와 CLI exit 1로 판정한다. 사후 검사 전후의 TS·기존 JS·소스 정책·명시 프로젝트 설정 지문이 달라져도 실패한다. 실행 결과의 `executor`와 `toolExecutor`는 실제 프로세스와 주입 시험을 구분하며, 주입 시험의 성공을 실제 모델 실행으로 보고하지 않는다.

정보 답변·preview·실행 없는 호출은 모델을 실행하지 않으며 검사를 위한 호출이 구현·쓰기·명령 실행 권한을 확대하지 않는다. `verify`·`review`·`read`·`complete`는 기존 core로 위임하며 authoring의 전후 검사를 모든 단계의 gate로 확대하지 않는다. 프로젝트 전체 소스 정책·타입 검사는 `npm run check`에서 별도로 강제한다. 공식 typed 진입점은 `npm run workflow`이며 low-level legacy API는 내부 구현으로 유지한다. 이 경로들은 호스트의 모든 쓰기를 차단하는 OS sandbox를 제공하지 않는다. 작업 완료의 문서 영향 검토와 독립 검토 책임은 [공통 계약](skills/WORKFLOW.md)을 유지한다.

`skipLibCheck: true`는 외부 라이브러리 선언 검사를 생략하는 기존 설정으로 유지한다. 직접 관리하던 `.d.mts`는 구현 `.ts`에 통합했다. 외부 선언 파일 본문까지 검증했다는 뜻은 아니다.

### BoxBox 작성·검증 경계

BoxBox는 제품 의존성이 아니라 작성 시 가독성 검사 도구다. 머신별 설치 경로는 Git에서 무시하는 `.www/development.local.json`의 `boxboxLauncher`, `boxboxNode`에 각각 절대경로로 둔다. 런처와 Node의 파일 실재를 확인하고 저장소 내부에 복사한 런처 대신 외부 설치본을 사용한다. BoxBox가 고정한 Node는 설치본의 `runtime.json`과 대조한다. 이 작업에서 확인한 설치본 런타임은 Node 22.22.3이다. 로컬 설정 누락이나 도구 고장은 성공으로 건너뛰지 않는다.

TypeScript·Python·strict JSON·YAML 작성은 파일별 `guide --file <파일> --authoring --json`과 `check --source --file <파일> --json`을 먼저 실행해 `columnSets`·`axisNotes`의 역할 행·열과 구문 경계를 읽고, 수정 후 같은 source check를 실행한다. 하네스는 코드 대상 `writes`의 `.ts`·`.tsx`·`.mts`·`.cts` 파일에 guide와 사전 검사 결과를 호스트 context로 전달한다. 사후 검사에서 `misaligned`, `REFUSE`, invalid 또는 errors가 나오면 하네스 결과는 실패이고 CLI는 exit 1로 끝난다. `FIXABLE`을 통과로 바꾸지 않는다.

`NO_GROUPS`는 검사기가 읽은 범위만 표시하며 전체 가독성 PASS 근거가 아니다. 미지원 언어는 미지원으로 보고하고 승인되지 않은 형태를 수동 공백 정렬·format·align으로 우회하지 않는다. align이나 formatter는 별도 명시 승인 없이 실행하지 않는다. 현재 승인되지 않은 BoxBox 형태는 별도 미해결 사항이며 TypeScript 전환만으로 모든 스타일 개선이 완료됐다고 쓰지 않는다. 실제 호스트가 guide·사전 검사 context를 수용했는지도 실행 근거로 확인하며 전역 자동 훅의 활성화를 주장하지 않는다.

### 제품 파일과 전송 경계

- `src/main.ts`: Electron 생명주기, 폴더 선택, 검증된 IPC, Codex 프로세스 연결
- `src/rpc.ts`: 크기 제한 JSONL/JSON-RPC 전송, 요청 라우팅, EOF/오류 처리
- `src/projection.ts`: 이벤트를 화면 블록으로 바꾸는 순수 투영
- `src/preload.ts`, `src/shared.ts`: context-isolated 브리지와 공유 계약
- `src/renderer.tsx`: React 화면
- `test/`: 가짜 JSONL child transport와 이벤트 투영의 행동 테스트

전송 프레임은 4 MiB로 제한한다. EOF나 오류가 나면 대기 요청을 실패시키며, 결과가 불확실한 변경 요청을 자동 재시도하지 않는다. 이벤트는 메모리에서 최근 2,000개만 보관하고 개인 원장을 파일로 쓰지 않는다.

## 제외한 기능과 Skills 정책

기존 TUI/PTY 탭, xterm/node-pty, 요청/REPORT/WES 7단계 체계, 기존 에픽·규칙·영수증 훅·런타임 파일과 제어판 기능은 가져오지 않았다. 이 저장소의 `AGENTS.md`가 일반적인 저장소/브랜치/dirty 확인과 변경 보존, 검증, 커밋·푸시 제한을 직접 규정하므로 `woo-entry`는 대체됐다. `woo-feature-template`과 `session-goal`은 옛 TUI 흐름, `woo-commit`·`woo-issue`·`woo-pr`은 옛 control-plane, `html-error-report`는 현재 필요가 없어 제외했다. 깨진 `woo-code-readability` 심볼릭 링크도 복사하지 않았다.

WWW 프로젝트 유형(Desktop 포함)의 여섯 Skills 정본은 `skills/www/`이고 `.agents/skills/`에는 발견용 상대 심볼릭 링크만 둔다. 이것이 모든 클라이언트의 동적 호출을 보장하지는 않는다. `www-dev` 역할로 접수한 개발 요청에서는 필요한 스킬을 선택하고 사용자 명시 호출도 유지한다. 호출·권한·커밋·증거의 정본은 [공통 계약](skills/WORKFLOW.md)이다. 프로젝트 유형의 추가 검토는 [데스크톱 프로필](skills/profiles/desktop.md), 실제 요청의 합성 흐름은 [승인 대기 카드 예시](skills/examples/approval-waiting.md)를 참고한다. 미래의 `skills/rpa/`, `skills/web/`, `skills/plugin/`은 필요할 때 별도 채택하며 현재 생성하지 않는다.

첫 제품 목표와 연결 작업의 실행 순서는 [Chat 통합 실행 계획](work/Chat/001-Native%20흐름%20통제와%20가독성/tasks.md)에 모은다. 이는 준비·BoxBox·개발 하네스·Chat 구현·실제 검증·승인된 게시를 잇는 계획이며 현재 구현 완료를 뜻하지 않는다.

기존 [프로젝트 opt-in 하네스](work/Workflow/001-Skills%20실행과%20개발%20기록%20자동화/spec.md)는 `npm run workflow`로 명시 실행한다. 의도·작업 UUID·정본 Skill·승인·binding을 연결하고 GJC 비대화형 실행과 verifier 결과를 `.www/runtime/<work-id>/`에 기록한다. 전역 훅, 자동 모델 전환, 제품 Chat의 Native 주입은 활성화하지 않는다. `context` 로드는 native Skill invoke가 아니고, GJC tool interception은 advisory이므로 OS sandbox나 모든 쓰기의 hard gate를 보장하지 않는다.

새 WWW 개발 경로는 일반 요청의 접수·재개, `www-dev` 역할과 Codex 호스트, 소스·기준에 연결한 검증 증거를 잇는 작업이다. 역할 문서를 실제로 읽었는지와 요청에 맞는 다음 행동을 실제 수행했는지는 해당 Workflow·Chat 작업의 검증 기록으로 확인한다. 기존 GJC fixture 성공을 새 Codex 경로의 통과로 사용하지 않는다. 현재 인터페이스는 실행부 도움말·소스와 검증 기록을 함께 확인하며 미구현 옵션을 실행 가능한 예제로 제시하지 않는다.

## 개발 역할의 작업 인터페이스

현재 작업 접수·재개의 CLI는 `node scripts/workflow.ts '<JSON>'`이며 `action`으로 동작을 선택한다. 이 인터페이스가 구현돼 있다는 사실과 실제 Codex·GUI·검토 흐름의 통합 검증은 구분한다. 입력의 권한 정보는 사용자의 유효한 요청에서 정하며, 예제나 역할 선택이 실행 승인을 만들지 않는다.

| `action` | 입력과 동작 |
|---|---|
| `open` | 직접 요청을 받은 `www-dev` 역할이 `requestId`, `request`, `decision`, `approval`, `inputs`로 새 작업을 등록. 기존 UUID는 `decision.workId`로 읽음. `decision.adoptLegacy: true`는 아래 명시 연결을 선택. 같은 접수 ID·요청의 중복 등록을 구분 |
| `adopt` | 현재 직접 요청·`requestId`·권한·`inputs`·`intent`를 기존 `workId`에 연결. 같은 UUID로 schema2를 사용하고 원래 레코드는 `workflow.legacyRecord`에 보존. 과거 통과를 현재 증거로 승격하지 않음 |
| `read` | `workId`의 레코드를 읽고 구조를 확인. legacy1을 새 증거로 자동 변환하지 않음 |
| `advance` | `workId`, `intent`, 필요한 `writes`·`surfaces`로 허용된 다음 단계를 기록. 완료는 별도 판정으로만 수행 |
| `inputs` | `workId`와 검사 의존 `inputs`를 지정해 범위를 갱신. 현재 기준 결과를 미검증으로 바꾸고 과거 시도는 보존 |
| `verify` | `workId`, `command`, `args`, `criterionIds`로 해당 작업에서 허용한 실제 검사를 수행하고 검증 시도·관찰 요약·결과 연결을 기록 |
| `status` | 현재 소스·기준·필수 검토의 적용 가능성을 읽기 전용으로 판정 |
| `resume` | 같은 UUID의 현재 적용성을 재평가하고 작업 상태·다음 행동을 갱신. 과거 시도 보존 |
| `complete` | 현재 소스·기준·필수 검토를 다시 확인하고 충족한 작업만 완료 기록 |
| `document-review` | `workId`, `documents`의 문서 영향 판단을 digest에 연결해 이력에 추가. 각 문서는 `path`, `decision` (`updated` | `unchanged` | `not_applicable`), 비어 있지 않은 `reason`을 받음 |
| `lock-status` | 잠금 소유 프로세스·호스트와 현재 생존 상태를 읽고 복구 가능 여부를 확인 |
| `recover-lock` | 관찰한 소유 token을 지정해 같은 호스트의 종료된 소유자 잠금만 명시 복구 |
| `check-repository` | 전체 저장소 검사를 실제 실행하고 작업 레코드와 분리한 로컬 영수증을 보존 |
| `repository-status` | 전체 검사 이후 Git 파일·작업 기록이 달라졌는지 읽기 전용으로 확인 |

`status.repositoryConsistency`는 작업의 기능 증거와 별개의 전체 저장소 검사 상태다. 작업이 완료돼도 이후 다른 작업 기록이 바뀌면 전체 검사는 오래된 상태일 수 있다. 최종 기록 갱신 후 `check-repository`에 `command`, `args`를 지정해 다시 검사한다. 기본 명령은 현재 Node로 작업 계약 검사기를 실행한다. 상세 정책과 잠금 복구의 한계는 [공통 계약](skills/WORKFLOW.md)을 따른다.

`open.decision`은 역할이 정리한 `intent`, `area`, `title`, `kind`, `areas`, `owner`, `criteria`와 필요한 기존 `workId`를 전달한다. 각 기준은 ID·설명·필수 여부와 선택적 `requirementRefs`를 가진다. `approval`은 구현·쓰기 경로·변경 표면·허용 검증 명령·커밋·게시 범위이고, `inputs`는 검사 의존 파일·디렉터리의 저장소 상대 경로다. 사용자 원문을 단순 키워드만으로 구현 승인으로 바꾸지 않는다.

문서 영향 검토의 정본과 필수 문서 범위는 [공통 계약](skills/WORKFLOW.md#문서-영향-검토)을 따른다. 아래는 항목 형식의 부분 예시이며, 실제 호출에는 필수 문서 전체와 해당 작업의 요구 참조 문서를 포함한다. 판단 기록은 `node scripts/workflow/work.ts '{"action":"document-review","workId":"work-UUID","documents":[{"path":"docs/ARCHITECTURE.md","decision":"unchanged","reason":"모듈 책임과 데이터 흐름이 유지됨"}]}'`로 남긴다. 완료 시 현재 source·criteria·문서 digest에 맞는 기록이 요구된다.

기존 schema1은 기본 읽기와 기존 직접 호출을 유지한다. 현재 요청을 `adopt` 또는 `open.decision`의 `workId`·`adoptLegacy`·`intent`로 명시 연결하면 과거 레코드 전체와 기존 검증 문서를 남긴 채 현재 결과를 `unverified`에서 다시 확인한다. 신규 접수와 입력 갱신은 `requirementRefs`가 가리키는 문서 파일도 검사 범위에 자동 포함한다.

다음은 현재 Workflow 작업의 **레코드 읽기만 수행하며 모델을 호출하지 않는** 예제다.

```sh
node scripts/workflow/work.ts '{"action":"read","workId":"work-d5528c42-2849-48bd-9a9f-d8c80bf67f07"}'
```

기존 GJC 경로의 실제 실행에는 `execute: true`, 안정적인 `eventId`, 유효한 권한, `writes`·`surfaces`, 실제 `verifier`가 필요하다. 해당 경로의 `approval.verifierCommands`는 허용한 command/args 배열의 JSON 문자열 목록이다. `run.ts`의 새 역할 분기는 같은 접수·권한·증거 계약과 연결하며 현재 소스와 작업 검증 기록으로 지원 범위를 확인한다. 실패·중복·불명확 결과를 같은 변경 명령의 자동 재실행으로 해결하지 않는다.

구현 하네스와 BoxBox 로컬 설정·실패 판정은 [TypeScript 작성 및 하네스](#typescript-작성-및-하네스)를 따른다.

런타임 세션 `done`은 작업의 `work.json` 완료가 아니다. verifier의 기준 매핑은 호출자가 지정한 검사 범위이며 최종 수용은 검증 기록과 대조한다. 원본 요청·컨텍스트·verifier argv는 사건에 남기지 않으며, Skill hash와 승인 범위·명령 hash·실제 exit를 기록한다. 상세 한계와 테스트는 해당 작업의 [재검증 기록](work/Workflow/001-Skills%20실행과%20개발%20기록%20자동화/verification.md)에 있다.

장기 제품 방향은 별도 브라우저 UI가 아닌 하나의 WWW 데스크톱 앱에서 shared React view와 로컬 Codex 실행·승인을 제공하고, 이후 GitHub의 코드·구조화 기록을 Mac mini가 지정 브랜치별로 검증·색인해 Roadmap/Node/Canvas API 보기를 제공하는 것이다. 이는 목표 설계이며 현재 제품은 메모리 전용이고 서버 통합이 없다. 정식 데스크톱 기반은 위 결정에 따라 Electron과 TypeScript다. push 성공과 서버의 commit 색인은 별개이며 원격 실행·소스 동기화는 범위 밖이다.

## 샌드박스 한계

스레드는 `sandbox: workspace-write`, `approvalPolicy: on-request`로 시작한다. 이는 선택한 작업 폴더 쓰기를 허용하는 Codex 정책 설정이지 “폴더 밖의 모든 작업은 반드시 질문한다”는 보장이 아니다. 실제 제한과 승인 발생 여부는 Codex 버전, 플랫폼 샌드박스, 구성, 명령 종류와 서버 정책에 좌우된다. UI는 관찰한 요청만 표시하며 보안 경계가 아니다.

## 검증과 알려진 한계

검증은 `npm run check`로 소스 정책, 앱·도구 타입 검사, fake JSONL transport 테스트, 이벤트 투영 테스트, Bun 번들을 수행한다. 테스트는 응답/알림 라우팅, 스트리밍 완료, 숫자 승인 ID 보존, EOF 시 불확실 실패와 무재시도, 지원하지 않는 요청 표시를 다룬다. 합성 fixture 기반이라 실제 사용자 내용은 포함하지 않는다.

초기 비교에서는 주간 사용량을 소비하지 않기 위해 실제 추론을 생략했다. 이후 첫 Chat 검증에서는 인증·사용량 확인 뒤 현재 Electron 앱에서 실제 Codex의 `READY` 단문 응답을 확인했다. 승인 왕복·긴 출력·실패·중단·읽기 상태는 실제 Electron 창과 합성 app-server fixture로 별도 확인했다. 실제 Native 승인·변경 작업, Windows·한국어 IME 실기, 플랫폼 sandbox 전체는 미검증이다. [Chat 검증 기록](work/Chat/001-Native%20흐름%20통제와%20가독성/verification.md)의 증거 범위를 따른다. 이벤트는 최근 2,000개, 명령 출력은 최근 32,768 UTF-16 코드 단위만 보관하며 완전한 원본 복원을 보장하지 않는다.

## 과거 Electron과 Tauri v2 비교 스파이크

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

`test/fixtures/fake-app-server.ts`는 두 백엔드가 공통으로 실제 stdio 프로세스 경계를 통과해 사용하는 fixture다. 스트리밍 delta, 명령 완료, 파일 이벤트, 숫자 ID `42` 승인 응답, interrupt, EOF와 존재하지 않는 CLI를 다룬다. EOF에서 대기 요청은 결과 불확실 오류가 되고 자동 재시도하지 않는다. 렌더러 투영은 기존 테스트를 그대로 공유한다. fixture는 `codex`를 실행하지 않으므로 비교 테스트가 실제 추론을 시작하지 않는다.

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

비교 당시에는 **제품을 즉시 Tauri로 전환하지 않는 것**을 권고했다. 앱 크기만이 최우선이면 Tauri의 이점이 크지만, 제한된 readiness 표본은 이 장비에서 Electron 쪽이 짧았고 코드량만으로 유지보수 비용 배수를 산정할 수는 없었다. 전체 process-tree 메모리, 실제 Codex 세션, macOS 한국어 IME 수동 입력, Windows 빌드·WebView2·샌드박스에는 추가 검증이 필요했다. 이 스파이크는 macOS arm64만 빌드했으므로 Windows 동작을 추론하거나 인증하지 않는다. 현재의 제품 선택은 위 기술 결정에 따라 Electron으로 확정했으며, 이 과거 비교가 진행 중인 셸 선택이나 Tauri 마이그레이션 계획을 뜻하지 않는다.

## Native 활동 패널 검증

채팅 오른쪽의 최소 활동 목록은 `src/activity-sidebar.ts`의 연결 수명주기 상태와 순수 투영, `src/native-activity-view.tsx`의 화면으로 구성한다. main은 app-server의 비실험 `skills/list`·`hooks/list` 응답을 cwd·필수 shape까지 검증하고 요청 세대·scope가 있는 최소 snapshot 사건으로 게시한다. `bun test test/activity-sidebar.test.ts test/native-activity.test.ts test/projection.test.ts`로 등록 순서·부분 목록·2,000건 절단 뒤 목록 유지·요청 세대와 thread 우선순위·한 사건의 여러 Skill 읽기·Hook tuple/run ID·완료 뒤 늦은 시작·연결 수명주기 중복·thread 격리와 기존 활동·대화 투영을 검사한다. 같은 검사에서 일반 사건 20,000개의 scalar watermark, 고유 Hook run 20,000개 전부의 정확한 반응, 오래된 동일 ID·완료 뒤 늦은 시작 억제, 64개 exact bucket의 copy-on-write 불변성을 확인한다. exact 상태는 실제 연결 세대의 고유 읽기/run ID 수만큼 필요하게 증가하며 새 transport 연결에서 회수된다.

renderer는 초기 bootstrap과 대화 전환 전에 활동 snapshot 경계를 열고, 요청 중 도착한 live 사건을 snapshot과 seq 순서로 병합한다. snapshot에 실제 포함된 사건은 pulse 없이 복원하고, snapshot에 없는 큐의 live 사건은 seq가 낮아도 새 반응으로 적용한다. 집중 검사는 snapshot보다 먼저 도착한 live, snapshot 실패, 취소된 effect 뒤 재진입, 다른 thread 전환을 실제 경계 객체와 renderer 호출 순서에서 확인한다.

`node scripts/verify-native-activity.ts`는 타입 검사·집중 검사·빌드 후 실제 Electron과 합성 Native subprocess로 Skills·Hooks 등록 목록, 새 요청 대기 중 오래된 목록 응답 억제, 대화 복원·재전환 뒤 같은 Hook run 무재생, 한 사건의 두 Skill 행 반응, 730ms 뒤 재활동으로 연장된 강조, Hook 행 반응, 고정 순서, 패널 재진입 무재생, 비공개 추론 미노출, 좁은 패널과 모션 축소를 확인한다. 명시적 `--ui-only`는 집중 검사·빌드·GUI만 실행하고 전체 타입 검사는 `not_run`으로 기록하는 별도 범위다. 전체 검사 실패를 자동으로 이 모드의 통과로 바꾸지 않는다. 검사 중 다른 빌드로 `dist`를 바꾸지 않는다. 생성 스키마나 합성 fixture의 목록 응답을 실제 설치 Native의 전체 등록 목록 검증으로 확대하지 않는다.

`bun test/verify-native-activity-live.ts`는 실제 인증과 모델 사용량을 쓰는 명시적 검사다. 임시 읽기 전용 작업 폴더에서 공개 답변·토큰·구조화된 Skill 문서 읽기·Hook 관측을 확인하고 요약만 증거 폴더에 저장한다. 일반 `bun test`에는 포함하지 않는다. 합성 시나리오의 성공과 실제 Native 표본을 구분하고, 비동기 Hook·모델별 청구 비용·모든 플랫폼 동작까지 확인했다고 확대하지 않는다.

## 생태계 지도 유지보수

사이드바의 생태계는 src/ecosystem.ts의 정적 안내와 src/ecosystem-view.tsx의 SVG 화면으로 구성된다. 구조 변경 시 노드의 역할·근거 경로·방향 관계·후속 구분을 갱신한다. bun test test/ecosystem.test.ts로 출처 경로·관계 무결성과 검색을 확인하고, 실제 Electron에서 전환·초안 보존·노드·필터·배율을 확인한다. 정적 지도와 실시간 상태는 구분한다.

## 작업 보고서 실행과 유지보수

저자는 [작업 종료 보고서 계약](skills/REPORTS.md)에 따라 work CLI의 report action으로 서술을 저장한다. reports 서비스·sandbox iframe·독립 HTML은 같은 구조화 데이터를 사용한다. 개발 역할의 core·하네스 사건이 자동 기록을 만들며 전역 호스트 Stop 등록은 전제하지 않는다. 보고서 생성에 실패한 reportHook 결과를 검사 성공으로 숨기지 않는다.

집중 검사 위치는 test/workflow-reports.test.ts, test/report-service.test.ts, test/workflow-work.test.ts, test/workflow-development.test.ts다. scripts/verify-reports.ts는 실제 Electron과 합성 Native로 리포트 IPC·화면 전환을 확인한다. 보고서 HTML은 좁은 화면·키보드·모션 축소·인쇄를 별도로 확인한다.

Native 자동 보고서의 집중 검사는 test/native-report-input.test.ts, test/native-reports.test.ts, test/report-judge.test.ts다. 실제 별도 subprocess 프로토콜·판단 거부·타임아웃·취소·큐·중복·재시작을 검사한다. scripts/verify-reports.ts는 실제 Electron에서 합성 Native 종료→합성 판단 subprocess→저장→sandbox iframe 표시를 확인한다. 실제 모델의 필요/생략 판단은 별도 실행 증거로 구분하며 합성 실행으로 판단 품질을 입증하지 않는다. probe에서는 자동 판단이 기본으로 꺼지고 WWW_PROBE_NATIVE_REPORTS=1일 때만 켠다. 판단 바이너리 주입은 probe 모드에서만 허용한다.

실제 모델 검사는 `bun test/verify-native-report-live.ts`로 명시 실행한다. 별도 읽기 전용 Codex 판단에 인사와 설계의 합성 공개 답변을 전달하고 각각 생략·저장 결과와 실제 생성된 보고서를 확인한다. 인증·모델 사용량을 사용하는 검사이며 일반 bun test에는 포함되지 않는다. 합성 Electron 연결 검사와 별도 검증 시도로 work.json에 연결한다.

독자용 보고서 확장은 narrative.reader를 사용한다. story와 요구별 결과·검사 내용은 실제 입력과 원장에 근거하고 누락은 null/빈 배열로 남긴다. 기존 fields와 과거 JSON/HTML은 유지한다. 파싱·저장·완료 이력·Native 큐 보존을 함께 검사한다. report-view의 raw details에만 긴 식별자·명령·당시 적용성 요약을 보존하며, 실제 자료가 잘렸을 때만 생략을 알린다. scripts/verify-reports.ts는 실제 iframe의 report-story 본문과 양수 box 높이를 확인한다. 동일 HTML의 주기 갱신은 프레임을 다시 로드하지 않고, 현재성 때문에 HTML이 바뀌면 갱신해 본문과 배너가 어긋나지 않게 한다.

## 자연스러운 진행 설명과 공개 추론 요약

`src/native-chat.ts`의 params 함수를 main이 실제 `thread/start`·`turn/start`에 사용한다. 스레드의 `developerInstructions`에 한국어 진행 설명 지침을 더하고 턴에서 `summary: "detailed"`를 요청한다. 기존 cwd·`workspace-write`·`on-request`와 text 입력 구조를 보존하며 baseInstructions·모델·effort·전역 설정은 바꾸지 않는다. 로컬 codex-cli 0.167.2 생성 스키마에서 해당 필드를 확인했다.

`bun test test/projection.test.ts test/native-chat.test.ts test/native-activity.test.ts test/input.test.ts test/native-report-input.test.ts`로 실제 main params 배선, 공개 요약 lifecycle·섹션·중복·snapshot·잘못된 입력·턴 격리·종료·절단과 기존 경로를 검사한다. `test/fixtures/fake-app-server.ts`는 기존 MODE에 공개 summary와 private sentinel 사건을 추가해 Electron probe에서 공개 요약 표시와 원문 미노출을 점검할 수 있게 한다. 합성 fixture·투영 검사와 실제 Native의 설명 빈도·요약 제공, 실제 DOM 확인은 구분해 기록한다. 이번 변경 자체가 새 실제 GUI·Native 검증 완료를 뜻하지 않는다.

## 오픈소스 채팅 통합 검증

Chat은 Ovis revision d505c75e26c54f31573057d1e9aa431ecc56677f의 행 상태·입력·인용 처리를 WWW에 맞게 개작한다. 코드와 라이선스 고지는 docs/third-party/ovis.md에 둔다. 전체 Herdr PTY runtime으로 이주한 것은 아니다. Markdown/GFM 의존성은 package.json과 lockfile의 고정 버전을 따른다.

집중 검사는 bun test test/chat-state.test.ts test/conversations.test.ts test/projection.test.ts test/input.test.ts다. Native thread/list/read/resume/turns/list 필드는 설치된 codex app-server generate-json-schema 결과와 대조한다. 새 프로토콜이 없으면 응답을 꾸며 완전 복원으로 표시하지 않는다.

node scripts/verify-chat.ts는 빌드된 실제 Electron을 고립 profile과 cwd에서 실행하고 외부 CDP로 저장 대화·Markdown·코드복사·인용·대화별 상태·동일 thread 후속 요청·승인·중단·앱 재시작을 조작한다. 서버는 test/fixtures/chat-ui-app-server.ts의 합성 stdio subprocess다. 성공·실패 원문과 화면은 .www/evidence/chat-ui-*에 저장하며 실제 모델·Windows·IME 실기로 확대하지 않는다. 실행 전에 npm run build를 수행하고 검사 중 다른 빌드로 dist를 바꾸지 않는다.
