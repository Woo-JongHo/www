# 구현 작업

## 단위 1: 산출물 검토

- 변경: artifacts.ts가 spec/consistency context·체크 항목·행 근거·기준별 작업 연결·현재성을 확인하고 work.ts가 잠금 안에서 이력을 저장한다.
- 관련 기준: AC-1
- 확인: 실제 임시 저장소에서 기록·읽기·문서/기준 변경·새 파일 생성·오래된 제출·잘못된 위치와 중복 기준 거부를 검사한다.

## 단위 2: 도구 출처와 실행 연결

- 변경: 정본·발견 링크의 일치와 누락/외부를 조회하고 기존 run.ts의 실제 컨텍스트·결과·영수증에 연결한다. 공식 workflow.ts의 준비/저장/상태/출처 action을 제공한다.
- 관련 기준: AC-2, AC-3
- 확인: 실제 파일·링크·CLI subprocess와 명시적인 호스트 test double의 컨텍스트 수신을 검사한다. test double을 실제 모델 수용으로 읽지 않는다.

## 직접 영향받는 후속 변경

스키마·타입·구조 요구/지도, 명세·설계 스킬과 공통 계약·개발 안내·아키텍처를 갱신한다. 집중 테스트·기존 하네스 회귀·타입 검사·전체 검사와 독립 검토를 기록한다.

## 재개할 다음 행동

같은 UUID의 현재 소스·기준·권한과 검토 상태를 확인하고 미통과 검사 또는 독립 검토의 실제 결과를 이어 처리한다.


## 현재 마감 인계 — 2026-11-16

1. AC-1/2: bun test test/workflow-artifacts.test.ts의 실제 준비·저장·조회·stale·거부·출처 시나리오를 공식 verify로 기록한다.
2. AC-3: strict 타입·source 검사 뒤 node --test test/workflow-development.test.ts test/workflow-work.test.ts 및 bun test test/workflow-completion-faults.test.ts로 권한·context/영수증·필수 완료 게이트를 실제 검사한다. 단순 구조 명령을 전체 기준의 성공으로 매핑하지 않는다.
3. 제품 동작을 바꾸지 않는 현재 마감에서 저장소 전체 health/build는 부모 Workflow021이 소유한다. 이 작업은 기능 기준에 직접 대응하는 실제 회귀로 현재 수용을 판단하며, 전체 저장소나 실제 모델 수용을 통과했다고 쓰지 않는다.
4. 현재 문서 영향·spec/consistency 현재성→실제 읽기 전용 Opus(allowFallback=false)→저작 보고서→공식 완료 평가/readback. 실패하면 그 상태를 보존한다.

inputs는 실제 CLI/완료 core·공통 계약·정책·검증 코드의 현재 의존 범위로 갱신했다. 009는 Electron build가 읽는 전체 src와 build.ts·원래 비교 스파이크를 포함한다. 기존 verifications/reviews는 삭제하지 않았고 과거 기록을 현재 결과로 바꾸지 않았다.
