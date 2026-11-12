> 한국어 번역본: 고정 커밋 `f29319d550d1f05404f7184b92e995600ca2293f`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<div align="center">
    <img src="https://raw.githubusercontent.com/github/spec-kit/main/media/logo_large.webp" alt="Spec Kit 로고" width="200" height="200"/>
    <h1>🌱 Spec Kit</h1>
    <h3><em>코딩 에이전트와 함께 명세로 개발하고, 버그를 고치고, 아이디어를 평가하세요.</em></h3>
</div>

<p align="center">
    <a href="https://github.com/github/spec-kit/releases/latest"><img src="https://img.shields.io/github/v/release/github/spec-kit" alt="최신 릴리스"/></a>
    <a href="https://github.com/github/spec-kit/stargazers"><img src="https://img.shields.io/github/stars/github/spec-kit?style=social" alt="GitHub 스타"/></a>
    <a href="https://github.com/github/spec-kit/blob/main/LICENSE"><img src="https://img.shields.io/github/license/github/spec-kit" alt="라이선스"/></a>
    <a href="https://github.github.io/spec-kit/"><img src="https://img.shields.io/badge/docs-GitHub_Pages-blue" alt="문서"/></a>
</p>

<p align="center">
    <strong>영어</strong> ·
    <a href="https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/README.zh-CN.md">简体中文</a> ·
    <a href="https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/README.ja.md">日本語</a> ·
    <a href="https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/README.ko.md">한국어</a>
</p>

Spec Kit은 AI 코딩 에이전트에 구조화된 프로세스, 재사용 가능한 템플릿, 문서화된 결과를 제공하는 오픈 소스 도구 모음입니다. 준비된 프로세스로 시작하거나, 이를 맞춤화하거나, 자신만의 프로세스를 가져올 수 있습니다.

## 프로세스 선택

