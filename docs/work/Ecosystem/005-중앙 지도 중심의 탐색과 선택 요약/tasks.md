# 종료 준비와 재개 절차

## 요청과 현재 범위

중앙 지도를 넓히고 선택 요약을 기본으로 사용한다. 사용자가 명시적으로 요청한 codex/canvas-focus worktree에서 이어갔으며, 원본의 기존 변경을 되돌리거나 삭제하지 않았다. 상태와 수용 기준의 정본은 [work.json](work.json), 실제 시도는 [verification.md](verification.md)다.

## 수행한 단위

- CANVAS-SPACE: 64px 화면 전환 영역과 압축 도구를 구현하고 실제 viewport 면적 및 탐색 복구를 검사했다.
- CANVAS-SELECT: 선택 요약과 명시적 상세 열기를 구현하고 노드·검색·참조 선택 및 상세 닫기를 검사했다.
- CANVAS-CONTROL: native HTML 버튼의 Enter/Space 입력을 보완해 실제 Electron에서 검사했다. 기존 지도/Chat 상태·초안·읽기 위치·승인/중단 보존 통합 검사를 수행했다.
- 제품·아키텍처·개발 안내·코드 설계도·생태계/구조 명세를 갱신하고 공유 core에 문서 영향 검토를 기록했다.
- 기존 Opus/CLI Terra 실패는 보존했다. 이후 Terra 지정 읽기 전용 호스트 검토에서 상세 자동 닫힘 1건을 발견해 실제 red를 재현하고 수정·green 및 2차 PASS를 받았다. 호스트 결과를 CLI 영수증으로 꾸미지 않았으며 공유 core의 최종 done은 별도 대기다.

## 세션을 닫을 때 보존할 것

- 작업 경로: `/Users/jonghoPro/woo/00_project/www-canvas-focus`, 브랜치 `codex/canvas-focus`.
- 작업 UUID: `work-2654a232-11a8-40a3-907d-edad8ec066b4`.
- Git-visible 기반 복사 manifest: `.www/worktree-baseline.json`. 사본에는 이전 작업 및 다른 작업의 미커밋 기반도 포함돼 있다. 전체 diff를 이번 UI 변경으로 취급하지 않는다.
- 현재 소스의 집중 검사·GUI·통합 근거: verification.md의 `attempt-c5a0f2e1`, `attempt-bb1a2765`, `attempt-2c89027e` 전체 ID 절.
- 모델 검토 원문: `.www/evidence/reviews/review-0e0ea302-2ac6-4931-b453-483b69df65a6/`.
- 추가 Terra CLI 실행 원문: `.www/evidence/terra-runtime-probe/`.
- Terra 지정 호스트 검토 전문: `.www/evidence/terra-host-review/review-1.md`(FAIL), `review-2.md`(수정 후 PASS).
- 보고서 JSON·HTML: 이 작업의 `reports/`. 최신 저작 보고서는 report API의 목록·읽기로 확인한다.

커밋·push·병합·worktree 삭제·원본 정리는 수행하지 않는다. 소스와 작업 문서는 미커밋 상태로 보존한다. 앱 종료도 수행하지 않는다.

## 다음 세션의 순서

1. 위 worktree로 이동해 `pwd`와 `git status --short --branch`를 확인한다.
2. 이 작업 UUID의 spec/design/verification/work.json과 최신 보고서를 읽는다. `node scripts/workflow.ts '{"action":"report-status","workId":"work-2654a232-11a8-40a3-907d-edad8ec066b4"}'`로 현행 적용성을 확인한다.
3. 사용자가 승인한 검토 모델은 Terra다. 호스트 읽기 전용 검토와 수정 후 PASS는 이미 수행됐다. 다만 실제 모델·호스트 메타데이터는 독립 미관측이고 현재 공유 core는 CLI process 영수증을 요구한다. 소스 읽기와 실제 모델 관측을 보장하는 검토 경로 및 수용 가능한 영수증 연결을 확보한다. 요청 모델명을 관측값으로 채우지 않는다.
4. 새 검토 실행이 필요한 경우 현재 소스에 대해 수행하고 원문·실제 모델·결과를 공유 core에 연결한다. 호스트 PASS와 과거 CLI 실패를 모두 보존한다. 소스가 바뀌면 영향받는 검사와 문서 검토를 갱신한다.
5. 필수 검토가 수용된 뒤 저작 보고서를 갱신하고 report-complete로 완료 여부를 판단한다. 검토 미완료 상태를 임의로 승인하지 않는다.

담당자와 재개 시점은 새로 확정하지 않는다. 모델 한도 로그에 표시된 시간은 실행 당시 안내이며 자동 재개 예약이 아니다.

## 최종 마감 — 2026-11-15

현재 소스의 실제 Terra CLI PASS와 공유 core 영수증 수용을 확보했다. 필수 수용 기준과 문서 영향 검토가 모두 충족됐다. 상세 근거는 verification.md의 최종 실제 검토 절 및 reports의 완료 보고서에서 읽는다. 이전 대기·실패 절은 당시 이력으로 보존한다. 원본·커밋·push·병합·worktree 삭제·앱 종료는 수행하지 않는다.
