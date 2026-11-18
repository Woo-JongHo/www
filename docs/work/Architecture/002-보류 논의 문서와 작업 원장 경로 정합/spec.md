# 보류 논의 문서와 작업 원장 경로 정합

## 요청과 목적

로컬 작업을 계속하라는 현재 요청에 따라 W020 검증 중 관측한 저장소 문서 계약 오류를 해결한다. 중앙화 개발은 시작하지 않는다.

## 관찰과 원인

보류 논의만 있는 docs/work/Architecture/001-중앙 저장과 로컬 실행 폴더에 work.json이 없어 check-workflow가 실패했다. 해당 문서 자체는 구현 승인·완료 명세가 아닌 고민 기록임을 명시한다. 검사를 약화하거나 가짜 원장을 만들지 않고 일반 논의 경로로 옮긴다.

## 범위와 제외

기존 discussion.md를 docs/architecture/discussions/central-storage-local-execution.md로 bytes 그대로 이동하고 목차 링크를 추가한다. 기존 보고서·검증 이력은 변경하지 않는다. 제품 코드·원격·중앙 API·DB·승인 정책·전역 설정·커밋·게시를 제외한다.

## 여정과 검사

| 기준 | 입력·행동 | 기대 결과 | 검사 방법 |
|---|---|---|---|
| DOC-BYTES | 기존 보류 문서를 이동 후 읽는다 | 원문 SHA 71785f2a1fe3142a16f03a36b61cbf05b51074cf575648ac5eaca426d23ab3b7와 보류 결정 유지 | 원문 bytes SHA 비교 |
| DOC-FIND | 작업 목차에서 보류 논의 링크를 연다 | 일반 docs/architecture/discussions 문서에 도달 | 링크 경로 실재·이전 빈 작업 디렉터리 부재 확인 |
| DOC-CONTRACT | 전체 작업 문서 계약 검사를 실행한다 | 원장 누락 오류 없이 통과 | 실제 node scripts/check-workflow.ts 실행 |

## 실패·복원

이동 전 원문은 Git 제외 증거 경로에 SHA와 함께 보존한다. 목적지 충돌이나 원본 폴더의 예상 밖 파일이 있으면 중단하고 덮어쓰지 않는다. 가짜 work.json이나 checker 예외를 추가하지 않는다.
