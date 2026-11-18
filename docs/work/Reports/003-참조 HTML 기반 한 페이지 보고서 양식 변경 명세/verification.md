# 검증 기록

## 2026-11-16 집중 검사

`node --test test/workflow-reports.test.ts`와 `bun test test/report-service.test.ts`를 각각 실행했다. 원문은 `.www/evidence/session-completion-20261116/reports-node.log`와 `reports-service-bun.log`에 남겼다. 기존 저장·읽기·보안·이력 검사와 여섯 절의 앵커, 자동 기록 미기록, 완료 및 차단 반례, 인쇄 제외 안내를 확인했다. HTML 문자열과 스타일 선언의 검사는 브라우저에서 실제 링크·인쇄가 동작했다는 증거가 아니다.

첫 시도에서 서비스 테스트를 Node로 실행해 확장자 없는 앱 import 해석 오류가 났고, 이전 이력의 미기록 문구까지 검사한 새 테스트가 실패했다. 서비스 테스트는 기존 Bun 실행기로 바꾸고 완료 entry 구간을 확인하도록 수정해 재실행했다. 실패 원문은 `.www/evidence/session-completion-20261116/reports-focused.log`에 남겼다.

실제 Electron·일반 브라우저·키보드·색 대비·오프라인·인쇄, 전체 타입·빌드, 독립 감사는 이 시도에서 실행하지 않았다. 전체 수용 기준의 현재 적용성과 완료 판정은 통합 검증에 남는다.

## 독립 검토 지적 수정

reader의 빈 nextActions가 기존 narrative.next를 가리는 반례와 두 출처 모두 행동이 있는 반례, 펼친 이력을 인쇄 CSS에서 숨기지 않는 선언 검사를 추가했다. 수정 전 `reports-correction-red.log`에는 세 반례의 실패가 남아 있다. 수정 후 `reports-correction-green.log`에서 재실행했다. 선택한 이력의 원시 상세와 접힌 이력은 출력하지 않으며 펼친 이력 본문은 인쇄 CSS가 숨기지 않는다. 실제 브라우저 인쇄 관찰은 여전히 미실행이다.

<a id="attempt-7ca1c4d6-29e3-42cf-a96e-e536e56db676"></a>
## 검증 시도 — 2026-11-16T07:31:12.266Z

- 시도 ID: `attempt-7ca1c4d6-29e3-42cf-a96e-e536e56db676`
- 실행 시각: 2026-11-16T07:29:34.720Z ~ 2026-11-16T07:31:12.266Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-reports.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/design-system.md`, `docs/skills/REPORTS.md`, `scripts/verify-reports.ts`, `scripts/workflow/report-view.ts`, `scripts/workflow/reports.ts`, `src/renderer.tsx`, `src/reports-view.tsx`, `src/reports.css`, `test/report-service.test.ts`, `test/workflow-reports.test.ts`
- 소스 식별: `70f112b9034d60c64252544c395c189a5bc0764bdea5585dd1e8fbe840def5b8`
- 기준 정의 식별: `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 64바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

## remote-20261116 — 현재 머신 범위와 미실행

공식 전체 명령은 현 머신에서 타입·실도구·집중·빌드까지 통과했으나 Electron 시작 SIGABRT로 중단됐다. 화면 접기·스크롤·인쇄/PDF는 실행되지 않았다. 제품 결함으로 단정하지 않으며 실제 데스크톱 실행 조건 확인 후 원래 공식 명령을 재개한다.

실측 환경: macOS 26.5.1 arm64, Node22.23.1, Bun1.4.0, Electron39.8.10. 원문은 .www/evidence/remote-20261116/ 기준 ../reports-Jk4kyD/ / electron-crash-summary.json. 실제 Opus 공유 core는 allowFallback=false, executor=process, not_run/authentication, observedModel=null이며 통과가 아니다. 실제 Native 두 검사도 실패했고 추가 시작 진단은 Codex 전역 상태 SQLite 초기화 오류를 관측했다. 승인·인증·설정을 변경하지 않았다.

## 현재 검증 범위 준비 — Reports003

현재 소스 동결 승인 뒤 실제 검사 의존 입력과 정확한 복합 verifier 서명만 합집합으로 확장했다. 원문 전체 백업과 SHA, withWorkLock, CAS, validateWorkRecord(baseDir=작업 폴더), 공식 serializer와 atomic rename을 확인했다. 기준·과거 결과·이력·직접 요청과 auth 해시는 보존했다. 확장 직후 공식 status의 완료 판정은 false이며 다음 단계는 verify다. 이는 검사를 실행한 결과가 아니다.

준비 근거: `.www/evidence/resume-20261116/reports-closeout/authority-expansion.json`, `authority-expansion.log`, `scratch-types.log`, `preflight.md`. 브라우저 복합 verifier는 현재 formal 실행이 만든 합성 HTML을 사용하며 모든 checks가 true인 경우만 성공한다. 기존 raw 로그와 읽기 전용 감사는 수정하지 않았다.

