# 구현 및 검증 작업

## 작업 원칙과 순서

같은 작업 UUID `work-84cda38b-7265-40d7-bf47-5a22ece1b3a2`에서 계속한다. 작업 상태·수용 기준의 정본은 `work.json`이며 이 문서는 실행 단위와 체크 목록만 소유한다. 칸반 카드 선택은 등록된 프로젝트 key와 원장 UUID의 쌍으로 상세를 조회한다. Native thread나 현재 대화로 작업을 추정하지 않는다. 기록된 원장 상태·기준 결과와 현재 코드에 대한 재검증은 별개 사실로 표시한다.

실행 순서는 이미 작업 트리에 반영된 병렬 구현 분업을 고려한다. backend와 frontend의 계약이 준비되면 Sol 통합이 해당 경계를 확인한다. Chat013 작업은 `src/native-activity.ts`와 `test/native-activity.test.ts`를 별도로 소유하므로 그 수정과 되돌림을 이 작업이 수행하지 않는다.

| 순서 | 기준 | 구체 단위 | 소유 / 제외 경로 | 통과 조건 | 검증 명령 후보 |
|---|---|---|---|---|---|
| 1 | KANBAN-DETAIL, KANBAN-SCOPE | `dashboardWork(selection, projectKey, workId)` 계약을 `WwwApi`와 안전한 `dashboard:get` 객체 인자로 연결한다. main이 등록 프로젝트와 고정 WWW 경로를 제공하고 renderer 입력 경로를 받지 않게 한다. 같은 프로젝트의 유일한 UUID 원장에서 원본 상태·기준·다음 단계와 `spec.md`, `design.md`, `tasks.md`, `verification.md`를 읽는다. 문서는 각 256 KiB, 총 1 MiB 한도를 적용한다. | Backend Terra: `src/dashboard.ts`, `src/shared.ts`, `src/preload.ts`, `src/native-session.ts`, `test/dashboard.test.ts`. 제외: `src/renderer.tsx`, `src/dashboard-view.tsx`, Native activity 모듈. | 올바른 프로젝트/UUID만 반환하고 원장을 수정하지 않는다. 누락·읽기 실패·과대 자료는 문서별 상태로 구별하며 잘못된 식별·모호한 목록·선택 경합은 명시 실패한다. | `bun test test/dashboard.test.ts`; `npm run typecheck` |
| 2 | KANBAN-DETAIL, KANBAN-TRUTH | 상세 pane에서 작업명·UUID·프로젝트·원본 상태·기록 기준 결과·차단 사유·다음 단계와 네 문서를 보여준다. 기준은 `work.json`에 저장된 결과임을 밝히고 현재 소스의 검증 통과로 표시하지 않는다. 계획 부재, 빈 문서, 읽기 불가를 각각 표시한다. 마크다운은 안전 렌더링하고 외부 링크·HTML·이미지를 실행하거나 탐색하지 않는다. 좁은 폭에서도 본문을 읽을 수 있게 한다. | Frontend Terra: `src/dashboard-view.tsx`, `src/dashboard.css`. 제외: IPC와 문서 읽기 구현, 원장 상태 변경. | 기록 사실과 현재 적용성 문구가 분리되고 네 문서의 available/missing/failed 및 빈 내용이 구별된다. 작은 화면에서 가로 넘침이 없고 키보드로 열기·닫기 가능하다. | `bun test test/dashboard.test.ts`; 이후 실제 Electron UI 시나리오 |
| 3 | KANBAN-DETAIL, KANBAN-SCOPE | 기존 전체/프로젝트별 칸반의 카드 선택을 상세 호출에 연결하고 응답을 현재 선택 key와 snapshot에 묶는다. 다른 카드·프로젝트 선택, 필터 변경, 새 snapshot, 늦은 응답이 이전 작업의 상세를 덮지 않도록 한다. 닫기 후 호출 카드로 초점을 돌린다. | Sol 통합: `src/renderer.tsx` 및 통합 문서. backend/frontend 소유 파일을 직접 덮어쓰지 않고 필요한 계약 조정은 담당자와 맞춘다. | 카드에서 같은 `projectKey + workId`가 요청되고 응답 식별자가 다르면 실패 표시한다. 선택 변경 후 이전 응답은 화면에 나타나지 않는다. 닫기 후 키보드 초점이 호출 카드로 돌아간다. | `bun test test/dashboard.test.ts`; `npm run typecheck` |
| 4 | KANBAN-DETAIL, KANBAN-TRUTH, KANBAN-SCOPE | 실패 후 재시도, 빈 목록·불완전 목록, 미등록 프로젝트·UUID 없음·동일 프로젝트 중복 UUID, 원장 변경 중 감지, 심볼릭 링크·하드링크·잘못된 UTF-8/JSON·문서별/누적 byte 한도를 검증한다. 원장 읽기 실패와 문서 단위 실패의 UI 차이를 확인한다. | Backend Terra가 회귀 픽스처를 소유하고 Frontend Terra가 상태별 UI를 확인한다. 제외: 실제 사용자 작업의 파일 수정. | 실패가 성공이나 빈 문서로 오인되지 않는다. 문서 한 건의 실패가 형제 문서 내용을 숨기지 않는다. 안전 경계에서 프로젝트 외부 bytes가 바뀌지 않는다. | `bun test test/dashboard.test.ts`; `node scripts/check-workflow.ts` |
| 5 | KANBAN-VERIFY | 정상·경계·실패·복원 UI 검증을 실행하고 결과·환경·현재 소스 적용성·미확인을 기록한다. 영향 검사와 전체 검사, 실제 Electron 화면과 독립 읽기 전용 감사를 각각 구별한다. | Sol 통합·검증 기록. 제외: 검증하지 않은 플랫폼·실모델을 통과 처리, 완료 상태 승격. | 아래 검증 행렬에서 실행한 항목만 결과를 기록한다. 필수 항목 미실행, 실패, 오래된 소스/기준, 독립 감사 미실행이면 완료로 판단하지 않는다. | `bun test test/dashboard.test.ts`; `npm run typecheck`; `npm run build`; `npm run check`; `node scripts/check-workflow.ts`; 실제 Electron GUI; 공유 검토 core의 독립 검토 |

