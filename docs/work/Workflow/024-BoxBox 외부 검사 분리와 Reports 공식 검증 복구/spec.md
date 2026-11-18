# BoxBox 외부 검사 분리와 Reports 공식 검증 복구

## 목적과 사용자 여정

BoxBox를 끈 상태에서 제품 테스트를 실행하면 직렬화·보고서·보안·크기 제한 검사는 그대로 실행되고, BoxBox 승인/외부 CLI pipeline은 별도 명시 실행으로만 남아야 한다. 기존 Reports 공식 복합 검사 argv를 유지하여 현재 기능/GUI 결과를 원래 UUID에 등록한다.

## 범위와 보존

제품 테스트12건과 외부 BoxBox4건의 시나리오를 삭제/skip/완화하지 않는다. 외부 검사 파일만 test/boxbox로 옮긴다. 기본 npm test는 제품 검사, 명시 test:boxbox는 별도 도구 검사다. 명시 요청도 project mode off이면 disabled로 실행 거부하고 성공으로 세지 않는다. 승인 registry·완료 core·기준·권한 정책은 바꾸지 않는다. 실제 예전 형식 실패는 과거 실패로 보존한다.

## 기준 연결

PRODUCT: 기존 제품 시나리오와 기본 runner 실행 확인. BOXBOX: 기본 선택/명시 선택/off/잘못된 mode·명령·누락 등 행동 회귀. REGISTER: 원격 변경 전 SHA일치 후 선택파일만 적용, 기존 verify-current.mts와 실제 모델 AC6의 정확 허용명령 확인 후 공식 verifyWork 실행/현재성 readback. 실제 GUI를 재실행하지 않고 과거 결과로 현재 PASS를 만들지 않는다.
