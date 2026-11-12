> 한국어 번역본: 고정 커밋 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<p>
  <a href="https://www.aihero.dev/s/skills-newsletter">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skills-repo-dark_2x.png">
      <source media="(prefers-color-scheme: light)" srcset="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skill-repo-light_2x.png">
      <img alt="스킬" src="https://res.cloudinary.com/total-typescript/image/upload/v1777382277/skill-repo-light_2x.png" width="369">
    </picture>
  </a>
</p>

# 진짜 엔지니어를 위한 스킬

[![skills.sh](https://skills.sh/b/mattpocock/skills)](https://skills.sh/mattpocock/skills)

바이브 코딩이 아니라 진짜 엔지니어링을 하기 위해 제가 매일 사용하는 에이전트 스킬입니다.

실제 애플리케이션을 개발하는 일은 어렵습니다. GSD, BMAD, Spec-Kit 같은 접근법은 프로세스를 주도하는 방식으로 도움을 주려 합니다. 하지만 그 과정에서 사용자의 통제권을 빼앗고 프로세스의 버그를 해결하기 어렵게 만듭니다.

이 스킬들은 작고, 쉽게 조정할 수 있으며, 조합 가능하도록 설계되었습니다. 어떤 모델에서도 작동합니다. 수십 년의 엔지니어링 경험을 바탕으로 합니다. 마음껏 뜯어고쳐 보세요. 자신만의 것으로 만드세요. 즐기세요.

이 스킬들의 변경 사항과 제가 만드는 새 스킬을 계속 확인하고 싶다면, 제 뉴스레터에서 약 60,000명의 다른 개발자와 함께할 수 있습니다.

[뉴스레터 신청하기](https://www.aihero.dev/s/skills-newsletter)

## 설치(30초 설정)

플러그인은 스스로 업데이트됩니다. [skills.sh](https://skills.sh/mattpocock/skills)는 편집 가능한 파일을 프로젝트에 복사하며, 직접 업데이트해야 합니다. 둘 다 설치하면 모든 스킬이 두 번 생기므로 에이전트마다 하나만 선택하세요.

### 1. 스킬 가져오기

<details>
<summary><strong>Claude Code</strong></summary>

```bash
claude plugin install mattpocock-skills@claude-plugins-official
```

기본적으로 자동 업데이트됩니다.

</details>

<details>
<summary><strong>Codex</strong></summary>

```bash
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock
```

시작할 때 자동 업데이트됩니다.

</details>

<details>
<summary><strong>GitHub Copilot</strong> (CLI 및 VS Code)</summary>

```bash
copilot plugin marketplace add mattpocock/skills
copilot plugin install mattpocock-skills@mattpocock
```

그런 다음 한 번만 `~/.copilot/settings.json`에 추가하세요.

```json
{
  "extraKnownMarketplaces": {
    "mattpocock": { "source": { "source": "github", "repo": "mattpocock/skills" }, "autoUpdate": true }
  }
}
```

VS Code에서 **Chat: Install Plugin From Source**를 실행하고 `https://github.com/mattpocock/skills`를 입력하세요. 매일 업데이트됩니다.

</details>

<details>
<summary><strong>Gemini CLI</strong> (수동 업데이트)</summary>

```bash
gemini skills install https://github.com/mattpocock/skills.git --path skills/engineering
gemini skills install https://github.com/mattpocock/skills.git --path skills/productivity
```

업데이트하려면 두 명령을 다시 실행하세요.

</details>

<details>
<summary><strong>기타 모든 에이전트 또는 편집 가능한 파일</strong> (수동 업데이트)</summary>

```bash
npx skills@latest add mattpocock/skills -a <agent>  # cursor, opencode, devin, windsurf, amp, pi; omit -a to choose
```

설치 프로그램이 가져올 스킬을 물으면 `setup-matt-pocock-skills`를 포함하세요. 업데이트하려면 `npx skills@latest update`를 실행하고, 새 스킬을 가져오려면 `add`를 다시 실행하세요.

</details>

### 2. `/setup-matt-pocock-skills` 실행

에이전트에서 저장소마다 한 번 실행하세요. 다음을 수행합니다.

- 사용할 이슈 트래커를 묻습니다(GitHub, GitLab, 로컬 파일 또는 사용자가 설명하는 다른 무엇이든)
- 티켓을 트리아지할 때 적용할 레이블을 묻습니다(`/triage`가 레이블을 사용함)
- 생성하는 문서를 어디에 저장할지 묻습니다

### 3. 짠, 준비가 끝났습니다.

## 이 스킬들이 존재하는 이유

Claude Code, Codex 및 다른 코딩 에이전트에서 흔히 보이는 실패 양상을 해결하기 위해 이 스킬들을 만들었습니다.

### #1: 에이전트가 내가 원하는 일을 하지 않았다

> "자신이 정확히 무엇을 원하는지 아는 사람은 없다"
>
> David Thomas & Andrew Hunt, [The Pragmatic Programmer](https://www.amazon.co.uk/Pragmatic-Programmer-Anniversary-Journey-Mastery/dp/B0833F1T3V)

**문제**. 소프트웨어 개발에서 가장 흔한 실패 양상은 불일치입니다. 개발자가 자신이 원하는 바를 안다고 생각합니다. 그러다 개발자가 만든 것을 보고 나서야 개발자가 자신을 전혀 이해하지 못했다는 사실을 깨닫습니다.

AI 시대에도 똑같습니다. 사용자와 에이전트 사이에는 의사소통의 간극이 있습니다. 해결책은 **집중 문답 세션**입니다. 에이전트가 만들려는 것에 관해 상세한 질문을 던지게 하는 것입니다.

**해결책**은 다음을 사용하는 것입니다.

- [`/grill-me`](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grill-me/SKILL.md) - 코드 이외의 용도
- [`/grill-with-docs`](./skills/engineering/grill-with-docs/SKILL.md) - [`/grill-me`](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grill-me/SKILL.md)와 같지만 더 많은 유용한 기능을 추가함(아래 참조)

이것들은 제 스킬 중 가장 인기가 많습니다. 작업을 시작하기 전에 사용자와 에이전트의 이해를 맞추고, 만들려는 변경을 깊이 생각하도록 돕습니다. 변경하려 할 때마다 _항상_ 사용하세요.

### #2: 에이전트가 지나치게 장황하다

> 보편 언어가 있으면 개발자 간의 대화와 코드 표현은 모두 동일한 도메인 모델에서 파생된다.
>
> Eric Evans, [Domain-Driven-Design](https://www.amazon.co.uk/Domain-Driven-Design-Tackling-Complexity-Software/dp/0321125215)

**문제**: 프로젝트 초기에 개발자와 소프트웨어를 의뢰한 사람들(도메인 전문가)은 대개 서로 다른 언어를 사용합니다.

제 에이전트에서도 같은 긴장을 느꼈습니다. 에이전트는 보통 프로젝트에 갑자기 투입되어 진행하면서 전문 용어를 파악하라는 요청을 받습니다. 그래서 한 단어면 될 곳에 스무 단어를 씁니다.

**해결책**은 공유 언어입니다. 에이전트가 프로젝트에서 쓰는 전문 용어를 해독하도록 돕는 문서입니다.

<details>
<summary>
예시
</summary>

제 `course-video-manager` 저장소의 [용어집](https://github.com/mattpocock/course-video-manager/blob/076a5a7a182db0fe1e62971dd7a68bcadf010f1c/CONTEXT.md) 예시입니다(스킬이 관례의 이름을 바꾸기 전이라 해당 고정 커밋에서는 여전히 `CONTEXT.md`라는 이름임). 어느 쪽이 읽기 더 쉽나요?

- **이전**: "강좌 섹션 안의 수업을 '실체화'할 때(즉, 파일 시스템에 위치를 부여할 때) 문제가 있습니다"
- **이후**: "실체화 연쇄에 문제가 있습니다"

이런 간결함은 세션마다 계속 이득을 줍니다.

</details>

이 기능은 [`/grill-with-docs`](./skills/engineering/grill-with-docs/SKILL.md)에 내장되어 있습니다. 집중 문답 세션이지만, AI와 공유 언어를 만들고 설명하기 어려운 결정을 ADR에 문서화하도록 돕기도 합니다.

이것이 얼마나 강력한지는 설명하기 어렵습니다. 이 저장소에서 단 하나의 가장 멋진 기법일지도 모릅니다. 직접 시도하고 확인해 보세요.

> [!TIP]
> 공유 언어에는 장황함을 줄이는 것 외에도 많은 이점이 있습니다.
>
> - 공유 언어를 사용하므로 **변수, 함수, 파일의 이름이 일관됩니다**
> - 그 결과 에이전트가 **코드베이스를 더 쉽게 탐색할 수 있습니다**
> - 더 간결한 언어를 사용할 수 있으므로 에이전트가 **사고에 쓰는 토큰도 줄어듭니다**

### #3: 코드가 작동하지 않는다

> "항상 작고 신중한 단계를 밟아라. 피드백 속도가 곧 속도 제한이다. 너무 큰 작업은 절대 맡지 마라."
>
> David Thomas & Andrew Hunt, [The Pragmatic Programmer](https://www.amazon.co.uk/Pragmatic-Programmer-Anniversary-Journey-Mastery/dp/B0833F1T3V)

**문제**: 사용자와 에이전트가 무엇을 만들지 뜻을 맞췄다고 해봅시다. 그런데도 에이전트가 여전히 형편없는 결과물을 내놓으면 어떻게 해야 할까요?

피드백 루프를 살펴볼 때입니다. 자신이 만든 코드가 실제로 어떻게 실행되는지에 대한 피드백이 없으면 에이전트는 앞을 보지 못한 채 움직이게 됩니다.

**해결책**: 정적 타입, 브라우저 접근, 자동화된 테스트라는 일반적인 피드백 루프 묶음이 필요합니다.

자동화된 테스트에는 레드-그린-리팩터 루프가 매우 중요합니다. 에이전트가 먼저 실패하는 테스트를 작성한 다음 테스트가 통과하도록 수정하는 방식입니다. 이를 통해 에이전트에 일관된 수준의 피드백을 제공하여 훨씬 더 나은 코드를 만들게 합니다.

어떤 프로젝트에도 끼워 넣을 수 있는 **[`/tdd`](./skills/engineering/tdd/SKILL.md) 스킬**을 만들었습니다. 레드-그린-리팩터를 장려하며 좋은 테스트와 나쁜 테스트를 가르는 기준을 에이전트에 충분히 안내합니다.

디버깅을 위해 최고의 디버깅 실천법을 단계별로 통제되는 규율 있는 루프로 감싼 **[`/diagnosing-bugs`](./skills/engineering/diagnosing-bugs/SKILL.md)** 스킬도 만들었습니다.

### #4: 진흙 덩어리를 만들었다

> "시스템 설계에 _매일_ 투자하라."
>
> Kent Beck, [Extreme Programming Explained](https://www.amazon.co.uk/Extreme-Programming-Explained-Embrace-Change/dp/0321278658)

> "최고의 모듈은 깊다. 단순한 인터페이스를 통해 많은 기능에 접근할 수 있게 한다."
>
> John Ousterhout, [A Philosophy Of Software Design](https://www.amazon.co.uk/Philosophy-Software-Design-2nd/dp/173210221X)

**문제**: 에이전트로 만든 앱 대부분은 복잡하고 변경하기 어렵습니다. 에이전트는 코딩 속도를 급격하게 높일 수 있기 때문에 소프트웨어 엔트로피도 가속합니다. 코드베이스는 전례 없는 속도로 더 복잡해집니다.

**해결책**은 AI 기반 개발에 대한 급진적인 새 접근법, 즉 코드 설계를 중요하게 여기는 것입니다.

이는 다음처럼 이 스킬들의 모든 계층에 내장되어 있습니다.

- [`/to-spec`](./skills/engineering/to-spec/SKILL.md)은 명세를 만들기 전에 건드릴 모듈이 무엇인지 질문합니다

그리고 결정적으로 [`/improve-codebase-architecture`](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/improve-codebase-architecture/SKILL.md)는 코드베이스에서 심화할 기회를 조사하고 후보를 건네줍니다. 며칠에 한 번씩 코드베이스에서 실행하기를 권합니다. 이것은 조사이지 구출 작업이 아닙니다. 정말 오래된 코드베이스에서는 실제 후보를 찾겠지만, 얽힌 진흙 덩어리를 대신 풀어주지는 않습니다.

### 요약

소프트웨어 엔지니어링의 기본기는 그 어느 때보다 중요합니다. 이 스킬들은 이러한 기본기를 반복 가능한 실천법으로 압축하여 여러분이 커리어 최고의 앱을 출시하도록 돕기 위한 제 최선의 노력입니다. 즐기세요.

## 참고 자료

이 스킬들은 누가 호출할 수 있는가라는 한 축으로 나뉩니다. **사용자 호출** 스킬은 사용자가 직접 입력할 때만(예: `/grill-me`) 접근할 수 있으며, 오케스트레이션하는 것이 역할입니다. **모델 호출** 스킬은 사용자가 호출할 수도 있고 작업에 맞을 때 에이전트가 자동으로 선택할 수도 있으며, 재사용 가능한 규율을 담습니다. 사용자 호출 스킬은 모델 호출 스킬을 호출할 수 있지만 다른 사용자 호출 스킬은 절대 호출할 수 없습니다.

### 엔지니어링

코드 작업에 매일 사용하는 스킬입니다.

**사용자 호출**

- **[ask-matt](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/ask-matt/SKILL.md)**: 상황에 어떤 스킬이나 흐름이 맞는지 묻습니다. 이 저장소의 사용자 호출 스킬을 연결하는 라우터입니다.
- **[grill-with-docs](./skills/engineering/grill-with-docs/SKILL.md)**: 프로젝트의 도메인 모델도 구축하면서 용어를 다듬고 `GLOSSARY.md`와 ADR을 그 자리에서 업데이트하는 집중 문답 세션입니다.
- **[triage](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/triage/SKILL.md)**: 트리아지 역할의 상태 머신을 따라 이슈를 이동합니다.
- **[improve-codebase-architecture](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/improve-codebase-architecture/SKILL.md)**: 코드베이스에서 심화 기회를 훑고 시각적 HTML 보고서로 제시한 다음, 선택한 후보를 집중 문답으로 검토합니다.
- **[setup-matt-pocock-skills](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/setup-matt-pocock-skills/SKILL.md)**: 이 저장소에서 엔지니어링 스킬을 설정합니다(이슈 트래커, 트리아지 레이블, 도메인 문서 배치). 다른 엔지니어링 스킬을 사용하기 전에 저장소마다 한 번 실행하세요.
- **[to-spec](./skills/engineering/to-spec/SKILL.md)**: 현재 대화를 명세로 만들고 이슈 트래커에 게시합니다. 인터뷰 없이 이미 논의한 내용을 종합하기만 합니다.
- **[to-tickets](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/to-tickets/SKILL.md)**: 계획, 명세 또는 대화를 트레이서 불릿 티켓 모음으로 나눕니다. 각 티켓은 차단 관계를 명시하며 로컬 파일에 텍스트로 작성되거나 실제 트래커에 네이티브 차단 링크로 작성됩니다.
- **[implement](./skills/engineering/implement/SKILL.md)**: 명세나 티켓 모음에 기술된 작업을 구현하며, 사전 합의한 심에서 `/tdd`를 진행하고 커밋 전에 `/code-review`로 마무리합니다.
- **[implement-spec](./skills/engineering/implement-spec/SKILL.md)**: 하나의 통합 브랜치에서 명세 전체를 구현합니다. 티켓을 작업 그래프로 처리하며 착수 가능한 티켓 전체에 걸쳐 구현 하위 에이전트를 실행해 동시성을 극대화한 다음 `/code-review`로 마무리합니다.
- **[wayfinder](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/wayfinder/SKILL.md)**: 에이전트 세션 하나에 담을 수 없는 거대한 작업을 이슈 트래커의 공유 결정 티켓 지도로 계획하고 목적지까지 가는 길이 분명해질 때까지 하나씩 해결합니다.
- **[retro](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/retro/SKILL.md)**: 세션 후 코딩 에이전트 환경(탐색, 자동 검사, 코딩 표준, 지침 파일, 도구)의 개선 사항을 심각도순으로 제안합니다.

**모델 호출**

- **[prototype](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/prototype/SKILL.md)**: 설계 질문에 답하기 위한 폐기용 프로토타입을 만듭니다. 상태/로직 질문에는 공유 가능한 단일 HTML 파일을 만들고, UI 질문에는 한 라우트에서 전환할 수 있는 서로 크게 다른 여러 변형을 만듭니다.
- **[diagnosing-bugs](./skills/engineering/diagnosing-bugs/SKILL.md)**: 어려운 버그와 성능 회귀를 위한 규율 있는 진단 루프입니다. 이 버그에서 빨간불이 켜지는 피드백 루프 구축 → 최소화 → 가설 수립 → 계측 → 수정 → 회귀 테스트 순으로 진행합니다.
- **[research](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/research/SKILL.md)**: 신뢰도 높은 1차 출처를 바탕으로 질문을 조사하고, 인용을 포함한 Markdown 파일로 결과를 저장소에 남기며 백그라운드 에이전트로 실행합니다.
- **[tdd](./skills/engineering/tdd/SKILL.md)**: 레드-그린-리팩터 루프를 따르는 테스트 주도 개발입니다. 기능을 구축하거나 버그를 한 번에 하나의 수직 슬라이스로 수정합니다.
- **[domain-modeling](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/domain-modeling/SKILL.md)**: 프로젝트의 도메인 모델을 능동적으로 구축하고 다듬습니다. 용어집을 기준으로 용어를 검토하고, 극단 사례 시나리오로 스트레스 테스트하며, `GLOSSARY.md`와 ADR을 그 자리에서 업데이트합니다.
- **[codebase-design](./skills/engineering/codebase-design/SKILL.md)**: 깊은 모듈을 설계하기 위한 공유 규율과 어휘입니다. 작은 인터페이스 뒤에 많은 동작을 두고, 깔끔한 심에 배치하며, 해당 인터페이스를 통해 테스트할 수 있게 합니다.
- **[code-review](./skills/engineering/code-review/SKILL.md)**: 고정 지점 이후의 diff를 두 축으로 검토합니다. **표준**(저장소의 코딩 표준과 Fowler의 코드 냄새 기준선을 따르는가?)과 **명세**(원래 이슈/명세를 충실하게 구현하는가?)를 병렬 하위 에이전트로 실행하여 서로의 맥락을 오염시키지 않게 합니다.
- **[pr](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/pr/SKILL.md)**: 풀 리퀘스트 본문의 형식입니다. 변경을 명확히 보여주는 가장 작은 시각 자료로 된 요약, 작동한다는 전후 증거, 병합 위험 판단(단방향 또는 양방향 문인지와 영향 범위)을 담습니다.
- **[wizard](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/engineering/wizard/SKILL.md)**: 사람이 직접 해야만 하는 단계를 안내하는 대화형 bash 마법사를 생성합니다. 인프라 프로비저닝, 자격 증명 또는 CI 비밀 설정, 익숙하지 않은 서드파티 대시보드 안내, 일회성 마이그레이션이나 전환 실행에 사용합니다.

### 생산성

코드에 한정되지 않는 일반 워크플로 도구입니다.

**사용자 호출**

- **[grill-me](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/grill-me/SKILL.md)**: 설계 트리의 모든 분기가 해소될 때까지 계획이나 설계에 관해 집요하게 인터뷰받습니다.
- **[handoff](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/handoff/SKILL.md)**: 다른 에이전트가 작업을 계속할 수 있도록 현재 대화를 인계 문서로 압축합니다.
- **[teach](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/teach/SKILL.md)**: 현재 디렉터리를 상태를 유지하는 학습 작업 공간으로 사용하여 여러 세션에 걸쳐 사용자에게 새로운 기술이나 개념을 가르칩니다.
- **[to-questionnaire](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/to-questionnaire/SKILL.md)**: 혼자 답할 수 없는 결정을 답할 수 있는 한 사람을 위한 Markdown 설문지로 만듭니다. 비동기로 작성하거나 회의에서 함께 작성합니다. 주제가 아니라 발송 대상과 회신받아야 할 내용 등 전달 방식에 관해 집중적으로 묻습니다.
- **[wait-what](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/wait-what/SKILL.md)**: 메시지가 이해되지 않는 순간 바로 실행합니다. 에이전트가 `GLOSSARY.md`의 어휘를 사용해 빠진 맥락을 보충하고 평이한 영어로 다시 설명합니다.

**모델 호출**

- **[grilling](./skills/productivity/grilling/SKILL.md)**: 설계 트리의 모든 분기가 해소될 때까지 계획, 결정 또는 아이디어에 관해 사용자를 집요하게 인터뷰합니다. `grill-me`, `grill-with-docs`, `triage`, `wayfinder`, `improve-codebase-architecture`의 기반이 되는 재사용 가능한 인터뷰 프리미티브입니다.
- **[writing-for-agents](https://github.com/mattpocock/skills/blob/4ae2317ddb22b046e26455e4f9c9b3aaaf62212d/skills/productivity/writing-for-agents/SKILL.md)**: 에이전트를 위한 문서, 즉 스킬, AGENTS.md/CLAUDE.md와 에이전트가 포인터를 따라 찾아가는 모든 문서를 작성합니다.
