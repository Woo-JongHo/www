---
name: www-report
description: WWW 작업 보고서를 생성하거나 기존 보고서 파일명을 점검·이전할 때 사용한다. 작업 UUID와 과거 JSON·HTML 내용을 보존하며 공식 보고서 하네스로 관리한다.
---

# WWW 보고서 생성과 관리

대상 저장소의 위치·브랜치·변경 상태를 확인하고 [보고서 계약](../../../docs/skills/REPORTS.md)을 읽는다. 이 스킬은 보고서 작업을 연결하며 개발 단계나 업무 완료 조건을 새로 정의하지 않는다.

## 보고서 생성

1. 작업 UUID로 원장과 실제 변경·검사·독립 검토·한계를 읽는다. 보고서의 한국어 제목은 작업의 `title`에서 오므로 신규 작업 접수 때 사람이 구분할 수 있는 제목을 정한다. 기존 이력의 이름을 바꾸려고 작업 원장이나 보고서 본문을 다시 쓰지 않는다.
2. 계약의 저작 양식에 따라 실제 관찰로 `narrative`를 작성하고 `node scripts/workflow.ts`의 `action: "report"`, `workId`, `narrative`로 저장한다. 자동 스냅샷은 `report-snapshot` 사건을 사용한다. 직접 파일명이나 HTML을 만들어 공통 writer를 우회하지 않는다.
3. 반환한 UUID로 앱에서 읽고 같은 작업·NFC 제목의 JSON·HTML 한 쌍에 새 entry가 누적됐는지 확인한다. 앱 목록은 최신 저작 우선의 한 항목이며 독립 HTML의 같은 제목 기록에서 전체 이력을 읽는다. 같은 사건 재실행의 중복 억제와 업무 수용·독립 검토 상태를 구분한다. 생성 실패는 실패로 보고한다.

## 기존 파일 점검과 이전

기본 점검은 읽기 전용이다. 대상 저장소 루트에서 실행한다.

```bash
node scripts/workflow.ts '{"action":"report-maintain"}'
```

반환된 `counts`, `changes`의 이전·대상 경로와 원본 SHA256, entries 의미 지문을 확인한다. 적용 전 원본 JSON·HTML을 별도 디렉터리에 복사하고 bytes·SHA256을 대조한 manifest를 보존한다. 사용자가 기존 파일 이전을 요청한 범위에서 다음을 실행한다. `direct: true`는 실제 사용자 요청을 연결하는 표시이며 새 권한을 만들지 않는다.

```bash
node scripts/workflow.ts '{"action":"report-maintain","apply":true,"direct":true}'
```

적용 뒤 같은 읽기 전용 명령을 재실행해 `no_changes`를 확인하고, 전체 entry ID 집합·객체·의미 지문과 과거 UUID 읽기를 대조한다. 병합은 새 envelope 직렬화이므로 기존 파일 bytes 불변으로 보고하지 않는다. 예전 보고서의 판단·근거·ID와 다른 작업 원장은 보존한다. 실제 파일을 가리키는 Markdown 링크가 있으면 이전 결과의 경로 대응으로 연결하고 역사 서술 속 UUID는 유지한다.

충돌·손상·누락 쌍·심볼릭 링크·읽기 상한 초과는 원인을 조사한다. 기존 대상 덮어쓰기나 보고서 축약으로 우회하지 않는다. 적용 도중 중단되면 남은 양쪽 경로를 보존한 채 같은 명령으로 다시 점검한다. 같은 UUID의 entry 내용이 같은 중간 상태만 중복 없이 회수하며, JSON commit 뒤 누락·낡은 HTML은 정본에서 복구한다. 전체 일괄 적용이 원자적이라고 보고하지 않는다.

프로세스 강제 종료로 잠금이 남으면 `action: "report-lock-status"`로 소유 상태를 읽는다. 같은 머신에서 소유 PID의 종료가 확인되어 `recoverable: true`인 항목만 관찰한 `directory`, `owner.token`과 `action: "report-lock-recover"`, `direct: true`를 전달해 명시 회수하고 다시 점검한다. 살아 있는 PID·다른 머신·소유 미확인 잠금은 회수하지 않는다.

## 반환할 근거

작업 UUID, 실제 생성·이전 수량, 재실행 결과, 목록·읽기 확인, 실패·미실행 범위와 증거 경로를 보고한다. 스킬 파일 발견·CLI 실행·실제 호스트 수용은 각각 확인한 범위만 기록한다. 커밋과 push는 저장소의 별도 요청 정책을 따른다.
