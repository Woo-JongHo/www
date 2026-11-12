> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 내 것으로 만들기

poteto-mode는 한 사람의 스타일입니다. 그 아래의 플레이북, 라우팅, 모델 역할은 여러분의 스타일에도 똑같이 잘 작동합니다. 이 페이지에서는 개인 모드 생성, 세션에서 얻은 교훈 포착, 에이전트가 실수를 반복하지 않도록 저장소 수정, 집중된 스킬 작성, 신뢰하기 전 스킬 변경 테스트를 다룹니다.

생각보다 작게 시작하십시오. 첫날부터 많은 스킬이 필요하지 않으며, 이 플러그인 전체조차 필요하지 않습니다. 평범하게 프롬프트를 작성하고 에이전트가 어디서 실패하는지 살핀 뒤, 같은 실패가 두 번 나타나면 스킬이나 검사를 추가하십시오.

## `/automate-me`로 나만의 모드 생성하기

```text
/automate-me
```

스타일을 설명할 필요는 없습니다. [`/automate-me`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/automate-me/SKILL.md)가 기록에서 스타일을 읽어내기 때문입니다. 활성 워크스페이스의 최근 대화 기록에서 응답, 위임, 검증, 코드, 산문, 프로세스에 관한 반복적인 선호를 찾아낸 다음, 어떤 패턴이 진짜 여러분의 것인지 묻습니다. Cursor에 내장된 `create-skill` 흐름을 통해 `.cursor/skills/<your-name>-mode/SKILL.md` 초안을 만들고, [`/unslop`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/unslop/SKILL.md)으로 초안을 다듬은 뒤, 다른 변경과 마찬가지로 검토할 수 있도록 worktree에서 PR을 엽니다.

습관이 달라질 때마다 다시 실행하십시오.

```text
/automate-me update my mode skill with everything since its last edit
```

업데이트 모드는 스킬이 마지막으로 변경된 이후의 기록만 분석합니다. 반박하지 않은 규칙은 유지하고, 새로운 증거가 있는 규칙은 수정하며, 새로운 패턴에 대해서만 섹션을 추가합니다.

## `/reflect`로 세션의 교훈 포착하기

무언가를 배운 작업 직후에 다음을 실행하십시오.

```text
/reflect that took way too long. capture what we learned so the next run doesn't repeat it.
```

[`/reflect`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/reflect/SKILL.md)는 대화 기록을 병렬 검토자 세 명에게 보낸 다음, 종합 담당자가 제안을 `Accepted`, `Rejected`, `Backlog`으로 분류하고 스킬을 변경하기 전에 여러분의 승인을 기다립니다. 향후 결정을 바꿀 제안만 승인하십시오. 특이한 세션 하나는 일화일 뿐 규칙이 아닙니다.

## `/correct`로 환경 수정하기

같은 실수 때문에 에이전트를 계속 교정한다면, 수정 사항은 다음 프롬프트가 아니라 저장소에 있어야 합니다. 효과가 얼마나 확실한지에 따라 선택지를 정렬하십시오.

1. 아키텍처나 더 나은 데이터 구조로 실수를 불가능하게 만듭니다.
2. 타입 또는 수정 방법을 명시하는 오류를 내는 린트나 CI 검사로 차단합니다.
3. 테스트로 잡아냅니다.
4. 문서나 에이전트 규칙으로 적습니다. 에이전트가 규칙을 건너뛰어도 아무것도 실패하지 않으므로 이 방법은 마지막입니다.

사람의 검토는 목록에 없습니다. 모든 PR에서 같은 실수를 잡아야 하는 검토자야말로 이 기능이 해결하는 문제입니다. [`/correct`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/correct/SKILL.md)가 그 일을 수행합니다.

```text
/correct agents keep calling the database client directly instead of going through the repository layer
```

최근 커밋, 되돌림, 검토 댓글, 우회 방법을 설명하는 댓글을 읽은 다음 실수를 유형별로 묶습니다. 한 유형은 두 번 발생하면 인정됩니다. 가장 자주 발생하는 유형부터 유형당 커밋 하나로, 작동하는 가장 높은 수준에서 수정하고, 각 새 검사가 과거의 실제 실수에서 실패함을 입증합니다. 또한 각 규칙과 그 규칙을 강제하는 수단을 짝지은 표를 에이전트 지침 파일에 유지하므로, 아무것도 강제하지 않는 규칙은 반복 항목으로 드러납니다. 응답에는 각 유형의 증거, 선택한 수준, 더 높은 수준이 작동하지 않은 이유가 나열됩니다.

