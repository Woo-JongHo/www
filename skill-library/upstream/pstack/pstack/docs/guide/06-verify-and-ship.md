> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 결과를 검증하고 PR 열기

"컴파일된다"는 증거가 아닙니다. [동작 증명하기 원칙](../../skills/principle-prove-it-works/SKILL.md)은 성공을 보고하기 전에 에이전트가 실제 산출물을 확인하게 하며, 여러분의 역할은 "실제 산출물"을 검사할 수 있게 만드는 것입니다. 이 페이지에서는 완료 조건 명시, 측정값 검토, 앱용 검증 스킬 생성, 테스트가 거의 도달하지 못하는 속성의 정형 검증, PR 열기와 병합까지 진행하기를 다룹니다.

대부분의 에이전트 작업에서 검증은 가장 느린 단계입니다. 보통 사람을 기다리는 단계이기 때문입니다. 에이전트가 직접 수행할 수 있게 만들면 여러분이 병목이 되지 않습니다. 건너뛰면 더 많은 에이전트를 실행해도 검토해야 할 미검증 작업만 늘어납니다.

![그녀가 스톱워치로 시간을 재는 동안 시제품 비행기가 실제 시험 코스를 날고, 로봇들이 실행을 촬영하고 체크리스트를 확인합니다. 터미널에는 verify: pass, evidence: captured가 표시됩니다.](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/docs/guide/images/verification.jpg?raw=true)

## 완료 조건을 먼저 명시하기

어떤 표현이든 알맞은 말로 첫 프롬프트에 완료의 의미를 넣으십시오.

```text
/poteto-mode add json output to this command. text output stays byte-identical, the json parses, both run against the sample project. show me the evidence.
```

이제 에이전트에는 충족해야 할 막연한 느낌이 아니라 실행할 수 있는 검사 세 개가 있습니다. 응답에는 정확한 명령과 출력이 담겨야 합니다. 검사를 실행할 수 없었다면 좋은 응답은 "inconclusive"이라고 말합니다. 증거 없이 확신하는 응답은 경고 신호입니다.

검사를 변경에 맞추십시오.

- CLI 변경은 실제 명령을 실행합니다.
- UI 변경은 실행 중인 앱에서 변경된 흐름을 따라갑니다. 참조와 픽셀 단위로 일치해야 한다면 [시각적 동등성 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/visual-parity.md)이 눈으로 판단하는 대신 고정된 기준과 스크린샷의 차이를 비교합니다.
- 파서나 마이그레이션은 저장된 입력을 재생합니다.
- 성능 변경은 변경 전후 프로파일을 비교합니다.
- 저장소 변경은 기록한 값을 다시 읽습니다.

직접 검사할 수 있는 산출물로 증거를 요청하십시오. 실패한 테스트와 그 뒤 통과한 테스트, 전후 영상, 트레이스, 스크린샷 등이 있습니다. 수정 사항이 이미 병합됐다면 main에서 같은 검사를 다시 요청하십시오. 산출물은 전체 실행을 재현하지 않고도 이의를 제기할 수 있으므로 그럴듯한 설명보다 낫습니다.

완전히 신뢰할 수 없는 작은 diff에는 [`/blast-radius`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/blast-radius/SKILL.md)가 다른 곳에서 무엇을 깨뜨릴 수 있는지 찾아줍니다. 안전성을 성립시키는 하나의 사실을 찾아 논증이 아니라 코드 실행으로 입증합니다.

## `/benchmark-checklist`로 측정값 검토하기

전후 측정값은 우연히 잘못되기 가장 쉬운 증거입니다. 예열된 캐시, 한쪽의 디버그 빌드, 측정 구간 안에서 실행되지 않은 작업은 각각 그럴듯한 속도 향상을 만들 수 있습니다. 수치를 보고하거나 그에 따라 행동하기 전에 다음을 입력하십시오.

```text
/benchmark-checklist vet the export speedup before it goes in the pr
```

[`/benchmark-checklist`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/benchmark-checklist/SKILL.md)는 일곱 가지 질문을 하고 각 질문에 대한 실행 증거를 요구합니다.

1. 그 수치를 제한하는 것은 무엇이며, 왜 두 배가 되지 않습니까?
2. 모든 쪽이 프로덕션과 같은 최적화 방식으로 실행됐습니까?
3. 결과가 디스크 대역폭이나 코어 수 같은 물리적 한계를 위반합니까?
4. 오류가 발생했거나 잘못된 출력이 반환됐습니까?
5. 번갈아 실행했을 때 중앙값과 범위를 포함해 재현됩니까?
6. 사용자가 기다리는 전체 경로에서 의미가 있습니까?
7. 작업이 실제로 측정 구간 안에서 일어났습니까?

