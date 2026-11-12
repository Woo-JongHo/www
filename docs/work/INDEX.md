# 작업 목차

작업 상태와 수용 기준 결과는 각 `work.json`에서 확인한다. 이 목차에는 사람이 찾기 위한 목적과 문서 링크만 둔다.

## Chat

### 001 — Native 흐름 통제와 가독성

Native와의 대화에서 실행 흐름을 통제하고 진행·근거·승인·결과를 읽기 좋게 표현한다.

- [명세](Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/spec.md)
- [설계](Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/design.md)
- [통합 실행 계획과 구현 작업](Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/tasks.md)
- [작업 레코드](Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/work.json)
- [검증 기록](Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/verification.md)

### 002 — 중단 접수와 실제 종료 구분

- [명세](Chat/002-%EC%A4%91%EB%8B%A8%20%EC%A0%91%EC%88%98%EC%99%80%20%EC%8B%A4%EC%A0%9C%20%EC%A2%85%EB%A3%8C%20%EA%B5%AC%EB%B6%84/spec.md)
- [작업 레코드](Chat/002-%EC%A4%91%EB%8B%A8%20%EC%A0%91%EC%88%98%EC%99%80%20%EC%8B%A4%EC%A0%9C%20%EC%A2%85%EB%A3%8C%20%EA%B5%AC%EB%B6%84/work.json)
- [검증 기록](Chat/002-%EC%A4%91%EB%8B%A8%20%EC%A0%91%EC%88%98%EC%99%80%20%EC%8B%A4%EC%A0%9C%20%EC%A2%85%EB%A3%8C%20%EA%B5%AC%EB%B6%84/verification.md)

## Workflow

### 001 — Skills 실행과 개발 기록 자동화

개발 세션에서 WWW Skills를 명시적으로 실행하고 같은 작업 기록을 안전하게 이어 주는 프로젝트 opt-in 하네스를 만든다. 런타임 실행 결과와 작업 수용 상태는 구분한다.

- [명세](Workflow/001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/spec.md)
- [설계](Workflow/001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/design.md)
- [구현 작업](Workflow/001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/tasks.md)
- [작업 레코드](Workflow/001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/work.json)
- [검증 기록](Workflow/001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/verification.md)

### 002 — 선택 변경의 안전한 커밋 절차

커밋 준비·명시 승인·선택 stage·결과 확인을 구분하는 WWW 커밋 스킬과 검증 연결을 추가한다. 실제 커밋·push 자동화는 포함하지 않는다.

- [명세](Workflow/002-선택%20변경의%20안전한%20커밋%20절차/spec.md)
- [작업 레코드](Workflow/002-선택%20변경의%20안전한%20커밋%20절차/work.json)
- [검증 기록](Workflow/002-선택%20변경의%20안전한%20커밋%20절차/verification.md)

### 003 — 커밋과 Push의 기본 게시 정책

기본 commit + push와 로컬 전용 예외, 원격·미게시 이력 확인, 실패·미확인 구분을 문서에 반영한다. 002의 과거 검증은 그 시점의 기록으로 보존한다.

- [명세](Workflow/003-커밋과%20Push의%20기본%20게시%20정책/spec.md)
- [작업 레코드](Workflow/003-커밋과%20Push의%20기본%20게시%20정책/work.json)
- [검증 기록](Workflow/003-커밋과%20Push의%20기본%20게시%20정책/verification.md)

### 004 — WWW 개발 역할과 검증 증거 연결

제품·구조·기능 기준과 개발 역할을 연결하고 신규 접수·실행·검증·재개 및 공유 검토 정책을 실제 작은 Chat 변경으로 확인한다.

- [명세](Workflow/004-WWW%20개발%20역할과%20검증%20증거%20연결/spec.md)
- [설계](Workflow/004-WWW%20개발%20역할과%20검증%20증거%20연결/design.md)
- [구현 작업](Workflow/004-WWW%20개발%20역할과%20검증%20증거%20연결/tasks.md)
- [작업 레코드](Workflow/004-WWW%20개발%20역할과%20검증%20증거%20연결/work.json)
- [검증 기록](Workflow/004-WWW%20개발%20역할과%20검증%20증거%20연결/verification.md)
