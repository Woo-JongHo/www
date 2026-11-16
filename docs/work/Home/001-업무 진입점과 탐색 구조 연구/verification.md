# 연구 확인과 남은 검증

## 실제 조사 범위

2026-11-15에 연구 본문의 공식 출처 14개를 열어 확인했다. Figma·VS Code 공식 원문 6개는 독립 수집 에이전트가 읽고 `/private/tmp/www-entry-ui-research/reference-patterns.md`에 전문을 보존했으며, 저자가 이 내용을 읽고 Linear 공식 원문·W3C 지침·현재 WWW 소스 및 문서와 함께 종합했다. 이 에이전트는 최종 감사자가 아니며 연구 수집만 담당했다. 해당 로컬 scratchpad는 공유 가능한 영구 출처가 아니므로 주장별 공식 URL을 연구 본문에 회수했다.

현행 대조 대상은 `src/renderer.tsx`, `src/index.html`, `src/projects.ts`, `src/reports-service.ts`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/design-system.md`, `docs/specs/ecosystem.md`다. TypeScript나 제품 파일은 이번 작업에서 수정하지 않았다.

R1은 공식 패턴 표와 신뢰 한계, R2는 대안 비교·정보 구조·상호작용·상태 소유·너비 규칙, R3는 대표 여정과 열린 결정에 연결한다. 이 연결은 저자의 대응 설명이며 독립 감사 통과나 실행 시험 결과가 아니다. 원장의 기준 결과는 자동으로 통과 처리하지 않았다.

## 문서 구조 확인

- `git diff --check -- docs/work/Home docs/work/INDEX.md`: 출력 없이 exit 0. 공백 오류 검사이며 내용의 타당성 검증이 아니다.
- `node scripts/check-workflow.ts`: exit 0, ‘워크플로 계약 검증 통과: 스킬 6개, 중첩 작업 기록, 목차, 템플릿, 예시’. 기록 형식·참조 검사이며 UX와 연구의 사실성을 증명하지 않는다.
- 연구 본문에서 TODO·test.skip·test.only·자리표시·미구현 패턴 검색은 일치가 없었다. 실제 업무·승인 건수처럼 보일 수 있는 레이아웃 내용은 예시라고 명시했다.

공식 `scripts/workflow.ts`의 action open 호출은 `execute: true` 필요 오류로 접수를 수행하지 않았다. 문서의 action 인터페이스 안내와 실제 저작 실행 경로의 차이를 확인했고, 기존 내부 work API의 open으로 접수 기록만 생성했다. 개발 호스트나 제품 구현을 실행한 것으로 기록하지 않는다.

## 독립 감사 미실행

공유 `scripts/workflow/review.ts` core를 통해 읽기 전용 Opus 감사를 실제 요청했다. 요청 모델은 opus, 대체 실행은 비활성화했다. 검토 입력은 연구 본문과 기준 원장이며, 원문 영수증은 아래 위치다.

- review ID: `review-8c2d1472-1ec0-4cbc-8c78-861a4cf99eae`
- 영수증: `.www/evidence/reviews/review-8c2d1472-1ec0-4cbc-8c78-861a4cf99eae/opus.json`
- source digest: `6d6a6d1b795c995b107e8872267e96ad84a501bb6eb5bb7476ae3788c75ee812`
- exit 1, `verdict: not_run`, `observedModel: null`, modelUsage 비어 있음.
- 관측 오류: `Not logged in · Please run /login`.

모델 검토가 시작됐다는 증거가 없으므로 불합격도 통과도 아닌 미실행이다. 로그인 실패를 사용량 소진으로 분류하지 않고 모델을 낮춰 대체하지 않았다. 필수 감사가 남아 있어 최종 완료를 선언하지 않는다.

## 미실행과 다음 검증

실제 참고 앱 조작, WWW GUI 실행, 시제품 사용성 시험, 운영체제별 단축키·한글 IME·포커스·창 크기·날짜 경계 시험은 실행하지 않았다. 연구의 너비와 동작은 시험 가능한 권고안이며 제품 적용 상태가 아니다. 제품 파일 변경이 없으므로 타입·빌드·제품 테스트를 의례적으로 실행하지 않았다.

다음으로 Opus 인증이 복구되면 같은 연구 입력으로 독립 감사를 재실행한다. 이후 구현 파일럿에서 홈→업무 상세→관련 대화→복귀와 실행 중 승인 도착을 먼저 관찰하고, 연구 본문의 나머지 여정을 확인한다. 연구 기록의 검증 범위를 제품 완성도 통과로 확대하지 않는다.