| 필요한 작업 | 프로세스 | 결과 |
| --- | --- | --- |
| 기능이나 애플리케이션 개발 | [명세 주도 개발](#%EB%AA%85%EC%84%B8-%EC%A3%BC%EB%8F%84-%EA%B0%9C%EB%B0%9C) | 계획·구현·수렴까지 이어지는 명세 |
| 잘못된 동작의 진단과 수정 | [버그 수정](#%EB%B2%84%EA%B7%B8-%EC%88%98%EC%A0%95) | 원인 평가, 범위를 정한 수정, 검증 기록 |
| 아이디어에 투자할 가치가 있는지 판단 | [아이디어 평가](#%EC%95%84%EC%9D%B4%EB%94%94%EC%96%B4-%ED%8F%89%EA%B0%80) | 근거에 기반한 진행·명확화·중단 결정 |
| 다른 프로세스 도입 또는 제작 | [자신만의 프로세스](#%EC%A0%9C%EA%B3%B5-%EA%B8%B0%EB%8A%A5) | 재사용 가능한 기본 요소를 조정하거나 조합한 프로세스 |

각 항목은 독립적인 진입점이며 필수 단계가 아닙니다. SDD는 코어에 포함되고, 버그 수정과 평가는 필요할 때 설치하는 번들 확장으로 제공됩니다. 아래 기본 요소로 다른 프로세스를 도입하거나 만들 수도 있습니다.

<a id="capabilities"></a>

## 제공 기능

Spec Kit은 바로 사용할 수 있는 프로세스와 조합 가능한 메커니즘을 함께 제공합니다:

| 기능 | Spec Kit 메커니즘 |
| --- | --- |
| 코딩 에이전트 연결 또는 전환 | [통합](https://github.github.io/spec-kit/integrations/index.html) |
| 명령·품질 게이트·전체 프로세스 추가 | [확장](https://github.github.io/spec-kit/extensions/overview.html) |
| 프로세스를 외부 도구나 서비스에 연결 | [확장](https://github.github.io/spec-kit/extensions/overview.html) |
| 코딩 에이전트 수명 주기 이벤트에 반응 | [확장 런타임 이벤트](https://github.github.io/spec-kit/extensions/api.html#extension-runtime-events) |
| Spec Kit 명령 전후에 확장 명령 실행 | [확장 훅](https://github.github.io/spec-kit/extensions/api.html#hook-configuration) |
| 템플릿·명령·용어·방법론 조정 | [프리셋](https://github.github.io/spec-kit/presets/overview.html) |
| 조직 또는 규제 기준 적용 | [프리셋](https://github.github.io/spec-kit/presets/overview.html) |
| 한 프로젝트에서 템플릿 재정의 | [프로젝트 로컬 재정의](https://github.github.io/spec-kit/how-to/customization.html#project-local-overrides-and-resolution) |
| 프롬프트·명령·게이트·셸 작업 자동화 | [워크플로](https://github.github.io/spec-kit/workflows/overview.html) |
| 설치된 워크플로를 포크 없이 수정 | [워크플로 오버레이](https://github.github.io/spec-kit/workflows/overlays.html) |
| 워크플로에 재사용 가능한 실행 동작 추가 | [워크플로 단계](https://github.github.io/spec-kit/workflow-steps/developing.html#custom-step-packages) |
| 역할이나 팀에 맞춘 선별 설정 설치 | [번들](https://github.github.io/spec-kit/bundles/overview.html) |
| 커뮤니티 구성 요소 찾기 | [카탈로그](https://github.github.io/spec-kit/overview/catalogs.html) |
| 승인된 구성 요소의 비공개 카탈로그 호스팅 | [카탈로그](https://github.github.io/spec-kit/overview/catalogs.html) |
| 비공개 카탈로그 및 구성 요소 다운로드 접근 | [인증](https://github.github.io/spec-kit/reference/authentication.html) |
| 오프라인 또는 방화벽 뒤에서 작업 | [로컬 출처와 자체 호스팅 카탈로그](https://github.github.io/spec-kit/install/air-gapped.html) |
| 명령·템플릿·스크립트를 공급하는 계층 확인 | [산출물 목록](https://github.github.io/spec-kit/overview/artifacts.html) |

`specify extension search`, `specify preset search`, `specify workflow search`, `specify bundle search` 등의 명령으로 활성 카탈로그를 검색하세요. Spec Kit에는 커뮤니티 카탈로그가 포함되며, 조직에서 선별한 자체 출처를 추가할 수도 있습니다. 카탈로그에 등재되었다고 감사나 추천을 받은 것은 아니므로, 설치하거나 실행하기 전에 커뮤니티 소스 코드를 검토하세요.

<a id="-get-started"></a>
<a id="-prerequisites"></a>

## 시작하기

Linux, macOS 또는 Windows에서 Python 3.11 이상, [uv](https://github.github.io/spec-kit/install/uv.html), 지원되는 AI 코딩 에이전트가 필요합니다.

터미널에서 다음 명령을 실행해 Spec Kit을 설치하고 프로젝트를 만드세요. 이 예시는 GitHub Copilot을 사용합니다.

```bash
uv tool install specify-cli
specify init my-project --integration copilot
cd my-project
```

<a id="-supported-ai-coding-agent-integrations"></a>

Specify CLI를 설치하고 프로젝트를 만든 다음, 프로젝트 디렉터리에서 코딩 에이전트를 실행하고 아래 프로세스 중 하나를 선택하세요.

다른 설정은 다음을 참고하세요:

- [설치](https://github.github.io/spec-kit/installation.html): 고정 릴리스, 다른 설치 도구, CI, 문제 해결.
- [기존 프로젝트](https://github.github.io/spec-kit/how-to/existing-projects.html): 이미 있는 코드로 시작하기.
- [다른 에이전트](https://github.github.io/spec-kit/integrations/index.html): 통합 키와 [호출 문법](https://github.github.io/spec-kit/integrations/cli.html#command-invocation).
- [업그레이드](https://github.github.io/spec-kit/upgrade.html): 기존 설치 업데이트.

<a id="-what-is-spec-driven-development"></a>
<a id="sdd-quickstart"></a>

<a id="spec-driven-development"></a>

## 명세 주도 개발

무엇을 왜 만들지 정의한 다음, 명세를 계획·작업·작동하는 코드로 구체화하세요.

아래는 최소 흐름입니다. 프로젝트마다 헌법을 한 번 만들고, 기능마다 나머지 단계를 반복하세요. 터미널이 아닌 에이전트 채팅에서 이 스킬을 하나씩 실행하고, 다음으로 넘어가기 전에 각 결과를 검토하세요.

이 예시는 GitHub Copilot의 기본 스킬 문법을 사용합니다. 다른 에이전트에서는 [대응하는 호출 문법](https://github.github.io/spec-kit/integrations/cli.html#command-invocation)을 사용하세요.

```text
/speckit-constitution Create principles focused on code quality, testing, and maintainability.
/speckit-specify Build a photo organizer with albums grouped by date and a tile preview of each album.
/speckit-plan Use Vite with vanilla JavaScript. Keep images local and store metadata in SQLite.
/speckit-tasks
/speckit-implement
/speckit-converge
```

수렴 결과가 `Converged`가 될 때까지 implement와 converge를 반복하세요. 명확화, 체크리스트, 일관성 분석은 SDD 단계별 안내를 참고하세요.

[SDD 단계별 안내](https://github.github.io/spec-kit/quickstart.html) ·
[명령 참조](https://github.github.io/spec-kit/reference/agentic-sdd.html)

<a id="-bug-fixing-with-spec-kit"></a>
<a id="bug-fix-quickstart"></a>

<a id="bug-fixing"></a>

## 버그 수정

원인을 평가하고 버그를 수정한 뒤, 원래 증상이 해결됐는지 검증하세요. SDD 기능 워크플로를 먼저 수행할 필요는 없습니다.

프로젝트 디렉터리의 터미널에서 버그 수정 확장을 설치하세요:

```bash
specify extension add bug
```

터미널이 아닌 에이전트 채팅에서 이 스킬을 하나씩 실행하고, 다음으로 넘어가기 전에 각 결과를 검토하세요.

이 예시는 GitHub Copilot의 기본 스킬 문법을 사용합니다. 다른 에이전트에서는 [대응하는 호출 문법](https://github.github.io/spec-kit/integrations/cli.html#command-invocation)을 사용하세요.

```text
/speckit-bug-assess "Submitting an empty password crashes the login form." slug=login-crash
/speckit-bug-fix slug=login-crash
/speckit-bug-test slug=login-crash
```

`.specify/bugs/login-crash/`의 보고서를 검토하세요. 최종 판정은 `verified`, `partial`, `failed` 중 하나이며, `verified`만 수정 성공을 확인해 줍니다.

[버그 수정 단계별 안내](https://github.github.io/spec-kit/guides/bugfix.html) ·
[명령 참조](https://github.github.io/spec-kit/reference/agentic-bugfix.html)

<a id="-assessing-ideas-with-spec-kit"></a>
<a id="idea-assessment-quickstart"></a>

<a id="idea-assessment"></a>

## 아이디어 평가

아이디어를 추진할 가치가 있는지 판단할 근거를 모으세요. 소스 코드나 SDD 기능 워크플로는 필요하지 않습니다.

프로젝트 디렉터리의 터미널에서 평가 확장을 설치하세요:

```bash
specify extension add assess
```

터미널이 아닌 에이전트 채팅에서 이 스킬을 하나씩 실행하고, 다음으로 넘어가기 전에 각 결과를 검토하세요.

이 예시는 GitHub Copilot의 기본 스킬 문법을 사용합니다. 다른 에이전트에서는 [대응하는 호출 문법](https://github.github.io/spec-kit/integrations/cli.html#command-invocation)을 사용하세요.

```text
/speckit-assess-intake "Let users work offline and sync when they reconnect." slug=offline-mode
/speckit-assess-research slug=offline-mode
/speckit-assess-define slug=offline-mode
/speckit-assess-shape slug=offline-mode
/speckit-assess-decide slug=offline-mode
```

`.specify/assessments/offline-mode/`의 산출물과 최종 결정인 `go`, `needs-clarification`, `kill`을 검토하세요. 단계 전체를 다시 실행하기보다 직접 또는 에이전트와 함께 기존 Markdown 산출물을 편집해 불확실한 사항을 해결하세요. `go` 결정을 받은 소프트웨어 아이디어를 구현하기로 했다면 필요에 따라 프로젝트 헌법을 마련하고, `decision.md`의 인수인계 요약을 `/speckit-specify`에 전달하세요. 이유를 문서화하고 중단하는 것도 유용한 결과입니다.

[평가 단계별 안내](https://github.github.io/spec-kit/guides/assessment.html) ·
[명령 참조](https://github.github.io/spec-kit/reference/agentic-assessment.html)

<a id="-making-spec-kit-your-own-extensions--presets"></a>
<a id="-bundles-role-based-setups"></a>
<a id="-community"></a>

## 맞춤화하거나 자신만의 프로세스 가져오기

팀의 기준에 맞게 명세 주도 개발, 버그 수정, 아이디어 평가를 맞춤화하세요. 어느 것도 도입하지 않고 자신만의 프로세스를 가져올 수도 있습니다. 목표에 맞게 [위의 기능](#%EC%A0%9C%EA%B3%B5-%EA%B8%B0%EB%8A%A5)을 조합하세요:

- 프리셋으로 기존 프로세스를 조정하세요. 예를 들어 계획에 규정 추적성을 요구할 수 있습니다. 한 번만 템플릿을 바꿀 때는 프로젝트 로컬 재정의를 사용하세요.
- 확장으로 명령을 추가하고 통합을 통해 코딩 에이전트에 제공하여 자신만의 프로세스를 가져오세요.
- 워크플로로 명령과 검사를 자동화하세요. 설치된 워크플로를 포크하지 않고 조정하려면 오버레이를 사용하고, 기본 유형만으로 부족하면 사용자 지정 워크플로 단계를 추가하세요.
- 확장·프리셋·워크플로·워크플로 단계를 번들로 묶어 재사용 가능한 설정을 공유하세요.

필요를 충족하는 가장 작은 변경부터 시작하세요. 프로세스 전체를 바꿀 필요는 없습니다.

[맞춤화 안내](https://github.github.io/spec-kit/how-to/customization.html) ·
[커뮤니티 구성 요소와 단계별 안내](https://github.github.io/spec-kit/community/overview.html)

<a id="-specify-cli-reference"></a>
<a id="available-slash-commands"></a>
<a id="-learn-more"></a>
<a id="-core-philosophy"></a>
<a id="-development-phases"></a>
<a id="-experimental-goals"></a>
<a id="-does-spec-kit-use-spec-kit"></a>

## 문서

- [CLI 참조](https://github.github.io/spec-kit/index.html#specify-cli) 및 [프로세스 명령](https://github.github.io/spec-kit/reference/agentic-sdd.html#command-overview)
- 프로젝트 작업에 Spec Kit을 적용하기 위한 [방법별 안내](https://github.github.io/spec-kit/how-to/index.html)
- [SDD 철학](https://github.github.io/spec-kit/how-to/sdd.html), [전체 방법론](./spec-driven.md), [기존 명세의 발전](https://github.github.io/spec-kit/how-to/evolving-specs.html)
- [프로젝트 역사](https://github.github.io/spec-kit/overview/history.html)
- [Spec Kit이 Spec Kit을 사용하는 방법](https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/CONTRIBUTING.md#does-spec-kit-use-spec-kit)

## 언론과 커뮤니티 소식

- [오픈 소스 금요일: Spec Kit 2부](https://www.youtube.com/watch?v=8hHCpNVLhmI) (2026년 10월 16일) — Manfred Riem과 Nicole Haugen이 Spec Kit 1.0과 확장된 도구 모음을 이야기합니다.
- [SpecKit의 살아 있는 명세](https://www.alfredo-perez.dev/blog/2026-10-15-living-specs) (2026년 10월 15일) — Alfredo Perez가 프로젝트의 발전에 맞춰 기능 수준 명세를 유지하는 방법을 살펴봅니다.
- [Spec Kit 맞춤화 연재](https://jesseliberty.com/2026/10/08/4-solutions-to-spec-kit-issues/) (2026년 10월 8~10일) — Jesse Liberty가 테스트와 게시를 포함한 프리셋·확장 저작을 단계별로 설명합니다.
- [명세 우선에서 기업용 준비까지: GitHub Spec Kit 확장](https://developer.microsoft.com/blog/from-spec-first-to-enterprise-ready-extending-github-spec-kit/) (2026년 10월 7일) — Apoorv Gupta가 프리셋·확장·번들·워크플로·관리형 카탈로그를 통한 기업 맞춤화를 설명합니다.
- [Spec Kit과 함께하는 오픈 소스 금요일](https://www.youtube.com/watch?v=2IArMAhkJcE) (2026년 5월 8일) — Manfred Riem의 소개와 SDD 시연입니다.

## 스타 이력

<p align="center">
    <a href="https://www.star-history.com/#github/spec-kit&Date">
        <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=github%2Fspec-kit&type=Date&theme=dark"/>
            <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=github%2Fspec-kit&type=Date"/>
            <img src="https://api.star-history.com/svg?repos=github%2Fspec-kit&type=Date" alt="Spec Kit 스타 이력 차트"/>
        </picture>
    </a>
</p>

<p align="center">
    <em>Spec Kit을 빛내 주시는 모든 분께 감사드립니다.</em>
</p>

<a id="-support"></a>

## 지원 및 기여

[버그 신고 또는 기능 요청](https://github.com/github/spec-kit/issues/new) ·
[기여 안내](https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/CONTRIBUTING.md) · [행동 강령](https://github.com/github/spec-kit/blob/f29319d550d1f05404f7184b92e995600ca2293f/CODE_OF_CONDUCT.md)

<a id="-license"></a>

Spec Kit은 [MIT 라이선스](./LICENSE)로 제공됩니다.
