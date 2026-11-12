> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# TODOS.md 형식 참조

정식 TODOS.md 형식의 공통 참조 문서입니다. 일관된 TODO 항목 구조를 보장하기 위해 `/ship`(14단계)과 `/plan-ceo-review`(TODOS.md 업데이트 절)에서 참조합니다.

---

## 파일 구조

```markdown
# TODOS

## <스킬/컴포넌트>     ← 예: ## Browse, ## Ship, ## Review, ## Infrastructure
<P0을 먼저 두고 P1, P2, P3, P4 순으로 정렬한 항목>

## Completed
<완료 주석이 있는 완료 항목>
```

**절:** 스킬 또는 컴포넌트별로 구성합니다(`## Browse`, `## Ship`, `## Review`, `## QA`, `## Retro`, `## Infrastructure`). 각 절 안에서는 항목을 우선순위별로 정렬합니다(P0이 맨 위).

---

## TODO 항목 형식

각 항목은 해당 절 아래의 H3입니다.

```markdown
### <제목>

**What:** 작업을 한 줄로 설명합니다.

**Why:** 해결하는 구체적인 문제 또는 실현하는 가치입니다.

**Context:** 3개월 뒤 이 작업을 맡은 사람이 동기, 현재 상태, 시작 지점을 이해할 수 있을 만큼 상세히 설명합니다.

**Effort:** S / M / L / XL
**Priority:** P0 / P1 / P2 / P3 / P4
**Depends on:** <선행 조건 또는 "없음">
```

**필수 필드:** What, Why, Context, Effort, Priority
**선택 필드:** Depends on, Blocked by

---

## 우선순위 정의

- **P0** — 차단: 다음 릴리스 전에 반드시 완료해야 함
- **P1** — 중대: 이번 주기에 완료해야 함
- **P2** — 중요: P0/P1이 해소되면 수행
- **P3** — 있으면 좋음: 도입/사용량 데이터가 나온 뒤 재검토
- **P4** — 언젠가: 좋은 아이디어지만 긴급하지 않음

---

## 완료 항목 형식

항목이 완료되면 원래 내용을 보존한 채 `## Completed` 절로 옮기고 다음을 덧붙입니다.

```markdown
**Completed:** vX.Y.Z (YYYY-MM-DD)
