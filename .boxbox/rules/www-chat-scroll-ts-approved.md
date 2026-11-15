# 채팅 스크롤 TypeScript 한정 승인

## 사용자 승인과 정확한 적용 범위

사용자 직접 승인 원문: `boxbox 승인하자 진행해`

승인자: `project-user`. 등록일: `2026-11-14`.
기존 작업: `work-673ddd6a-b9e6-4dd2-99c5-c37f4b02c96b/P1`.

이 승인은 직전 요청의 `scripts/verify-chat.ts` 내 9 FIXABLE 선언그룹에 한정한 등록·공식 Align 실행 승인이다. 정확 scope는 `scripts/verify-chat.ts` 한 파일이며 다음 5개 exact key만 추가한다.

1. 규칙 ID: `www-chat-scroll-ts-01`
   - exact key: `v1|typescript|Block|declaration-equals|equals>semicolon`
   - 양성 예시 원본: `www-ts-v1-24918147df36-positive`
2. 규칙 ID: `www-chat-scroll-ts-02`
   - exact key: `v1|typescript|Block|declaration-extended-equals|equals>semicolon`
   - 양성 예시 원본: `www-ts-v1-aba3c0c460d5-positive`
3. 규칙 ID: `www-chat-scroll-ts-03`
   - exact key: `v1|typescript|Block|declaration-values|equals>semicolon`
   - 양성 예시 원본: `www-ts-v1-28167155fd89-positive`
4. 규칙 ID: `www-chat-scroll-ts-04`
   - exact key: `v1|typescript|SourceFile|declaration-equals|colon>equals>semicolon`
   - 양성 예시 원본: `www-ts-v1-3a4addb53a6c-positive`
5. 규칙 ID: `www-chat-scroll-ts-05`
   - exact key: `v1|typescript|SourceFile|declaration-extended-equals|equals>semicolon`
   - 양성 예시 원본: `www-ts-v1-aba3c0c460d5-positive`

모든 규칙은 토큰·AST·줄·들여쓰기를 보존하며 승인된 토큰 사이의 수평 공백 정렬만 허용한다. 원문 문자열 내부 공백 변경은 금지한다. 소스 정렬에는 공식 Align만 허용하며 수작업 정렬·별도 formatter·전역 정렬을 허용하지 않는다. 이 승인으로 다른 파일 scope, 기존 28개 규칙, 전역/JSON/formatter 승인 범위를 확대하지 않는다.

각 규칙의 양성 before/after는 `.boxbox/examples.jsonl`에 동일 규칙 ID의 `-positive`로 복제한다. Block 3개는 위 원본을 그대로 재사용한다. SourceFile 2개는 위 원본의 `function sample()` wrapper와 각 내부 행 첫 두 공백만 제거한 before/after를 새 ID로 만든다. 이는 합성 예시의 context만 SourceFile로 바꾸며 원본 예시나 실제 소스의 줄·들여쓰기를 변경하지 않는다.

각 규칙의 `-literal-counter`는 위 원본과 짝인 기존 문자열 변조 금지 bad 반례를 새 ID로 복제한다. 반례 before는 `const value = "keep  inner spaces";`이고 금지된 after는 `const value = "keep inner spaces";`이다. 검사기가 PASS여도 이 문자열 내부 공백 변조는 허용하지 않는다. 각 예시 contentHash는 `SHA256(before + NUL + after)`다.

기존 JSONL 행과 기존 규칙 문서를 변경·삭제하지 않는다. 새 계획·작업을 만들지 않는다. 이번 담당자는 정책 metadata만 등록하며 `scripts/verify-chat.ts`를 수정하지 않는다. assertions는 기존 schema의 기대값이며 이번 실행의 검사 결과가 아니다. 테스트·검증 gate·lint·format/align은 실행하지 않았고, 검증과 공식 Align은 부모 실행자가 담당한다. commit/push는 허용하지 않는다.
