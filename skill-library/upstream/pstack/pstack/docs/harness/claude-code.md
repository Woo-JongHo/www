> 한국어 번역본: 고정 커밋 `63912a91d52c43946f974f2aaf661334a6116a82`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# Claude Code에서의 pstack

pstack 스킬은 Cursor 이름을 사용합니다. Claude Code에서는 세션마다 이 파일을 한 번 읽은 다음, 아래 표를 사용해 스킬 안의 각 Cursor 이름을 대응시키세요. `<pstack>`은 `skills/`와 `docs/`가 들어 있는 폴더를 뜻합니다. Cursor 필드에 해당하는 행이 없으면 그 필드를 제외하고 그렇게 했다고 밝히세요. 도구 스키마가 거부하는 필드나 값은 절대 전달하지 마세요.

## 도구

| Cursor | Claude Code |
| --- | --- |
| `Task` | `Agent` |
| `AskQuestion` | `AskUserQuestion`. `-p` 모드에는 없으므로 일반 텍스트로 질문합니다. |
| 할 일 목록 열기 | 세션에서 제공한다면 `TodoWrite`를 사용합니다. 그렇지 않으면 답변에 목록을 유지하고 각 단계에서 갱신합니다. |
| 다른 pstack 스킬 실행(`/name` 또는 "**name** 스킬") | `<pstack>/skills/<name>/SKILL.md`를 `Read`하고 따릅니다. `Skill` 도구는 대부분의 pstack 스킬을 거부합니다. 사용자에게 입력하라고 안내할 때는 `/pstack:<name>`이라고 씁니다. |
| `Grep`, `Glob` | 세션에 `Grep`이나 `Glob`이 없으면 `rg`와 함께 `Bash`를 사용합니다. |

## 하위 에이전트 필드

| Cursor | Claude Code |
| --- | --- |
| `subagent_type: generalPurpose` | `subagent_type: "general-purpose"` |
| `poteto-agent`, `comment-sicko` | `pstack:poteto-agent`, `pstack:comment-sicko` |
| `readonly: true` | `subagent_type: "Explore"`. `Bash`는 유지되므로 브리프에도 "파일을 수정하지 마세요"라고 쓰고, 나중에 `git status`를 확인합니다. |
| `readonly: false` | `general-purpose`. 세션의 MCP 서버를 유지합니다. |
| `environment: "cloud"` | `isolation: "worktree"`. 작업자가 체크아웃할 브랜치나 커밋을 명시합니다. |
| `environment: "local"` | 생략합니다. |
| `cloud_base_branch: <b>` | 작업자에게 먼저 `<b>`를 체크아웃하라고 지시합니다. |
| `run_in_background: true` | 생략합니다. 하위 에이전트는 기본적으로 백그라운드에서 실행되며 완료되면 알립니다. |
| `resume` | 새 에이전트를 생성하고 이전 결과를 브리프에 붙여 넣습니다. |
| `file_attachments` | 브리프에 경로를 나열합니다. |

## 모델

| Cursor | Claude Code |
| --- | --- |
| `claude-<family>-<version>-<effort>[-fast]`, 예: `claude-opus-5-5-xhigh` | `model: "opus"`와 `effort: "xhigh"`. `model`은 `opus`, `sonnet`, `haiku`, `fable`만 받습니다. `-fast`는 제외합니다. |
| `grok-*`, `gpt-*` 또는 기타 Claude가 아닌 슬러그 | 에이전트가 세션 모델에서 실행되도록 `model`을 생략하고, 그렇게 했다고 밝힙니다. |
| `auto` 또는 `inherit-parent` | `model`을 생략합니다. |
| `pstack-models.mdc` 규칙, `~/.cursor/rules/pstack-models.mdc` | `~/.claude/rules/pstack-models.md`. Claude Code는 모든 새 세션에 이 파일을 로드하므로 역할 행이 이미 컨텍스트에 있습니다. 없다면 파일을 읽습니다. 파일이나 역할 행이 없으면 스킬의 기본 슬러그를 사용합니다. |
| 역할 값 `<model> <effort>`, 예: `opus high` | `model: "opus"`와 `effort: "high"`. |

## setup-pstack

