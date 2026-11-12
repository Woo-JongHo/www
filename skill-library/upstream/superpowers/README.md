> 한국어 번역본: 고정 커밋 `22f0b463e7a5e579904dd6211a520321035526f7`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# Superpowers

Superpowers는 조합 가능한 스킬 집합과 에이전트가 이를 사용하도록 보장하는 몇 가지 초기 지침을 기반으로 구축된, 코딩 에이전트를 위한 완전한 소프트웨어 개발 방법론입니다.

## 목차

- [작동 방식](#%EC%9E%91%EB%8F%99-%EB%B0%A9%EC%8B%9D)
- [상용 서비스](#%EC%83%81%EC%9A%A9-%EC%84%9C%EB%B9%84%EC%8A%A4)
- [시작하기](#%EC%84%A4%EC%B9%98)
  - [Claude Code](#claude-code)
  - [Antigravity](#antigravity)
  - [Codex App](#codex-app)
  - [Codex CLI](#codex-cli)
  - [Cursor](#cursor)
  - [Devin CLI](#devin-cli)
  - [Factory Droid](#factory-droid)
  - [Gemini CLI](#gemini-cli)
  - [GitHub Copilot CLI](#github-copilot-cli)
  - [Grok Build CLI](#grok-build-cli)
  - [Kimi Code](#kimi-code)
  - [OpenCode](#opencode)
  - [Pi](#pi)
  - [Qwen Code](#qwen-code)
  - [Hermes Agent](#hermes-agent)
  - [Muse](#muse)
- [기본 워크플로](#%EA%B8%B0%EB%B3%B8-%EC%9B%8C%ED%81%AC%ED%94%8C%EB%A1%9C)
- [문제가 발생했을 때](#%EB%AC%B8%EC%A0%9C%EA%B0%80-%EB%B0%9C%EC%83%9D%ED%96%88%EC%9D%84-%EB%95%8C)
- [커뮤니티](#%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0)
- [포함된 내용](#%ED%8F%AC%ED%95%A8%EB%90%9C-%EB%82%B4%EC%9A%A9)
- [철학](#%EC%B2%A0%ED%95%99)
- [기여하기](#%EA%B8%B0%EC%97%AC%ED%95%98%EA%B8%B0)
- [업데이트](#%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8)
- [라이선스](#%EB%9D%BC%EC%9D%B4%EC%84%A0%EC%8A%A4)
- [시각적 동반 기능 원격 분석](#%EC%8B%9C%EA%B0%81%EC%A0%81-%EB%8F%99%EB%B0%98-%EA%B8%B0%EB%8A%A5-%EC%9B%90%EA%B2%A9-%EB%B6%84%EC%84%9D)

<a id="how-it-works"></a>

## 작동 방식

코딩 에이전트를 실행하는 순간부터 시작됩니다. 에이전트는 무언가를 만들고 있다는 것을 확인하자마자 코드를 작성하려고 바로 뛰어들지 *않습니다*. 대신 한 걸음 물러나 실제로 하려는 일이 무엇인지 묻습니다.

대화에서 명세를 끌어낸 뒤에는 실제로 읽고 이해할 수 있을 만큼 짧은 단위로 나누어 보여 줍니다.

설계를 승인하면 에이전트는 형편없는 취향, 판단력 부재, 프로젝트 맥락 부재, 테스트 기피 성향을 가진 의욕 넘치는 주니어 엔지니어도 따를 수 있을 만큼 명확한 구현 계획을 마련합니다. 이 계획은 진정한 red/green TDD, YAGNI (You Aren't Gonna Need It), DRY를 강조합니다.

다음으로 "go"라고 말하면, 에이전트들이 각 엔지니어링 작업을 수행하고, 자신의 작업을 검사하고 검토하며, 계속 진행하도록 하는 *subagent-driven-development* 프로세스를 시작합니다. 작성한 계획에서 벗어나지 않고 에이전트가 한 번에 몇 시간씩 자율적으로 작업하는 일도 드물지 않습니다.

이 외에도 많은 내용이 있지만, 이것이 시스템의 핵심입니다. 그리고 스킬은 자동으로 실행되므로 특별히 할 일은 없습니다. 코딩 에이전트가 그냥 Superpowers를 갖게 됩니다.

<a id="commercial-services"></a>

## 상용 서비스

기업에서 Superpowers를 사용 중이며 상용 지원, 추가 도구 또는 관리형 지출이 도움이 된다면 sales@primeradiant.com으로 언제든지 연락해 주세요.

<a id="installation"></a>

## 설치

설치는 하니스마다 다릅니다. 둘 이상을 사용한다면 각각에 Superpowers를 별도로 설치하세요.

### Claude Code

Superpowers는 [공식 Claude 플러그인 마켓플레이스](https://claude.com/plugins/superpowers)를 통해 제공됩니다.

#### 공식 마켓플레이스

- Anthropic의 공식 마켓플레이스에서 플러그인을 설치합니다:

  ```bash
  /plugin install superpowers@claude-plugins-official
  ```

#### Superpowers 마켓플레이스

Superpowers 마켓플레이스는 Claude Code용 Superpowers 및 일부 관련 플러그인을 제공합니다.

- 마켓플레이스를 등록합니다:

  ```bash
  /plugin marketplace add obra/superpowers-marketplace
  ```

- 이 마켓플레이스에서 플러그인을 설치합니다:

  ```bash
  /plugin install superpowers@superpowers-marketplace
  ```

### Antigravity

이 리포지터리에서 플러그인으로 Superpowers를 설치합니다:

```bash
agy plugin install https://github.com/obra/superpowers
```

Antigravity는 설치된 각 스킬의 설명을 나열하며, `using-superpowers` 스킬의 설명은
모델이 대화 시작 시 해당 스킬을 로드하도록 안내합니다. 업데이트하려면 같은 명령으로
다시 설치하세요.

### Codex App

Superpowers는 [공식 Codex 플러그인 마켓플레이스](https://github.com/openai/plugins)를 통해 제공됩니다.

- Codex 앱의 사이드바에서 Plugins를 클릭합니다.
- Coding 섹션에 `Superpowers`가 표시됩니다.
- Superpowers 옆의 `+`를 클릭하고 안내를 따릅니다.

### Codex CLI

Superpowers는 [공식 Codex 플러그인 마켓플레이스](https://github.com/openai/plugins)를 통해 제공됩니다.

- 플러그인 검색 인터페이스를 엽니다:

  ```bash
  /plugins
  ```

- Superpowers를 검색합니다:

  ```bash
  superpowers
  ```

- `Install Plugin`을 선택합니다.

### Cursor

- Cursor Agent 채팅에서 마켓플레이스로 설치합니다:

  ```text
  /add-plugin superpowers
  ```

- 또는 플러그인 마켓플레이스에서 "superpowers"를 검색합니다.

### Devin CLI

- 이 리포지터리에서 플러그인을 설치합니다:

  ```bash
  devin plugins install obra/superpowers
  ```

- 다음 명령으로 최신 버전으로 업데이트합니다:

  ```bash
  devin plugins update superpowers
  ```

### Factory Droid

- 마켓플레이스를 등록합니다:

  ```bash
  droid plugin marketplace add https://github.com/obra/superpowers
  ```

- 플러그인을 설치합니다:

  ```bash
  droid plugin install superpowers@superpowers
  ```

### Gemini CLI

- 확장을 설치합니다:

  ```bash
  gemini extensions install https://github.com/obra/superpowers
  ```

- 나중에 업데이트합니다:

  ```bash
  gemini extensions update superpowers
  ```

### GitHub Copilot CLI

- 마켓플레이스를 등록합니다:

  ```bash
  copilot plugin marketplace add obra/superpowers-marketplace
  ```

- 플러그인을 설치합니다:

  ```bash
  copilot plugin install superpowers@superpowers-marketplace
  ```

### Grok Build CLI

Superpowers는 [공식 Grok 플러그인 마켓플레이스](https://github.com/xai-org/plugin-marketplace)를 통해 제공됩니다.

- xAI의 공식 마켓플레이스에서 플러그인을 설치합니다:

  ```bash
  grok plugin install superpowers@xai-official --trust
  ```

- 또는 TUI에서 마켓플레이스를 열고 Superpowers를 검색하여 설치합니다:

  ```text
  /marketplace
  ```

### Kimi Code

Superpowers는 Kimi Code의 플러그인 마켓플레이스에서 제공됩니다.

- Kimi Code의 플러그인 관리자를 엽니다:

  ```text
  /plugins
  ```

- `Marketplace` > `Superpowers`로 이동하여 설치합니다.

- 또는 이 리포지터리에서 직접 설치합니다:

  ```text
  /plugins install https://github.com/obra/superpowers
  ```

- 상세 문서: [docs/README.kimi.md](docs/README.kimi.md)

### OpenCode

OpenCode는 자체 플러그인 설치 방식을 사용하므로, 다른 하니스에서 이미 사용하더라도
Superpowers를 별도로 설치하세요.

- OpenCode에 다음과 같이 말합니다:

  ```
  Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md
  ```

- 상세 문서: [docs/README.opencode.md](docs/README.opencode.md)

### Pi

이 리포지터리에서 Pi 패키지로 Superpowers를 설치합니다:

```bash
pi install git:github.com/obra/superpowers
```

로컬 개발 시 이 체크아웃을 임시 패키지로 로드하여 Pi를 실행합니다:

```bash
pi -e /path/to/superpowers
```

Pi 패키지는 Superpowers 스킬과 세션 시작 및 압축 후에 `using-superpowers` 부트스트랩을 주입하는 작은 확장을 로드합니다. Pi에는 네이티브 스킬이 있으므로 호환성 `Skill` 도구가 필요하지 않습니다. 서브에이전트 및 작업 목록 도구는 선택 사항인 Pi 동반 패키지로 유지됩니다.

### Qwen Code

Qwen Code는 Claude Code 마켓플레이스에서 직접 플러그인을 설치합니다.

- 이 리포지터리에서 플러그인을 설치하고, 메시지가 표시되면 `superpowers`를 선택합니다:

  ```bash
  qwen extensions install obra/superpowers
  ```

- 나중에 업데이트합니다:

  ```bash
  qwen extensions update superpowers
  ```

### Hermes Agent

이 리포지터리에서 Hermes 플러그인으로 Superpowers를 설치합니다:

```bash
hermes plugins install obra/superpowers --enable
```

설치 후 활성 Hermes 세션을 다시 시작합니다. 참고: Hermes에는 압축 후 훅이 없으므로,
첫 번째 턴을 넘어 압축되는 매우 긴 세션은 부트스트랩을 잃습니다. 스킬이 더 이상
실행되지 않으면 새 세션을 시작하세요.

### Muse

Superpowers는 네이티브 Muse 플러그인으로 제공됩니다. 같은 리포지터리, 같은 스킬, 모든 하니스입니다. `using-superpowers` 부트스트랩은 Claude Code, Codex, Cursor, Gemini, Pi 및 나머지와 함께 네이티브 `SessionStart` 훅을 통해 주입되며, 세션별 옵트인이 필요하지 않습니다.

- 로컬 체크아웃에서 설치합니다:

  ```bash
  muse plugins install ./
  muse plugins approve superpowers
  ```

  또는 복제하여 설치합니다:

  ```bash
  git clone https://github.com/obra/superpowers.git
  muse plugins install ./superpowers
  muse plugins approve superpowers
  ```

- 나중에 업데이트합니다:

  ```bash
  muse plugins update superpowers
  ```

`SessionStart` 훅이 적용되도록 설치 후 활성 Muse 세션을 다시 시작하세요. 스킬은 즉시 활성화되지만, 훅은 최초 설치 시 승인이 필요합니다. 확인하려면 새 세션을 시작하고 `Let's make a react todo list`를 전송하세요. 정상 설치라면 코드가 작성되기 전에 `brainstorming`이 자동으로 실행됩니다. 버전은 `.version-bump.json`에서 추적되므로 `scripts/bump-version.sh`가 동기화 상태를 유지합니다.

<a id="the-basic-workflow"></a>

## 기본 워크플로

1. **brainstorming** - 무엇이든 만들기 전에 활성화됩니다. 설명하는 질문을 통해 실제로 원하는 것과 그 이유를 끌어낸 다음, 수정할 수 있도록 이해한 내용을 다시 전달합니다. 작은 변경은 채팅에서 합의하고, 프로젝트는 빌더가 계획을 수립할 수 있는 서면 설계 문서를 만듭니다.

2. **using-git-worktrees** - 설계 승인 후 활성화됩니다. 새 브랜치에 격리된 작업 공간을 만들고, 프로젝트 설정을 실행하며, 깨끗한 테스트 기준선을 검증합니다.

3. **writing-plans** - 승인된 설계와 함께 활성화됩니다. 작업을 한입 크기 작업(각각 2~5분)으로 나눕니다. 모든 작업에는 정확한 파일 경로, 완전한 코드, 검증 단계가 있습니다.

4. **subagent-driven-development** 또는 **executing-plans** - 계획과 함께 활성화됩니다. 각 작업에 새 서브에이전트를 배정하고 각 작업 후 검토합니다(가장 철저함). 또는 현재 세션에서 모든 작업을 인라인으로 구현하고 마지막에 전체 브랜치를 새로 검토합니다(가장 저렴함).

5. **test-driven-development** - 구현 중 활성화됩니다. RED-GREEN-REFACTOR를 강제합니다: 실패하는 테스트를 작성하고, 실패를 확인하고, 최소 코드를 작성하고, 통과를 확인하고, 커밋합니다. 테스트보다 먼저 작성된 코드를 삭제합니다.

6. **requesting-code-review** - 작업 사이에 활성화됩니다. 계획에 따라 검토하고 심각도별로 문제를 보고합니다. 심각한 문제는 진행을 차단합니다.

7. **finishing-a-development-branch** - 작업이 완료되면 활성화됩니다. 테스트를 검증하고, 선택지(병합/PR/유지/폐기)를 제시하며, worktree를 정리합니다.

**에이전트는 모든 작업 전에 관련 스킬을 확인합니다.** 제안이 아니라 필수 워크플로입니다.

<a id="when-something-goes-wrong"></a>

## 문제가 발생했을 때

가끔 세션이 오작동합니다. 스킬이 실행되면 안 될 때 실행되거나, 실행되어야 할 때 조용히 있거나, 에이전트가 계획을 무시하거나, 작업을 반복하거나, 예상보다 많은 토큰을 소모할 수 있습니다. 코딩 에이전트에게 "이 세션에서 superpowers에 어떤 문제가 있었는지 조사해 줘"이라고 요청하면 **diagnosing-superpowers** 스킬을 호출합니다. 이전 세션을 조사하려면 "세션 `<id>`에서 superpowers에 어떤 문제가 있었는지 조사해 줘"처럼 이름을 지정하세요.

이 스킬은 세션 기록을 읽고, 줄 단위 증거와 함께 발생한 일을 보고하며, 원한다면 버그 보고용으로 정리된 번들을 패키징합니다.

<a id="community"></a>

## 커뮤니티

Superpowers는 [Jesse Vincent](https://blog.fsck.com)와 [Prime Radiant](https://primeradiant.com)의 나머지 구성원이 만들었습니다.

- **Discord**: 커뮤니티 지원, 질문, Superpowers로 만들고 있는 것을 공유하려면 [참여하세요](https://discord.gg/35wsABTejz)
- **Issues**: https://github.com/obra/superpowers/issues
- **릴리스 공지**: 새 버전에 대한 알림을 받으려면 [가입하세요](https://primeradiant.com/superpowers/)

<a id="whats-inside"></a>

## 포함된 내용

### 스킬 라이브러리

**테스트**
- **test-driven-development** - RED-GREEN-REFACTOR 주기(테스트 안티패턴 참고 자료 포함)

**디버깅**
- **systematic-debugging** - 4단계 근본 원인 프로세스(root-cause-tracing, defense-in-depth, condition-based-waiting 기법 포함)
- **verification-before-completion** - 실제로 수정되었는지 확인
- **diagnosing-superpowers** - 증거를 바탕으로 세션에서 무엇이 잘못되었는지 파악하고, 정리된 번들을 내보내거나 이슈 등록

**협업**
- **brainstorming** - 빌드 전에 의도 파악
- **writing-plans** - 상세 구현 계획
- **executing-plans** - 인라인 계획 실행: 하나의 컨텍스트, 하나의 최종 검토
- **dispatching-parallel-agents** - 동시 서브에이전트 워크플로
- **requesting-code-review** - 사전 검토 체크리스트
- **receiving-code-review** - 피드백에 대응
- **using-git-worktrees** - 병렬 개발 브랜치
- **finishing-a-development-branch** - 병합/PR 결정 워크플로
- **subagent-driven-development** - 2단계 검토(명세 준수, 이후 코드 품질)를 통한 빠른 반복

**메타**
- **writing-skills** - 모범 사례를 따라 새 스킬 생성(테스트 방법론 포함)
- **using-superpowers** - 스킬 시스템 소개

<a id="philosophy"></a>

## 철학

- **테스트 주도 개발** - 항상 테스트를 먼저 작성
- **임시방편보다 체계성** - 추측보다 프로세스
- **복잡성 감소** - 단순성을 최우선 목표로
- **주장보다 증거** - 성공을 선언하기 전에 검증

[원본 릴리스 공지](https://blog.fsck.com/2025/10/09/superpowers/)를 읽어 보세요.

<a id="contributing"></a>

## 기여하기

아래는 Superpowers의 일반적인 기여 절차입니다. 일반적으로 새 스킬의 기여는 받지 않으며, 스킬 업데이트는 지원하는 모든 코딩 에이전트에서 작동해야 한다는 점을 유념하세요. 동일한 문제를 겪었더라도 유지 관리자가 요청하지 않은 한 다른 사람이 등록한 이슈를 수정하는 에이전트 작성 PR은 받지 않습니다. 대신 기존 이슈에 보고를 추가하세요.

1. 리포지터리를 포크합니다
2. 'dev' 브랜치로 전환합니다
3. 작업용 브랜치를 만듭니다
4. 새 스킬 및 수정된 스킬의 생성과 테스트는 `writing-skills` 스킬을 따릅니다
5. 사람이 자신의 말로 작성한 요약을 포함하여 풀 리퀘스트 템플릿의 모든 섹션을 채운 PR을 제출합니다.

스킬 동작 테스트는 `evals/`에 복제된 [superpowers-evals](https://github.com/prime-radiant-inc/superpowers-evals/)의 drill eval 하니스를 사용합니다. 설정은 `evals/README.md`를 참조하세요. 플러그인 인프라 테스트는 `tests/`에 있으며 해당 `run-*.sh` 또는 `npm test`를 통해 실행합니다.

전체 가이드는 `skills/writing-skills/SKILL.md`를 참조하세요.

<a id="updating"></a>

## 업데이트

Superpowers 업데이트는 코딩 에이전트에 따라 다소 다르지만, 대개 자동으로 이루어집니다.

<a id="license"></a>

## 라이선스

MIT License - 자세한 내용은 LICENSE 파일을 참조하세요

<a id="visual-companion-telemetry"></a>

## 시각적 동반 기능 원격 분석

스킬과 플러그인은 제작자에게 어떤 피드백도 제공하지 않으므로, 여러분 중 얼마나 많은 사람이 Superpowers를 사용하는지 알 방법이 없습니다. 기본적으로 brainstorming의 선택적 시각적 동반 기능에 있는 Prime Radiant 로고는 당사 웹사이트에서 로드됩니다. 여기에는 사용 중인 Superpowers 버전이 포함됩니다. 프로젝트, 프롬프트 또는 코딩 에이전트에 대한 세부 정보는 포함하지 않습니다. 클릭이나 여러분이 무엇을 만들고 있는지에 대한 정보도 보지 않습니다. 이는 얼마나 많은 사람이 Superpowers를 사용하고 있는지와 어떤 버전의 Superpowers를 사용하는지 대략적으로 파악하는 데 도움이 됩니다. 이는 100% 선택 사항입니다. 비활성화하려면 환경 변수 `SUPERPOWERS_DISABLE_TELEMETRY`를 임의의 true 값으로 설정하세요. Superpowers는 Claude Code의 `DISABLE_TELEMETRY` 및 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` 옵트아웃도 준수합니다.