판정은 실행 횟수, 범위, 제한 요소와 함께 faster, slower, no measurable difference, inconclusive 중 하나로 돌아옵니다. 제한 요소를 밝힐 수 없거나 한쪽이 최적화되지 않은 채 실행됐다면 inconclusive이라고 판정합니다. `/poteto-mode`는 이미 Perf issue와 Hillclimb 플레이북 안에서 체크리스트를 실행하므로, 그 밖에서 무언가를 측정했거나 다른 사람의 수치가 지나치게 좋아 보일 때 직접 입력하십시오. 이는 [수치 설명하기 원칙](../../skills/principle-explain-the-number/SKILL.md)의 실무 형식입니다.

## 프로젝트 검증 스킬 만들기

위의 UI 항목에는 실제 요구 사항이 숨어 있습니다. 에이전트에는 앱을 조작하는 스크립트 방식이 필요합니다. 프로젝트에 이미 있다면 좋습니다. 없다면 다음을 실행하십시오.

```text
/create-verification-skill
```

[`/create-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-verification-skill/SKILL.md)은 여러분이 아니라 저장소를 인터뷰합니다. 사용자가 무엇을 조작하는지, 앱을 로컬에서 어떻게 실행하는지, 무엇으로 조작할 수 있는지(기존 하네스를 먼저 사용하고, 없으면 브라우저와 CDP, PTY 또는 일반 HTTP), 어떤 증거가 동작을 입증하는지, 두 인스턴스를 나란히 실행할 수 있는지를 알아냅니다. 코드로 답할 수 없는 것만 여러분에게 묻습니다.

`.cursor/skills/verify-<app>/`에 정확한 Launch, Doctor, Drive, Evidence, Cleanup 섹션이 있는 에이전트용 지침, 제공하는 스크립트용 Helpers 섹션, 앱의 기능과 각 기능이 작동함을 입증하는 결과를 색인화한 `features/` 아래의 기능 맵을 작성합니다. 스킬에는 README 색인과 필수 H2 네 개를 사용하는 기능별 파일로 구성된 [완성된 기능 맵 예제](https://github.com/cursor/plugins/tree/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-verification-skill/references/feature-map-example)가 포함됩니다. 넘겨주기 전에 생성기는 스킬을 한 번 처음부터 끝까지 입증합니다. 실행하고, doctor 검사를 수행하고, 기능 하나를 조작하고, 증거를 캡처하고, 정리한 다음, 정리 후에도 증거가 남아 있는지 확인합니다. 이 입증이 실패하면 결과물을 사용하지 마십시오.

그 뒤부터는 "verify it in the app"이 이 저장소에서 설정 관련 대화 없이 어떤 에이전트든 실행할 수 있는 단계가 됩니다. 특정 형식의 증거가 필요하면 프롬프트에서 이름을 지정하십시오.

```text
/poteto-mode build the bulk-archive action. use /verify-<app> to verify your changes and show me a video and screenshots as proof.
```

```text
/poteto-mode repro this with /verify-<app>. if it repros on main, fix it and show me a video as proof.
```

검증 스킬이 작동하면 [`/swarm`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/swarm/SKILL.md)은 전체 검증을 기능 맵 항목별로 나누고 결과를 집계할 수 있습니다. 검증자 무리는 충분히 큰 표본에서 성능 개선을 확인하거나 PR 배포 전에 앱을 퍼징해 회귀를 찾을 수도 있습니다.

검증 스킬을 일회용이 아니라 인프라로 다루십시오. 커밋하여 팀의 모든 사람과 모든 에이전트가 같은 방식으로 앱을 조작하게 하십시오. 그런 다음 [지렛대를 만드십시오](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/principle-build-the-lever/SKILL.md). 에이전트가 앱을 클릭하기 위해 계속 일회용 스크립트를 작성한다면, 스킬이 대신 호출할 작은 제어 CLI를 요청하십시오. 에이전트가 사용하는 토큰이 줄고 모든 실행을 반복할 수 있게 됩니다. 에이전트가 잘 사용할 수 있는 CLI에는 다음 특성이 있습니다.

- 얇은 명령을 많이 두는 대신, 각각 실제 작업을 수행하는 조합 가능한 명령 몇 개를 둡니다.
- 파괴적인 모든 작업에 `--dry-run` 옵션을 둡니다.
- 모든 기능을 한꺼번에 보여주는 대신 점진적으로 드러내는 하위 명령을 둡니다.
- 오류 메시지에 대신 무엇을 해야 하는지 명시합니다.
- 풍부한 `--help` 텍스트를 제공합니다.
- JSON 같은 기계 판독 가능 출력을 제공합니다.

그 작업을 하는 김에 시드 데이터, 테스트 사용자, 매번 같은 방식으로 환경을 띄우는 단일 명령으로 개발 환경 설정도 반복 가능하게 만드십시오.

## 검증 스킬을 정확하게 유지하기

앱은 바뀌고 기능 맵은 오래됩니다. 아무도 기억할 필요가 없도록 가급적 예약 자동화에서, 최소 하루에 한 번 다음을 실행하십시오.

```text
/maintain-verification-skill
```

[`/maintain-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-verification-skill/SKILL.md)은 생성된 스킬을 감사합니다. 기능마다 읽기 전용 소스 판독자 하나를 병렬로 실행한 다음, 매핑된 모든 기능을 조작하는 라이브 검증을 한 번 수행합니다. 정확히 세 결과 중 하나로 끝납니다. `clean`은 완전한 범위와 배포할 것이 없음을 뜻합니다. `changed`는 검증 스킬 자체 디렉터리로 한정된, 입증된 수정 PR 하나를 뜻합니다. `blocked`는 차단 요소를 밝힙니다. 제품 코드는 절대 수정하지 않습니다. 라이브 검증이 제품 회귀를 발견하면 문서 수정으로 숨기지 않고 회귀를 보고합니다.