Claude Code는 `~/.claude/rules/`의 모든 `.md` 파일을 각 새 세션에 로드하므로 `setup-pstack`은 그곳에 규칙을 작성합니다. 다음 변경 사항을 적용해 해당 단계를 따르세요.

- 감지. 감지된 모델은 `Agent` 도구 스키마가 나열하는 `model` 값이며, 각각의 노력 수준은 해당 `effort` 값에서 가져옵니다. 실제 모델은 `opus xhigh`처럼 `<model> <effort>`로 작성합니다. 노력 수준이 마지막 토큰이므로 예산 단계는 작성된 그대로 작동합니다.
- 기본값. 위 행을 사용해 각 기본 슬러그를 대응시킵니다. `claude-opus-5-5-xhigh`는 `opus xhigh`이고, `grok-4.7-xhigh-fast`는 `inherit-parent`입니다.
- 작성. frontmatter 없이 `~/.claude/rules/pstack-models.md`를 작성한 다음, 주석 행, `# budget` 행, 5단계의 역할별 한 행을 작성합니다. 파일 전체를 덮어씁니다. 역할 행을 `CLAUDE.md`나 `AGENTS.md`에 넣지 마세요.

## 경로

| Cursor | Claude Code |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.claude/skills/`, `~/.claude/skills/` |
| `~/.cursor/plugins/`, `.cursor-plugin/plugin.json` | `~/.claude/plugins/`, `.claude-plugin/plugin.json` |
| `.cursor/rules/*.mdc`, 항상 적용되는 규칙 | `CLAUDE.md`, 또는 `CLAUDE.md`가 없을 때 `AGENTS.md`. Claude Code는 `.mdc` 파일을 읽지 않습니다. 모델 규칙은 예외입니다. 모델을 참조하세요. |
| `https://github.com/cursor/plugins/blob/main/pstack/<path>` | 해당 파일이 존재할 때 `<pstack>/<path>`. 플러그인에는 스킬, `docs/guide/`, `README.md`가 포함됩니다. 로컬 사본을 읽고 절대 가져오지 마세요. 사용자에게 링크가 필요할 때 URL을 제공하세요. |
| `~/.cursor/projects/<slug>/agent-transcripts/`의 대화 기록 | `~/.claude/projects/<slug>/<session>.jsonl`. 슬러그는 작업 공간 경로의 각 `/`와 `.`을 `-`로 바꾼 것이므로 `/Users/you/proj`는 `-Users-you-proj`가 됩니다. 해당 폴더 바로 아래의 가장 최신 `.jsonl`이 현재 세션입니다. 그 `<session>/subagents/` 폴더에는 하위 에이전트 대화 기록이 있습니다. 이 작업 공간의 폴더만 읽으세요. |

## Cursor 전용 기능

Claude Code에는 Cursor Automations, Bugbot, Cursor cloud agents 또는 내장 PR 도구가 없습니다. 단계에서 이 중 하나가 필요하면 답변에 `Skipped in Claude Code: <step>. <reason>.` 한 줄을 넣고 다음 단계로 진행하세요. 중단하거나 질문하거나 재시도하지 마세요. 이후 단계에서 URL이나 키처럼 건너뛴 단계가 생성하는 것이 필요하면 자리 표시자를 남기고 해당 줄에 그 이름을 적으세요.

| Cursor | Claude Code |
| --- | --- |
| Cursor Automations: 루틴, `update_state` 루틴 호출, `api2.cursor.sh/automations` 웹훅, 루틴 깨우기, `SendToUser` 비밀 요청 | 해당 줄을 쓰고 건너뜁니다. |
| Bugbot | GitHub PR의 Bugbot 코멘트는 일반 검토 스레드이므로 단계에서 제공하는 forge 명령으로 분류합니다. PR에 Bugbot 검사나 코멘트가 없을 때 Bugbot을 시작하거나 기다리거나 구성하는 단계는 건너뜁니다. |
| Cursor cloud agents | 하위 에이전트 필드에서처럼 `environment: "cloud"`는 worktree에 대응합니다. 대시보드 상태나 자체 머신처럼 cloud agent 자체가 필요한 단계는 건너뜁니다. |
| 내장 PR 도구 | `gh pr create`처럼 단계에서 제공하는 forge 명령을 사용합니다. 이는 건너뛰기가 아니므로 해당 줄을 쓰지 않습니다. |
