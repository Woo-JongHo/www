# Skills와 Hook 활동 사이드바 — 현재 인계와 이전 계획

UUID `work-16362e60-e269-4d5d-bf38-2869496efd2c`. 현재 단계·기준 결과·권한·남은 조건은 work.json과 verification.md의 최신 공식 read/status가 소유한다. 아래 이전 계획의 현재/GO 대기/검사 수는 당시 상태이며 최신 판정으로 읽지 않는다.

새 반례·문서 정합 교정 뒤 소스를 동결하고 같은 UUID의 기존 허용 exact 검증→문서 영향 검토→고유 읽기 전용 독립 감사→저작 보고서·앱 읽기→공식 완료/read/status를 회수한다. GUI·build·actual Native 읽기 표본과 제품 소스 교정은 Root가 소유한다. 다른 UUID의 PASS·영수증을 복사하거나 구현 계획을 성공으로 표시하지 않는다.

새 반례 이후 구현/검사/감사 성공은 이 계획에서 미리 주장하지 않는다. status가 done이면 추가 구현 지시를 만들지 않는다. 기준 ID·정의·필수 여부·권한·일반 검토 정책은 변경하지 않으며 commit/push/배포는 별도 실행 요청 전 수행하지 않는다.

## 이전 계획 전문 — 당시 단계와 다음 행동

<details>
<summary>문서 정합 전 계획 원문</summary>

# Skills와 Hook 활동 사이드바 단일 현재 인계

UUID `work-16362e60-e269-4d5d-bf38-2869496efd2c`. 현재 단계와 남은 조건은 같은 UUID의 work.json 및 공식 status가 소유한다. Root가 고정한 현재 소스에서 승인된 exact 검증 명령과 최신 GUI·actual Native 증거를 연결하고 문서 검토·고유 독립 감사·저작 보고서·완료 판정을 차례로 회수한다. GUI·build·actual Native 표본 실행은 Root가 소유하며 이 문서 담당자가 중복 실행하지 않는다. status가 done이면 새로운 구현 지시를 만들지 않는다.

1. 현재 여정/기준은 spec.md·work.json이고 과거 source/실패/summary는 보존한다. Source가 바뀌면 이UUID current 검사를 직접 다시 실행한다.
2. 선행검사가 남은GUI를 대체하지 않는다. 실제 Electron은 독립profile로 확인하고 actual Native·모델선택·OS실기를 합성검사와 구분한다.
3. 현재 정본에 대한 문서영향검토와 exact 직접원문의 ReviewAuthority/fullbinding/allowFallbackfalse actualTerra를 이UUID에서 실행한다. 감사pin에 mutable verification을 넣지 않고 공식append 후 review.usable을 확인한다.
4. 모든필수현재근거·문서검토·유효감사 조건이 맞으면 저작보고서→앱read→공식complete/read/status까지 수행한다. 부족하면 실제사유/해제조건을 남기고 제품bug는Root에게전달한다. source수정/원장수동PASS/commit/push는 하지 않는다.

<details>
<summary>이전 계획 — 현재 지시가 아님</summary>

# 구현 작업

## 단위 1: 등록 목록 수집

- 변경: main에서 `skills/list`와 `hooks/list`를 독립 호출하고 검증된 최소 snapshot을 사건으로 게시한다. renderer 시작·Skills 변경·스레드 생성에서 필요한 재조회를 연결한다.
- 관련 기준: `AC-1`, `AC-5`
- 확인: fixture가 실제 요청 method와 cwd/thread params를 확인하고 실패 목록을 다른 목록과 분리하는지 검사한다.

## 단위 2: 고정 목록과 활동 매핑

- 변경: 등록 snapshot과 구조화 Skill 읽기·Hook run 사건을 고정 행과 pulse로 바꾸는 순수 투영을 작성한다.
- 관련 기준: `AC-1`, `AC-2`, `AC-3`
- 확인: 이름 언급, 임의 문자열, 완료 중복, 동일 run, 늦은 시작, 다른 thread, 불명확 Hook 매핑, 이력 snapshot을 집중 검사한다.

## 단위 3: 최소 사이드바

- 변경: 현재 답변 흐름 화면을 Skills·Hooks 목록과 짧은 연결 상태로 단순화하고 행 반응·모션 축소·좁은 패널을 구현한다.
- 관련 기준: `AC-4`, `AC-5`
- 확인: 타입·빌드와 실제 Electron+합성 Native probe에서 목록, 대상 행 반응, 고정 순서, 기존 초안·승인·중단·다른 보기 보존을 확인한다.

## 직접 영향받는 후속 변경

현행 `CHAT-ACTIVITY-01`, 제품·구조·개발 검증 설명을 실제 변경에 맞춰 검토한다. 기존 `Chat/003` 기록과 과거 검증은 당시 이력으로 보존하며 이번 작업의 통과 근거로 옮기지 않는다.

## 재개할 다음 행동

두 번째 Terra 재검토의 확률 필터 오탐과 renderer snapshot/live 순서 결함을 같은 범위에서 수정했다. 일반 사건 20,000개는 scalar watermark로 처리하고 고유 Hook run 20,000개는 exact ID 상태로 모두 반응시키며 오래된 중복·완료 뒤 늦은 시작을 억제한다. bootstrap·대화 전환은 snapshot 요청 전 live 큐 경계를 열고 성공·실패·취소·재진입에서 seq 병합과 thread 격리를 지킨다. 다음 행동은 집중·타입·빌드·전체 검사와 공식 검증 원장을 현재 digest로 고정한 뒤 `.www/scratchpad/sidebar-final-20261113/final.md`에 마지막 빌드 digest를 남기는 것이다. 그 뒤 부모 환경에서 실제 Electron+합성 Native를 다시 실행하고 사용자 지정 Terra 읽기 전용 독립 검토를 수행한다. 실제 Hook 알림 미관측과 BoxBox의 프로젝트 관습 미승인 안전 거부는 합성 검증 또는 전역 설정 변경으로 꾸미지 않는다. 독립 검토가 수용되기 전에는 done·commit·push·배포하지 않는다.

</details>

</details>
