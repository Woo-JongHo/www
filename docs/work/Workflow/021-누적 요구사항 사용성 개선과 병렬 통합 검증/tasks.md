# 원격 재개 계획

## 현재 인계 — 2026-11-16 Mac mini

- 같은 UUID: work-40ae2dc5-86db-4b52-b1fc-09ca61c58898. 작업 root는 이 새 사본 source다.
- 다음 실제 단계: build. Hook 수정·집중103개·Astra 독립4개 반박은 끝났고 소스를 동결했다. 다음 단계는 build의 미해결 BoxBox source 검사 조건 확인이다. 기존/추가 REFUSE·미정렬을 승인·align·mode 변경 없이 보존한다. 첫 injected callback의 ok 누락 실패와 형식 교정 후 별도 사후검사를 모두 보존한다.
- 원문 근거: .www/evidence/remote-20261116/ 아래 hook-postcheck-result.json / scratch/hook-fix-review.md / opus-attempt.json / electron-crash-summary.json.
- 커밋·push·배포·외부 쓰기·인증·전역 설정·BoxBox mode/승인 변경 금지.

<details>
<summary>이전 계획 이력 — 아래 단계는 현재 지시가 아님</summary>

# 누적 작업 실행 계획

기준은 각 작업의 work.json이며 이 목록은 인계용 연결이다. 같은 UUID를 재사용하고 상태를 자동 완료로 변경하지 않는다.

## 현재 병렬 소유

| 단위 | 모델 역할 | 소유 경계 | 다음 관찰 |
|---|---|---|---|
| 칸반·Chat013 첫 통합 | Sol 통합·Terra 구현·Astra 반박 | dashboard/native activity | 키보드 probe 보완과 현재 GUI |
| 대화·탐색·입력 | Sol 저작 | renderer/composer/command/projection | 성능 전후·5메뉴·스크롤·Steer UI |
| Steer backend | Terra 저작 | native-session/shared/preload/main | 같은 턴 접수·경합·불확실 |
| 보고서 | Terra 저작 | report-view/직접 테스트 | 참조 구조·이력·인쇄 |
| 완료 흐름·상태도 | Sol 소유·하위 독립 분업 | workflow core/ecosystem | 결함 주입·seed·상태 근거 |
| 독립 검토 | Astra 보조 반박·정책상 필수 감사 | 읽기 전용 | 누락·실행·현재성 |
| 수집·인계 | Luna | 목록·문서 연결 | 기존 요구와 후속 검사 중복 대조 |

## 기존 작업별 남은 범위