## 정형 검증 스킬로 속성 입증하기

검증 스킬은 직접 조작하는 경로를 입증합니다. 일부 버그는 아무도 조작하지 않는 경로에 있습니다. 두 재시도가 겹치거나, 쓰기 도중 잠금이 만료되거나, 상태 변경이 순서와 다르게 도착하는 경우입니다. 테스트는 이런 경우에 거의 도달하지 못합니다. 이런 버그의 비용이 큰 코드에는 다음을 실행하십시오.

```text
/create-formal-verification-skill
```

[`/create-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-formal-verification-skill/SKILL.md)은 코드에서 대상을 선택합니다. 코드가 보장하는 약속 중, 깨지면 사용자에게 피해가 가고 테스트가 깨지는 경우에 거의 도달하지 못하는 것을 찾습니다. 검증하기 가장 쉬운 대상이 아니라 가장 강력한 대상을 선택합니다. 특정 영역이나 버그에서 시작하려면 대신 이름을 지정하십시오.

```text
/create-formal-verification-skill the job lease and retry logic. a job must never run twice at once.
```

질문에 따라 도구가 결정됩니다. 이벤트가 잘못된 순서로 발생할 수 있는지는 작은 설계 모델을 사용하는 모델 검사기에 적합하며, 어떤 언어든 기본값은 TLA+입니다. 코드가 모든 입력에서 올바르게 동작하는지는 코드에서 실행되는 검증기에 적합합니다. 사용하는 언어에서 실행되는 검증기가 없다면 에이전트가 그 사실을 밝히고, 함수를 손으로 작성한 모델이 아니라 생성된 입력으로 실제 코드를 테스트합니다. 모든 크기에서 성립해야 하는 속성에는 증명이 필요할 수 있습니다. 에이전트는 선택한 도구와 이유를 알려줍니다.

속성 하나를 검증하고 코드의 깨진 변형에서 그 속성이 실패하는 모습을 보여줍니다. 한 번도 실패하는 것을 보지 못한 검사는 아무것도 입증하지 못하기 때문입니다. 현재 코드가 이미 속성을 위반한다면 코드 용어로 표현한 짧은 단계 순서의 반례를 받습니다. 속성은 명시된 그대로 유지되므로 발견 사항도 그대로 남습니다. 요청하지 않는 한 제품 코드는 변경하지 않습니다.

다음 에이전트에게 변경이 검증된 코드에 닿는지, 한 명령으로 검사를 실행하는 방법, 실제 버그와 모델링 오류를 구분하는 방법을 알려주는 프로젝트 로컬 스킬을 작성합니다. 넘겨주기 전에 생성기는 속성을 깨뜨리는 임시 변경에서 그 스킬을 한 번 따르며, 검사가 이를 잡아내야 합니다. 인계에는 어떤 도구와 경계로 무엇을 검증했는지, 검사가 무엇을 발견했는지, 무엇을 다루지 않는지가 적힙니다. 통과는 모델이나 경계를 다룰 뿐 전체 시스템을 다루지는 않습니다.

스킬은 각 검사가 다루는 코드와 검사가 마지막으로 일치했던 커밋도 기록합니다. 스킬을 건너뛴 병합과 리팩터링은 이미 사라진 코드의 설명에 대해 검사가 계속 통과하게 만들 수 있습니다. 그런 작업 뒤에는 [`/maintain-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-formal-verification-skill/SKILL.md)을 실행하십시오. 코드에 맞춰 검증을 갱신하고 다시 실행하며, 갱신된 각 검사가 여전히 실패할 수 있음을 보여주고, 각 실패가 검증의 표류인지 코드의 버그인지 알려줍니다.

