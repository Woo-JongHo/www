---
description: 현재 코드베이스를 기능의 명세·계획·작업과 대조하고, 아직 구현되지 않은 나머지 작업을 tasks.md에 새 작업으로 추가해 implement가 완료할 수 있게 합니다.
scripts:
  sh: scripts/bash/check-prerequisites.sh --json --require-spec --require-tasks --include-tasks
  ps: scripts/powershell/check-prerequisites.ps1 -Json -RequireSpec -RequireTasks -IncludeTasks
  py: scripts/python/check_prerequisites.py --json --require-spec --require-tasks --include-tasks
---

> 한국어 번역본: 고정 커밋 `f29319d550d1f05404f7184b92e995600ca2293f`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.


## 사용자 입력

```text
$ARGUMENTS
```

사용자 입력이 비어 있지 않으면 진행 전에 **반드시** 고려해야 합니다.

## 실행 전 검사

**확장 훅 확인(수렴 전)**:

- 프로젝트 루트에 `.specify/extensions.yml`이 있는지 확인하세요.
- 있으면 읽고 `hooks.before_converge` 키 아래의 항목을 찾으세요.
- YAML을 파싱할 수 없거나 유효하지 않으면 조용히 건너뛰지 마세요. `.specify/extensions.yml`을 읽지 못했다는 사실과 파서 오류를 사용자에게 알리고, 등록된 필수 훅(`optional: false`)을 포함해 어떤 훅도 확인하지 못했다고 설명한 뒤 정상적으로 계속하세요.
- `enabled`가 명시적으로 `false`인 훅은 제외하세요. `enabled` 필드가 없으면 기본적으로 활성화된 것으로 취급하세요.
- 남은 훅의 `condition` 표현식을 해석하거나 평가하려고 하지 **마세요**:
  - `condition` 필드가 없거나 null/빈 값이면 실행 가능한 훅으로 취급하세요.
  - 비어 있지 않은 `condition`이 있으면 훅을 건너뛰고 조건 평가는 HookExecutor 구현에 맡기세요.
- 실행 가능한 각 훅에 대해 `optional` 플래그에 따라 다음을 출력하세요:
  - **선택 훅**(`optional: true`):

    ```text
    ## 확장 훅

    **선택적 사전 훅**: {extension}
    명령: `/{command}`
    설명: {description}

    프롬프트: {prompt}
    실행 방법: `/{command}`
    ```

  - **필수 훅**(`optional: false`):

    ```text
    ## 확장 훅

    **자동 사전 훅**: {extension}
    실행 중: `/{command}`
    EXECUTE_COMMAND: {command}

    목표로 진행하기 전에 훅 명령의 결과를 기다리세요.
    ```
    위 블록을 출력한 뒤 계속하기 전에 훅을 실제로 호출하고 완료될 때까지 기다려야 합니다. 이 에이전트/세션에서 직접 명령을 실행할 때와 같은 방식으로 실행하세요. 실제 호출은 위의 문자 그대로인 `{command}` ID와 다를 수 있습니다. 예를 들어 skills 모드 에이전트는 `/skill:speckit-...` 또는 `$speckit-...`로 실행합니다. 블록 출력만으로 훅이 실행되지는 않습니다.

- 등록된 훅이 없거나 `.specify/extensions.yml`이 없으면 조용히 건너뛰세요.

## 목표

기능의 명세·계획·작업이 요구하는 것과 코드베이스의 현재 구현 사이의 간극을 메우세요. `spec.md`, `plan.md`, `tasks.md`를 **의도의 유일한 출처**로 읽고(헌법은 지배 제약으로 사용), 코드의 현재 상태를 평가해 충족되지 않았거나 불완전하거나 일부만 충족된 요구 사항·수용 기준·계획 결정·기존 작업을 찾으세요. 그리고 **나머지 작업을 각각 추적 가능한 새 작업으로** `tasks.md` 하단에 추가해 `__SPECKIT_COMMAND_IMPLEMENT__`가 완료할 수 있게 하세요. 이 명령은 `__SPECKIT_COMMAND_TASKS__`가 완전한 `tasks.md`를 생성하고, 현재 `tasks.md`에 대해 `__SPECKIT_COMMAND_IMPLEMENT__`가 실행된 뒤에만 실행해야 합니다.

