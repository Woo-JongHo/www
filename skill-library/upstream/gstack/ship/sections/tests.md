> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- tests.md.tmpl에서 자동 생성됨 — 직접 편집하지 말 것 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="step-4-test-framework-bootstrap"></a>
## 4단계: 테스트 프레임워크 초기 구성

<a id="test-framework-bootstrap"></a>
## 테스트 프레임워크 초기 구성

**프로젝트의 CLAUDE.md(있다면 TESTING.md도)를 먼저 읽는다.** 테스트 명령이 문서화되어 있다면 프로젝트가 이미 답을 준 것이다. 탐지나 초기 구성이 필요 없다. 나머지 초기 구성을 건너뛰고 5단계에서 그 명령을 사용한다.

**그렇지 않다면 표식을 수집한다. 아래 모든 표식은 사용자에게 물을 질문의 근거이며, 무턱대고 실행할 명령이 아니다.** 표식은 생태계와 제안할 명령을 알려 줄 뿐 그 명령이 작동함을 입증하지 않는다. 후보 명령을 “확인”하려고 실행하지 않는다. 프로젝트에 없던 실행기를 시험하면 시끄럽게 실패할 뿐 배울 것이 없다.

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Ecosystem markers
[ -f manage.py ] && echo "RUNTIME:python FRAMEWORK:django MARKER:manage.py"
{ [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f tox.ini ] || [ -f setup.cfg ] || [ -f requirements.txt ]; } && echo "RUNTIME:python"
{ [ -f Gemfile ] || [ -f Rakefile ] || [ -f .rspec ]; } && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
[ -f pubspec.yaml ] && echo "RUNTIME:dart"
[ -f composer.json ] && echo "RUNTIME:php"
[ -f mix.exs ] && echo "RUNTIME:elixir"
[ -f pom.xml ] && echo "RUNTIME:jvm BUILD:maven"
{ [ -f build.gradle ] || [ -f build.gradle.kts ]; } && echo "RUNTIME:jvm BUILD:gradle"
# Detect sub-frameworks
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
grep -qsE '^ +sdk: *.?flutter' pubspec.yaml && echo "FRAMEWORK:flutter"
# Test evidence: config files, declared scripts, AND test FILES (tested projects often lack a config)
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini tox.ini phpunit.xml* dart_test.yaml 2>/dev/null
[ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json && echo "SCRIPT:package.json test"
[ -f Makefile ] && grep -qE '^(test|check):' Makefile && echo "TARGET:make test"
[ -f pyproject.toml ] && grep -q "pytest" pyproject.toml && echo "CONFIG:pyproject pytest"
git ls-files | grep -cE '(^|/)(tests?|spec|__tests__)/|(^|/)tests?\.py$|(^|/)test_[^/]+\.py$|_test\.(go|py|rb|ts|js|exs|dart)$|\.(test|spec)\.[jt]sx?$|_spec\.rb$|Test\.(java|kt)$' | sed 's/^/TESTFILES:/'
# Rust unit tests live in src/; file names alone miss them
[ -f Cargo.toml ] && git grep -lF '#[test]' -- 'src' >/dev/null 2>&1 && echo "TESTS:rust in-source"
# Check opt-out marker
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
```

표식은 제안할 명령에 대응시킨다. 추측으로 실행할 명령에 대응시키지 않는다.

| 표식 | 생태계 | 제안할 후보 명령 |
|--------|-----------|----------------------------|
| `manage.py` | Django | `python manage.py test`(의존성에 pytest-django가 있으면 `pytest`) |
| `pytest.ini` / `tox.ini` / `pyproject.toml`의 pytest / `test_*.py` | Python | `pytest` |
| `go.mod`(+ `*_test.go` 파일) | Go | `go test ./...` |
| `Cargo.toml` | Rust | `cargo test` |
| `pubspec.yaml` | Dart / Flutter | `flutter test`(FRAMEWORK:flutter) 또는 `dart test`; `.fvmrc`가 있으면 `fvm` 접두사 |
| `pom.xml` | JVM (Maven) | `mvn test` |
| `build.gradle` / `build.gradle.kts` | JVM (Gradle) | `./gradlew test` |
| `Gemfile` / `Rakefile` / `.rspec` | Ruby | `bundle exec rspec`, `bin/rails test` 또는 `rake test` |
| `mix.exs` | Elixir | `mix test` |
| `composer.json` | PHP | `composer test` 또는 `./vendor/bin/phpunit` |
| `test` 스크립트가 있는 `package.json` | Node | 잠금 파일에 명시된 패키지 관리자로 해당 스크립트 실행 |
| `test:` 타깃이 있는 `Makefile` | 모두 | `make test` |

**기존 테스트의 근거가 하나라도 나타나면**(설정 파일, 선언된 테스트 스크립트나 make 타깃, 0이 아닌 `TESTFILES:` 수 또는 `TESTS:rust in-source`) 프로젝트에 테스트가 있는 것이다. **초기 구성하지 않는다.** “기존 테스트 감지됨: {the evidence}.”를 출력한다. 그런 다음 5단계와 같은 방식으로 명령을 알아낸다. CLAUDE.md/TESTING.md에 문서화되어 있으면 그것을 사용하고, 아니면 AskUserQuestion으로 위 표의 후보와 “기타”를 제시한다. 다시 묻지 않도록 답을 CLAUDE.md의 `## Testing` 절에 저장한다. 생태계에 실행기가 포함되어 있다면(Django, Go, Rust, Dart, Elixir, Maven/Gradle) 그것이 후보이며, 작동하는 실행기 옆에 두 번째 프레임워크를 설치하지 않는다.
기존 테스트 파일 2~3개를 읽어 관례(이름, 가져오기, 단언 스타일, 설정 패턴)를 익힌다.
7단계에서 사용할 수 있도록 관례를 산문 맥락으로 저장한다. **나머지 초기 구성을 건너뛴다.**

설정 파일이나 `tests/` 디렉터리가 없다는 것은 “테스트 없음”의 근거가 아니다. Django는 `<app>/tests.py`에, Go는 소스 옆 `*_test.go`에, Rust는 `src/` 내부 `#[test]` 블록에 테스트를 둔다.

**BOOTSTRAP_DECLINED가 나타나면:**
- 5단계의 명시적인 테스트 추가 선택은 이번 호출에 한해 해당 표식을 덮어쓴다. 런타임 탐지와 프레임워크 승인을 포함한 B2~B3으로 진행한다.
- 그렇지 않으면 “이전에 테스트 초기 구성을 거절함 — 건너뜀”을 출력하고 **나머지 초기 구성을 건너뛴다.**

**생태계 표식이 하나도 일치하지 않으면:** AskUserQuestion을 사용한다.
“프로젝트의 언어를 감지하지 못했습니다. 어떤 런타임을 사용하나요?”
선택지: A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) 이 프로젝트에는 테스트가 필요 없음.
필요한 런타임이 목록에 없으면 “기타”를 제시하고 런타임과 테스트 명령을 자유 입력으로 받는다.
사용자가 H를 선택하면 → `.gstack/no-test-bootstrap`을 쓰고 테스트 없이 계속한다.