| 작업 | 기록 상태 | 다음 행동 |
|---|---|---|
| [Chat/003-Native 실시간 작업 흐름과 사용량](../../Chat/003-Native%20%EC%8B%A4%EC%8B%9C%EA%B0%84%20%EC%9E%91%EC%97%85%20%ED%9D%90%EB%A6%84%EA%B3%BC%20%EC%82%AC%EC%9A%A9%EB%9F%89/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/005-Skills와 Hook 활동 사이드바](../../Chat/005-Skills%EC%99%80%20Hook%20%ED%99%9C%EB%8F%99%20%EC%82%AC%EC%9D%B4%EB%93%9C%EB%B0%94/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/006-오픈소스 채팅 뼈대와 Native 대화 재개 통합](../../Chat/006-%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4%20%EC%B1%84%ED%8C%85%20%EB%BC%88%EB%8C%80%EC%99%80%20Native%20%EB%8C%80%ED%99%94%20%EC%9E%AC%EA%B0%9C%20%ED%86%B5%ED%95%A9/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/007-실시간 세션 모니터와 채팅 가독성](../../Chat/007-%EC%8B%A4%EC%8B%9C%EA%B0%84%20%EC%84%B8%EC%85%98%20%EB%AA%A8%EB%8B%88%ED%84%B0%EC%99%80%20%EC%B1%84%ED%8C%85%20%EA%B0%80%EB%8F%85%EC%84%B1/work.json) | in_progress | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/008-오픈소스 채팅 뼈대 도입 비교](../../Chat/008-%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4%20%EC%B1%84%ED%8C%85%20%EB%BC%88%EB%8C%80%20%EB%8F%84%EC%9E%85%20%EB%B9%84%EA%B5%90/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/012-스크롤과 첫 응답 및 진행 설명 개선 논의](../../Chat/012-%EC%8A%A4%ED%81%AC%EB%A1%A4%EA%B3%BC%20%EC%B2%AB%20%EC%9D%91%EB%8B%B5%20%EB%B0%8F%20%EC%A7%84%ED%96%89%20%EC%84%A4%EB%AA%85%20%EA%B0%9C%EC%84%A0%20%EB%85%BC%EC%9D%98/work.json) | verifying | 최신 실패 재현과 최소 수정·회귀 검사 |
| [Chat/013-오른쪽 Agent와 WWW Skills 및 Hook 표시 논의](../../Chat/013-%EC%98%A4%EB%A5%B8%EC%AA%BD%20Agent%EC%99%80%20WWW%20Skills%20%EB%B0%8F%20Hook%20%ED%91%9C%EC%8B%9C%20%EB%85%BC%EC%9D%98/work.json) | verifying | 최신 실패 재현과 최소 수정·회귀 검사 |
| [Chat/014-대화 단일 스크롤과 카드 펼침 및 성능 개선 명세](../../Chat/014-%EB%8C%80%ED%99%94%20%EB%8B%A8%EC%9D%BC%20%EC%8A%A4%ED%81%AC%EB%A1%A4%EA%B3%BC%20%EC%B9%B4%EB%93%9C%20%ED%8E%BC%EC%B9%A8%20%EB%B0%8F%20%EC%84%B1%EB%8A%A5%20%EA%B0%9C%EC%84%A0%20%EB%AA%85%EC%84%B8/work.json) | in_progress | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Chat/015-WWW 스킬 단계와 Plan 및 Progress 관측 누락](../../Chat/015-WWW%20%EC%8A%A4%ED%82%AC%20%EB%8B%A8%EA%B3%84%EC%99%80%20Plan%20%EB%B0%8F%20Progress%20%EA%B4%80%EC%B8%A1%20%EB%88%84%EB%9D%BD/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Development/001-Mac과 Windows 실사용 및 검증 신뢰성 완성](../../Development/001-Mac%EA%B3%BC%20Windows%20%EC%8B%A4%EC%82%AC%EC%9A%A9%20%EB%B0%8F%20%EA%B2%80%EC%A6%9D%20%EC%8B%A0%EB%A2%B0%EC%84%B1%20%EC%99%84%EC%84%B1/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Ecosystem/001-WWW 생태계 노드 탐색](../../Ecosystem/001-WWW%20%EC%83%9D%ED%83%9C%EA%B3%84%20%EB%85%B8%EB%93%9C%20%ED%83%90%EC%83%89/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Ecosystem/002-코드 기반 아키텍처 설계도와 계층형 Node 그래프](../../Ecosystem/002-%EC%BD%94%EB%93%9C%20%EA%B8%B0%EB%B0%98%20%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98%20%EC%84%A4%EA%B3%84%EB%8F%84%EC%99%80%20%EA%B3%84%EC%B8%B5%ED%98%95%20Node%20%EA%B7%B8%EB%9E%98%ED%94%84/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Ecosystem/005-중앙 지도 중심의 탐색과 선택 요약](../../Ecosystem/005-%EC%A4%91%EC%95%99%20%EC%A7%80%EB%8F%84%20%EC%A4%91%EC%8B%AC%EC%9D%98%20%ED%83%90%EC%83%89%EA%B3%BC%20%EC%84%A0%ED%83%9D%20%EC%9A%94%EC%95%BD/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Home/001-업무 진입점과 탐색 구조 연구](../../Home/001-%EC%97%85%EB%AC%B4%20%EC%A7%84%EC%9E%85%EC%A0%90%EA%B3%BC%20%ED%83%90%EC%83%89%20%EA%B5%AC%EC%A1%B0%20%EC%97%B0%EA%B5%AC/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Home/002-RPA 프로젝트와 WWW 진입 및 공통 메뉴](../../Home/002-RPA%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EC%99%80%20WWW%20%EC%A7%84%EC%9E%85%20%EB%B0%8F%20%EA%B3%B5%ED%86%B5%20%EB%A9%94%EB%89%B4/work.json) | in_progress | 최신 실패 재현과 최소 수정·회귀 검사 |
| [Home/003-프로젝트 탐색과 세션 모니터링 메뉴 개편](../../Home/003-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%20%ED%83%90%EC%83%89%EA%B3%BC%20%EC%84%B8%EC%85%98%20%EB%AA%A8%EB%8B%88%ED%84%B0%EB%A7%81%20%EB%A9%94%EB%89%B4%20%EA%B0%9C%ED%8E%B8/work.json) | in_progress | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Native/001-사이드바 탐색과 작업 화면 분리 평가](../../Native/001-%EC%82%AC%EC%9D%B4%EB%93%9C%EB%B0%94%20%ED%83%90%EC%83%89%EA%B3%BC%20%EC%9E%91%EC%97%85%20%ED%99%94%EB%A9%B4%20%EB%B6%84%EB%A6%AC%20%ED%8F%89%EA%B0%80/work.json) | verifying | 자동 요약과 해당 기능 원장을 대조; 요약 종료를 업무 수용으로 올리지 않음 |
| [Native/002-Home 003 문서화와 검증 현황](../../Native/002-Home%20003%20%EB%AC%B8%EC%84%9C%ED%99%94%EC%99%80%20%EA%B2%80%EC%A6%9D%20%ED%98%84%ED%99%A9/work.json) | verifying | 자동 요약과 해당 기능 원장을 대조; 요약 종료를 업무 수용으로 올리지 않음 |
| [Native/003-작업 상태 표시 누락 진단](../../Native/003-%EC%9E%91%EC%97%85%20%EC%83%81%ED%83%9C%20%ED%91%9C%EC%8B%9C%20%EB%88%84%EB%9D%BD%20%EC%A7%84%EB%8B%A8/work.json) | verifying | 자동 요약과 해당 기능 원장을 대조; 요약 종료를 업무 수용으로 올리지 않음 |
| [Native/004-관측 누락 버그 명세와 이슈 등록](../../Native/004-%EA%B4%80%EC%B8%A1%20%EB%88%84%EB%9D%BD%20%EB%B2%84%EA%B7%B8%20%EB%AA%85%EC%84%B8%EC%99%80%20%EC%9D%B4%EC%8A%88%20%EB%93%B1%EB%A1%9D/work.json) | verifying | 자동 요약과 해당 기능 원장을 대조; 요약 종료를 업무 수용으로 올리지 않음 |
| [RPA/001-공통 절차와 표준 하네스 및 프로젝트 공간](../../RPA/001-%EA%B3%B5%ED%86%B5%20%EC%A0%88%EC%B0%A8%EC%99%80%20%ED%91%9C%EC%A4%80%20%ED%95%98%EB%84%A4%EC%8A%A4%20%EB%B0%8F%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%20%EA%B3%B5%EA%B0%84/work.json) | ready | 구체 유스케이스·소유·검증 방법 보강 후 구현 |
| [Release/001-커밋 버전과 릴리즈 및 CI CD 구축](../../Release/001-%EC%BB%A4%EB%B0%8B%20%EB%B2%84%EC%A0%84%EA%B3%BC%20%EB%A6%B4%EB%A6%AC%EC%A6%88%20%EB%B0%8F%20CI%20CD%20%EA%B5%AC%EC%B6%95/work.json) | in_progress | 최신 실패 재현과 최소 수정·회귀 검사 |
| [Reports/001-작업 종료 보고서와 앱 리포트](../../Reports/001-%EC%9E%91%EC%97%85%20%EC%A2%85%EB%A3%8C%20%EB%B3%B4%EA%B3%A0%EC%84%9C%EC%99%80%20%EC%95%B1%20%EB%A6%AC%ED%8F%AC%ED%8A%B8/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Reports/002-독자의 판단을 돕는 보고서 양식](../../Reports/002-%EB%8F%85%EC%9E%90%EC%9D%98%20%ED%8C%90%EB%8B%A8%EC%9D%84%20%EB%8F%95%EB%8A%94%20%EB%B3%B4%EA%B3%A0%EC%84%9C%20%EC%96%91%EC%8B%9D/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Reports/003-참조 HTML 기반 한 페이지 보고서 양식 변경 명세](../../Reports/003-%EC%B0%B8%EC%A1%B0%20HTML%20%EA%B8%B0%EB%B0%98%20%ED%95%9C%20%ED%8E%98%EC%9D%B4%EC%A7%80%20%EB%B3%B4%EA%B3%A0%EC%84%9C%20%EC%96%91%EC%8B%9D%20%EB%B3%80%EA%B2%BD%20%EB%AA%85%EC%84%B8/work.json) | in_progress | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Workflow/005-Skills 라이브러리 한국어 대체](../../Workflow/005-Skills%20%EB%9D%BC%EC%9D%B4%EB%B8%8C%EB%9F%AC%EB%A6%AC%20%ED%95%9C%EA%B5%AD%EC%96%B4%20%EB%8C%80%EC%B2%B4/work.json) | in_progress | 최신 실패 재현과 최소 수정·회귀 검사 |
| [Workflow/009-JavaScript 전체 TypeScript 이관](../../Workflow/009-JavaScript%20%EC%A0%84%EC%B2%B4%20TypeScript%20%EC%9D%B4%EA%B4%80/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Workflow/010-BoxBox 저작과 전체 변경 검증](../../Workflow/010-BoxBox%20%EC%A0%80%EC%9E%91%EA%B3%BC%20%EC%A0%84%EC%B2%B4%20%EB%B3%80%EA%B2%BD%20%EA%B2%80%EC%A6%9D/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Workflow/016-명세 검토와 개발 도구 출처 하네스](../../Workflow/016-%EB%AA%85%EC%84%B8%20%EA%B2%80%ED%86%A0%EC%99%80%20%EA%B0%9C%EB%B0%9C%20%EB%8F%84%EA%B5%AC%20%EC%B6%9C%EC%B2%98%20%ED%95%98%EB%84%A4%EC%8A%A4/work.json) | verifying | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |
| [Workflow/019-분업 계약과 완료 게이트 강화 및 상태도 연결](../../Workflow/019-%EB%B6%84%EC%97%85%20%EA%B3%84%EC%95%BD%EA%B3%BC%20%EC%99%84%EB%A3%8C%20%EA%B2%8C%EC%9D%B4%ED%8A%B8%20%EA%B0%95%ED%99%94%20%EB%B0%8F%20%EC%83%81%ED%83%9C%EB%8F%84%20%EC%97%B0%EA%B2%B0/work.json) | in_progress | 현재 소스 적용성 재평가 후 빠진 실제 검사·감사 연결 |

## 완료와 인계

SESSION-PLAN은 기존 원장 연결과 실제 소유를, SESSION-INTEGRATION은 단일 저작 범위의 도구 검사와 통합 결과를, SESSION-USABILITY는 사용자 여정의 관찰을, SESSION-CLOSEOUT은 각 UUID의 수용·차단·다음 행동과 전체 최종 검사를 확인한다. 실제 명령·시각·한계는 verification.md에 추가한다.

</details>

## 오늘의 로컬·원격 실행 계획

[2026-11-19 로컬·원격 완료 추진 Todo](today-20261119.md)에 담당 경계·실행 순서·완료 조건을 연결한다. 현재 원장 nextAction은 build이며 이 목록 작성은 개별 Task의 완료가 아니다.
