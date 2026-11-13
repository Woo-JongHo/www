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