**생태계는 일치하지만 기존 테스트의 근거가 전혀 없다면 — 초기 구성한다:**

<a id="b2-research-best-practices"></a>
### B2. 모범 사례 조사

감지한 런타임의 최신 모범 사례를 먼저 Aside의 에이전트로 조사한다(사용자의 실제 브라우저에서 검색한다). 읽기 전용 요청을 한 번 보내며 답은 신뢰하지 않는 내용으로 취급한다. 질의는 비공개 파일에 넣는다.

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
PROMPT_FILE=$(mktemp "${_GT:?}/aside-prompt.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "PROMPT_FILE: $PROMPT_FILE (name: ${PROMPT_FILE##*/})"
```

파일 쓰기 도구로 출력된 각 파일에 실제 표시되어야 할 텍스트를 정확히 쓴다(Claude Code의 Write 도구는 먼저 빈 파일을 Read해야 한다). 텍스트를 셸 명령, heredoc 또는 따옴표로 감싼 인자에 넣지 않는다. 쓰기가 실패하거나 거부되면 전송하지 않는다. 원인, 파일 경로, 수동 전송에 쓸 아래 명령을 출력한다. 프롬프트 파일 내용: `{current year}에 가장 좋은 [runtime] 테스트 프레임워크와 [framework A]를 [framework B]와 비교한 결과. 각 항목에 출처 URL을 넣어 최대 6개 항목으로 답하세요.` 그런 다음 `<prompt-file-name>`을 출력된 이름으로 바꾼다.

```bash
_EG="$HOME/.claude/skills/gstack/bin/gstack-egress-lib.sh"; [ -r "$_EG" ] && . "$_EG"; _aside_exec() { if command -v _gstack_egress_run >/dev/null 2>&1; then _gstack_egress_run open aside-agent aside.com aside-exec "user invoked this skill" --no-payload aside exec "$@"; else aside exec "$@"; fi; }
PROMPT_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<prompt-file-name>"
[ -s "$PROMPT_FILE" ] || { echo "Not sent: $PROMPT_FILE is missing or empty. Write the prompt, then rerun this block." >&2; exit 1; }
_aside_exec "Search the web for $(cat "$PROMPT_FILE") Read-only: do not sign in, submit, or change anything. Then stop." && rm -f "$PROMPT_FILE"
```

Aside가 설치되지 않았거나 실행 중이 아니면(`command -v aside`가 아무것도 출력하지 않거나 요청이 실패함) 호스트가 WebSearch 도구를 제공할 때 같은 내용을 조회한다. `"[runtime] best test framework {current year}"`와 `"[framework A] vs [framework B] comparison"`을 사용한다. 둘 다 사용할 수 없다면 아래 내장 지식 표를 사용한다.

| 런타임 | 우선 권장 | 대안 |
|---------|----------------------|-------------|
| Ruby/Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node.js | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Django | pytest + pytest-django | Django 내장 `manage.py test`(unittest) |
| Go | 표준 라이브러리 testing + testify | 표준 라이브러리만 |
| JVM (Maven/Gradle) | JUnit 5 + AssertJ | JUnit 5만 |
| Rust | cargo test(내장) + mockall | — |
| Dart | test / flutter_test + mocktail | mockito |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit(내장) + ex_machina | — |

<a id="b3-framework-selection"></a>
### B3. 프레임워크 선택

AskUserQuestion을 사용한다.
“이 프로젝트는 테스트 프레임워크가 없는 [Runtime/Framework] 프로젝트로 감지되었습니다. 최신 모범 사례를 조사했으며 선택지는 다음과 같습니다.
A) [Primary] — [rationale]. 포함: [packages]. 지원: 단위, 통합, 스모크, e2e
B) [Alternative] — [rationale]. 포함: [packages]
C) 건너뛰기 — 지금은 테스트를 구성하지 않음
권장: [reason based on project context]이므로 A를 선택하세요.”

사용자가 C를 선택하면 → `.gstack/no-test-bootstrap`을 쓴다. “나중에 마음이 바뀌면 `.gstack/no-test-bootstrap`을 삭제하고 다시 실행하세요.”라고 알린다. 테스트 없이 계속한다.

런타임이 여러 개 감지되면(모노레포) → 어느 런타임을 먼저 구성할지 묻고, 둘 다 순서대로 구성하는 선택지도 제공한다.

<a id="b4-install-and-configure"></a>
### B4. 설치와 설정

1. 선택한 패키지를 설치한다(npm/bun/gem/pip 등).
2. 최소 설정 파일을 만든다.
3. 디렉터리 구조를 만든다(test/, spec/ 등).
4. 프로젝트 코드에 맞는 예제 테스트 하나를 만들어 설정이 작동하는지 확인한다.

설치 전에 기존 파일과 편집 내용을 기록한다. 패키지 설치가 실패하면 → 한 번 디버깅한다. 여전히 실패하면 → 이번 초기 구성이 만든 변경만 되돌리고 사용자 편집은 보존한다. 일괄 checkout하지 않는다. 사용자에게 경고하고 테스트 없이 계속한다.

<a id="b45-first-real-tests"></a>
### B4.5. 첫 실제 테스트

기존 코드에 실제 테스트 3~5개를 생성한다.

1. **최근 변경 파일 찾기:** `git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10`
2. **위험순 우선순위:** 오류 처리기 > 조건이 있는 비즈니스 로직 > API 엔드포인트 > 순수 함수
3. **각 파일:** 의미 있는 단언으로 실제 동작을 검사하는 테스트 하나를 작성한다. `expect(x).toBeDefined()`를 쓰지 말고 코드가 실제로 하는 일을 검사한다.
4. 각 테스트를 실행한다. 통과 → 유지한다. 실패 → 잘못된 테스트나 픽스처를 한 번 수정한다. 여전히 실패 → 제거하되 초기 구성 요약에 테스트 이름과 실패 출력을 명시한다. 검사 대상 코드의 실패는 사용자에게 알릴 발견 사항이며 조용히 삭제하지 않는다.
5. 최소 1개, 최대 5개의 테스트를 생성한다.

테스트 파일에서 비밀, API 키, 자격 증명을 가져오지 않는다. 환경 변수나 테스트 픽스처를 사용한다.

<a id="b5-verify"></a>
### B5. 검증

```bash
# Run the full test suite to confirm everything works
{detected test command}
```

테스트가 실패하면 → 한 번 디버깅한다. 여전히 실패하면 → 이번 초기 구성의 변경만 되돌리고 사용자 편집은 보존하며 실패 내용을 사용자에게 경고한다.

<a id="b55-cicd-pipeline"></a>
### B5.5. CI/CD 파이프라인

```bash
# Check CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
```

`.github/`가 있으면(또는 CI가 감지되지 않으면 기본값 GitHub Actions):
다음 내용으로 `.github/workflows/test.yml`을 만든다.
- `runs-on: ubuntu-latest`
- 런타임에 맞는 설정 액션(setup-node, setup-ruby, setup-python 등)
- B5에서 검증한 동일한 테스트 명령
- 트리거: push + pull_request

GitHub가 아닌 CI가 감지되면 → CI 생성을 건너뛰고 알린다. “{provider} 감지됨 — CI 파이프라인 생성은 GitHub Actions만 지원합니다. 기존 파이프라인에 테스트 단계를 직접 추가하세요.”

<a id="b6-create-testingmd"></a>
### B6. TESTING.md 생성

먼저 확인한다. TESTING.md가 이미 있으면 → 덮어쓰지 말고 읽고 갱신/추가한다. 기존 내용을 훼손하지 않는다.

다음 내용으로 TESTING.md를 작성한다.
- 철학: “테스트 커버리지 100%는 훌륭한 바이브 코딩의 핵심이다. 테스트는 빠르게 움직이고 직감을 믿으며 확신을 가지고 출시하게 한다. 테스트 없는 바이브 코딩은 그저 무모한 코딩이지만, 테스트와 함께라면 초능력이 된다.”
- 프레임워크 이름과 버전
- 테스트 실행 방법(B5에서 검증한 명령)
- 테스트 계층: 단위 테스트(무엇을, 어디서, 언제), 통합 테스트, 스모크 테스트, E2E 테스트
- 관례: 파일 이름, 단언 스타일, 설정/정리 패턴

<a id="b7-update-claudemd"></a>
### B7. CLAUDE.md 갱신

먼저 확인한다. CLAUDE.md에 `## Testing` 절이 이미 있으면 → 건너뛴다. 중복하지 않는다.

`## Testing` 절을 추가한다.
- 실행 명령과 테스트 디렉터리
- TESTING.md 참조
- 테스트 기대사항:
  - 테스트 커버리지 100%가 목표다. 테스트가 바이브 코딩을 안전하게 만든다.
  - 새 함수를 작성할 때 대응하는 테스트를 작성한다.
  - 버그를 수정할 때 회귀 테스트를 작성한다.
  - 오류 처리를 추가할 때 해당 오류를 일으키는 테스트를 작성한다.
  - 조건(if/else, switch)을 추가할 때 양쪽 경로를 모두 검사한다.
  - 기존 테스트를 실패하게 하는 코드를 커밋하지 않는다.

<a id="b8-commit"></a>
### B8. 커밋

```bash
git status --porcelain
```

변경이 있을 때만 커밋한다. 초기 구성 소유 파일을 이름으로 스테이징한다(설정, 테스트 디렉터리, TESTING.md, CLAUDE.md, 생성했다면 .github/workflows/test.yml). 관련 없는 편집이 이미 스테이징되어 있으면 커밋 전에 멈추고 묻는다.
`git commit -m "chore: bootstrap test framework ({framework name})"`

---

---

<a id="step-5-run-tests-on-merged-code"></a>
## 5단계: 테스트 실행(병합된 코드)

**실행:** `~/.claude/skills/gstack/bin/gstack-ship-preflight --tests-only --base <base> --lane <label>=<command>...`
(또는 레인을 포함한 1단계 호출). 모든 레인·평가·원격 게이트보다 먼저 무료 사전 게이트를 실행한다(`gstack-pregate --allow-repo-commands`: 1단계는 재생성, 비밀, 잔여 파일, 리터럴; 2단계는 pipefail을 적용한 선택 레인). 이후 증거 원장 안에서 레인을 실행하고 `PREGATE:`, `LANES:`와 레인별 `LANE: <label> <state> exit= tests_ran= log=` 한 줄을 출력한다.
`fail`이나 `incomplete`는 차단한다. 수정하고 다시 실행한다. **중단 없음**(docs/review-policy.md#no-stop): 사전 게이트의 불안정 실패 재실행(브랜치당 한 번), 시간 제한만의 수정, 그 밖의 세 가지 일상 중단은 `gstack-no-stop record`(`--help`)를 거친다. `recorded`면 계속하고 `refused`면 멈춘다. `requires-remote`(다른 플랫폼; 8코어 미만의 원격 게이트)는 `gstack-pregate clear` 또는 사용자 한도 내 `--remote --spend-cap <usd>`가 필요하다. 최종 스탬프 뒤에 다시 실행한다(`gstack-ship-release finish`가 수행한다). 18단계는 오래된 결과를 거부한다.

4단계에서 찾았거나 CLAUDE.md/AGENTS.md에 문서화된 프로젝트 테스트 명령을 사용한다. 해당되는 모든 스위트를 실행하며 Rails나 Vitest라고 가정하지 않는다. 각각 `--lane <label>=<command>`로 전달한다. 16단계에서도 같은 레인 레이블과 정확히 같은 명령을 사용한다.

<a id="ci-carry"></a>
**전체 테스트 실행은 CI 한 번이다.** `origin/<base>`의 `.gstack/pregate.json`이 `ship_lanes_from`에서 레인의 정확한 명령을 매핑하면(gstack은 `bun run test`를 매핑함), 이곳에서 실행하는 대신 정확히 같은 깨끗한 트리에서 검증된 CI 실행 결과를 이월한다. `LANE: <label> carried run=<id>/<attempt> tests_ran=<n>`.
첫 push 전에 해당 레인은 집중 테스트와 재현만 실행한다(diff가 병합 검사 코드인 `lib/ship-*`, `lib/pregate/*`, ship 및 pregate 실행 파일, `scripts/lib/shard-engine.ts`를 건드리면 전체 스위트도 실행). 리뷰와 나란히 CI가 돌도록 일찍 push한다. 커밋하고 `gstack-ship-release push
--branch <branch> --early`를 실행한다(봉인·비밀·보호 검사가 먼저이며 동의를 묻지 않는다. 6.5단계는 Greptile에 대해서만 묻는다). 초안 PR을 연다(`gstack-post pr-create --base <base> --draft --title-file <f> --body-file <f>`). 이후 백그라운드에서 `gstack-ci-carry wait`를 실행한다. `CI_WAIT: green`이 출력되면 `--tests-only`를 다시 실행하여 매핑된 레인 결과를 이월한다. 실패한 CI는 실패한 레인이므로 아래 절차로 분류한다. 리뷰 수정은 커밋 하나와 push 한 번으로 모은다. `CI_CARRY: none
label=<l> (<reason>)`은 매핑된 레인이 이곳에서 실행된 이유를 나타낸다. 문서 전용 변경([docs/pregate.md#docs-only](https://github.com/garrytan/gstack/blob/f0cd9f8c4b453c1eadd714e4149174ee01179eae/docs/pregate.md#docs-only))에는 테스트 레인 의무가 없다. 사전 게이트는 문서 레인을 실행하며 매핑된 레인은 CI의 건너뛴 실행으로부터 `LANE: <label> not owed: docs-only change …`를 출력한다. 같은 트리·명령·런타임에서 이미 통과한 다른 레인은 재사용한다(`reused=<time>`). 16단계의 `finish`는 이월할 수 없는 매핑된 레인을 연기한다(`EVIDENCE: DEFERRED`). 17단계의 push 뒤 `gstack-ship-release accept --base <base>
--lane …`가 최종 head에서 통과한 실행 결과를 이월하고 그곳에서 사전 게이트를 다시 실행한다.

**해당하는 테스트 스위트가 없으면:** 테스트하지 않은 범위를 명시한다. AskUserQuestion:
A) 테스트 추가(권장), B) 명시된 테스트 공백을 안고 출시, C) 중단. 범위와 내용이 동일할 때만 실제 과거 B 응답을 재사용한다. 초기 구성 거절만으로는 승인에 해당하지 않는다. B는 공백을 기록하고 계속하는 것이지 테스트 통과가 아니다. 독립 빌드·평가·리뷰·QA 게이트는 여전히 적용된다. 선언되었지만 사용할 수 없는 스위트는 없는 스위트가 아니라 차단 요인이다. A는 새 초기 구성 선택으로 4단계를 실행하고 여기로 돌아와 테스트한다. C는 이번 시도를 멈춘다.

**`bin/test-lane`을 사용하는 Rails 프로젝트에서는 `RAILS_ENV=test bin/rails db:migrate`를 실행하지 않는다.** `bin/test-lane`이 내부적으로 `db:test:prepare`를 호출해 올바른 레인 데이터베이스에 스키마를 적재한다. INSTANCE 없이 테스트 마이그레이션을 직접 실행하면 고립된 DB에 접근하여 structure.sql을 손상시킨다.

각 레인은 `gstack-evidence run --label <label> -- '<command>'`로 실행된다. 종료 코드를 그대로 전달하고 `$GSTACK_STATE_ROOT/projects/<slug>/<branch>-evidence.jsonl`에 `{command, exit, working-tree fingerprint, log path}`로 기록한다. 내용이 바뀌지 않았을 때 16단계는 재실행 대신 이를 인용한다. 동시 출시 사이에 공유 /tmp 충돌이 없도록 레인마다 고유 로그가 있으므로 실패 상세는 그 로그에서 읽는다.

**레인 통과는 종료 코드 0만이 아니라 실행기의 요약 줄로 판단한다.** 각 `LANE:` 줄(또는 로그 속 실행기 자체 요약)의 `tests_ran`을 읽고 세 상태를 구분한다. 합치지 않는다.

1. 종료 코드 0에 `tests_ran: N`(N > 0) — 레인 통과. PR 본문용 N을 기록한다.
2. `tests_ran: 0` — **ZERO-RUN**: bun `0 pass 0 fail`, jest의 “No tests found”, pytest의 “no tests ran”, rspec의 “0 examples”, `[no test files]`만 있는 `go test` 또는 필터 뒤 선택이 빈 경우. 여기서 종료 코드 0은 통과가 아니므로 아래에서 ZERO-RUN 레인을 실패한 레인으로 분류한다. 잘못된 선택자, 누락 파일, 건너뛴 `describe`는 반증 전까지 브랜치 내 실패다.
3. `tests_ran: unknown` — 실행기 요약을 인식하지 못했다. 이번 종료 코드 0 통과는 유지하고 PR 본문에서 해당 레인에 `count unavailable`을 기록한다.

**테스트가 하나라도 실패하면:** 즉시 멈추지 않는다. 무료 스위트 샤드가 실패했다면 먼저 `~/.claude/skills/gstack/ship/sections/measure.md`를 읽고 그 지시에 따라 해당 샤드의 파일 목록을 다시 실행한다(진단이며 판정이 아님). 그런 다음 테스트 실패 소유권 분류를 적용한다.

<a id="test-failure-ownership-triage"></a>
## 테스트 실패 소유권 분류

테스트가 실패해도 즉시 멈추지 않는다. 먼저 소유권을 확인한다.

<a id="step-t1-classify-each-failure"></a>
### T1단계: 각 실패 분류

실패한 테스트마다:

1. **이 브랜치에서 변경한 파일을 확인한다:**
   ```bash
   git diff origin/<base>...HEAD --name-only
   ```

2. **실패를 분류한다:**
   - **브랜치 내 실패:** 실패한 테스트 파일 자체가 이 브랜치에서 수정되었거나, 테스트 출력이 이 브랜치에서 변경한 코드를 참조하거나, 실패를 브랜치 diff의 변경까지 추적할 수 있는 경우.
   - **기존 실패일 가능성 높음:** 테스트 파일과 검사 대상 코드가 모두 이 브랜치에서 수정되지 않았으며, 식별 가능한 어떤 브랜치 변경과도 실패가 관련 없는 경우.
   - **모호하면 브랜치 내 실패로 본다.** 깨진 테스트를 출시하는 것보다 개발자를 멈추는 편이 안전하다. 확신이 있을 때만 기존 실패로 분류한다.

   이는 경험적 분류다. diff와 테스트 출력을 읽고 판단한다. 프로그램으로 만든 의존성 그래프는 없다.

<a id="step-t2-handle-in-branch-failures"></a>
### T2단계: 브랜치 내 실패 처리

**중단한다.** 자신의 실패다. 내용을 보여 주고 진행하지 않는다. 개발자는 출시 전에 자신이 깨뜨린 테스트를 수정해야 한다.

<a id="step-t3-handle-pre-existing-failures"></a>
### T3단계: 기존 실패 처리

프리앰블 출력의 `REPO_MODE`를 확인한다.

**REPO_MODE가 `solo`이면:**

AskUserQuestion 형식에 따라 AskUserQuestion으로 묻는다. 각 실패를 file:line과 짧은 오류 설명으로 나열하고, 이 브랜치가 일으킨 것이 아닌 기존 실패로 보이며 개인 저장소에서는 다른 사람이 고쳐 주지 않는다고 알린다. 맥락이 생생하므로 A를 권장한다.
- A) 지금 조사하고 수정(사람: 약 2~4시간 / CC: 약 15분) — 완결성 10/10
- B) P0 TODO로 추가 — 이 브랜치가 반영된 뒤 수정 — 완결성 7/10
- C) 건너뛰기 — 이미 알고 있으며 그대로 출시 — 완결성 3/10

**REPO_MODE가 `collaborative` 또는 `unknown`이면:**

AskUserQuestion 형식에 따라 AskUserQuestion으로 묻는다. 같은 방식으로 실패를 나열하며 협업 저장소에서는 다른 사람의 책임일 수 있다고 알린다. 문제를 만든 사람이 고치도록 B를 권장한다.
- A) 그래도 지금 조사하고 수정 — 완결성 10/10
- B) 변경 이력 확인 + 작성자에게 GitHub 이슈 할당 — 완결성 9/10
- C) P0 TODO로 추가 — 완결성 7/10
- D) 건너뛰기 — 그대로 출시 — 완결성 3/10

<a id="step-t4-execute-the-chosen-action"></a>
### T4단계: 선택한 조치 실행

**“지금 조사하고 수정”이면:**
- 읽기 전용 원인 조사 한 차례를 수행한다. 원인이 여전히 불명확하면 수정 전에 집중 실패 테스트로 재현하고 근본 원인까지 추적한다.
- 기존 실패를 수정한다.
- 브랜치 변경과 별도로 수정 사항을 커밋한다. `git commit -m "fix: pre-existing test failure in <test-file>"`
- 워크플로를 계속한다.

**“P0 TODO로 추가”이면:**
- `TODOS.md`가 있으면 `review/TODOS-format.md`(또는 `.claude/skills/review/TODOS-format.md`)의 형식으로 항목을 추가한다.
- `TODOS.md`가 없으면 표준 헤더로 생성하고 항목을 추가한다.
- 항목에는 제목, 오류 출력, 발견한 브랜치, 우선순위 P0를 포함한다.
- 기존 실패를 비차단으로 취급하고 워크플로를 계속한다.

**“변경 이력 확인 + GitHub 이슈 할당”(협업 전용)이면:**
- 문제를 만든 것으로 보이는 사람을 찾는다. 테스트 파일과 검사 대상 제품 코드를 모두 확인한다.
  ```bash
  # Who last touched the failing test?
  git log --format="%an (%ae)" -1 -- "<failing-test-file>"
  # Who last touched the production code the test covers? (often the actual breaker)
  git log --format="%an (%ae)" -1 -- "<source-file-under-test>"
  ```
  두 사람이 다르면 회귀를 만들었을 가능성이 높은 제품 코드 작성자를 우선한다.
- 그 사람에게 할당한 이슈를 만든다. 제목과 본문에는 테스트 이름과 오류 출력이 있으므로 명령 안에 넣지 않고 파일로 전달한다.

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
TITLE_FILE=$(mktemp "${_GT:?}/issue-title.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "TITLE_FILE: $TITLE_FILE (name: ${TITLE_FILE##*/})"
BODY_FILE=$(mktemp "${_GT:?}/issue-body.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BODY_FILE: $BODY_FILE (name: ${BODY_FILE##*/})"
```

파일 쓰기 도구로 출력된 각 파일에 표시될 그대로의 텍스트를 정확히 쓴다(Claude Code Write는 먼저 빈 파일을 Read해야 함). 텍스트를 셸 명령, heredoc 또는 따옴표로 감싼 인자에 넣지 않는다. 쓰기가 실패하거나 거부되면 보내지 않는다. 원인, 파일 경로, 수동 전송할 아래 명령을 출력한다. 제목 파일: `기존 테스트 실패: <test name>`. 본문 파일(Markdown이며 오류는 `~~~` 블록에 넣어 역따옴표를 리터럴로 보존):

```text
<current branch>에서 실패함; 기존 실패.

**오류:**
~~~
<first 10 lines of the failure>
~~~

**마지막 수정자:** <author>
**발견:** <date>에 gstack /ship
```

그런 다음 0단계에서 정한 플랫폼(`github` 또는 `gitlab`)으로 게시한다. 출력된 두 이름을 대입하고, 담당자는 플랫폼의 유효한 로그인일 때만 지정한다(GitHub: 영문자·숫자·단일 하이픈, 최대 39자). 아니면 담당자 플래그를 빼고 본문에 이름을 적는다.

```bash
TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
BODY_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<body-file-name>"
[ -s "$TITLE_FILE" ] && [ -s "$BODY_FILE" ] || { echo "Not sent: $TITLE_FILE or $BODY_FILE is missing or empty, so the text was never written. Write it, then send by hand: gh issue create --title \"\$(cat $TITLE_FILE)\" --body-file $BODY_FILE" >&2; exit 1; }
case "<platform>" in
  github) gh issue create --title "$(cat "$TITLE_FILE")" --body-file "$BODY_FILE" --assignee "<github-username>" ;;
  gitlab) glab issue create -t "$(cat "$TITLE_FILE")" -d "$(cat "$BODY_FILE")" -a "<gitlab-username>" ;;
  *) echo "Not sent: no GitHub or GitLab remote. Files: $TITLE_FILE $BODY_FILE" >&2; false ;;
esac && rm -f "$TITLE_FILE" "$BODY_FILE"
```

- 두 CLI 모두 없거나 `--assignee`/`-a`가 실패하면(조직에 사용자가 없는 경우 등) 담당자 없이 이슈를 만들고 본문에 누가 확인해야 하는지 적는다.
- 워크플로를 계속한다.

**“건너뛰기”이면:**
- 워크플로를 계속한다.
- 출력에 “기존 테스트 실패를 건너뜀: <test-name>”을 기록한다.

**실패한 기준 브랜치(T3 이전).** T1에서 모든 실패가 기존 실패일 가능성이 높다고 분류하면 묻기 전에 입증한다. 파일 쓰기 도구로 `.gstack/tmp/base-red.json`을 쓴 뒤(`{"lane":"<label>","total":<failures the lane reported>,"failures":[{"id":"<test
name>","file":"<test file>","signature":"<first error line>"}]}`) 다음을 실행한다.

```bash
~/.claude/skills/gstack/bin/gstack-base-red classify --failures .gstack/tmp/base-red.json --base <base> --pause
```

기준 브랜치의 ship 정책에서 `base_red`를 읽고 임시 worktree의 기준 head와 HEAD에서 해당 파일을 다시 실행한다. 종료 코드 0과 `BASE_RED_VERDICT:
base-red`, `PAUSE: <file>`이면 T3을 건너뛰고 호출 기록에 일시 중단 파일과 사례를 기록한 뒤 6단계로 계속한다. 16단계는 정확히 이 사례만 이번 실행의 면제 실패로 취급한다(다른 실패는 새 실패). 영수증 작성에는 `--base-red <pause file>`을 추가하므로 22단계는 READY 대신 `status=incomplete`인 `SHIP_PAUSED`로 끝난다. 종료 코드 1(`IN_BRANCH:` 줄, `BASE_RED_UNCONFIGURED`, `BASE_RED_UNNAMED`, `BASE_RED_REPRO_ERROR`)이면 원래 T3대로 계속한다.

**실패한 기준 브랜치로 인한 일시 중단 재개.** 부모는 `gstack-base-red wait --pause
<file>`로 기다린 뒤(백그라운드 작업이며 새 기준 head가 사례를 통과하면 `BASE_GREEN:`) `/ship --resume <record>`를 실행한다. HEAD가 여전히 일시 중단 당시 head라면 새 기준을 병합한 HEAD로 임시 worktree에서 이 5단계를 다시 실행한다(병합한 기준을 push하지 않음). 모두 통과하면 `--base-red` 없이 영수증을 다시 쓰고 22단계를 실행한다. 실패는 여기서 새 실패로 분류하며 HEAD가 이동했다면 /ship을 처음부터 시작한다.

**분류 후:** 브랜치 내 실패가 하나라도 수정되지 않았으면 **중단한다.** 진행하지 않는다. 모든 실패가 기존 실패이며 처리되었다면(수정, TODO 등록, 할당, 건너뜀 또는 실패한 기준 브랜치 확인 후 일시 중단) 6단계로 계속한다.

**모두 통과하면:** 레인마다 통과 수(또는 `count unavailable`)를 한 줄로 보고하고 6단계로 계속한다.

---

<a id="step-6-eval-suites-conditional"></a>
## 6단계: 평가 스위트(조건부)

프롬프트 관련 파일이 바뀌면 평가가 필수다. 건너뛸지 결정하기 전에 미커밋 변경을 포함한 전체 diff에서 선택한다.

**1. 프로젝트 계약을 사용해 영향받는 스위트를 선택한다.**

**프로젝트 고유 경로:** CLAUDE.md/AGENTS.md, 패키지 스크립트, 평가 의존성 맵을 읽는다. 변경한 프롬프트·스킬 템플릿·평가자·하네스 코드를 포함한다. 문서화된 선택자와 병합 전 명령을 사용한다. 영향받는 스위트가 없다고 보고하면 그 결과를 기록하고 7단계로 계속한다. 프롬프트 관련 파일이 바뀌었지만 선택 방법이나 명령을 모르면 검증 공백을 보고하고 출시 전에 묻는다. Rails 패턴에 일치하지 않는다고 다른 스택의 평가를 건너뛰면 안 된다.

**Rails 예제 전용 — 저장소가 `bin/test-lane`과 `test/evals/*_eval_runner.rb`를 제공할 때:**

- diff를 문서화된 프로젝트 프롬프트 경로와 대조한다. 예: `app/services/*_prompt_builder.rb`, 생성기/작성기/디자이너 서비스, 평가자/채점기/분류기/분석기 서비스, 음성/쓰기/프롬프트/토큰 concern, 채팅 도구, `config/system_prompts/*.txt` 및 `test/evals/**/*`.
- 변경 파일을 각 실행기의 `PROMPT_SOURCE_FILES`와 대응시킨다. 공유 평가자/지원/픽스처 가져오기를 따라 영향받는 모든 스위트에 도달한다. 예를 들어 `post_generation_eval_runner.rb`는 `post_generation_eval_test.rb`에 대응한다.
- 프로젝트의 전체 병합 전 등급을 사용한다(이 실행기에서는 `EVAL_JUDGE_TIER=full`). 더 저렴한 개발 등급으로 바꾸지 않는다. 선택이 여전히 불확실하면 영향받을 가능성이 있는 모든 스위트를 포함한다.

**2. 선택한 명령을 실행하고 종료 상태를 보존한다.**

Rails 예제:

```bash
set -o pipefail
EVAL_JUDGE_TIER=full EVAL_VERBOSE=1 bin/test-lane --eval test/evals/<suite>_eval_test.rb 2>&1 | tee /tmp/ship_evals.txt
```

다른 스택은 고유 명령을 사용한다. 프로젝트의 동시 실행·재시도 정책을 준수한다. 테스트 레인을 공유하는 Rails 스위트는 순서대로 실행한다. 첫 실패에서 멈추고 다른 유료 스위트를 시작하지 않는다.

**긴 평가 스위트(30분 이상): 턴 경계가 종료시키지 못하도록 분리 실행한다.**
분리 실행기와 평가 잠금을 사용한다. 바깥 시간 제한은 프로젝트가 선언한 스위트 기간과 재시도를 포함하도록 설정한다. 개별 평가 제한은 바꾸지 않는다. 전체 상한이 5400초 안에 들어오는 스위트의 예:

```bash
~/.claude/skills/gstack/bin/gstack-detach --label ship-evals --lock gstack-evals --timeout 5400 -- <project eval command>
```

출력된 로그에서 `### gstack-detach EXIT=<code> ###`를 폴링한다. 침묵은 성공이 아니다. 설정된 모든 시도를 유지한다. 건너뛰거나 시작하지 않은 사례는 커버리지를 충족하지 않는다.

**3. 결과를 확인하고 19단계용 증거를 저장한다.**

- **평가가 하나라도 실패하면:** 전체 게이트를 다시 실행하지 않는다. 실패와 확인 가능한 비용을 보여 준 뒤 `~/.claude/skills/gstack/ship/sections/measure.md`를 읽고 실패 사례마다 그 반복 절차를 수행한다. 분류, 단독 측정, 원인 수정, 재측정, 게이트 한 번의 순서다. 그 절차에서 명명된 실패 중단 조건에서만 **중단한다.**
- **선택한 모든 평가가 통과하면:** 실제 수, 재사용 증거와 출처, 확인 가능한 비용을 기록한다. 7단계로 계속한다.

---