## 상태 차트로 동작 보여주기

모델 용어로 된 반례는 여러분을 납득시킵니다. 그 동작을 담당하는 PM이나 디자이너는 자신의 용어로 확인해야 합니다. 다음을 실행하십시오.

```text
/statechart what the user sees when they edit a note offline
```

[`/statechart`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/statechart/SKILL.md)는 TLA+ 모델에서 사용자가 보는 내용을 Mermaid 상태 차트로 그리므로 그림과 검증된 모델이 서로 어긋날 수 없습니다. 독자의 규칙("오프라인일 때 Synced가 표시되어서는 안 된다")은 불변 조건이 됩니다. 차트는 규칙을 위반하는 각 상태를 표시하고, 보고서는 독자의 말로 그 상태에 도달하는 가장 짧은 경로를 제시합니다. 인계 전에 에이전트는 실제 코드에서 각 버그 경로를 재현하므로 모델링 오류가 버그로 독자에게 전달되지 않습니다.

## PR 열기

```text
/poteto-mode open the pr. small ordered commits, evidence in the description.
```

[PR 열기 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/opening-a-pr.md)은 worktree에서 작업하고, 작업을 작고 순서 있는 커밋으로 rebase하며, diff를 정리하고, 산문을 다듬은 뒤 PR 링크를 반환합니다. 큰 PR 하나보다 좁은 PR 다섯 개가 낫고, 커지는 브랜치보다 스택형 후속 작업이 낫습니다.

## PR을 돌봐 병합 준비 상태까지 진행하기

열린 PR에는 즉시 차단 요소가 쌓이기 시작합니다. 검사가 실패하고, 검토자가 댓글을 달며, trunk가 움직입니다. 그 변동을 [Babysit 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/babysit.md)에 맡기십시오.

```text
/poteto-mode babysit this pr. get it green.
```

Babysit은 GitHub에서는 번들 감시자를, 사용할 수 있을 때는 Origin CLI를 이용해 PR을 감시하고 차단 요소를 충돌, 검토 스레드, CI 순으로 처리합니다. 알려진 수정은 모두 한 번의 push로 묶어 검사도 각 수정 뒤가 아니라 한 번만 다시 시작합니다. 사람과 봇이 실제 지적과 잡음을 같은 목록에 올리므로 댓글 분류는 회의적으로 수행합니다. 실제 발견 사항은 수정하고, 잡음은 반증을 스레드에 게시한 뒤 기각합니다. 상태만 필요할 때는 더 작은 요청을 하면 Babysit이 루프를 시작하지 않고 답합니다.

```text
/poteto-mode check on pr 123. anything outstanding?
```

Babysit은 병합 준비 상태에서 멈춥니다. 모든 검사가 통과해도 절대 병합하지 않습니다. 병합은 별개의 결정이기 때문입니다.

## 출시 절차로 스택 반영하기

검사가 통과하는 것과 안전한 것은 다릅니다. 반영할 준비가 되면 다음과 같이 말하십시오.

```text
/poteto-mode land the stack.
```

[Shipping 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/shipping.md)은 무엇이든 실행 준비 상태로 만들기 전에 각 PR을 독립적으로 검증합니다. PR마다 새로운 에이전트 한 명이 실제 동작을 입증하며, 변경을 판단하는 에이전트는 그 변경을 작성한 에이전트와 절대 같지 않습니다. 그런 다음 아래에서부터 연속된 검증 완료 구간만, 기본적으로 GitHub를 통해 또는 Origin CLI를 사용할 수 있을 때는 Origin으로 PR을 하나씩 반영하고, 연속성을 처음 깨뜨리는 PR을 보고합니다. 검증되지 않은 PR 위에 있는 검증된 PR은 기다립니다. 병합하면 그 아래의 빈틈까지 함께 들어오기 때문입니다.

다음: [잠든 동안 작업 실행하기](./07-overnight.md).
