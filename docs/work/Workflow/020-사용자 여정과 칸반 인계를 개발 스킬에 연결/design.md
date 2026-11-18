# 사용자 여정과 칸반 인계 설계

## 기준선과 재사용

기존 `www-spec`은 정상·경계·오류 시나리오와 AC를 언급했고 `www-design`은 위험→기준→검사 연결을 요구했다. 공통 원장은 이미 상태·기준·차단 사유·`workflow.nextAction`을 소유한다. 새 스키마나 실행기를 추가하지 않고 누락된 사용자 행동·실제 호출·최종 관측 연결을 이 책임 안에서 보강한다.

`ARTIFACT_REVIEW.md`의 의미 검토는 advisory이며 코드 검사가 의미를 입증하거나 실행을 차단하는 gate가 아니다. 기존 독립 검토·완료 정책을 그대로 따른다.

## 경계와 데이터 흐름

| 여정·기준 | 입력부터 결과 확인까지 | 소유·인계 | 확인 방법 |
|---|---|---|---|
| UC-1 / SKILL-HANDOFF | 계획 요청→작업 검색/접수→계획 문서→다음 단계→재개 | 개발 역할이 같은 UUID를 연결, 원장은 상태/차단/다음 단계, 문서는 구체 순서·해제 조건을 소유 | 독립 패스에서 채팅 요약만으로 종료하거나 중복 원장을 만들지 않는지 확인 |
| UC-2 / SKILL-JOURNEYS, SKILL-HANDOFF | 여정의 입력·행동·기대→AC→경계/호출부/상태 소유→실행→관찰 | WORKFLOW가 추적 규칙, spec/design/build/verify는 해당 단계의 수행, verification은 실제 관측을 소유 | 버튼·파일 존재 검사와 실제 여정 미실행을 구별하는 행동검사 |
| UC-3 / SKILL-VALIDATE | 작은 수정→필요한 한 행/절→형식 검사→독립 판단 | 기존 권한·모델·발견 경로 유지, quick_validate와 workflow는 형식/연결만 검사 | 네 스킬 형식과 저장소 계약 검사, 작은 요청에 대한 독립 적용 |

## 영향 파일

- `docs/skills/WORKFLOW.md`: 사용자 여정 추적과 계획/칸반 인계 규칙의 정본.
- `agents/www/AGENT.md`: 접수·재개 시 정본을 읽고 같은 UUID로 연결하는 책임.
- `skills/www/www-{spec,design,build,verify}/SKILL.md`: 각 단계의 입력·완료·인계 지점에서 공통 규칙 참조.
- `docs/skills/ARTIFACT_REVIEW.md`: 기존 검토 항목의 내용 판단을 정본에 연결하며 advisory 한계 유지.
- `docs/skills/templates/{spec,design,tasks,verification}.md`: 짧은 표/열로 실제 작성과 인계를 유도.
- 같은 작업 폴더의 명세·설계·작업·검증: 변경과 실제 실행 근거, 미완료 구분.

## 위험과 검증 전략

규칙 복제를 피하려고 여정 필드와 예외 선택 기준을 공통 계약에 모았다. 작은 수정은 한 행/절로 줄이고 작업 규모에 해당하는 흐름만 선택한다. 템플릿 경로는 복사 시 상대 경로가 깨지지 않도록 저장소 기준 문서 경로를 적었다.

유지할 비교 사례는 기존 구현 권한 승계, 작은 수정의 간소화, advisory 검토의 한계, 필수 완료 감사와 일반 업무 모델 배분의 분리다. 실제 사용자 행동 검증은 독립 패스에서 수행하고 형식 검사 성공으로 대신하지 않는다.

## 오픈소스 참고와 선택

별도 읽기 전용 조사에서 revision·원문·라이선스를 고정했다. 전문은 로컬 `.www/evidence/session-completion-20261116/opensource-workflow-reference.md`에 보존했다.

- pstack: `cursor/plugins@bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7`, [feature playbook](https://github.com/cursor/plugins/blob/bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7/pstack/skills/poteto-mode/playbooks/feature.md), [MIT 라이선스](https://github.com/cursor/plugins/blob/bf0c7cd80abdbf7fe47b634978a7d1b4071f71a7/pstack/LICENSE). 검증 표면을 실제 변경과 맞추고 독립 흐름/공유 상태를 구분하는 관점만 참고했다. 전체 플러그인·새 분업 gate·특정 모델·커밋/PR 절차는 도입하지 않는다.
- GJC: `Yeachan-Heo/gajae-code@51fd21e58ddef6b3482575d97eac48fbddc838e5`, [deep-interview](https://github.com/Yeachan-Heo/gajae-code/blob/51fd21e58ddef6b3482575d97eac48fbddc838e5/packages/coding-agent/src/defaults/gjc/skills/deep-interview/SKILL.md), [ultragoal](https://github.com/Yeachan-Heo/gajae-code/blob/51fd21e58ddef6b3482575d97eac48fbddc838e5/packages/coding-agent/src/defaults/gjc/skills/ultragoal/SKILL.md), [MIT 라이선스](https://github.com/Yeachan-Heo/gajae-code/blob/51fd21e58ddef6b3482575d97eac48fbddc838e5/LICENSE). 필요한 모호성만 좁히기, 실행 증거와 durable state를 구분하고 최신성을 확인하는 관점을 참고했다. 해당 문서의 upstream fork 표기를 보존하며 GJC 원저작이라고 주장하지 않는다. 점수형 인터뷰·새 ledger 형식·외부 명령은 도입하지 않는다.

외부 코드나 문구를 복제하지 않고 기존 WWW 계약의 누락된 연결을 자체 문장으로 보강했다. 이번 변경으로 비용·품질 향상을 실측했다고 주장하지 않는다.

## 구현 인계와 미래 범위

[tasks.md](tasks.md)의 문서 저작→형식/연결 검사→독립 행동검사·검토 순서로 인계한다. 원장과 목차는 통합 담당이 소유한다. 자동 칸반 기능·런타임 gate·모델 정책·외부 설치는 선점하지 않는다.
