# WWW JSON scalar fields

사용자 승인: 2026-11-12의 직접 답변 “WWW 한정 JSON 규칙 승인”. 승인 질문은 같은 객체의 연속 3개 이상 scalar 필드를 키·콜론·값 열로 맞추며 전역·공개 preset과 안전 검사를 유지하는 WWW 프로젝트 규칙이었다.

## 적용 범위

정확한 lookup key는 `v1|json|object|mapping|key-colon>value`, 프로젝트 파일 scope는 `**/*.json`이다. 같은 부모 JSON 객체에서 연속된 3개 이상의 단일 행 scalar 속성만 비교한다. 키의 실제 최장 길이로 해당 표의 최소 폭을 정하고 키/콜론/값의 수평 공백만 맞춘다.

들여쓰기·물리 줄 수·속성 순서·값·문자열 내부 바이트는 바꾸지 않는다. 1~2개 속성, 배열·객체 값, 여러 행 값, 다른 부모의 속성은 이 승인으로 새 표를 만들지 않는다. 미지원 구간은 그대로 둔다.

## 검증과 예시

예시 `www-json-fields-positive`는 3개 scalar 속성의 전후를 보여 준다. `www-json-fields-two-row-counter`에서 두 행을 임의로 넓힌 after는 잘못된 결과이며 원본 before를 유지해야 한다.

예시는 이 프로젝트의 규칙 설명·검증을 위해 만든 합성 자료이며 source.license는 UNLICENSED다. 공개 BoxBox preset에 복사·승격하는 승인이 아니다.

자동 Align/Format의 기존 whole-file 승인 검사, 구문/토큰·주석 보존, parser 재검사, fixed point, 원자적 교체와 외부 변경 감지는 유지한다. 생성 writer가 공백을 다시 바꾸면 실제 마지막 후보를 재검사한다. 이 결정은 다른 언어·다른 lookup key·전역 DB의 승인이 아니다.
