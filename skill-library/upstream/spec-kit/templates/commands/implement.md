---
description: tasks.md에 정의된 모든 작업을 처리하고 실행하여 구현 계획을 수행합니다.
scripts:
  sh: scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
  ps: scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
  py: scripts/python/check_prerequisites.py --json --require-tasks --include-tasks
---

> 한국어 번역본: 고정 커밋 `f29319d550d1f05404f7184b92e995600ca2293f`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.


## 사용자 입력

```text
$ARGUMENTS
```

진행하기 전에 사용자 입력이 비어 있지 않다면 **반드시** 고려해야 합니다.

## 실행 전 검사

**확장 훅 확인(구현 전에)**:
- 프로젝트 루트에 `.specify/extensions.yml`이 있는지 확인합니다.
- 있다면 파일을 읽고 `hooks.before_implement` 키 아래의 항목을 찾습니다.
- YAML을 파싱할 수 없거나 유효하지 않다면 조용히 건너뛰지 마십시오. 사용자에게 `.specify/extensions.yml`을 읽을 수 없었다고 알리고(파서 오류 포함), 그곳에 등록된 필수(`optional: false`) 훅을 포함해 어떤 훅도 확인되지 않았다고 알린 다음 정상적으로 계속합니다.
- `enabled`가 명시적으로 `false`인 훅을 제외합니다. `enabled` 필드가 없는 훅은 기본적으로 활성화된 것으로 처리합니다.
- 남은 각 훅의 `condition` 표현식을 해석하거나 평가하려고 **시도하지 마십시오**.
  - 훅에 `condition` 필드가 없거나 null/빈 값이면 실행 가능한 것으로 처리합니다.
  - 훅에 비어 있지 않은 `condition`이 정의되어 있으면 훅을 건너뛰고 조건 평가는 HookExecutor 구현에 맡깁니다.
- 실행 가능한 각 훅에 대해 `optional` 플래그에 따라 다음을 출력합니다.
  - **선택적 훅** (`optional: true`):
    ```
    ## 확장 훅

    **선택적 사전 훅**: {extension}
    명령: `/{command}`
    설명: {description}

    프롬프트: {prompt}
    실행 방법: `/{command}`
    ```
  - **필수 훅** (`optional: false`):
    ```
    ## 확장 훅

    **자동 사전 훅**: {extension}
    실행 중: `/{command}`
    EXECUTE_COMMAND: {command}

    개요로 진행하기 전에 훅 명령의 결과를 기다리십시오.
    ```
    위 블록을 출력한 뒤 계속하기 전에 훅을 실제로 호출하고 완료될 때까지 **반드시** 기다려야 합니다. 이 에이전트/세션에서 직접 명령을 실행할 때와 같은 방식으로 실행하십시오(호출 방식은 위에 표시된 리터럴 `{command}` ID와 다를 수 있습니다. 예를 들어 스킬 모드 에이전트는 `/skill:speckit-...` 또는 `$speckit-...`로 실행합니다). 블록만 출력해서는 훅이 실행되지 않습니다.
- 등록된 훅이 없거나 `.specify/extensions.yml`이 존재하지 않으면 조용히 건너뜁니다.

## 개요

1. 저장소 루트에서 `{SCRIPT}`를 실행하고 FEATURE_DIR 및 AVAILABLE_DOCS 목록을 파싱합니다. 모든 경로는 절대 경로여야 합니다. "I'm Groot"처럼 인수에 작은따옴표가 있으면 이스케이프 구문을 사용합니다. 예: 'I'\''m Groot' (가능하면 큰따옴표 사용: "I'm Groot").

