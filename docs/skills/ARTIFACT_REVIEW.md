# 구현 전 산출물 검토와 도구 출처

## 준비와 기록

명세 끝에는 `spec`, 설계·작업 분해 뒤 구현 인계 전에는 `consistency`를 검토한다. 공식 진입점 `node scripts/workflow.ts`의 다음 action을 사용한다. 각 호출은 JSON 옵션 객체 하나를 받는다.

- `artifact-context`: `workId`, `kind`를 받아 대상 문서 원문·기준·검토 항목·digest를 읽는다.
- `artifact-review`: `workId`, `direct: true`, `review`를 받아 기존 작업 잠금 안에서 이력을 추가한다.
- `artifact-status`: `workId`의 종류별 최신 검토를 `not_run`, `current`, `stale`로 읽는다.
- `tool-inventory`: 선택적인 `skill`(기본 `www-build`)의 정본 경로·SHA256·발견 경로 일치 여부를 읽는다. 모델이나 검토를 실행하지 않는다.

## 의미 검토의 책임

검토자는 context의 실제 문서와 수용 기준을 읽고 다음을 판단한다. `brief`는 작은 수정의 짧은 근거, `full`은 여러 사용자 여정·변경 경계가 있는 기능의 상세 근거에 쓴다. 깊이와 관계없이 모든 항목에 판단과 이유를 남긴다. 이미 정한 사항은 다시 질문하지 않는다.

여정·경계·성공 기준과 구현/검증 coverage의 내용 판단은 [사용자 여정과 기준별 추적](WORKFLOW.md#사용자-여정과-기준별-추적)을 적용한다. 명세의 입력·행동·기대 결과에서 기준과 검사 방법을 찾고, 설계·작업에는 그 흐름을 끝까지 잇는 책임·호출부·검증 단위가 있는지 본다. 계획 인계는 [같은 UUID의 원장과 문서 연결](WORKFLOW.md#계획과-칸반-인계)을 확인한다. 문서가 이 연결을 설명하는지 판단하는 패스이며 실제 사용자 행동을 실행한 증거는 아니다.

| kind | 항목 ID | 확인할 내용 |
|---|---|---|
| spec | purpose | 요청 목적·포함/제외 범위와 기준이 연결되는가 |
| spec | journeys | 사용자 여정과 독립 검증 방법이 필요한 만큼 정의됐는가 |
| spec | boundaries | 경계·오류·복원 상황과 중요한 미결정이 정리됐는가 |
| spec | outcomes | 관찰 가능한 성공 기준이 work.json에 정의됐는가 |
| consistency | coverage | 모든 기준에 필요한 구현·검증 작업이 연결되는가 |
| consistency | alignment | 설계·작업·명세의 동작과 제약에 충돌이 없는가 |
| consistency | terminology | 같은 개념·상태·데이터를 일관되게 부르는가 |

review는 준비한 `digest`, `kind`, `depth` (`brief` 또는 `full`), 한국어 `summary`, `checks`를 가진다. 각 check는 `id`, `result` (`satisfied`, `finding`, `not_applicable`), 한국어 `reason`, `references` 배열이다. reference는 context가 반환한 저장소 상대 `path`와 1부터 시작하는 실제 비어 있지 않은 `line`이다. `not_applicable`만 근거 위치를 생략할 수 있고 적용되지 않는 이유는 필요하다.

`consistency`는 추가로 모든 기준의 `coverage`를 제출한다. 각 항목은 `criterionId`와 `tasks` 참조 배열이며 위치는 해당 작업의 `tasks.md` 행이다. 작업을 연결하지 못한 기준도 `tasks: []`로 명시하며 status가 지적으로 보고한다. 작은 단일 수정에 tasks.md를 만들지 않았다면 그 이유를 check와 summary에 남긴다. 빈 coverage를 통과로 보고하지 않는다.

검토 결과의 판단은 에이전트가 책임진다. 코드는 항목 완전성·문서 위치·기준 연결·현재성을 확인한다. 코드가 문장의 의미나 지적의 진위를 입증한 것으로 읽지 않는다. 지적은 소유 문서에서 수정하고 다시 검토한다. 미실행·지적·오래된 검토는 실행 맥락에 제공하되 이번 버전에서 자동 구현 차단이나 완료 조건으로 확대하지 않는다. 기존 권한·실제 검증·독립 검토는 유지한다.

## 출처와 실행 근거

정본은 개발 역할·선택 스킬·공통 계약·데스크톱 프로필·검토 정책이다. 발견 경로는 정본을 대체하지 않으며 일치·불일치·외부 경로·누락을 별도로 표시한다. 발견용 파일이 디렉터리·과대 파일이거나 읽을 수 없으면 `invalid`로 표시하고 유효한 정본 조회는 유지한다. 정본 자체가 잘못된 파일이면 조회를 거부한다. 공식 개발 단계는 실제 제공한 문서에만 `provided: true`를 붙이고 결과와 로컬 실행 영수증에 남긴다. 호스트가 의미상 적용했다는 별도 근거를 수집하지 않으므로 `hostAcceptance: unconfirmed`를 유지한다.

검토 이력은 `work.json.workflow.artifactReviews`에 보존한다. 문서·기준·직접 요청 연결이 바뀌면 기존 결과는 오래된 것으로 읽는다. 기존 기록을 일괄 변환하지 않으며 검토 제출이 AC를 passed로 바꾸지 않는다.
