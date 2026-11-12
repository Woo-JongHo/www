> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 테스트 전문가 검토 체크리스트

범위: 항상 활성화(모든 검토)
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"testing","summary":"...","fix":"...","fingerprint":"path:line:testing","specialist":"testing"}
선택: line, fix, fingerprint, evidence, test_stub.
발견 사항이 없으면 `NO FINDINGS`만 출력하고 다른 것은 아무것도 출력하지 않는다.

호출자가 ASCII 커버리지 다이어그램을 명시적으로 요청하면 먼저 지정된 source와 test 파일을
전용 도구 호출에서 직접 읽는다. 그 도구 호출은 두 파일 읽기로만 제한하고, 기본 Read 호출이나
`cat -n src/file && echo ---- && cat -n test/file` 같은 단순한 shell 표시를 사용한다. diff,
package 파일, config 또는 다른 맥락은 별도 도구 호출에서 읽는다. 그런 다음 JSON 발견 사항보다
앞에 다이어그램을 출력한다. public 또는 changed function마다 function root 하나를 사용하고,
tested 또는 missing path와 같은 branch row에 `[OK]` 또는 `[GAP]` 마커를 배치하며,
legend를 같은 diagram block 안에 유지한다:

```text
src/billing.ts
processPayment(amount, currency)
├── 유효한 USD 정상 경로가 성공을 반환 [OK]
└── 잘못된 금액 / 지원하지 않는 통화 분기 [GAP]
refundPayment(paymentId, reason)
└── 환불 성공·가드 분기를 가져오지 않았거나 테스트하지 않음 [GAP]
범례: [OK] 테스트됨 [GAP] 테스트 없음
```

요약 표, 산문 문단 또는 멀리 떨어진 중첩 마커에만 의존하여 커버리지 증거를 제시하지 않는다.
커버된 happy-path 행에는 성공한, 유효한 또는 구체적으로 테스트된 input path를 명시해야 하며,
gap 행은 missing path를 소유한 function 아래에 있어야 한다.

---

## 범주

### 탐색적 가설

부모는 전문가를 건너뛰는 작은 diff까지 포함해 Fix-First 전에 공유 탐색적 QA 패스를 한 번 실행한다.
위험도가 높은 변경된 contract, adverse scenario, native test candidate를 그 패스에 제공한다. 다른
explorer를 시작하거나, product/test를 편집하거나, commit하지 않는다. test proposal은 `test_stub`를
사용하고 caller의 approval requirement를 유지한다. 해당하는 경우 실제 request/queue/storage effect,
retry, duplicate, interrupted recovery를 검사한다. diagram이나 test count는 실행된 증거가 아니다.
regression으로 승격된 발견은 수리 전에 재현된 bug에 대해 실패해야 하고 이후 green 및 원래/인접
probe를 요구한다. buggy-output golden이나 폐기된 유효한 red test를 절대 수용하지 않는다. unit test는
logic에 적합하고, 실제 integration/E2E test는 mock이 숨기는 boundary를 보호한다.

### 누락된 부정 경로 테스트
- 오류, 거부 또는 유효하지 않은 입력을 처리하지만 대응하는 테스트가 전혀 없는 새 코드 경로
- 테스트되지 않은 가드 절과 조기 반환
- 실패 경로 테스트가 없는 try/catch, rescue 또는 error boundary의 오류 분기
- 코드에서 단언하지만 "denied" 사례를 테스트하지 않은 권한/auth 검사

### 누락된 엣지 케이스 커버리지
- 경계값: 0, 음수, max-int, 빈 문자열, 빈 배열, nil/null/undefined
- 단일 요소 컬렉션(루프의 off-by-one)
- 사용자 대상 입력의 Unicode와 특수 문자
- race-condition 테스트가 없는 동시 접근 패턴

### 부정 단언
- 무엇인가 없다는 새 단언(`not.toContain`, `not in`, `assertNotIn`, 이전에 성공하던 호출의
  `pytest.raises`)은 커버리지가 아니라 동작 제거를 기록한다. 제거를 승인하는 spec line, plan item 또는
  PR text를 인용한다. 없으면 test로 출시된 product decision으로 보고한다.
- 이 diff의 rename 또는 removal은 기존 negative assertion을 무력화할 수 있다. old token이 없다고 단언하는
  test는 이제 영원히 통과하며 아무것도 보호하지 않는다. diff에서 이름을 바꾸거나 삭제하는 identifier,
  flag, heading 또는 string마다 다른 것을 단언하는 test 내부까지 포함해 old value를 지목하는 negative
  assertion을 test suite에서 grep하고, 각각을 새 값을 명시하는 수정이 필요한 coverage gap으로 보고한다.

### 테스트 격리 위반
- 변경 가능한 상태(class variable, global singleton, 정리되지 않은 DB record)를 공유하는 테스트
- 순서 의존 테스트(순서대로 실행하면 통과하고 무작위 실행하면 실패)
- system clock, timezone 또는 locale에 의존하는 테스트
- stub/mock 대신 실제 network call을 수행하는 테스트

### 불안정한 테스트 패턴
- 시간 의존 단언(sleep, setTimeout, 촘촘한 timeout을 사용한 waitFor)
- 순서가 정해지지 않은 결과(hash key, Set iteration, async resolution order)의 순서를 단언함
- fallback 없이 외부 service(API, database)에 의존하는 테스트
- seed 제어가 없는 무작위 test data

### 누락된 보안 강제 테스트
- "unauthorized" 사례의 테스트가 없는 controller의 auth/authz 검사
- 실제 차단을 입증하는 테스트가 없는 rate limiting logic
- malicious input 테스트가 없는 input sanitization
- integration test가 없는 CSRF/CORS configuration

