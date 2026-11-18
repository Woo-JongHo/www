# JavaScript 전체 TypeScript 이관

## 요청과 목적

직접 관리하는 mjs 소스·테스트·fixture·비교 도구를 TS로 이관한다. vendor·생성물·과거 작업 기록은 보존한다. BoxBox 서식 수정은 별도 작업이다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `AC-1`, `AC-2`, `AC-3`.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.


## 2026-11-16 현재 요청에 따른 로컬 마감 재개

사용자 직접 요청: “내 고민까지 넣어서 지금 전체적으로 남은 작업 진행하자 Astra~ Luna까지 적절하게 분배해서 진행해줘 결론적으로 요구사항에 대해서 사용성이 높게끔 만들어라.”

같은 UUID에서 기존 시도·검토·보고서를 보존하고 현재 입력/정확 검증 argv를 정식 갱신했다. 이전 원장은 history/work-before-local-closeout-20261116-f61aa2651518.json에 원문 보존했다. 새 requestId/requestHash와 direct_user_request 권한은 work.json이 소유한다. 이번 소유 범위는 이 작업 문서·원장·보고서뿐이며 제품 구현·설정·커밋·push는 하지 않는다. 과거 PASS를 현재로 옮기지 않고 기준 결과를 미검증으로 되돌려 실제 재검증한다.

현재 여정은 JS/strict 우회 거부, 실제 Node CLI·stdio fixture와 실행기 분리, Electron 전체 src 의존 및 비교 스파이크 경로를 확인한다. 전체 npm test·build·test:comparison은 root의 공유 빌드 슬롯 해제 후 수행한다.
