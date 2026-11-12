> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 원칙 이름으로 방향 잡기

pstack은 24가지 원칙을 개별 스킬로 제공합니다. `/poteto-mode`는 모든 다단계 작업을 시작할 때 원칙 색인을 읽고, 작업이 촉발하는 원칙을 적용하며, 응답에서 적용한 각 원칙과 그 원칙으로 달라진 결정을 밝힙니다.

원칙을 직접 호출하는 것이 아닙니다. 원칙의 이름을 사용해 방향을 잡습니다. 각 이름은 에이전트가 이미 읽은 완전한 규칙을 가리키므로, 한 구절만으로도 지침 한 문단보다 더 정확하게 작업의 방향을 바꿀 수 있습니다.

## 실제로 방향 잡기

에이전트가 기존 어댑터 세 개에 새 어댑터 하나를 덧붙이려 한다고 가정해 봅시다.

```text
use subtract before you add. delete the obsolete adapters first, then design what's left.
```

빌드가 통과했다는 이유로 성공을 주장한다고 가정해 봅시다.

```text
apply prove it works. run the real import flow and show me the written records.
```

병렬 시도 두 개가 같은 브랜치에 쓰려고 한다고 가정해 봅시다.

```text
separate before serializing shared state. give each attempt its own worktree, no locks.
```

각 구절이 효과를 내는 이유는 그 이면의 규칙이 구체적이기 때문입니다. 에이전트는 여전히 응답에서 그 규칙으로 어떤 결정이 달라졌는지 밝혀야 합니다. 결정이 뒤따르지 않는 원칙 인용은 에이전트가 규칙을 적용하지 않고 이름만 언급했다는 뜻입니다.

## 24가지 원칙 요약

핵심 원칙은 얼마나 구현할지, 언제 설계를 다시 생각할지를 결정합니다.

- [최소 노력 원칙](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-laziness-protocol/SKILL.md)은 삭제와 문제를 해결하는 가장 작은 변경을 우선합니다.
- [기초부터 사고하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-foundational-thinking/SKILL.md)은 로직을 작성하기 전에 핵심 데이터 구조를 선택합니다.
- [근본 원칙에서 재설계하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-redesign-from-first-principles/SKILL.md)은 새로운 요구 사항이 처음부터 있었던 것처럼 통합합니다.
- [전제 검증하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-attack-the-premise/SKILL.md)은 두 번 이상 실패한 수정이 공유한 전제를 적고, 다음 수정 전에 그 전제를 직접 검증합니다.
- [추가 전에 제거하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-subtract-before-you-add/SKILL.md)는 그 위에 무언가를 만들기 전에 불필요한 요소를 제거합니다.
- [독자의 부담 줄이기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-minimize-reader-load/SKILL.md)는 독자가 머릿속에 담아야 하는 계층과 숨은 상태를 줄입니다.
- [결과 중심 실행](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-outcome-oriented-execution/SKILL.md)은 버려질 호환성 상태를 보존하는 대신 재작성을 목표 설계로 수렴시킵니다.
- [경험 우선](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-experience-first/SKILL.md)는 구현 편의보다 사용자가 얻는 결과를 선택합니다.
- [설계 공간 탐색하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-exhaust-the-design-space/SKILL.md)는 전례가 없을 때 서로 경쟁하는 프로토타입 두세 개를 만듭니다.
- [지렛대 만들기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-build-the-lever/SKILL.md)는 검토자가 다시 실행할 수 있도록 작업을 수행하거나 입증하는 스크립트를 만듭니다. 에이전트가 같은 일을 계속 수작업으로 한다면, 자신에게 필요했던 도구나 스킬을 작성하게 하십시오. 스크립트가 어떤 단계를 매번 같은 방식으로 수행할 수 있다면 스크립트를 사용하고, 판단이 필요한 일에 에이전트를 투입하십시오.

아키텍처 원칙은 상태, 검증, 호환성을 어디에 둘지 결정합니다.

- [도메인 모델링하기](../../skills/principle-model-the-domain/SKILL.md)은 반복되는 규칙을 흩어진 조건문이 아니라 하나의 구조에 인코딩합니다.
- [경계 규율](../../skills/principle-boundary-discipline/SKILL.md)은 경계에서 검증하고 내부 타입을 신뢰합니다.
- [타입 시스템 규율](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-type-system-discipline/SKILL.md)은 잘못된 상태를 표현할 수 없게 만듭니다.
- [연산을 멱등하게 만들기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-make-operations-idempotent/SKILL.md)는 재시도가 동일한 최종 상태로 수렴하게 합니다.
- [호출자를 옮긴 뒤 기존 API 삭제하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md)는 한 번에 호출자를 마이그레이션하고 레거시 API를 삭제합니다.
- [공유 상태를 직렬화하기 전에 분리하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-separate-before-serializing-shared-state/SKILL.md)는 조정을 추가하기 전에 공유 자체를 제거합니다.

검증 원칙은 무엇을 증거로 인정할지 정의합니다.

- [동작 증명하기](../../skills/principle-prove-it-works/SKILL.md)는 대리물이 아니라 실제 산출물을 검증합니다.
- [근본 원인 수정하기](../../skills/principle-fix-root-causes/SKILL.md)는 코드를 변경하기 전에 문제를 재현하고 원인까지 추적합니다.
- [작업을 검증 가능한 단위로 배열하기](../../skills/principle-sequence-verifiable-units/SKILL.md)는 다음 작은 단위를 시작하기 전에 각 단위를 검사로 마무리합니다.
- [구현 대신 동작 테스트하기](../../skills/principle-test-behavior-not-implementation/SKILL.md)은 코드 사용자가 관찰할 수 있는 것을 단언하여, 그 동작이 깨지면 테스트가 실패하고 내부 구현이 바뀌어도 테스트가 유지되게 합니다.
- [수치 설명하기](../../skills/principle-explain-the-number/SKILL.md)는 측정값을 신뢰하거나 보고하기 전에 그 값을 제한하는 요소를 밝히고 다른 것을 측정한 것이 아님을 확인합니다. [`/benchmark-checklist`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/benchmark-checklist/SKILL.md)는 이를 실제 실행 결과로 답하는 일곱 가지 질문으로 바꿉니다.

위임 원칙은 병렬 작업을 건전하게 유지합니다.

- [컨텍스트 창 보호하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-guard-the-context-window/SKILL.md)는 대량 읽기를 하위 에이전트에게 보내고 발견 사항은 주 대화에 유지합니다.
- [사람을 기다리며 멈추지 않기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-never-block-on-the-human/SKILL.md)은 되돌릴 수 있는 작업을 진행하고 결과를 제시합니다.

그리고 메타 원칙 하나가 있습니다.

- [교훈을 구조로 표현하기](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-encode-lessons-in-structure/SKILL.md)는 두 번 반복한 조언을 린트, 검사 또는 스크립트로 바꿉니다. [`/correct`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/correct/SKILL.md)는 [내 것으로 만들기](./09-make-it-yours.md#correct로-환경-수정하기)에 나온 것처럼 이 원칙을 저장소 전체에 적용합니다.

목록을 외우지 마십시오. 지금 한 번 훑어본 다음, 여기 있는 이름 하나로 막을 수 있었던 행동을 에이전트가 하는 것을 발견하면 다시 돌아오십시오. 그렇게 해야 이 어휘가 익숙해집니다.

다음: [내 것으로 만들기](./09-make-it-yours.md).
