# 같은 제목 보고서의 누적 설계

## 데이터와 파일명

reports.ts가 schema2 묶음 envelope(workId·title·entries)를 저장한다. entries는 기존 schema1 WorkReport 전체 객체다. 내부 UUID와 semanticHash를 유지하고 같은 사건 재실행은 새 entry를 만들지 않는다. reportFileStem은 NFC 제목에서 안정된 제목 파일명과 제목 해시를 만든다. 작업별 폴더 안에서 같은 제목의 JSON·HTML을 하나씩 유지한다(AC-1, AC-2).

## 조회와 앱 표시

listWorkReports는 기존 lifecycle·업무 완료 평가가 모든 저작 버전을 찾도록 entry 목록을 유지한다. 앱의 reports-service가 workId와 NFC title로 묶어 한 항목을 제공하고 최신 authored를 우선, 없으면 최신 snapshot을 고른다. readWorkReport는 요청 UUID의 entry를 주본문으로 돌려주며 같은 묶음의 모든 기록을 HTML에 전달한다. report-view는 나머지 기록의 서술·요구·결정·검사·근거를 접힌 상세에 함께 싣고 각 당시 기록의 현재성을 발명하지 않는다. 문서 내 HTML ID는 entry별로 구분한다(AC-5).

## 작성과 복구

디렉터리별 PID·host·token lease로 append와 이전을 직렬화한다. 완전한 새 묶음 JSON을 임시 파일에 작성·검증한 뒤 원자 rename으로 commit한다. HTML은 같은 entries에서 파생하며 별도 원자 교체한다. JSON commit 뒤 HTML 실패는 JSON 정본에서 복구하고 재실행에서 entry를 중복 추가하지 않는다. JSON·HTML 전체에 단일 원자 commit을 보장한다고 쓰지 않는다(AC-3).

묶음 JSON은 16 MiB, 개별 entry JSON은 1 MiB, entries는 최대 2000개로 제한한다. 묶음 HTML은 32 MiB, 기존 단일 HTML은 2 MiB 한도를 유지한다. 한도를 넘으면 이전 entry를 줄이거나 별도 파일로 몰래 분할하지 않고 거부한다.

## 기존 자료 병합

UUID형과 시각 포함 제목형 schema1을 모두 읽는다. maintainWorkReports는 전체 사전검사 후 같은 workId·NFC title의 entries를 모아 정본 묶음과 파생 HTML을 만들고 검증한 뒤 원본 파일을 해제한다. 동일 ID의 다른 내용·정규화된 경로 충돌·손상·링크·상한은 거부한다. 이미 존재하는 묶음과 legacy가 같은 entry를 가진 중단 상태는 중복 없이 수렴한다. 이전 전 원본 bytes 백업과 각 entry 의미 SHA256을 보존하고, 적용 후 전체 ID 집합·객체·목록·UUID 읽기와 no_changes를 대조한다. 다른 작업 원장은 변경하지 않는다(AC-2, AC-3).

## 스킬과 검증

www-report는 정본 REPORTS.md를 참조하여 생성·누적·백업·이전·복구를 수행한다. .agents 상대 링크와 공식 tool-inventory의 일치를 확인하며 호스트 재로딩을 가정하지 않는다(AC-4).

신규 누적·동시 작성·dedupe·서로 다른 작업 격리·old UUID 읽기·history HTML escaping과 ID 중복·상한·충돌·중단 복원을 집중 검사한다. 실제 기존 자료는 백업 후 병합하고 의미 보존과 파일 수 감소를 실측한다. 타입·소스 정책·구조·빌드와 독립 Opus 검토를 별도 기록한다. BoxBox 잔여와 GUI 미실행을 일반 테스트 통과로 숨기지 않는다.
