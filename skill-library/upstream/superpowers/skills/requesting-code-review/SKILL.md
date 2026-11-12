---
name: requesting-code-review
description: 작업을 완료하거나 주요 기능을 구현했거나 병합 전에 작업이 요구 사항을 충족하는지 확인할 때 사용
---

> 한국어 번역본: 고정 커밋 `22f0b463e7a5e579904dd6211a520321035526f7`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.


# 코드 검토 요청

문제가 연쇄적으로 커지기 전에 코드 검토자 하위 에이전트를 배정하여 포착합니다. 검토자는 평가를 위해 정밀하게 작성된 컨텍스트를 받으며, 세션 기록 전체를 받지 않습니다.

**핵심 원칙:** 일찍 검토하고, 자주 검토합니다.

## 검토를 요청할 시점

**필수:**
- 하위 에이전트 주도 개발에서 각 작업 후
- 주요 기능을 완료한 후
- main에 병합하기 전

**선택 사항이지만 유용함:**
- 막혔을 때(새로운 관점)
- 리팩터링 전(기준선 점검)
- 복잡한 버그를 수정한 후

## 요청 방법

**1. git SHA 가져오기:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or: git merge-base origin/main HEAD
HEAD_SHA=$(git rev-parse HEAD)
```

**2. 코드 검토자 하위 에이전트 배정:**

[code-reviewer.md](code-reviewer.md)의 템플릿을 채워 `general-purpose` 하위 에이전트를 배정합니다.

**자리 표시자:**
- `{DESCRIPTION}` - 구현한 내용의 간략한 요약
- `{PLAN_OR_REQUIREMENTS}` - 수행해야 하는 내용
- `{BASE_SHA}` - 시작 커밋
- `{HEAD_SHA}` - 종료 커밋

**3. 피드백에 따라 조치:**
- Critical 문제는 즉시 수정
- Important 문제는 진행 전에 수정
- Minor 문제는 나중을 위해 기록
- 검토자가 틀렸다면 근거를 들어 반박

## 예시

```
[방금 작업 2를 완료함: 검증 함수 추가]

You: 진행하기 전에 코드 검토를 요청하겠습니다.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | cut -d' ' -f1)
HEAD_SHA=$(git rev-parse HEAD)

[코드 검토자 하위 에이전트 배정]
  DESCRIPTION: 4가지 문제 유형으로 verifyIndex() 및 repairIndex() 추가
  PLAN_OR_REQUIREMENTS: docs/superpowers/plans/deployment-plan.md의 작업 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[하위 에이전트 응답]:
  강점: 깔끔한 아키텍처, 실제 테스트
  문제:
    Important: 진행 상태 표시기 누락
    Minor: 보고 간격에 매직 넘버(100) 사용
  평가: 진행 준비 완료

You: [진행 상태 표시기 수정]
[작업 3 계속]
```

## 흔한 합리화

| 변명 | 현실 |
|--------|---------|
| "검토자를 배정하는 대신 내가 직접 diff를 검토하면 되겠어" | 당신은 조정자입니다. diff를 인라인으로 검토하면 작업을 계속 이끌어 가는 데 필요한 컨텍스트 창을 소모합니다. 검토자 하위 에이전트를 배정하세요. diff와 평가는 그 컨텍스트에 있고, 발견 사항만 당신에게 돌아옵니다. |
| "검토자가 변경 사항을 이해하려면 내 전체 세션 기록이 필요해" | 세션 기록 전체가 아니라 정밀하게 작성된 컨텍스트를 전달하세요. 그러면 검토자는 당신의 사고 과정이 아니라 작업 결과물에 집중합니다. |

## 위험 신호

**절대 하지 말 것:**
- "간단하니까"라는 이유로 검토 건너뛰기
- Critical 문제 무시
- 수정되지 않은 Important 문제를 남기고 진행
- 타당한 기술 피드백과 논쟁

**검토자가 틀린 경우:**
- 기술적 근거를 들어 반박
- 작동함을 증명하는 코드/테스트 제시
- 명확화 요청

템플릿 참조: [code-reviewer.md](code-reviewer.md)
