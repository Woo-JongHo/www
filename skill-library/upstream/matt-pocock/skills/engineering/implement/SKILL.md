---
name: implement
description: "명세 또는 티켓 모음을 바탕으로 작업을 구현합니다."
disable-model-invocation: true
---

> 한국어 번역본: 고정 커밋 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.


명세 또는 티켓에서 사용자가 설명한 작업을 구현하세요.

사용자가 티켓 참조를 전달하면 이슈 트래커에서 가져오고 시작하기 전에 제목을 밝히세요. 참조가 모호하면 질문하세요.

가능한 경우 사전에 합의한 심에서 Skill 도구를 "tdd"로 호출하세요.

타입 검사를 정기적으로 실행하고, 개별 테스트 파일도 정기적으로 실행하며, 마지막에는 전체 테스트 스위트를 한 번 실행하세요.

완료되면 Skill 도구를 "code-review"로 호출하여 작업을 검토하세요.

작업을 현재 브랜치에 커밋하세요.
