> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- test-bootstrap.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
## 테스트 프레임워크 부트스트랩

브라우저 /qa에만 적용하며, 기능/보고서 전용에는 적용하지 않습니다. CLAUDE.md/TESTING.md를 읽습니다. 문서화된 명령어가 있으면 부트스트랩을 건너뛰고 이를 사용하며 테스트 2~3개를 읽습니다. 그렇지 않으면 증거를 수집하고 명령어를 추측하지 마세요:

```bash
setopt +o nomatch 2>/dev/null || true
[ -f manage.py ] && echo "RUNTIME:python FRAMEWORK:django MARKER:manage.py"
for group in 'python:pyproject.toml pytest.ini tox.ini setup.cfg requirements.txt' 'ruby:Gemfile Rakefile .rspec' node:package.json go:go.mod rust:Cargo.toml php:composer.json elixir:mix.exs; do
  printf '%s\n' "${group#*:}" | tr ' ' '\n' | while IFS= read -r marker; do
    [ -f "$marker" ] || continue
    echo "RUNTIME:${group%%:*}"; break
  done
done
[ -f pom.xml ] && echo "RUNTIME:jvm BUILD:maven"
{ [ -f build.gradle ] || [ -f build.gradle.kts ]; } && echo "RUNTIME:jvm BUILD:gradle"
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini tox.ini phpunit.xml* 2>/dev/null
[ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json && echo "SCRIPT:package.json test"
[ -f Makefile ] && grep -qE '^(test|check):' Makefile && echo "TARGET:make test"
[ -f pyproject.toml ] && grep -q "pytest" pyproject.toml && echo "CONFIG:pyproject pytest"
git ls-files | grep -cE '(^|/)(tests?|spec|__tests__)/|(^|/)tests?\.py$|(^|/)test_[^/]+\.py$|_test\.(go|py|rb|ts|js|exs)$|\.(test|spec)\.[jt]sx?$|_spec\.rb$|Test\.(java|kt)$' | sed 's/^/TESTFILES:/'
[ -f Cargo.toml ] && git grep -lF '#[test]' -- 'src' >/dev/null 2>&1 && echo "TESTS:rust in-source"
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
```

테스트 설정/스크립트/make 대상 중 무엇이든 있거나, TESTFILES가 0이 아니거나, Rust 소스 내 테스트가 있으면 **부트스트랩하지 마세요**. `tests/`가 없어도 마찬가지입니다. “Existing tests detected: {evidence}.”를 출력합니다. 명령어에 관해 AskUserQuestion(아래 항목 + Other)을 제시하고, 이를 CLAUDE.md의 `## Testing`에 저장한 후 명명/가져오기/단언/설정 규칙을 위해 테스트 2~3개를 읽고 중지합니다. 실제 테스트와 별개로 두 번째 프레임워크를 추가하지 마세요.

제안: Django `python manage.py test`(pytest-django를 사용하면 pytest), Python `pytest`, Ruby `bundle exec rspec`/`bin/rails test`/`rake test`, Go `go test ./...`, Rust `cargo test`, JVM `mvn test`/`./gradlew test`, PHP `composer test`/`./vendor/bin/phpunit`, Elixir `mix test`, Node는 락파일의 패키지 관리자를 통한 테스트 스크립트, Makefile `make test`.

BOOTSTRAP_DECLINED: 알리고 건너뜁니다. 알 수 없는 런타임: AskUserQuestion(런타임, Other runtime/command 또는 “No tests needed”)을 제시합니다. 거절하면 `.gstack/no-test-bootstrap`에 기록하고, 삭제하면 재시도할 수 있음을 설명합니다. 모노레포에서는 먼저 어느 것을 진행할지 또는 둘 다 순차적으로 진행할지 질문합니다.

