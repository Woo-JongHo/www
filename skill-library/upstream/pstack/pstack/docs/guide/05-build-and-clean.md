> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 변경을 빌드하고 diff를 정리하세요

빌드 플레이북은 하나의 규율을 공유합니다. 관찰한 내용을 말하고, 플레이북이 증거를 요구하게 하세요. 이 페이지에서는 일반적인 각 빌드 작업의 프롬프트에 무엇을 넣을지와 diff를 검토 가능한 상태로 유지하는 정리 습관을 설명합니다.

## 알고 있는 내용으로 각 빌드 플레이북의 프롬프트를 작성하세요

버그 프롬프트는 증상을 밝히고 먼저 재현할 것을 요청합니다.

```text
/poteto-mode this command emits two records after a retry. repro first, then fix and verify.
```

기능 프롬프트는 동작과 변경되면 안 되는 것을 밝힙니다.

```text
/poteto-mode add a --json flag. text output stays byte-identical. verify both forms.
```

리팩터링 프롬프트는 구조를 옮기기 전에 동작을 고정합니다.

```text
/poteto-mode move parsing into one module, zero behavior change. record the current output first and prove it's unchanged after.
```

성능 프롬프트는 인상이 아니라 측정값을 밝힙니다.

```text
/poteto-mode startup takes 1.8s on this fixture. trace it, fix the measured cause, show me before and after.
```

각 프롬프트는 해당 플레이북([Bug fix](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/bug-fix.md), [Feature](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/feature.md), [Refactoring](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/refactoring.md), [Perf issue](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/perf-issue.md))으로 라우팅되며, 플레이북은 여러분이 입력하지 않은 단계를 제공합니다. 수정 전에 재현하고, 구현 전에 데이터 형태를 명시하고, 구조를 바꾸기 전에 동작을 고정하며, 최적화 전에 프로파일링합니다.

한 수치를 지속적으로 개선하려면 [Hillclimb 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/hillclimb.md)이 있습니다. 지표, 목표, 최소 시도 횟수를 제공하면 고정된 측정 하네스로 한 번에 하나의 가설을 반복합니다. 개선된 결과는 유지하고 나머지는 모두 되돌립니다.

두 성능 플레이북 모두 수치에 [`/benchmark-checklist`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/benchmark-checklist/SKILL.md)를 실행합니다. Perf issue는 기준값과 이후의 모든 수치를 검증하고, Hillclimb는 하네스를 고정하기 전에 검증합니다. 언제 직접 입력해야 하는지는 [검증하고 출시하기](./06-verify-and-ship.md#benchmark-checklist로-측정값-검토하기)에서 설명합니다.

때로는 수정보다 원인을 먼저 알고 싶을 수 있습니다. 누수, 유휴 CPU 스핀 또는 시각적 결함 같은 실시간 증상에는 [Runtime forensics 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/runtime-forensics.md)이 실행 중인 프로세스에 계측을 추가합니다. 이미 캡처한 프로파일에는 [Trace forensics 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/trace-forensics.md)이 아티팩트를 읽고 병목 프레임을 소스에 연결합니다. 둘 다 수정이 아니라 진단을 반환합니다.

```text
/poteto-mode here's a cpuprofile from the slow startup. tell me where the time goes and which source lines own it. no fix yet.
```

## `/tdd`로 실패하는 테스트를 먼저 작성하세요

버그에 비용이 적게 드는 로컬 테스트 경로가 있다면 전체 프롬프트는 두 단어면 됩니다.

```text
/tdd implement
```

맥락 안에서는 이것으로 충분합니다. [`/tdd`](../../skills/tdd/SKILL.md)는 의도한 이유로 실패하는 가장 작은 테스트를 작성한 다음 수정하고, 테스트를 다시 실행합니다. 테스트에 광범위한 하네스 설정이나 취약한 모의 객체가 필요하다면 스킬은 이를 밝히고 대신 가장 가까운 실행 가능한 검사를 사용합니다. 실제 명령이 더 강한 증거라면 테스트를 억지로 만들지 마세요.

## TypeScript 규칙을 이름으로 불러오세요

[`typescript-best-practices`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/typescript-best-practices/SKILL.md)는 타입 시스템 원칙을 판별 유니온, 경계에서의 `unknown`, 완전한 변형 처리, 스키마에서 도출한 타입 같은 구체적인 규칙으로 바꿉니다. 자동으로 불러와지지 않으므로 작업이 `.ts` 또는 `.tsx` 파일을 건드릴 때 `/typescript-best-practices`를 입력하세요.

## 커밋하기 전에 정리하세요

[PR 열기 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/opening-a-pr.md)은 각 커밋 전에 diff에 `/deslop`을 실행하고, PR 설명과 커밋 본문에 [`/unslop`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/unslop/SKILL.md)을 적용합니다. `/deslop`은 pstack이 아니라 `cursor-team-kit` 플러그인에 포함되어 있습니다. 이 플러그인이 없다면 같은 결과를 평이한 말로 요청하세요. 서술형 주석, 근거 없는 가드, 죽은 호환성 경로, 관련 없는 수정을 제거하라고 하세요.

산문에는 `/unslop`에 대상과 추가 규칙을 전달하세요.

```text
/unslop the readme changes, no emdashes
```

여러분만의 축약 표현을 익히게 될 것입니다. 이 스킬은 `unslop that, tighten it`처럼 짧은 프롬프트에서도 의도를 잘 파악합니다.

## `/no-comments`로 주석을 제거하세요

주석에는 별도 검토가 필요하며, 주석을 작성한 에이전트가 검토해서는 안 됩니다. 작성자는 여러분이 자신의 주석을 옹호하듯 자신의 주석을 옹호합니다. 따라서 검토 전에 새로운 시각에 맡기세요.

```text
/no-comments the diff
```

[`/no-comments`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/no-comments/SKILL.md)는 짧은 유지 목록을 가진 읽기 전용 검토자 [Comment Sicko](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/agents/comment-sicko.md)를 생성합니다. 유지 목록은 라이선스 헤더, 공개 API의 문서 주석, 코드가 설명할 수 없는 내용을 설명하는 링크, 재구성할 수 없는 외부 의존성이 강제하는 동작입니다. 나머지는 모두 제거 대상입니다. 자체 코드의 놀라운 동작에는 그런 예외가 없습니다. 해당 주석은 리팩터링 신호로 돌아오며, `/no-comments`는 받아들인 신호를 근본 원인에서 수정합니다. 주석이 "do not remove"라는 제약을 주장하면 스킬은 그 주장을 타입, 테스트 또는 린트로 인코딩하겠다고 제안합니다. 어느 쪽이든 주석은 제거됩니다.

역할 분담은 명확히 기억할 가치가 있습니다. `/deslop`은 코드에서 군더더기를 정리하고, `/unslop`은 산문에서 정리하며, `/no-comments`는 주석을 작성하지 않은 검토자에게 주석을 맡깁니다.

**함정:** 정리는 선택적인 다듬기가 아닙니다. 서술형 주석과 방어적인 불필요 코드가 있는 diff는 검토자에게 미완성으로 보이며, 추가된 코드에는 다음 버그가 숨어 있습니다. diff가 부풀려진 느낌이라면 검토에서 지적한 뒤가 아니라 커밋 전에 `deslop it`이라고 말하세요.

다음: [검증하고 출시하기](./06-verify-and-ship.md).