### 커버리지 공백
- test coverage가 전혀 없는 새 public method/function
- 기존 테스트가 새 분기가 아닌 이전 동작만 다루는 changed method
- 여러 곳에서 호출되지만 간접적으로만 테스트되는 utility function
- 유일한 테스트가 약한 경로(★ smoke/existence/trivial 또는 아래 authoring gate를 실패하는 새 테스트)는
  기존 severity의 coverage gap으로 남는다. 가치가 낮은 테스트는 gap을 절대 메우지 못한다

### 가치가 낮거나 구현에 결합된 테스트
범위: diff에서 추가·변경한 테스트와 테스트 전용 프로덕션 연결 지점. 발견 사항은 INFORMATIONAL이며
절대 CRITICAL이 아니고 자동 삭제하지 않는다. 소유 boundary에서 다시 작성하거나, 기존 test를 확장하거나,
완전한 retirement card(`test, detects, non_test_callers, search_command, stronger_proof, history, unlocks,
validation`)와 함께 폐기하도록 권고한다. 각 발견 사항의 `fix`를 `Repo-wide sweep: run /test-audit.`로 끝낸다.

새 테스트나 변경된 테스트는 네 가지 답이 모두 있을 때만 authoring gate를 통과한다(diff에 있다면
`Value: protects=...; fails_when=...; why_new=...; seam=...` header comment를 읽는다. 선택적인
`no_claim=...`은 green이 입증하지 않는 것과 무엇을 대신하는 fixture 또는 mock인지 명시하며,
필수 live check를 절대 면제하지 않는다):
1. 어떤 관찰 가능한 동작, 불변식 또는 독립적인 contract를 보호하는가?
2. 어떤 신빙성 있는 regression이 이를 실패하게 하는가?
3. 기존 커버리지가 왜 이를 이미 포착하지 못하는가? 거의 중복되는 테스트보다 기존 table-driven test나 shared fixture에 행을 추가하는 방식을 선호한다.
4. production caller에게 필요 없는 production seam(export, flag, wrapper, injection hook)이 필요한가? 그렇다면 실제 boundary에서 테스트한다.

패턴:
- 단언 없는 coverage probe
- 자기 비교와 identity copy
- 복사된 fixture, inventory 또는 export list
- 선언된 contract가 아닌 정확한 source, import 또는 string grep
- 실제 boundary에서 중복되는 private predicate 또는 call-shape test
- 같은 contract의 중복 호출
- shared helper 테스트를 caller마다 재현함
- test-only export, global 또는 wrapper를 유지하는 것만이 목적인 테스트
- caller가 test뿐인 production code

보존 기준(절대 지적하지 않음): public API, protocol, config, migration, storage, security, platform,
default, prompt-byte, generated-output(SKILL.md golden), package, release 또는 architecture contract를
독립적으로 강제하는 테스트. 순서가 관찰 가능할 때의 call order. 가장 저렴한 독립 가드일 때의 source inspection.
package entrypoint(`package.json` exports/main, index re-exports)에서 도달 가능한 모든 것.
정적이거나 느리다는 것은 삭제 이유가 아니다.

각 발견 사항의 증거는 `evidence`에 `detects`(테스트가 실제로 감지할 수 있는 실패),
`non_test_callers`, `search_command`, `stronger_proof` 필드로 넣는다. 마지막 두 패턴의 경우 diff가 추가하거나
내보내는 각 symbol에 대해 caller check를 실행하되, symbol이 `^[A-Za-z_][A-Za-z0-9_]*$`와 일치할 때만
실행한다(그렇지 않으면 "caller check unavailable: unsupported symbol"을 기록한다). symbol은 따옴표로
감싸고 따옴표 없이 보간하지 않는다:

```bash
git grep -n -F -w -e '<symbol>' -- . ':!test/' ':!tests/' ':!spec/' ':!**/__tests__/**' ':!**/*.test.*' ':!**/*.spec.*' ':!**/*_test.*' ':!**/test_*.py'
```

명령, 제외 항목, 적중 횟수를 기록하고 증거를 "grep-only"로 표시한다(re-export, dynamic dispatch 또는
generated code는 볼 수 없다). 검색에 실패하면 `caller check unavailable: <command>`를 기록한다.
발견 사항은 INFORMATIONAL로 유지하고 삭제는 제안하지 않는다. 증거를 완성하려면 검색을 직접 실행한다.
(참조: ~/.claude/skills/gstack/docs/test-value-bar.md#caller-check-unavailable)

`gstack:test-value keep reason="<why>"`(어떤 주석 문법이든 가능)를 포함한 테스트는 건너뛴다. 건너뛴 것이
있으면 개수와 이유를 INFORMATIONAL 줄 하나로 보고한다. 검토 후 유지한 테스트에는 발견 사항을 내지 않는다.

발견 사항이 새 테스트의 gate 실패 이유를 명시할 때 사용하는 거부 어휘:
`duplicate_protects`, `needs_seam`, `incomplete_card`, `no_credible_regression`,
`covered_elsewhere`, `implementation_coupled`.

### red 증거가 없는 회귀 테스트
- diff가 regression이라고 이름 붙이거나 주석 처리한 테스트를 추가했지만 commit history와 PR body 어디에도
  수정 전 실패했다는 근거가 없음. 입증 가능하게 실패한 적 없는 regression test는 수정이 아니라 mock을
  입증한다. INFORMATIONAL이며 fails-at-HEAD / passes-after-fix 기록을 요청한다.