<a id="attempt-0991073d-f542-4b27-8c01-b33fc8663023"></a>
## 검증 시도 — 2026-11-16T14:57:24.496Z

- 시도 ID: `attempt-0991073d-f542-4b27-8c01-b33fc8663023`
- 실행 시각: 2026-11-16T14:56:35.873Z ~ 2026-11-16T14:57:24.496Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/resume-20261116/reports-closeout/verify-current.mts","reports003"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `.boxbox`, `build.ts`, `docs/architecture`, `docs/design-system.md`, `docs/skills/REPORTS.md`, `docs/specs/reports.md`, `docs/work/Workflow/012-BoxBox 승인 규칙과 새 JSON 출력/approvals`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-reports.ts`, `scripts/workflow/report-view.ts`, `scripts/workflow/reports.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/renderer.tsx`, `src/reports-view.tsx`, `src/reports.css`, `test`, `test/report-service.test.ts`, `test/workflow-reports.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `e9670b67c1e3a55702a7a903577e2bb2cfbb8a97eee17aa4ad3b733d852d22db`
- 기준 정의 식별: `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/resume-20261116/reports-closeout/browser-current.mts` (12264바이트, sha256 5eb673ec0c5ab9c61cab48ec35f3dc73782229eb65ff67aca9cdb8795560f310), `.www/evidence/resume-20261116/reports-closeout/verify-current.mts` (1113바이트, sha256 9a687908ddf8fd81ea2ceb8671f8ced23fc09fcf8c9421430af122d9c229d352)
- 검증 중 원문 유지: 확인
- 출력: stdout 454바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

## 현재 복합 검사 관찰 — Reports003

실제 attempt `attempt-0991073d-f542-4b27-8c01-b33fc8663023`는 `2026-11-16T14:56:35.873Z`부터 `2026-11-16T14:57:24.496Z`까지 종료 코드 0, passed, sourceStable=true로 기록됐다. 대상 기준은 AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7다. 소스 지문은 `e9670b67c1e3a55702a7a903577e2bb2cfbb8a97eee17aa4ad3b733d852d22db`, 기준 지문은 `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`이며 이 둘은 다른 namespace다. 원장에 정식 연결한 현재 시도이고 다른 UUID 영수증을 복사하지 않았다.

formal verify-reports가 현재 타입·실제 공개 CLI를 사용하는 JSON 의미 golden·보고서 집중 행동/보안·빌드·실제 Electron을 실행하고 새 합성 보고서를 만들었다. 이어 그 실행이 반환한 fixture의 HTML을 실제 headless Chrome에서 열어 23개 checks가 모두 통과했다. 현재 HTML은 `/Users/woojongho/woo/00_project/www-handoff-20261116/source/.www/evidence/reports-rsfYUT/standalone.html`이며 SHA-256은 `9f4769396958a04b5633ea31d498c33263f0d44df4012499951b21ef9442d709`다. Chrome 관측 버전은 `Chrome/157.0.8103.51`다.

- 요구 매핑: reader story/요구/검사/조건부 결정 보존, 실패 판정 병기, 과거 PASS·현재성·감사·업무 완료 분리, legacy 의미와 UUID/entry 보존, 실제 생략 표시·이스케이프는 formal 집중 테스트에서 확인했다.
- 사용자 흐름: 실제 Electron에서 목록·독립 HTML 읽기·sandbox·빈 검색·대화 초안 보존·Native 합성 자동 저장을 확인했다. 실제 모델 판단 품질은 이 합성 프로세스 검사 범위가 아니다.
- 현재 Chrome: 1440/791/790/789/541/540/539/360px, 키보드 목차 6절·원시 상세 열기/닫기와 위치·포커스 outline, light/dark 주요 본문 대비 4.5:1 이상, PDF 한글 여섯 절, 과거 이력 열림/닫힘 인쇄 및 외부 요청 없는 오프라인을 직접 관찰했다.
- 한계: 이 실행의 합성 자료·macOS Electron/Chrome 표본이다. OS 인쇄 대화상자·Windows·모든 실제 업무 자료 조합·실제 Native 구현 수행/일반 모델 품질은 확인하지 않았다. 과거 Chrome 결과를 새 실행으로 승격하지 않았다. BoxBox off는 disabled이며 스타일 PASS가 아니다.

원문은 `.www/evidence/resume-20261116/reports-closeout/reports003-functional.json`, `reports003-functional.log`, `reports003-browser/results.json`, `reports003-browser/cdp.json`과 각 PDF/PNG에 보존했다. 독립 감사와 업무 완료는 이 검사 성공과 별도다.

## 현재 독립 감사 — 수정 필요

실제 공유 review core의 `review-580dfbd1-87a5-4c8a-893e-809b20da67e4`는 `executor=process`, `observedModel=gpt-6.1-terra`, `verdict=fail`, `recorded=true`다. 직접 사용자 Terra 요청·현재 work/request/auth·source/criteria/policy 지문·review 단계로 연결하고 fallback이나 주입 실행을 사용하지 않았다. 이 결과는 실제 감사 실패이며 과거 실패/미실행과 별도 보존한다.

