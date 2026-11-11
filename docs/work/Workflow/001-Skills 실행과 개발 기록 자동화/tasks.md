# 구현 작업

## 단위 1: 프로젝트 opt-in 라우팅과 binding

- 변경: 제안된 `scripts/workflow/route.mjs`, `preflight.mjs`에 repo/worktree/branch/work-id binding, 명시 범위, 의도·상태 라우팅, Skill realpath/hash 확인을 구현한다.
- 관련 기준: `AC-1`, `AC-2`, `AC-3`
- 확인: falsy/malformed 입력, untrusted prompt, traversal, 외부 symlink, branch drift, 사용자 명명 Skill 우선, 불명확 요청을 테스트한다.

## 단위 2: 멱등 기록과 검증 gate

- 변경: 제안된 `record.mjs`와 gitignored `.www/runtime/` 계약에 작업별 배타 잠금, 잠금 내부 revision·event-id 검사, 원자적 상태 교체와 로그 재생, 검사 증거 연결, 비밀 redaction을 구현한다. revision 비교 후 rename만으로 동시성을 보장하지 않는다.
- 관련 기준: `AC-3`, `AC-5`, `AC-6`, `AC-8`
- 확인: concurrent event, duplicate stop, failed verifier, post 실패, 불명확 mutation, writer 충돌, 민감 문자열 fixture를 테스트한다.

## 단위 3: 검증된 host adapter

- 변경: host capability probe 뒤 `adapters/gjc.mjs`와 opt-in `run.mjs`를 연결한다. native context 전달과 native invoke, advisory와 hard gate, 요청 모델과 관측 모델을 구분한다.
- 관련 기준: `AC-2`, `AC-4`, `AC-7`
- 확인: 지원/미지원 hook·model·effort·mutation surface를 실제 설치 버전에서 preflight하고 unsupported 진단과 무단 fallback 부재를 확인한다.

## 단위 4: 단계 통합과 문서화

- 변경: spec → design → build → verify의 같은 work-id 인계와 요구 변경 승인 흐름을 통합하고 실제 활성화 명령·해제·한계를 문서화한다.
- 관련 기준: `AC-1`~`AC-8`
- 확인: 임시 저장소의 end-to-end 시나리오에서 승인 없는 쓰기 거부, 실제 검사 전 완료 거부, 명세 변경 승인, 중단 복구를 확인한다.

## 직접 영향받는 후속 변경

- 구현 승인을 받은 뒤에만 script/test/runtime ignore 규칙을 변경한다.
- 전역 `~/.gjc/agent/hooks`, `~/.codex/hooks.json`, `.gjc/skills`와 제품 `src/`는 별도 host 선택·활성화 승인 없이는 변경하지 않는다.
- 각 task의 실행 결과는 같은 작업의 `verification.md`와 `work.json`에 기록하며 별도 반복 계획 원장을 만들지 않는다.