## 검증 시나리오 행렬

| 구분 | 입력·행동 | 관찰해야 할 결과 | 기준 |
|---|---|---|---|
| 정상 | 등록 프로젝트의 원장 UUID 카드 열기 | 동일 프로젝트와 UUID의 원본 상태·기준 결과·다음 단계·네 문서가 표시되고 문서가 각각 열림 | KANBAN-DETAIL, KANBAN-TRUTH |
| 정상 | 여러 프로젝트에 있는 서로 다른 UUID 카드 열기 | 각 카드는 해당 프로젝트 원장에 귀속되고 같은 이름의 thread나 현재 대화와 무관 | KANBAN-DETAIL, KANBAN-SCOPE |
| 경계 | `design.md` 또는 `tasks.md` 없음, 네 문서 중 빈 파일, 검증 문서만 존재 | 누락·빈 내용·제공된 문서를 구분하고 계획이 없다는 사실을 명시 | KANBAN-TRUTH |
| 경계 | 원장 기준이 `unverified`, `passed`, `failed`, `blocked`이고 이전 evidence가 존재/없음 | 원장 기록과 증거 개수를 그대로 보이며 “현재 재검증 미평가” 안내를 유지 | KANBAN-TRUTH |
| 경계 | 파일 256 KiB 초과 또는 총 문서 읽기 1 MiB 초과 | 해당 문서는 실패 상태와 한도 사유로 표시하고 다른 안전한 문서는 계속 확인 가능 | KANBAN-SCOPE |
| 오류 | 임의 project key, 잘못된/없는 UUID, 같은 프로젝트의 중복 UUID | 상세를 다른 작업으로 추정하지 않고 API 오류를 사용자에게 알림 | KANBAN-DETAIL, KANBAN-SCOPE |
| 오류 | 문서 symlink/hardlink 탈출, 잘못된 UTF-8, 손상 JSON 또는 목록의 불완전 수집 | 외부 내용을 읽거나 성공으로 표시하지 않으며 범위/기록 오류와 문서별 오류를 구분 | KANBAN-SCOPE, KANBAN-TRUTH |
| 오류 | 상세 읽기 실패 뒤 재시도 선택 | 오류와 재시도 동작이 보이고 다시 실패하면 실패가 계속 표시됨 | KANBAN-TRUTH, KANBAN-VERIFY |
| 복원·경합 | 카드 A 요청이 지연된 동안 카드 B 또는 다른 프로젝트를 선택한 뒤 A 응답 도착 | B의 선택과 내용이 유지되고 A의 늦은 응답은 폐기 | KANBAN-SCOPE |
| 복원·경합 | 상세가 열린 상태에서 snapshot 갱신·필터 변경·취소 작업 숨김 변경 | 예전 snapshot 응답이 새 선택을 덮지 않고 더 이상 표시 대상이 아닌 상세가 제거됨 | KANBAN-SCOPE |
| 복원·접근성 | 키보드로 카드 열기, 상세 닫기, 다시 열기 | 제목에 초점 이동, 닫기 후 원래 카드로 초점 복귀, 문서 펼침은 키보드 조작 가능 | KANBAN-VERIFY |
| 반응형 | 좁은 창에서 긴 UUID·경로·마크다운 문서 읽기 | 가로 페이지 overflow 없이 텍스트와 상태를 확인할 수 있음 | KANBAN-VERIFY |

## 진행 체크

- [x] 요청 UUID와 기존 네 기준을 확인했다. (2026-11-16, `work.json`, `spec.md`)
- [x] 구현 소유와 제외 파일을 backend Terra, frontend Terra, Sol 통합, 별도 Chat013 변경으로 구분했다. (2026-11-16, 현재 작업 분업 전달)
- [ ] backend 상세 reader와 IPC 경계 테스트를 완료하고 공식 시도로 기록한다.
- [ ] frontend 상세 pane의 정상·빈·오류 상태 및 접근성 테스트를 완료한다.
- [ ] renderer 통합 후 선택 경합·응답 식별자·닫기 초점 복원을 집중 검증한다.
- [ ] 등록 목록 누락·중복·경로 탈출·잘못된 문서·byte 한도를 실패 주입으로 검증한다.
- [ ] strict typecheck, build, repository check를 실행해 각각의 결과와 입력 범위를 기록한다.
- [ ] 실제 Electron에서 전체 폭·좁은 폭·키보드·실패 재시도 흐름을 확인한다.
- [ ] 별도 읽기 전용 독립 감사를 수행하고 관측 모델·원문 위치·판정 적용성을 기록한다.
- [ ] 필수 기준과 현재 증거 적용성을 확인하기 전까지 완료 상태로 승격하지 않는다.