- scripts/workflow/report-view.ts의 decisions()는 narrative.reader가 존재하면 reader.decisions만 표시한다. reader.decisions가 빈 배열이고 기존 narrative.decisions에 실제 선택 이유가 있는 보고서는 선택 내용이 원시 상세로 밀려 기본 본문에서 사라진다. test/workflow-reports.test.ts의 reader fixture도 이 누락을 기대한다. 중요한 선택을 보존해야 하는 보고서 계약과 충돌한다.
- scripts/workflow/report-view.ts의 blockerMessage()는 blockedReason이 '독립 검토 not_run:'으로 시작하면 뒤에 실제 사유가 기록돼 있어도 무조건 '원인은 기록에서 확인되지 않았습니다'로 바꾼다. 예를 들어 로그인 실패가 기록된 경우에도 독자는 원인을 알 수 없다는 잘못된 설명을 보게 된다.
- 검토 범위는 제공된 inputBundle의 소스·문서·테스트 코드이며, 생략된 파일과 별도 검증 로그는 읽지 않았다. 테스트는 실행하지 않았다.

현재 기준 검사의 passed와 감사 fail은 별개다. 공식 action 뒤 다음 단계는 build, 완료 판정은 false다. 공유 제품 코드 소유자인 Root에 원문과 재현을 전달했으며 이 담당은 제품 파일을 임의 수정하지 않았다. 결정 누락은 현재 새 fixture의 읽기, 차단 사유는 메모리상의 보고서 clone 렌더로 재현했다. iframe 내부 목차 실제 클릭은 이전 formal/Chrome 표본에서 확인하지 않았고 추가 실제 브라우저 재현이 필요하다. 원문은 `.www/evidence/resume-20261116/reports-closeout/reports003-audit.json`과 `.review.json`에 보존한다.

<a id="attempt-e6da79a8-2988-4f48-a549-7b451e188032"></a>
## 검증 시도 — 2026-11-17T01:46:10.523Z

- 시도 ID: `attempt-e6da79a8-2988-4f48-a549-7b451e188032`
- 실행 시각: 2026-11-17T01:45:39.033Z ~ 2026-11-17T01:46:10.523Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/resume-20261116/reports-closeout/verify-current.mts","reports003"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `.boxbox`, `build.ts`, `docs/architecture`, `docs/design-system.md`, `docs/skills/REPORTS.md`, `docs/specs/reports.md`, `docs/work/Workflow/012-BoxBox 승인 규칙과 새 JSON 출력/approvals`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-reports.ts`, `scripts/workflow/report-view.ts`, `scripts/workflow/reports.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/renderer.tsx`, `src/reports-view.tsx`, `src/reports.css`, `test`, `test/report-service.test.ts`, `test/workflow-reports.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `64fb0674ff71bb0cc5dc080bfc120b03dd0b621b3f7b996f922e23426ed2187a`
- 기준 정의 식별: `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/resume-20261116/reports-closeout/browser-current.mts` (12264바이트, sha256 5eb673ec0c5ab9c61cab48ec35f3dc73782229eb65ff67aca9cdb8795560f310), `.www/evidence/resume-20261116/reports-closeout/verify-current.mts` (1113바이트, sha256 9a687908ddf8fd81ea2ceb8671f8ced23fc09fcf8c9421430af122d9c229d352)
- 검증 중 원문 유지: 확인
- 출력: stdout 549바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-ea8adeee-5946-45f4-9a2e-f8d7d8649587"></a>
## 검증 시도 — 2026-11-17T02:00:32.502Z

- 시도 ID: `attempt-ea8adeee-5946-45f4-9a2e-f8d7d8649587`
- 실행 시각: 2026-11-17T02:00:01.253Z ~ 2026-11-17T02:00:32.502Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/resume-20261116/reports-closeout/verify-current.mts","reports003"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `.boxbox`, `build.ts`, `docs/architecture`, `docs/design-system.md`, `docs/skills/REPORTS.md`, `docs/specs/reports.md`, `docs/work/Workflow/012-BoxBox 승인 규칙과 새 JSON 출력/approvals`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-reports.ts`, `scripts/workflow/report-view.ts`, `scripts/workflow/reports.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/renderer.tsx`, `src/reports-view.tsx`, `src/reports.css`, `test`, `test/report-service.test.ts`, `test/workflow-reports.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `1f6e4ba15ce95a59845c930c32975c804c39758732843e5e080c1b50724883a5`
- 기준 정의 식별: `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/resume-20261116/reports-closeout/browser-current.mts` (12264바이트, sha256 5eb673ec0c5ab9c61cab48ec35f3dc73782229eb65ff67aca9cdb8795560f310), `.www/evidence/resume-20261116/reports-closeout/verify-current.mts` (1113바이트, sha256 9a687908ddf8fd81ea2ceb8671f8ced23fc09fcf8c9421430af122d9c229d352)
- 검증 중 원문 유지: 확인
- 출력: stdout 549바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

