> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# pstack 설정하기

이 페이지에서는 플러그인을 설치하고, pstack이 사용할 모델을 선택한 다음 첫 작업을 실행합니다. 설정에는 명령 하나와 짧은 대화만 필요합니다.

## 플러그인 설치

Cursor 채팅에서 다음을 실행합니다.

```text
/add-plugin pstack
```

Cursor가 플러그인 설치를 확인합니다.

Claude Code에서는 `/plugin marketplace add cursor/plugins`를 실행한 다음 `/plugin install pstack@cursor-plugins`를 실행합니다. Claude Code는 플러그인 명령 앞에 접두사를 붙이므로 이 가이드의 각 명령에는 `/pstack:setup-pstack`처럼 `pstack:` 접두사가 붙습니다. 이 명령은 모델 규칙을 `~/.claude/rules/pstack-models.md`에 작성합니다. 그 밖의 차이점은 [Claude Code 어댑터](../harness/claude-code.md)에서 다룹니다.

## 모델 선택

다음을 실행합니다.

```text
/setup-pstack
```

[`/setup-pstack`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/setup-pstack/SKILL.md)은 접근 가능한 모델을 감지하고, 추론 예산을 묻고, 각 역할(코드 위임자, 판단, 검토 패널)을 보여 준 다음 원하는 구성을 묻습니다. 질문에 답하세요. 이 명령은 모든 pstack 스킬이 읽는 작은 규칙인 `~/.cursor/rules/pstack-models.mdc`를 작성합니다.

기본값은 `large` 예산과 같은 `xhigh` 추론으로 실행됩니다. `unlimited`는 각 모델을 최고 티어, 최대 `max`까지 올립니다. Opus는 `max`로 올라갑니다. Grok의 상한은 `xhigh`이므로 그대로 유지됩니다. `medium`과 `small`은 추론 수준을 낮추고 토큰을 더 적게 사용합니다.

중요한 항목만 재정의하면 됩니다. 규칙에 줄이 없는 역할은 스킬의 기본값을 유지합니다. 기본값을 복원하려면 해당 역할의 줄을 삭제하세요. `/setup-pstack`을 다시 실행하면 모델이 기본값과 다른 역할은 모두 유지됩니다. 기본값이 바뀌어도 변경 전에 작성된 규칙은 여전히 이전 기본값을 고정하므로, 해당 역할 줄이나 파일을 삭제한 다음 `/setup-pstack`을 다시 실행하세요.

Auto를 사용하면 어떻게 되는지 궁금할 수 있습니다. 역할을 `inherit-parent` 또는 `auto`로 설정하면 pstack은 하위 에이전트의 `model` 필드를 생략하므로 하위 에이전트가 상위 채팅 모델을 상속합니다. 두 값은 같은 뜻이며 어느 쪽도 모델 슬러그가 아닙니다. 패널 역할의 값은 목록이고 항목마다 하위 에이전트 하나가 실행되므로 목록 길이가 패널 크기를 결정합니다. 설정은 각 실행 경로가 모델을 지정하지 않는 한 모든 `/swarm` 작업자가 기본으로 사용할 모델인 `swarm workers`도 구성합니다.

## 검증 제안을 수락하거나 거절하기

설정이 끝날 때 `/setup-pstack`은 프로젝트에서 앱 동작을 입증할 방법, 즉 `verify-*` 스킬이나 기존 하네스를 찾습니다. 둘 다 없으면 [`/create-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-verification-skill/SKILL.md)로 하나를 생성하겠다고 한 번 제안합니다.

수락하면 에이전트에게 사용자가 앱을 다루는 방식대로 앱을 조작하는 법을 가르치는 프로젝트 로컬 스킬인 `.cursor/skills/verify-<app>/`을 작성합니다. 넘겨주기 전에 스킬이 작동함을 한 번 입증합니다. 거절하면 설정을 계속합니다. 언제든 직접 `/create-verification-skill`을 실행할 수 있습니다. [검증하고 출시하기](./06-verify-and-ship.md#프로젝트-검증-스킬-만들기)에서 자세히 다룹니다.

pstack을 처음 사용한다면 수락하세요. 자신의 작업을 확인할 수 있는 에이전트는 검사가 통과할 때까지 계속합니다. 확인할 수 없는 에이전트는 모든 결과를 직접 검사해 달라고 되돌려 줍니다. 이 가이드의 모든 내용 가운데 검증 스킬이 가장 큰 효과를 냅니다.

그런 다음 프로젝트에 아직 없다면 설정은 [`/create-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-formal-verification-skill/SKILL.md)로 형식 검증 스킬을 생성하겠다고 한 번 제안합니다. 테스트는 누군가 작성할 생각을 한 사례를 검사합니다. 형식 검증 스킬은 명시된 범위 안의 모든 사례에서 "작업이 동시에 두 번 실행되지 않는다" 같은 코드의 핵심 속성 하나를 검사합니다. 동시성, 재시도, 상태 머신 또는 파서가 있고 버그 비용이 크며 테스트가 실패 사례에 거의 도달하지 못한다면 수락하세요. 그렇지 않으면 거절하고, 상황이 바뀌면 나중에 실행하세요. [검증하고 출시하기](./06-verify-and-ship.md#정형-검증-스킬로-속성-입증하기)에서 이를 다룹니다.

설정 후 새 채팅을 시작하세요. 모델 규칙은 새 세션에 적용됩니다.

## 비용 관리

pstack은 하위 에이전트와 검토 패널에 추가 토큰을 사용합니다. 이것이 엄격함의 대가입니다. 사용량을 줄이려면 다음과 같이 합니다.

- `/setup-pstack`을 다시 실행하고 더 작은 추론 예산이나 더 저렴한 모델을 선택합니다. 기본 채팅에는 강력한 모델을 쓰고 코드 역할에는 더 저렴하고 빠른 모델을 쓰는 구성이 좋습니다.
- 역할을 `auto` 또는 `inherit-parent`로 설정해 채팅 자체 모델에서 실행되게 합니다.
- 패널 목록을 줄입니다. 항목마다 하위 에이전트 하나가 실행됩니다.
- 엄격함이 필요한 작업에만 `/poteto-mode`를 사용합니다. 작고 명백한 수정에는 필요하지 않습니다.

## 첫 작업 실행

작지만 실제적인 작업을 골라 동료에게 설명하듯 기술합니다.

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

할 일 목록을 지켜보세요. 첫 항목들은 일치한 플레이북의 단계를 그대로 복사한 것이며, 이 프롬프트에서는 Feature 플레이북입니다. `/poteto-mode`가 단계를 건너뛰면 해당 단계는 `skip: <reason>`과 함께 목록에 남으므로 무엇을 하지 않기로 선택했는지 볼 수 있습니다.

여기서부터 일반적인 후속 메시지를 입력할 수 있습니다. 채팅 전체에서 `/poteto-mode`를 계속 켜 두려면 `/` 메뉴에서 선택하고 Enter 대신 Option+Enter(Mac) 또는 Alt+Enter(Windows)를 누릅니다. 그러면 종료할 때까지 매 턴 컨텍스트에 유지되는 [Custom Mode](https://cursor.com/docs/skills#using-a-skill-as-a-custom-mode)가 됩니다. Custom Modes는 Agents Window와 CLI에서 사용할 수 있습니다. 일반 Enter는 스킬을 메시지 하나에만 첨부하며 채팅이 진행되면 영향이 사라집니다.

다음: [`/poteto-mode`를 통해 작업 라우팅하기](./02-poteto-mode.md).