이 명령은 diff 도구가 아니며 변경 사항을 추적하지 않습니다. 기능 산출물을 기준으로 코드의 현재 상태를 평가합니다. git, 브랜치 비교, 이력을 사용하지 않습니다.

## 운영 제약

**추가만 가능, 재작성 금지**: 이 명령의 유일한 쓰기는 `tasks.md`에 새 `## Phase N: Convergence` 절을 추가하는 것입니다. 다음을 해서는 **안 됩니다**:

- 어떤 방식으로든 `spec.md` 또는 `plan.md` 수정.
- 기존 작업의 재작성·번호 변경·재정렬·삭제(이전 Convergence 단계의 작업도 포함).
- 애플리케이션 코드 수정·생성·삭제. 추가된 작업을 완료하는 것은 `__SPECKIT_COMMAND_IMPLEMENT__`의 책임입니다.

코드베이스가 이미 모든 사항을 충족하면 빈 Convergence 제목을 만들지 말고 `tasks.md`를 **바이트 단위까지 변경 없이** 유지하며 문제가 없는 결과를 보고해야 합니다.

**헌법 권한**: 프로젝트 헌법(`/memory/constitution.md`)은 **양보할 수 없습니다**. MUST 원칙을 위반하는 코드는 가장 높은 심각도의 발견 사항이며 대응하는 개선 작업을 생성합니다. 헌법이 미작성 템플릿이면 실패하는 대신 헌법 검사를 무리 없이 건너뛰세요.

## 실행 단계

### 1. 수렴 맥락 초기화

저장소 루트에서 `{SCRIPT}`를 한 번 실행하고 JSON의 FEATURE_DIR와 AVAILABLE_DOCS를 파싱하세요. 절대경로를 도출하세요:

- SPEC = FEATURE_DIR/spec.md
- PLAN = FEATURE_DIR/plan.md
- TASKS = FEATURE_DIR/tasks.md
- CONSTITUTION = `/memory/constitution.md` (있으면)
`spec.md`, `plan.md`, `tasks.md` 중 하나라도 없으면 필요한 선행 명령을 명시하는 명확하고 실행 가능한 메시지와 함께 중단하세요. 명세가 없으면 `__SPECKIT_COMMAND_SPECIFY__`, 계획이 없으면 `__SPECKIT_COMMAND_PLAN__`, 작업이 없으면 `__SPECKIT_COMMAND_TASKS__`를 안내하세요. 부분 출력은 만들지 마세요.
인수에 "I'm Groot"처럼 작은따옴표가 있으면 이스케이프 구문을 쓰세요. 예: 'I'\''m Groot' (가능하면 큰따옴표 사용: "I'm Groot").

### 2. 산출물 읽기(점진적 공개)

각 산출물에서 필요한 최소 맥락만 읽으세요:

**spec.md에서:**