2. **체크리스트 상태 확인**(FEATURE_DIR/checklists/가 있는 경우):
   - 체크리스트 표시를 읽기 전용 게이트로 취급합니다. 체크박스 상태를 스캔하고 상태를 보고하며 필요할 때 진행 전에 질문합니다. 체크리스트 파일이나 표시를 수정하지 **마십시오**.
   - `checklists/requirements.md`는 `__SPECKIT_COMMAND_SPECIFY__`와 `__SPECKIT_COMMAND_CLARIFY__`가 유지하는 내장 명세 품질 체크리스트입니다. `__SPECKIT_COMMAND_CHECKLIST__`가 생성한 사용자 정의 체크리스트는 검토자가 소유하는 요구사항 품질 검토 산출물입니다.
   - 사용자 정의 체크리스트에서 `[x]`는 검토자가 요구사항 품질 기준이 충족되었다고 판단했다는 뜻이며, 구현 작업이 완료되었다는 뜻이 **아닙니다**.
   - checklists/ 디렉터리의 모든 체크리스트 파일을 스캔합니다.
   - 각 체크리스트에서 다음을 셉니다.
     - 전체 항목: `- [ ]`, `- [X]`, `- [x]`와 일치하는 모든 줄
     - 선택된 항목: `- [X]` 또는 `- [x]`와 일치하는 줄
     - 선택되지 않은 항목: `- [ ]`와 일치하는 줄
   - 상태 표를 만듭니다.

     ```text
     | 체크리스트 | 전체 | 선택됨 | 선택 안 됨 | 상태 |
     |-----------|-------|---------|-----------|--------|
     | ux.md     | 12    | 12      | 0         | ✓ 통과 |
     | test.md   | 8     | 5       | 3         | ✗ 실패 |
     | security.md | 6   | 6       | 0         | ✓ 통과 |
     ```

   - 전체 상태를 계산합니다.
     - **통과**: 모든 체크리스트의 선택되지 않은 항목이 0개
     - **실패**: 하나 이상의 체크리스트에 선택되지 않은 항목이 있음

   - **체크리스트에 선택되지 않은 항목이 하나라도 있는 경우**:
     - 선택되지 않은 항목 수가 있는 표를 표시합니다.
     - **중지**하고 다음과 같이 묻습니다. "일부 체크리스트에 선택되지 않은 항목이 있습니다. 그래도 구현을 진행하시겠습니까? (yes/no)"
     - 계속하기 전에 사용자 응답을 기다립니다.
     - 사용자가 "no", "wait", "stop"이라고 답하면 실행을 중단합니다.
     - 사용자가 "yes", "proceed", "continue"라고 답하면 3단계로 진행합니다.

   - **모든 체크리스트가 선택된 경우**:
     - 모든 체크리스트가 통과되었음을 보여 주는 표를 표시합니다.
     - 자동으로 3단계로 진행합니다.

3. 구현 맥락을 로드하고 분석합니다.
   - **필수**: 전체 작업 목록과 실행 계획을 위해 tasks.md를 읽습니다.
   - **필수**: 기술 스택, 아키텍처, 파일 구조를 위해 plan.md를 읽습니다.
   - **존재하는 경우**: 엔터티와 관계를 위해 data-model.md를 읽습니다.
   - **존재하는 경우**: API 명세와 테스트 요구사항을 위해 contracts/를 읽습니다.
   - **존재하는 경우**: 기술 결정과 제약을 위해 research.md를 읽습니다.
   - **존재하는 경우**: 거버넌스 제약을 위해 /memory/constitution.md를 읽습니다.
   - **존재하는 경우**: 통합 시나리오를 위해 quickstart.md를 읽습니다.

