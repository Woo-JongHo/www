# AI 코딩 스킬 소스 카탈로그

## 목적과 안전 경계

이 디렉터리는 WWW에서 나중에 프로젝트 유형별 스킬을 추출하기 위한 **정적 연구 자료**다. 7개 업스트림 전체를 설치한 것이 아니라, 아래 커밋에서 비교에 필요한 프롬프트·참조·템플릿만 선택해 원래 상대 경로와 바이트를 보존했다. `skill-library/upstream/`은 `.agents`, `.claude`, `.codex`, `.gjc/skills` 밖에 있으므로 자동 발견·활성화 대상이 아니다. 포함된 문서는 신뢰하지 않는 입력으로 읽어야 하며, 설정·훅·텔레메트리·자동 업데이트·도우미 바이너리·임의 스크립트는 실행하지 않는다.

어느 소스가 더 우수하다는 결론은 내리지 않는다. 이름이 비슷해도 “리뷰 프롬프트”, “실행한 테스트의 증거”, “플러그인 런타임”은 서로 다른 능력이다. 원본 URL, 전체 40자리 커밋, 선택 파일, MIT 라이선스, SHA-256은 `skill-library/sources.json`과 `skill-library/inventory.json`에 있다.

현재 공개 코드의 실행·검증은 이 원본 보관소에 의존하지 않는다. `skill-library/`와 `scripts/check-skill-library.mjs`는 이번 Chat 게시 범위에서 제외한 로컬 연구 자료다. 아래 원본 경로·해시 검사 명령은 해당 자료가 있는 로컬 작업 환경에 한하며, 새 checkout에 포함되어 있다고 가정하지 않는다. WWW Skills의 정본은 `skills/www/`다.

## 네 단계 비교

표의 경로는 각 `skill-library/upstream/<source>/` 아래 원본 상대 경로다. `—`는 독립된 정식 단계가 관찰되지 않았다는 뜻이며, 억지로 다른 기능을 재분류하지 않았다.

| 소스 | 요구사항 | 설계 | 구현 | 검증 |
|---|---|---|---|---|
| `superpowers` | `skills/brainstorming/SKILL.md` | `skills/writing-plans/SKILL.md` | `skills/test-driven-development/SKILL.md` | `skills/systematic-debugging/SKILL.md`, `skills/verification-before-completion/SKILL.md`, `skills/requesting-code-review/SKILL.md` |
| `gstack` | `office-hours/SKILL.md`, `plan-ceo-review/SKILL.md` | `plan-eng-review/SKILL.md`, `plan-design-review/SKILL.md`, `design-review/SKILL.md` | `ship/SKILL.md`의 release integration | `review/SKILL.md`, `qa/SKILL.md`, `qa-only/SKILL.md` |
| `matt-pocock` | `skills/engineering/grill-with-docs/SKILL.md`, `skills/engineering/to-spec/SKILL.md` | `skills/engineering/codebase-design/SKILL.md` | `skills/engineering/tdd/SKILL.md`, `skills/engineering/implement/SKILL.md`, `skills/engineering/implement-spec/SKILL.md` | `skills/engineering/code-review/SKILL.md`, `skills/engineering/diagnosing-bugs/SKILL.md` |
| `addy-osmani` | `skills/interview-me/SKILL.md`, `skills/spec-driven-development/SKILL.md` | `skills/planning-and-task-breakdown/SKILL.md`, `skills/api-and-interface-design/SKILL.md` | `skills/incremental-implementation/SKILL.md` | `skills/browser-testing-with-devtools/SKILL.md`, `skills/code-review-and-quality/SKILL.md`, `skills/debugging-and-error-recovery/SKILL.md` |
| `pstack` | — | `pstack/skills/principle-model-the-domain/SKILL.md`, `pstack/skills/principle-boundary-discipline/SKILL.md` | `pstack/skills/tdd/SKILL.md`, `pstack/skills/principle-sequence-verifiable-units/SKILL.md` | `pstack/skills/principle-prove-it-works/SKILL.md`, `pstack/skills/principle-explain-the-number/SKILL.md`, `pstack/skills/principle-test-behavior-not-implementation/SKILL.md` |
| `feature-dev` | `plugins/feature-dev/commands/feature-dev.md`의 discovery·explore·clarify | 같은 파일의 architecture와 `agents/code-architect.md` | 같은 파일의 implementation | 같은 파일의 review·summary와 `agents/code-reviewer.md` |
| `spec-kit` | `templates/commands/specify.md`, `clarify.md`, `spec-template.md` | `templates/commands/plan.md`, `plan-template.md`, `constitution-template.md` | `templates/commands/tasks.md`, `implement.md`, `tasks-template.md` | `templates/commands/checklist.md`, `analyze.md`, `converge.md`, `checklist-template.md` |