인수 없이 실행하면 기록에서 유형을 스스로 찾습니다. `/reflect`와 `/correct`는 작업을 나눕니다. `/reflect`는 한 세션을 바탕으로 스킬을 개선합니다. `/correct`는 같은 유형의 실수가 되풀이되지 않도록 저장소를 변경합니다. 수정 사항이 새로운 경계라면 `/architect`와 함께 사용하십시오. [여러 프로젝트를 병렬로 실행하기](./07-overnight.md#여러-프로젝트를-병렬로-실행하기)에는 저장소 전체에서 두 가지를 모두 수행하는 프롬프트가 있습니다.

## 집중된 스킬 작성하기

포착하려는 워크플로를 이미 알고 있다면 다음과 같이 작성합니다.

```text
/poteto-mode write a skill for verifying database migrations in this repo
```

스킬 작성은 [스킬 작성 또는 수정 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/authoring-a-skill.md)을 따릅니다. 이 플레이북은 Cursor에 내장된 `create-skill`을 거치고, frontmatter와 링크를 검증하며, PR 열기 플레이북을 통해 결과를 내보냅니다. 에이전트용 문장은 사람용 문장보다 기준이 높습니다. 도움이 되지 않는 문장이 미래의 어떤 에이전트가 따를 지침이 되기 때문입니다. `SKILL.md`를 직접 작성하지 말고 플레이북이 그 기준을 지키게 하십시오.

두 가지 특수 사례에는 전용 생성기가 있습니다. 앱을 조작하고 동작을 입증해야 하는 스킬은 검증 스킬이므로 [`/create-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-verification-skill/SKILL.md)과 [`/maintain-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-verification-skill/SKILL.md)을 대신 사용하십시오. 모델 검사기, 증명 또는 다른 검증기로 코드의 속성을 검사하는 스킬은 정형 검증 스킬이므로 [`/create-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/create-formal-verification-skill/SKILL.md)과 [`/maintain-formal-verification-skill`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/maintain-formal-verification-skill/SKILL.md)을 사용하십시오. [검증하고 배포하기](./06-verify-and-ship.md#정형-검증-스킬로-속성-입증하기)에서 두 종류를 모두 다룹니다.

## `/technical-writing`으로 기준에 맞는 문서 작성하기

배포하는 산문은 스킬만이 아닙니다. 문서, RFC, README, PR 설명, 커밋 메시지에는 다음을 사용합니다.

```text
/technical-writing review the readme changes
```

[`/technical-writing`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/technical-writing/SKILL.md)은 계층화된 기준을 적용합니다. 목표는 피곤한 엔지니어도 처음 읽을 때 이해할 수 있는 글입니다. 먼저 문서의 모드(튜토리얼, 방법 안내, 참조 또는 설명)를 선택한 다음, 문장별로 누가 무엇을 하는지, 문장마다 하나의 생각만 담겼는지, 두 가지로 읽힐 수 있는 부분이 없는지를 살핍니다. 여러분이나 에이전트가 방금 쓴 글을 검토할 때 사용하거나, 문서를 요청할 때 처음부터 이름을 지정하십시오.

## 스킬 변경을 블라인드 테스트하기

스킬 수정은 앞으로의 모든 세션에 영향을 미치므로 실험처럼 테스트하십시오. 다른 사람의 스킬을 도입할 때도 마찬가지입니다. 유지하기 전에 여러분의 작업에서 에이전트를 더 나아지게 하는지 확인하십시오.

```text
/poteto-mode run the eval playbook on this skill change. same task for both variants, candidates stay blind.
```

스킬이 계속 놓치는 부분이 있고 무엇을 해야 하는지 알고 있다면, 하나의 작업에서 변경하고 테스트하십시오.

```text
/poteto-mode update the review skill so it flags missing migrations, and eval the change.
```

처음부터 평가를 요청하면 수정이 정직하게 유지됩니다. 나쁜 세션 하나를 보고 작성한 수정은 그 세션에 과적합되기 쉽고, 수정이 누적되면 스킬이 표류합니다. 평가는 배포 전에 그 표류를 잡아냅니다.

[평가 플레이북](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/poteto-mode/playbooks/eval.md)은 관찰자 효과라는 하나의 실패 모드를 중심으로 설계되었습니다. 평가받고 있다는 사실을 아는 에이전트는 다르게 행동합니다. 따라서 후보 에이전트에는 정리된 디렉터리에서 자연스러워 보이는 작업을 주고, "eval"이나 "candidate"라는 단어 또는 다른 후보의 존재를 절대 알리지 않습니다. 한 명의 판정자가 중립적인 레이블 아래 모든 결과를 채점하고, 지시 체인을 따랐는지는 각 후보가 실제로 읽은 파일로 평가하지 후보의 주장으로 평가하지 않습니다.

판정을 받아들이기 전에 모든 결과를 직접 읽으십시오. 판정자와 의견이 다르다면 자신의 판단보다 루브릭을 먼저 의심하십시오.

## `/make-bot-ui`로 봇 UI 만들기

상황에 따라 쓰는 스킬 하나는 Grok Bot 사용자를 위한 것입니다. [`/make-bot-ui`](https://github.com/cursor/plugins/blob/63912a91d52c43946f974f2aaf661334a6116a82/pstack/skills/make-bot-ui/SKILL.md)는 버튼으로 webhook 루틴을 통해 봇을 깨우는 작은 페이지를 만듭니다. 예를 들어 검토 대기열을 스와이프하면서 각 스와이프마다 봇에게 해당 항목에 조치하도록 요청할 수 있습니다. 컴퓨터에서 실행되는 서버가 webhook의 발신자 키를 보관하므로 키가 브라우저나 대화에 도달하지 않습니다. 이 스킬은 Tailscale에 페이지를 노출하는 방법도 다룹니다.

**주의할 점:** 스킬이 제대로 작동하지 않는다는 이유로 작업 도중에 수정하지 마십시오. 별도의 PR에서 수정하고 진행 중인 작업은 계속하십시오. 기능 작업에 뒤섞여 배포된 스킬 수정은 검토에서 보이지 않고 평가할 수도 없습니다.

다음: [레시피와 주의할 점](./10-recipes-and-pitfalls.md).