4. **프로젝트 설정 검증**:
   - **필수**: 실제 프로젝트 설정을 바탕으로 ignore 파일을 생성/검증합니다.

   **감지 및 생성 로직**:
   - 저장소가 git 저장소인지 확인하려면 다음 명령의 성공 여부를 확인합니다(그렇다면 .gitignore를 생성/검증).

     ```sh
     git rev-parse --git-dir 2>/dev/null
     ```

   - Dockerfile*이 있거나 plan.md에 Docker가 있음 → .dockerignore 생성/검증
   - .eslintrc*가 있음 → .eslintignore 생성/검증
   - eslint.config.*가 있음 → 설정의 `ignores` 항목이 필수 패턴을 포함하는지 확인
   - .prettierrc*가 있음 → .prettierignore 생성/검증
   - .npmrc 또는 package.json이 있음 → .npmignore 생성/검증(게시하는 경우)
   - terraform 파일(*.tf)이 있음 → .terraformignore 생성/검증
   - .helmignore가 필요함(helm 차트가 있음) → .helmignore 생성/검증

   **ignore 파일이 이미 있는 경우**: 필수 패턴이 포함되어 있는지 확인하고 누락된 중요 패턴만 추가합니다.
   **ignore 파일이 없는 경우**: 감지된 기술의 전체 패턴 세트로 생성합니다.

   **기술별 공통 패턴**(plan.md 기술 스택 기준):
   - **Node.js/JavaScript/TypeScript**: `node_modules/`, `dist/`, `build/`, `*.log`, `.env*`
   - **Python**: `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`
   - **Java**: `target/`, `*.class`, `*.jar`, `.gradle/`, `build/`
   - **C#/.NET**: `bin/`, `obj/`, `*.user`, `*.suo`, `packages/`
   - **Go**: `*.exe`, `*.test`, `vendor/`, `*.out`
   - **Ruby**: `.bundle/`, `log/`, `tmp/`, `*.gem`, `vendor/bundle/`
   - **PHP**: `vendor/`, `*.log`, `*.cache`, `*.env`
   - **Rust**: `target/`, `debug/`, `release/`, `*.rs.bk`, `*.rlib`, `*.prof*`, `.idea/`, `*.log`, `.env*`
   - **Kotlin**: `build/`, `out/`, `.gradle/`, `.idea/`, `*.class`, `*.jar`, `*.iml`, `*.log`, `.env*`
   - **C++**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.so`, `*.a`, `*.exe`, `*.dll`, `.idea/`, `*.log`, `.env*`
   - **C**: `build/`, `bin/`, `obj/`, `out/`, `*.o`, `*.a`, `*.so`, `*.exe`, `*.dll`, `autom4te.cache/`, `config.status`, `config.log`, `.idea/`, `*.log`, `.env*`
   - **Swift**: `.build/`, `DerivedData/`, `*.swiftpm/`, `Packages/`
   - **R**: `.Rproj.user/`, `.Rhistory`, `.RData`, `.Ruserdata`, `*.Rproj`, `packrat/`, `renv/`
   - **범용**: `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`

   **도구별 패턴**:
   - **Docker**: `node_modules/`, `.git/`, `Dockerfile*`, `.dockerignore`, `*.log*`, `.env*`, `coverage/`
   - **ESLint**: `node_modules/`, `dist/`, `build/`, `coverage/`, `*.min.js`
   - **Prettier**: `node_modules/`, `dist/`, `build/`, `coverage/`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`
   - **Terraform**: `.terraform/`, `*.tfstate*`, `*.tfvars`, `.terraform.lock.hcl`
   - **Kubernetes/k8s**: `*.secret.yaml`, `secrets/`, `.kube/`, `kubeconfig*`, `*.key`, `*.crt`

5. tasks.md 구조를 파싱하고 다음을 추출합니다.
   - **작업 단계**: 설정, 테스트, 핵심, 통합, 다듬기
   - **작업 의존성**: 순차 실행과 병렬 실행 규칙
   - **작업 세부 정보**: ID, 설명, 파일 경로, 병렬 표시 [P]
   - **실행 흐름**: 순서와 의존성 요구사항

6. 작업 계획에 따라 구현을 실행합니다.
   - **단계별 실행**: 다음 단계로 이동하기 전에 각 단계를 완료합니다.
   - **의존성 준수**: 순차 작업은 순서대로 실행하고 병렬 작업 [P]는 함께 실행할 수 있습니다.
   - **TDD 접근 방식 준수**: 해당 구현 작업보다 먼저 테스트 작업을 실행합니다.
   - **파일 기반 조정**: 같은 파일에 영향을 미치는 작업은 순차적으로 실행해야 합니다.
   - **검증 체크포인트**: 진행하기 전에 각 단계의 완료를 검증합니다.

7. 구현 실행 규칙:
   - **설정 우선**: 프로젝트 구조, 의존성, 구성을 초기화합니다.
   - **코드보다 테스트 우선**: 계약, 엔터티, 통합 시나리오의 테스트를 작성해야 하는 경우
   - **핵심 개발**: 모델, 서비스, CLI 명령, 엔드포인트를 구현합니다.
   - **통합 작업**: 데이터베이스 연결, 미들웨어, 로깅, 외부 서비스
   - **다듬기 및 검증**: 단위 테스트, 성능 최적화, 문서화

