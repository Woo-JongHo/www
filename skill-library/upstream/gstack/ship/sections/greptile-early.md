> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- greptile-early.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
<a id="step-65-early-greptile-pr-after-the-free-tests-pass"></a>
## 6.5단계: 초기 Greptile PR(무료 테스트 통과 후)

저장소가 Greptile을 사용하고(`greptile`이 검토 봇 목록에 있고) 있다면 지금 푸시하고 PR을 열어 7~9단계가 실행되는 동안 Greptile이 검토하게 합니다. 10단계에서 그 의견을 수집합니다.

```bash
~/.claude/skills/gstack/bin/gstack-greptile-early detect
```

- **`GREPTILE_EARLY: off`** — 이유(및 다시 켜는 방법을 적은 줄이 있으면 그 줄)를 출력하고 7단계로 계속합니다.
- **`GREPTILE_EARLY: ask`**(공개 저장소이거나 공개 여부를 알 수 없는 경우의 최초 실행) — AskUserQuestion:
  > 이 저장소는 공개되어 있습니다. 초기 Greptile 검토는 /ship 자체 검토 전에 이 브랜치를 푸시하고 초안 PR을 열므로, 해당 검토가 끝나기 전에 코드가 공개됩니다. 나중에 /ship이 중단되면 중단 이유를 설명하는 댓글과 함께 초안이 계속 공개된 상태로 남습니다.

  A) 이 저장소에서는 일찍 푸시(기억됨) · B) 이 저장소에서는 오늘의 순서 유지(기억됨).
  A는 `~/.claude/skills/gstack/bin/gstack-greptile-early consent yes`, B는 `consent no`를 실행합니다.
  B는 7단계로 계속합니다. 어느 답도 5단계의 동의 불필요 CI-carry 푸시와 초안 PR을 되돌리지 않습니다.
- **`GREPTILE_EARLY: on`** 또는 A 이후 — 출력된 `Greptile: found …` 줄을 사용자에게 보여 준 다음 1~3을 따릅니다.

**1.** 푸시: `git push -u origin <branch-name>`. 실패하면 "Greptile early review: not run (push failed)"를 기록하고 7단계로 계속합니다. 17단계에서 나중에 푸시합니다.

**2.** 임시 `<type>: <summary>` 제목(18단계에서 대체됨)을 비공개 파일에 작성합니다:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
TITLE_FILE=$(mktemp "${_GT:?}/early-title.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "TITLE_FILE: $TITLE_FILE (name: ${TITLE_FILE##*/})"
```

출력된 각 파일에 나타나야 하는 그대로의 텍스트를 파일 쓰기 도구로 작성합니다(Claude Code의 Write 도구는 빈 파일도 먼저 Read해야 합니다). 텍스트를 셸 명령, heredoc 또는 따옴표로 묶은 인수에 절대 넣지 않습니다. 쓰기가 실패하거나 거부되면 보내지 말고, 원인과 파일 경로 및 수동으로 보낼 아래 명령을 출력합니다.

**3.** 출력된 이름으로 초안을 엽니다. 사용자가 초안이 아닌 PR을 요청한 경우에만 `--ready`를 추가합니다:

```bash
TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
~/.claude/skills/gstack/bin/gstack-greptile-early open --base <base> --title-file "$TITLE_FILE"
```

이 명령은 `gstack-post`를 통해 PR을 열고(본문: /ship이 일찍 열었음), Greptile이 초안을 건너뛰는 경우 `@greptileai` 댓글 하나를 게시합니다. 출력된 `EARLY_PR`과 `EARLY_PR_OPENED_AT`을 호출 기록에 저장합니다. `EARLY_PR: none`은 PR이 이미 열려 있다는 뜻이며(5단계의 초안도 포함), 10단계에서 이를 분류합니다. 종료 코드 1 또는 2는 `gstack-post`가 임시 제목에 문제가 있다고 표시했다는 뜻입니다. 더 평이한 제목을 작성하고 다시 실행합니다. 종료 코드 3이면 오류를 기록하고 초기 검토 없이 계속합니다.

**초기 PR을 연 뒤 19단계 게시 전에 /ship이 중단되면**, 초안을 열린 상태로 두고(절대 닫거나 강제 푸시하지 않음) /ship이 중단되었다는 내용과 그 이유를 담은 댓글 하나를 게시합니다. 이유를 비공개 파일에 작성한 다음 `~/.claude/skills/gstack/bin/gstack-post pr-comment <pr-number> --body-file <that file>`을 실행합니다.

---