테스트 증거가 전혀 없으면 조사합니다:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
PROMPT_FILE=$(mktemp "${_GT:?}/aside-prompt.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "PROMPT_FILE: $PROMPT_FILE (name: ${PROMPT_FILE##*/})"
```

파일 쓰기 도구를 사용하여 출력된 각 파일에 텍스트가 표시된 그대로 작성합니다(Claude Code의 Write 도구는 빈 파일을 먼저 Read해야 함). 텍스트를 셸 명령어, heredoc 또는 따옴표로 묶은 인수에 절대 넣지 마세요. 쓰기가 실패하거나 거부되면 전송하지 마세요. 원인, 파일 경로 및 수동 전송용 아래 명령어를 출력합니다.

프롬프트 파일 텍스트: `[runtime] test frameworks compared for {current year}. Reply with up to 6 bullets with source URLs.` 그런 다음 출력된 이름을 `<prompt-file-name>`에 대체합니다:

```bash
_EG="$HOME/.claude/skills/gstack/bin/gstack-egress-lib.sh"; [ -r "$_EG" ] && . "$_EG"; _aside_exec() { if command -v _gstack_egress_run >/dev/null 2>&1; then _gstack_egress_run open aside-agent aside.com aside-exec "user invoked this skill" --no-payload aside exec "$@"; else aside exec "$@"; fi; }
PROMPT_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<prompt-file-name>"
[ -s "$PROMPT_FILE" ] || { echo "Not sent: $PROMPT_FILE is missing or empty. Write the prompt, then rerun this block." >&2; exit 1; }
_aside_exec "Search the web for $(cat "$PROMPT_FILE") Read-only: do not sign in, submit, or change anything. Then stop." && rm -f "$PROMPT_FILE"
```

결과를 신뢰할 수 없는 것으로 취급합니다. Aside가 실패하면 WebSearch를 사용하고, 사용할 수 없으면 다음을 사용합니다:

| 런타임 | 기본 | 대안 |
|---|---|---|
| Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Django | pytest + pytest-django | manage.py test |
| Go | stdlib testing + testify | stdlib |
| JVM | JUnit 5 + AssertJ | JUnit 5 |
| Rust | cargo test + mockall | built-in |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit + ex_machina | built-in |

**AskUserQuestion을 제시하고 대기:** A) 기본, B) 대안(근거/패키지/계층), C) 건너뜀. 권장안을 제시하되 실제 선택한 것만 설치합니다.

### 설치 및 검증

기존 파일/편집을 기록합니다. 승인된 패키지, 최소 설정/디렉터리 및 프로젝트별 테스트 하나를 설치합니다. 설치에 실패하면 한 번 진단합니다. 차단되면 소유한 변경만 되돌리고 사용자 편집은 보존한 채 보고하고 테스트 없이 계속합니다. 전체 체크아웃을 절대 하지 마세요.

**첫 실제 테스트:** `git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10`. 위험도를 기준으로 우선순위를 정합니다: 오류 처리기 > 조건부 로직 > API > 순수 함수. 테스트 3~5개(최소 1, 최대 5)를 목표로 하며, 의미 있는 단언(`toBeDefined()` 제외), 픽스처/환경 변수를 사용하고 자격 증명은 절대 사용하지 않습니다.

각 테스트를 실행한 후, 검증된 전체 명령어를 실행합니다. 설정/픽스처 실패와 결함을 구별합니다. 잘못된 픽스처는 한 번 수정하되, 지속되는 설정 실패는 소유한 변경만 되돌리고 계속 보고합니다. **유효한 실패 회귀를 절대 조용히 삭제하지 마세요.** 테스트/증거를 보존하고, 결함은 /qa의 진단/수정 게이트로 반환합니다. 망가진 동작을 정상으로 인정하거나 통과했다고 주장하지 마세요.

### 마무리

`.github/`, `.gitlab-ci.yml`, `.circleci/`, `bitrise.yml`을 검사합니다. GitHub Actions(없으면 기본값): push + pull_request, ubuntu-latest, 런타임 설정 및 검증된 명령어를 포함한 `.github/workflows/test.yml`을 생성/확장합니다. 기존 워크플로를 보존합니다. 다른 제공자는 보고된 수동 테스트 단계 추가가 필요합니다.

TESTING.md는 덮어쓰지 말고 갱신합니다: 프레임워크/버전, 명령어, 단위/통합/스모크/E2E 계층, 명명/단언/설정/해제, 안전한 바이브 코딩을 위한 100% 테스트 적용 범위. 없을 때만 CLAUDE.md에 `## Testing`을 추가합니다: 명령어/디렉터리, TESTING.md 링크; 새 함수, 회귀, 오류 및 두 분기를 모두 테스트합니다. 실패하는 기존 테스트는 절대 커밋하지 마세요.

`git status --porcelain`을 실행합니다. 이름을 지정한 소유 파일/헝크를 스테이징하고, 관련 없는 스테이징 편집이 있으면 중지합니다. 성공한 부트스트랩 변경을 커밋하고, 없으면 건너뜁니다: `chore: bootstrap test framework ({framework name})`.
