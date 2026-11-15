# 개발 환경 사전점검 설계

실행 경계 직전의 `environment.ts`가 읽기 전용 structured 진단을 소유한다. 기존 검증 core·소스 정책을 재구현하지 않고 실행파일 해석, 명시한 Git 기준과 index, 외부 도구 설치 위치, Git 제외 출력 저장 정책만 검사한다. inherited env와 overrides 병합은 실제 자식 실행에도 같은 값을 전달한다.

CLI는 같은 검사를 JSON으로 출력하고 차단 시 exit 1을 반환한다. 재설치·reset·trust 변경은 하지 않는다. run.ts의 모델 시작 직전에 같은 함수를 연결하고 실패는 실행하지 않은 상태로 반환한다. 출력 spool은 Codex 어댑터가 Git 제외 디렉터리에 원문을 기록하고 메모리에는 bounded 요약과 종료·usage만 보존한다. 원문 보존 실패나 protocol 손실은 성공으로 판정하지 않는다.

ENV1은 PATH override와 존재하지 않는 도구, 실제 host 미호출로 검사한다. ENV2는 Git 이력/index 누락·잘못된 ref·저장소 안 도구·출력 위치 실패를 임시 저장소에서 검사한다. ENV3은 1MiB를 넘는 출력 뒤 종료와 usage, spool 실패 회귀로 검사한다. ENV4는 실제 typed Sol 작성 1회와 source/type/집중 검사를 분리 기록한다. Windows 실제 패키징 수정은 별도 소유 작업이다.

공유 파일은 격리 clone에서만 편집하고 exact patch로 통합 담당에게 전달한다. 공개 이슈: https://github.com/Woo-JongHo/www/issues/1 . 개인 경로·로그 원문은 Git 제외 scratch에만 보존한다. 제품 목적과 Chat 동작은 유지되며 DEVELOPMENT와 아키텍처 생성물은 통합 시 갱신한다.

## 잔여 원인 보강 설계

첫 저작은 명시 toolPaths와 모델 시작 경계만 검사해 루트 설치기 17JS 및 verify intent 자동 차단을 해결하지 못했다. 기존 결과는 보존하고 같은 사용자 환경 개선 권한으로 두 누락을 보강한다. 기존 checkSourcePolicy API를 재사용하는 기본 개발 환경 진단을 npm check 맨 앞에 두어 새로운 JavaScript 오염을 고비용 검사 전에 차단한다. 기본 Git 전체 이력/index·설정 파일 실재·안전한 출력·실행파일/PATH를 검사하며 소스 정책 예외와 자동 삭제를 추가하지 않는다. JSON 명시 진단의 기존 계약을 유지하고 옵션을 일반 framework로 확장하지 않는다. 공식 verify intent는 선언된 Git·toolPaths와 verifier 실행파일을 검사한 뒤에만 실제 검증 프로세스를 시작한다. 실패 시 실제 실행 카운터 0, 정상 조건에서 1을 관측한다. Node API 회귀 파일은 scripts/test.ts의 Node 목록에 등록한다.

보강 파일은 환경 모듈/CLI/run.ts/환경 회귀와 package.json/scripts/test.ts에 한정한다. source-policy 정본은 수정하지 않는다. 신규 17JS 오염·verify counter·기본 정상 환경 회귀를 먼저 실행해 실패 원인을 관측하고 구현한다. 좁은 실제 Sol 저작은 추가 1회만 수행하며 최종 후보에서 focused와 npm check 한 번으로 통합 판정한다. root index/HEAD와 mode off 정책은 변경하지 않는다.
