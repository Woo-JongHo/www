# 채팅 개편 최종 두 규칙 한정 승인

사용자 직접 승인 원문: `진행하자.`

직전 질문의 두 규칙 승인 등록·공식 Align·후속 전체 검사와 독립 검토에 대한 응답이다. 승인자 `project-user`, 등록일 `2026-11-15`. 실제 응답 연결은 `.boxbox/approvals/chat-final-two-response.json`에 보존한다.

## www-chat-final-ts-01

- 파일: `scripts/workflow.ts`
- 정확 key: `v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon`
- 양성/문자열 보존 반례: 기존 `www-ts-v1-616c1c8ea868-positive`, `www-ts-v1-616c1c8ea868-literal-counter`의 before/after를 새 ID `www-chat-final-ts-01-positive`, `www-chat-final-ts-01-literal-counter`로 복제한다.

## www-chat-final-ts-02

- 파일: `src/architecture-tree.ts`
- 정확 key: `v1|typescript|ObjectLiteralExpression|registration|colon>value>comma`
- 양성/문자열 보존 반례: 기존 `www-ts-v1-246a8999b89d-positive`, `www-ts-v1-246a8999b89d-literal-counter`의 before/after를 새 ID `www-chat-final-ts-02-positive`, `www-chat-final-ts-02-literal-counter`로 복제한다.

기존 승인·예시는 변경하지 않는다. 다른 파일·새 key·glob·전역 승인으로 확대하지 않는다. 두 파일의 완전한 proof를 확인한 뒤 공식 dry-run → Align → 재Align 고정점 → source check만 수행한다. 토큰·문자열·AST·줄·들여쓰기를 보존하는 수평 공백만 허용한다. 프로젝트 off 설정은 유지한다. 엔진·설치본 변경, commit·push는 허용하지 않는다.
