# Terra 검토 실행과 관측 연결

## 입증된 문제

설치된 codex exec --json은 thread.started와 판정 사건을 내지만 model 필드는 제공하지 않았다. 기존 prompt는 명령 실행을 전부 금지해 Codex의 파일 읽기도 막았다. 비 JSON 실행은 실제 CLI 초기 헤더에 model/provider/approval/sandbox를 출력했다. 실제 표본은 .www/evidence/terra-runtime-probe/에 있으며 사용량 제한 종료이므로 성공한 코드 검토로 세지 않는다.

## 최소 변경

- 새 Terra 호출은 기존 read-only/ignore-user-config/ephemeral/output-schema를 유지하고 --json만 제거한다.
- 새 결과는 stdout의 엄격한 최종 JSON과 stderr의 시작 CLI 헤더를 읽는다. Reading additional input 한 줄과 OpenAI Codex 버전·구분자 블록만 허용한다. 모델은 단일 필드, provider openai, sandbox read-only를 확인한다. 요청 argv에서 모델을 채우지 않는다. 이는 CLI가 관측한 실행 설정이며 서버 내부 라우팅의 독립 증명은 아니다.
- 과거 --json 영수증은 최초 thread.started의 thread_id와 선택적 model만 읽고 응답 사건의 model을 무시한다. 실제 모델 미관측 영수증은 재검토가 필요하다. 호출 형식에 맞는 파서만 사용하고 서로의 모델 필드를 재사용하지 않는다.
- 정확한 argv·실행 경로·소진·소스/기준/정책 맥락·영수증 해시·종료·출력 절단·실제 관측 모델 검증을 유지한다. 호스트 검토나 주입 fixture를 process 성공으로 변환하지 않는다.
- 파일 읽기·검색·해시용 읽기 전용 명령만 prompt에서 허용하고 테스트/빌드/설치/네트워크/파일·설정·Git 변경/게시를 금지한다.

## 검증

TERRA-READ는 입력 캡처로 허용/금지를 확인한다. TERRA-MODEL/RECEIPT는 새 plain 응답·CLI 헤더·누락/중복/위조 위치/모델 불일치/응답 손상·legacy JSONL·변조·비읽기전용 argv·주입 거부를 unit fixture로 검사한다. TERRA-LIVE는 현재 소스의 실제 성공한 모델 검토와 core 수용이 있어야 통과한다. 사용량 제한이나 인증 실패를 성공으로 바꾸지 않는다. 실제 모델 사용 가능 여부가 외부 차단이면 미완료로 기록한다.

영향 파일은 review.ts와 기존 workflow-review.test.ts 및 구조 snapshot·개발/구조 문서다. 정책의 기본 Opus·소진 시 Terra 조건은 변경하지 않는다. 현재 worktree에서만 변경하고 원본·커밋·push·병합을 건드리지 않는다.