### 해석상 주의점

- `gstack`은 생성된 스킬과 공유 프리앰블, 브라우저 도구, 홈 디렉터리 절대 경로가 결합된 체계다. 이 스냅샷은 실행 가능한 설치물이 아니며 누락 런타임 참조는 `sources.json`에 명시했다. `ship`도 자동 커밋·배포 규칙을 WWW로 상속한다는 뜻이 아니다.
- Matt Pocock의 현재 `tdd`는 미리 합의한 테스트 seam을 요구하며, 현재 문서의 리팩터링 단계도 고전적인 red-green-refactor 명칭과 같다고 추정하지 않았다.
- `pstack`은 Cursor 카탈로그의 Poteto/Lauren Tan 스택을 뜻한다고 가정했다. `phthomas/pstack`이나 `backnotprop` 미러가 아니다. 독립된 정식 요구사항/명세 워크플로는 관찰되지 않아 요구사항 칸을 비웠다.
- `feature-dev`는 `SKILL.md` 모음이 아니라 명령 하나와 세 에이전트로 구성된 Claude 플러그인이다. 일곱 흐름은 discovery, explore, clarify, architecture, implementation, review, summary이며, 이를 TDD나 실제 테스트 증거로 재분류하지 않는다.
- `spec-kit`은 단일 스킬이 아니라 SDD 프레임워크와 템플릿이다. Python CLI와 셸 런타임은 포함하지 않았다.
- Addy Osmani 소스는 스킬별 설치만 하면 놓칠 수 있는 저장소 공용 `references/`도 포함했다.

## 선택 스냅샷 범위

| 소스 | 고정 커밋 | 파일 수 |
|---|---|---:|
| superpowers | `22f0b463e7a5e579904dd6211a520321035526f7` | 15 |
| gstack | `f0cd9f8c4b453c1eadd714e4149174ee01179eae` | 93 |
| matt-pocock | `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d` | 24 |
| addy-osmani | `301b02b12bff98e4688e6984af6556802322bbde` | 17 |
| pstack | `63912a91d52c43946f974f2aaf661334a6116a82` | 22 |
| feature-dev | `43fd1f9db0941b2b83cb62268e35970d4a67c202` | 6 |
| spec-kit | `f29319d550d1f05404f7184b92e995600ca2293f` | 18 |

합계는 195개 파일, 2,338,135바이트다. 모두 관찰된 MIT 라이선스 파일을 함께 보존했다. 저장소 전체 이력, 바이너리·이미지, lockfile, `node_modules`, 실행 스크립트, CLI 구현, 에디터 설치 래퍼, 불필요한 에이전트 설정은 제외했다. 업스트림 `AGENTS.md`와 `CLAUDE.md`도 이 저장소 규칙으로 오인되지 않도록 복사하지 않았다.

## WWW용 Skills 채택