- 기능 요구 사항(FR-###)
- 성공 기준(SC-###): 구현 가능한 작업이 필요한 항목만 포함하고, 출시 후 성과 지표와 비즈니스 KPI는 제외
- 사용자 스토리와 수용 시나리오
- 경계 사례(있으면)

**plan.md에서:**

- 아키텍처/스택 선택과 기술 결정
- 데이터 모델 참조
- 단계와 명시된 접점(계획에서 생성·편집한다고 한 파일/컴포넌트)
- 기술 제약

**tasks.md에서:**

- 작업 ID(다음 ID와 다음 단계 번호 계산용)
- 설명, 단계별 묶음, 참조 파일 경로

**헌법에서(미작성 템플릿이 아니면):**

- 원칙 이름과 MUST/SHOULD 규범 문장

### 3. 의도 목록 구성

내부 모델을 만드세요(산출물 원문을 그대로 출력하지 마세요):

- **요구 사항 목록**: 각 FR-### / SC-### / 사용자 스토리 수용 시나리오(예: `US1/AC2`)에 안정적인 키를 하나씩 부여하고, 구현 가능한 의무를 부과하는 계획 결정과 헌법 원칙도 포함하세요.
- **코드 범위 지도**: `plan.md`와 `tasks.md`에 명시된 파일 경로 및 각 요구 사항의 개념에 대한 키워드 검색으로 평가 범위에 속하는 소스 파일·컴포넌트 집합을 도출하세요. 평가를 이 범위로 한정하고 산출물이 정의한 범위를 넘어 추론하지 **마세요**.

### 4. 코드베이스 평가 및 발견 사항 분류

체크박스 상태나 Convergence 단계와 무관하게 모든 기존 작업을 의도 목록에 포함하세요. 완료 주장은 증거가 아닙니다. 명세·계획·작업·헌법을 기준으로 현재 동작을 검증하세요. 수정 작업의 연쇄에 대해서는 대체된 구현 세부 사항이 아니라 최종 동작을 평가하세요. 충족되지 않은 의무와 함께 명시된 의도에 모순되거나 이를 초과하거나 범위 밖에 있는 구현도 검사하세요.

의도 목록의 각 항목에 대해 범위 내의 현재 코드를 살펴보고 간극이 있는 경우에만 `Finding`을 만드세요. 모든 발견 사항을 **간극 유형**으로 분류하세요:

- **`missing`**: 필요한 작업이 코드에 전혀 없습니다.
- **`partial`**: 작업은 있지만 요구 사항 / 수용 기준 / 계획 결정을 아직 완전히 충족하지 않습니다.
- **`contradicts`**: 코드가 명시된 의도 또는 헌법의 MUST 원칙과 충돌하는 동작을 합니다.
- **`unrequested`**: 명세·계획·작업에서 요구하지 않은 작업이 코드에 있습니다. 인지를 위해 드러내며, converge는 코드를 삭제하지 않고 검토·정당화 또는 제거 작업만 추가합니다.

각 `Finding`에는 안정적인 ID, 추적 대상 `source-ref`, `gap-type`, 심각도, 증거(관찰한 파일/영역)를 포함한 짧고 사람이 읽을 수 있는 설명을 기록합니다.

**경계 사례:**

- **코드가 거의 또는 전혀 없음**: 실패하는 대신 명시된 범위 전체를 `missing`인 나머지 작업으로 취급하세요.
- **남은 작업 없음**: 발견 사항을 0개로 만들고 7단계의 수렴 완료 분기를 따르세요.

### 5. 심각도 부여

- **CRITICAL**: 헌법 MUST 원칙 위반 또는 P1 사용자 스토리의 기본 기능을 막는 `missing`/`contradicts` 간극.
- **HIGH**: 핵심 기능 요구 사항 또는 수용 기준의 `missing`이나 `partial` 간극.
- **MEDIUM**: 부차적 요구 사항의 `partial` 간극 또는 정당성이 불분명한 `unrequested` 추가.
- **LOW**: 사소한 부분적 간극, 마무리 개선 또는 위험이 낮은 `unrequested` 추가.

### 6. 세션 내 발견 사항 요약 제시

무언가를 추가하기 전에 심각도로 등급을 매긴 간결한 요약을 출력하세요(아직 파일을 쓰지 않음):

## 수렴 발견 사항

| ID | 간극 유형 | 심각도 | 출처 | 증거 | 남은 작업 |
|----|----------|----------|--------|----------|----------------|
| F1 | missing | HIGH | FR-008 | 예: tasks.md를 쓸 때 path/to/module.py에서 추가 전용 방어가 탐지되지 않음 | 추가 전용 강제 적용 |

**요약 지표:**

- 검사한 요구 사항 / 수용 기준
- 검사한 계획 결정
- 검사한 헌법 원칙(또는 "건너뜀 — 템플릿")
- 간극 유형별 발견 사항(missing / partial / contradicts / unrequested)
- 심각도별 발견 사항

### 7. 수렴 작업 추가(또는 수렴 완료 보고)

**실행 가능한 발견 사항이 하나 이상 있으면**(`tasks_appended` 결과):

추가 계약에 따라 `tasks.md`의 **끝**에 추가하세요:

1. 모든 기존 작업 ID를 검색하고 최댓값을 `M`으로 삼으세요. 다음 단계 번호 `N`(기존 최대 단계 + 1)을 결정하세요.
2. 새 절 제목 `## Phase N: Convergence` 하나를 쓰세요.
3. 실행 가능한 발견 사항마다 체크리스트 항목 하나를 출력하세요. CRITICAL/HIGH를 먼저 배치하고 0으로 자릿수를 채운 ID `T{M+1:03d}, T{M+2:03d}, …`를 부여하세요:

   ```markdown
   - [ ] T042 <imperative description> per <source-ref> (<gap-type>)
   ```

   `<source-ref>`는 작업을 원래 출처에 연결합니다. 예: `FR-003`, `SC-002`, `US1/AC2`, `plan: storage decision`, `Constitution II`.

   `<gap-type>`은 `missing`, `partial`, `contradicts`, `unrequested` 중 하나입니다.

   헌법 위반 작업은 반드시 먼저 출력하고 `CRITICAL`로 설명해야 합니다.
4. 기존 ID를 재사용하거나 번호를 바꾸지 마세요. 이전 Convergence 단계가 있으면 그 아래에 별도 번호의 새 단계를 추가하고 이전 단계는 건드리지 마세요.

**실행 가능한 발견 사항이 없으면**(`converged` 결과):

- `tasks.md`를 전혀 수정하지 **마세요**. 빈 단계 제목도 만들지 마세요.
- 보고: **"✅ 수렴 완료 — 구현이 명세·계획·작업을 충족합니다."**
- 검사 대상의 요약 개수를 포함하세요.

### 8. 다음 행동 제공(인계)

- `tasks_appended`이면: 어떤 단계에 작업 몇 개를 추가했는지 알리고 `__SPECKIT_COMMAND_IMPLEMENT__`를 실행해 완료하도록 권하세요. 이후 converge 실행에서는 남은 항목이 줄거나 없어질 것이라고 설명하세요.
- `converged`이면: 검토 / PR 개설로 진행하도록 권하세요. 이 기능의 명시된 범위에 대해 implement를 다시 실행할 필요는 없습니다.

### 9. 확장 훅 확인

결과를 낸 뒤 프로젝트 루트에 `.specify/extensions.yml`이 있는지 확인하세요.

- 있으면 읽고 `hooks.after_converge` 키 아래의 항목을 찾으세요.
- YAML을 파싱할 수 없거나 유효하지 않으면 조용히 건너뛰지 마세요. `.specify/extensions.yml`을 읽지 못했다는 사실과 파서 오류를 사용자에게 알리고, 등록된 필수 훅(`optional: false`)을 포함해 어떤 훅도 확인하지 못했다고 설명한 뒤 정상적으로 계속하세요.
- `enabled`가 명시적으로 `false`인 훅은 제외하세요. `enabled` 필드가 없으면 기본적으로 활성화된 것으로 취급하세요.
- 남은 훅의 `condition` 표현식을 해석하거나 평가하려고 하지 **마세요**:
  - `condition` 필드가 없거나 null/빈 값이면 실행 가능한 훅으로 취급하세요.
  - 비어 있지 않은 `condition`이 있으면 훅을 건너뛰고 조건 평가는 HookExecutor 구현에 맡기세요.
- 훅을 나열하기 전에 세션에서 수렴 결과(`converged` 또는 `tasks_appended`)를 보고해 사용자가 선택적 후속 명령 실행 여부를 판단할 수 있게 하세요.
- 실행 가능한 각 훅에 대해 `optional` 플래그에 따라 다음을 출력하세요:
  - **선택 훅**(`optional: true`):

    ```text
    ## 확장 훅

    **선택적 훅**: {extension}
    명령: `/{command}`
    설명: {description}

    프롬프트: {prompt}
    실행 방법: `/{command}`
    ```

  - **필수 훅**(`optional: false`):

    ```text
    ## 확장 훅

    **자동 훅**: {extension}
    실행 중: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    위 블록을 출력한 뒤 계속하기 전에 훅을 실제로 호출하고 완료될 때까지 기다려야 합니다. 이 에이전트/세션에서 직접 명령을 실행할 때와 같은 방식으로 실행하세요. 실제 호출은 위의 문자 그대로인 `{command}` ID와 다를 수 있습니다. 예를 들어 skills 모드 에이전트는 `/skill:speckit-...` 또는 `$speckit-...`로 실행합니다. 블록 출력만으로 훅이 실행되지는 않습니다.

- 등록된 훅이 없거나 `.specify/extensions.yml`이 없으면 조용히 건너뛰세요.
