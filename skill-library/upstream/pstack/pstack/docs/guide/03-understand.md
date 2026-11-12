> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 코드를 변경하기 전에 이해하세요

이해하지 못한 코드를 수정하면 미묘한 회귀가 출시되며, 이는 여러분뿐 아니라 에이전트에게도 똑같이 적용됩니다. 에이전트는 보통 두 가지 방식 중 하나로 실패합니다. 여러분이 원하는 것을 잘못 이해하거나, 작업을 제대로 수행하는 데 필요한 맥락이 없습니다. 첫 번째는 [프롬프트에 들어갈 내용](./02-poteto-mode.md#프롬프트에-들어갈-내용)에서 다룹니다. 이 페이지에서는 두 번째를 다룹니다.

pstack은 네 가지 진입 방법을 제공합니다. `/how`는 현재 코드가 무엇을 하는지 설명합니다. `/why`는 코드가 그렇게 구성된 이유를 찾아냅니다. `/teach`는 두 가지를 하나의 설명으로 결합합니다. `/recall`은 특정 주제에 대한 여러분 자신의 최근 맥락을 재구성합니다. 각각은 에이전트가 여러분이 확인할 수 있는 말로 자신을 설명하게도 합니다. 이것이 여러분보다 코드를 더 잘 알 수도 있는 에이전트를 감독하는 방법입니다.

![한 탐정이 돋보기로 기계 청사진을 살펴보는 동안 로봇들이 사건 파일을 가져오고 있으며, 뒤쪽 증거 게시판에는 /how와 /why 아래 단서들이 연결되어 있습니다.](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/docs/guide/images/understanding.jpg?raw=true)

## 읽기 전용 조사로 시작하세요

원인이 불분명할 때는 수정이 아니라 조사 결과를 요청하세요.

```text
/poteto-mode investigate why background jobs time out every few hours. give me what we know, what data you used, and your best hypotheses. don't change any code yet.
```

"don't change any code yet"는 이 요청을 [조사 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/investigation.md)으로 라우팅합니다. 이 플레이북은 `/how`를 실행하고, 동기에 관한 질문에는 `/why`를 추가한 뒤, 출처를 인용한 설명을 반환합니다. 여러 선택지 중 하나를 골라야 할 때는 장단점 표와 함께 권고안을 반환합니다. "what data you used"라고 물으면 에이전트가 증거와 추측을 구분하게 됩니다. 조사 결과가 수정 방향을 가리키면 새 작업으로 수정을 시작하세요.

## `/how`로 동작을 추적하세요

```text
/how do we dedupe notifications? is there an n+1 when we look up subscribers?
```

실제로 궁금한 질문을 하세요. [`/how`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/how/SKILL.md)는 코드를 읽고, 런타임 흐름, 핵심 타입, 명확하지 않은 부분을 포함해 선임 엔지니어가 여러분을 하위 시스템에 온보딩하는 수준으로 답합니다. 큰 하위 시스템이면 먼저 2~4개의 읽기 전용 탐색 작업으로 분산합니다. 좁은 질문이면 코드를 읽고 설명하기만 합니다.

## `/why`로 이력을 찾아내세요

```text
/why was the retry limit set to five? does the reason still hold?
```

[`/why`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/why/SKILL.md)는 소스 제어에서 시작한 다음, 이슈 트래커, 장문 문서, 팀 채팅, 관측 가능성, 오류 추적, 분석 등 MCP가 노출하는 모든 증거 범주를 병렬로 조회합니다. 보고서는 모든 출처를 인용하고, 직접 증거와 추론을 구분하며, 기록이 빈약할 때는 "appears to"라고 말합니다. 결과가 없는 경우도 보고합니다. "왜 그런지 아무도 기록하지 않았다"는 것 자체가 답이기 때문입니다.

두 스킬은 자연스럽게 조합됩니다. 이력이 혼란스러운 구조를 설명해 준다고 의심한다면 `do why first then how`가 좋은 프롬프트입니다.

## `/teach`로 실제로 이해하세요

```text
/teach me how this PR changes retries. convince me it fixes the cause and not the symptom.
```

[`/teach`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/teach/SKILL.md)는 요약만으로 충분하지 않을 때 사용합니다. `/how`와 `/why`를 실행하되, 작은 변경이라면 둘 중 하나만 실행할 수도 있으며, 조사 결과를 다이어그램별로 차근차근 전개되는 평이한 설명으로 엮습니다. "convince me"라는 표현은 재사용할 가치가 있습니다. 설명을 둘러보는 안내가 아니라 여러분이 검증할 수 있는 논증으로 바꿉니다.

에이전트 자신의 선택에도 사용할 수 있습니다.

```text
/teach me why you implemented it this way and not with a queue. what did you trade off, and why?
```

가르치는 것은 여러분만큼 에이전트에게도 도움이 됩니다. 자신의 작업을 설명해야 하는 에이전트는 확신에 차서 말하고 넘어가는 대신, 코드를 읽고 각 주장을 증거로 뒷받침해야 합니다.

## `/recall`로 여러분 자신의 맥락을 재구성하세요

```text
/recall catch me up on the export work from last week
```

[`/recall`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/recall/SKILL.md)은 여러분 자신의 최근 채팅과 공유 기록(이슈, 이전 수정, 여전히 발생하는 오류)을 탐색해 현재 상황과 다음 할 일을 정리한 브리핑을 돌려줍니다. 이전 채팅에는 새 에이전트에게 없는 맥락이 있으므로, 오래된 주제에 관한 새 작업을 시작할 때는 먼저 이를 불러온 다음 새 입력을 전달하세요.

```text
/recall my work on the virtualized list from yesterday, then read this bug report.
```

특정 채팅 하나를 재개하려면 `/recall`이 아니라 아래의 세션 이어받기 플레이북을 사용하세요.

## 세션 이어받기로 이전 작업을 이어받으세요

다른 에이전트(또는 지난주의 여러분)가 브랜치 작업을 진행 중인 상태로 남겼다면 다음과 같이 요청하세요.

```text
/poteto-mode take over this branch. read the decision log, figure out what's done, and continue from there. don't redo finished work.
```

[세션 이어받기 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/session-pickup.md)은 이전 작업 흔적을 권위 있는 정보로 취급합니다. 브랜치 상태와 결정을 재구성하고, 재개 지점을 명시하며, 모든 것을 처음부터 다시 도출하는 대신 원래 목표를 기준으로 인계받은 주장을 검증합니다.

**함정:** "어차피 에이전트가 코드를 읽을 테니까"라는 이유로 이 페이지의 스킬을 건너뛰지 마세요. 추적된 모델 없이 수정을 시작한 에이전트는 처음으로 그럴듯해 보이는 지점에서 증상만 고치는 경향이 있습니다. 먼저 `/how`를 실행하는 편이 두 번째 버그보다 비용이 적게 듭니다.

다음: [변경 설계하기](./04-design.md).