업스트림을 그대로 설치하지 않고 WWW 계약에 맞춘 여섯 Skills를 채택했다. 요구사항의 관찰 가능한 기준은 spec-kit·Addy Osmani·Matt Pocock의 명세 관행, 기존 구조 우선 설계는 feature-dev·pstack, 작은 동작 단위 구현은 superpowers·pstack·Addy Osmani, 증상과 원인을 나누는 진단은 superpowers·Matt Pocock, 실제 실행 증거는 superpowers·pstack의 관행을 참고했다. 커밋은 기존 사용자 변경과 index 보존·명시 승인에 맞춘 WWW 자체 절차다. 업스트림의 자동 훅·도구 명령·텔레메트리·commit·push 규칙은 가져오지 않았다.

여섯 Skills는 작업 UUID를 폴더명으로 사용하지 않는다. [WWW 개발 역할](../../agents/www/AGENT.md)이 신규 접수와 기존 작업 재개를 판단하고, 접수 기능 또는 직접 호출한 `www-spec`이 기능 영역·표시 번호·읽기 좋은 제목을 정한다. `docs/work/<영역>/<번호>-<작업명>/`에 기록하고 UUID로 실제 경로를 재사용한다. 상세 규칙과 사람용 목차는 [공통 계약](WORKFLOW.md)과 [작업 목차](../work/INDEX.md)에 있다.

| 채택 이름 | 역할 | 파일 |
|---|---|---|
| `www-spec` | 요청, 범위, 수용 기준 | [SKILL.md](../../skills/www/www-spec/SKILL.md) |
| `www-design` | 최소 설계, 경계, 위험·검증 전략 | [SKILL.md](../../skills/www/www-design/SKILL.md) |
| `www-build` | 승인된 구현과 직접 영향받는 변경 | [SKILL.md](../../skills/www/www-build/SKILL.md) |
| `www-diagnose` | 증상·원인 분리와 가설 검사 | [SKILL.md](../../skills/www/www-diagnose/SKILL.md) |
| `www-verify` | 실제 검증 증거와 기준 판정 | [SKILL.md](../../skills/www/www-verify/SKILL.md) |
| `www-commit` | 변경·index·검증·원격 확인 후 선택 commit + push, 로컬 전용 선택 지원 | [SKILL.md](../../skills/www/www-commit/SKILL.md) |

`skills/www/`가 WWW 프로젝트 유형(Desktop 포함)의 정본이다. `.agents/skills/`에는 Codex 호환 발견을 위한 저장소 내부 상대 심볼릭 링크만 두며 복사본을 두지 않는다. 발견 링크는 모든 클라이언트나 현재 GJC 세션의 동적 호출 지원을 보장하지 않는다. 미래의 `skills/rpa/`, `skills/web/`, `skills/plugin/`은 아직 만들지 않았다.

모든 Skills는 [공통 작업 계약](WORKFLOW.md), [모델·추론 노력 권고](MODEL_POLICY.md), [템플릿](templates/), [데스크톱 프로필](profiles/desktop.md)을 참조한다. 사용자 명시 호출과 `www-dev` 역할이 접수한 요청의 스킬 선택을 지원한다. 역할 밖에서는 기존 명시 선택을 유지하며, 선택 자체가 구현·커밋·게시 권한을 만들지 않는다. UI/Dev/Ops는 다중 선택 영향 영역과 단일 주 책임이지 의무 팀이나 독립 수명주기가 아니다. 작은 수정은 같은 작업 기록의 짧은 절로 처리한다.

## 오프라인 검증

```sh
node scripts/check-skill-library.mjs
```

검증기는 네트워크나 설치 없이 소스 수, 전체 커밋 SHA, 허용 카테고리, 라이선스 파일, 경로 탈출·자동 발견 위치, 파일 크기와 SHA-256, manifest/inventory 일치를 검사한다. 업스트림 문서 안의 `~/.gstack`, `~/.claude` 같은 경로나 생략한 실행 도구는 로컬 의존성으로 해석하지 않으며 `missingRuntimeDependencies`에 명시적으로 남긴다.