8. 진행 상황 추적 및 오류 처리:
   - 완료된 각 작업 후 진행 상황을 보고합니다.
   - 병렬이 아닌 작업이 실패하면 실행을 중단합니다.
   - 병렬 작업 [P]에서는 성공한 작업을 계속하고 실패한 작업을 보고합니다.
   - 디버깅을 위한 맥락과 함께 명확한 오류 메시지를 제공합니다.
   - 구현을 진행할 수 없다면 다음 단계를 제안합니다.
   - **중요** 완료된 작업은 tasks 파일에서 반드시 [X]로 표시합니다.

9. 완료 검증:
   - 모든 필수 작업이 완료되었는지 확인합니다.
   - 구현된 기능이 원래 명세와 일치하는지 확인합니다.
   - 테스트가 통과하고 커버리지가 요구사항을 충족하는지 검증합니다.
   - 구현이 기술 계획을 따르는지 확인합니다.

참고: 이 명령은 tasks.md에 완전한 작업 분해가 있다고 가정합니다. 작업이 불완전하거나 없으면 먼저 `__SPECKIT_COMMAND_TASKS__`를 실행하여 작업 목록을 다시 생성하도록 제안합니다.

## 필수 실행 후 훅

**사용자에게 완료를 보고하기 전에 이 섹션을 반드시 완료해야 합니다.**

프로젝트 루트에 `.specify/extensions.yml`이 있는지 확인합니다.
- 파일이 없거나 `hooks.after_implement` 아래에 등록된 훅이 없으면 완료 보고로 건너뜁니다.
- 있다면 파일을 읽고 `hooks.after_implement` 키 아래의 항목을 찾습니다.
- YAML을 파싱할 수 없거나 유효하지 않다면 조용히 건너뛰지 마십시오. 사용자에게 `.specify/extensions.yml`을 읽을 수 없었다고 알리고(파서 오류 포함), 그곳에 등록된 필수(`optional: false`) 훅을 포함해 어떤 훅도 확인되지 않았다고 알린 다음 완료 보고로 계속합니다.
- `enabled`가 명시적으로 `false`인 훅을 제외합니다. `enabled` 필드가 없는 훅은 기본적으로 활성화된 것으로 처리합니다.
- 남은 각 훅의 `condition` 표현식을 해석하거나 평가하려고 **시도하지 마십시오**.
  - 훅에 `condition` 필드가 없거나 null/빈 값이면 실행 가능한 것으로 처리합니다.
  - 훅에 비어 있지 않은 `condition`이 정의되어 있으면 훅을 건너뛰고 조건 평가는 HookExecutor 구현에 맡깁니다.
- 실행 가능한 각 훅에 대해 `optional` 플래그에 따라 다음을 출력합니다.
  - **필수 훅** (`optional: false`) — 각 필수 훅에 대해 **반드시 `EXECUTE_COMMAND:`를 출력해야 합니다**:
    ```
    ## 확장 훅

    **자동 훅**: {extension}
    실행 중: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    위 블록을 출력한 뒤 계속하기 전에 훅을 실제로 호출하고 완료될 때까지 **반드시** 기다려야 합니다. 이 에이전트/세션에서 직접 명령을 실행할 때와 같은 방식으로 실행하십시오(호출 방식은 위에 표시된 리터럴 `{command}` ID와 다를 수 있습니다. 예를 들어 스킬 모드 에이전트는 `/skill:speckit-...` 또는 `$speckit-...`로 실행합니다). 블록만 출력해서는 훅이 실행되지 않습니다.
  - **선택적 훅** (`optional: true`):
    ```
    ## 확장 훅

    **선택적 훅**: {extension}
    명령: `/{command}`
    설명: {description}

    프롬프트: {prompt}
    실행 방법: `/{command}`
    ```

## 완료 보고

완료된 작업 요약과 함께 최종 상태를 보고합니다.

## 완료 조건

- [ ] tasks.md의 모든 작업이 완료되고 `[X]`로 표시됨
- [ ] 구현이 명세, 계획, 테스트 커버리지를 기준으로 검증됨
- [ ] 위 필수 실행 후 훅의 규칙에 따라 확장 훅이 전달되거나 건너뛰어짐
- [ ] 완료된 작업 요약과 함께 완료가 사용자에게 보고됨
