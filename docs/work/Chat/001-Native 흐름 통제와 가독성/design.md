# 설계

## 기준선과 재사용

- `src/main.ts`의 Electron main/preload/renderer 경계, JSON-RPC ID의 `string | number` 보존, 승인 허용 목록, 최근 2,000개 메모리 이벤트를 유지한다. Tauri 비교 스파이크나 백엔드 선택을 이번 작업으로 확정하지 않는다.
- `src/projection.ts`는 순수 투영 함수, `src/renderer.tsx`는 공용 React 표현 계층으로 계속 사용한다. 별도 core 계층이나 새 모델 요약 호출을 만들지 않는다.
- 현재 `Projection`은 `blocks(answer|command|files|approval)`, `working`, `turnId`뿐이고, command는 `id/command/output/running/exitCode`만 가진다. 요청 접수·승인 응답·transport·중단 요청/확인·업무 수용·검증 상태를 분리하지 못한다.
- 현재 renderer의 실행 박스와 승인 카드는 재사용하되, `exitCode === null`과 `0`, 열린 승인과 과거 승인, 실행 중과 연결 끊김을 시각적으로 구분한다. `src/styles.css`는 없고 스타일은 `src/index.html`에 있으므로 그 파일을 조건부 영향 파일로 본다.
- `test/fixtures/fake-app-server.mjs`, `test/projection.test.ts`, `test/rpc.test.ts`, `test/rpc.fixture.test.ts`의 합성 경로를 확장한다. 합성 fixture 성공은 live Codex나 GUI 수용 증거가 아니다.

## 경계와 데이터 흐름

1. main은 app-server에서 받은 notification/request/transport 사건에 `seq/at`과 원본 ID를 붙여 전달한다. renderer의 사용자 입력이나 도구 출력은 상태·권한 제어 입력으로 해석하지 않는다.
2. 투영은 thread/turn/item/request 연결 키를 보존하고 현재 turn에 속한 사건만 현재 진행으로 묶는다. 다른 turn의 완료·출력은 같은 ID 문자열만으로 합치지 않는다.
3. 상태는 최소한 `transport`, `turn`, `interrupt`, `approval` 축으로 나눈다. 요청 전송과 접수, 실행 중, 사용자 결정 대기, 중단 요청과 확인, EOF/불명확 결과를 별개 값으로 유지한다. agent loop 종료나 종료 코드 0을 업무 수용 또는 검증 통과로 승격하지 않는다.
4. command 블록은 관측된 명령·작업 경로·출력·종료 코드를 같은 실행 ID로 갱신한다. 실행 중에는 최근 출력을 보이고, 성공 완료는 기본 접힘, 실패·승인 대기는 강조한다. 출력 제한과 원본 보유 범위를 표시하고 절단된 내용을 복원 가능한 것처럼 보이지 않는다.
5. 공개 작업 설명은 Native가 실제 제공한 공개 답변과 사건에서만 연결한다. 미제공이면 미제공으로 표시하고 숨은 사고를 생성·추출하지 않는다. 더 자세한 설명은 app-server turn 입력에 명시적 공개 설명 지침을 넣을 수 있는지 실제 지원 필드와 주입 위치를 확인한 뒤 별도 결정한다.
6. 결과 요약은 관찰된 변경·명령·검사 사실과 Native 공개 답변을 연결해 파생한다. 별도 모델 호출은 하지 않으며, 미검증·실패·남은 일을 성공 요약에 숨기지 않는다.
7. renderer는 사용자의 실행 박스 접힘, 과거 읽기 스크롤, 선택, 입력 초안을 자동 갱신보다 우선한다. 하단 근처일 때만 따라가고 그 외에는 새 내용 표시 동작을 제공한다.
8. 승인 응답은 main의 pending map에서 한 번만 소비한다. renderer도 응답 중/응답됨을 표시하고 중복 클릭을 막는다. 전송 결과가 불명확하거나 EOF이면 자동 재전송하지 않는다.

## 영향 파일

| 파일 | 변경 이유 |
|---|---|
| `src/shared.ts` | 관측 상태와 실행/승인/transport 계약을 명시한다. |
| `src/main.ts` | turn·승인·중단 사건의 원본 연결, 중복 응답 방지, transport 종료 시 미결 상태를 전달한다. |
| `src/preload.ts` | 공유 계약 변경이 있을 때 기존 허용 목록 안에서만 연결한다. |
| `src/projection.ts` | turn별 사건 상관관계, 독립 상태 축, command/files/approval 수명주기와 결과 사실을 투영한다. |
| `src/renderer.tsx` | 실행 박스, 공개 설명, 승인·중단, 결과·검증·미해결, 스크롤/초안 보존을 표현한다. |
| `src/index.html` | 기존 인라인 스타일 체계에서 상태 강조와 접근 가능한 접힘·포커스를 추가한다. |
| `test/projection.test.ts` | 서로 다른 turn, 출력/완료 순서, null/0, EOF, 승인 상태 투영을 검증한다. |
| `test/rpc.test.ts`, `test/rpc.fixture.test.ts`, `test/fixtures/fake-app-server.mjs` | 원본 ID, 중복 승인, 중단, transport 실패와 불확실 결과를 검증한다. |

## 위험과 검증 전략

- `AC-1/AC-2`: 빈 입력·전송 실패·연결 끊김, delta/completed 순서, 같은 item ID의 다른 turn 혼합을 단위/fixture 테스트로 확인한다.
- `AC-3`: 숫자와 문자열 승인 ID, 중복 클릭·중복 request, 응답 후 EOF, 미지원 request를 테스트해 동일 승인에 최대 한 번 전송을 시도함을 확인한다. 이는 클라이언트의 중복 응답 방지이며 Native에서 효과가 정확히 한 번 발생한다는 보장이 아니다. 전송 결과가 불명확하면 미확인으로 남긴다.
- `AC-4`: 중단 요청 성공과 실제 `turn/completed` 상태, EOF, `exitCode: null`과 `0`을 분리한다. mutation 응답 불명확 시 재시도가 없음을 확인한다.
- `AC-6`: preload 허용 목록과 `contextIsolation/nodeIntegration/sandbox` 설정을 회귀 검사하고 출력 문자열이 HTML/명령으로 실행되지 않는지 확인한다. 승인 UI는 OS sandbox 보장으로 표현하지 않는다.
- `AC-7/AC-8/AC-9/AC-10`: 긴 출력, 성공/실패/승인/미제공 설명, 접힘, 키보드, 포커스, 입력 초안, 과거 스크롤을 실제 Electron GUI에서 확인한다. fixture QA와 live Codex 승인 왕복을 별도 기록한다.
- 이벤트 2,000개 절단 시 시작 사건이 사라질 수 있다. 이를 완료로 추론하지 않고 ‘이전 사건 없음/상태 불명’으로 표시한다.
- `AC-5`는 선택 기준으로 유지한다. 이번 작업에서 영속화나 동일 thread 재개를 끼워 넣지 않는다.

## 결정하지 않은 미래 범위

대화 영속화·재개, 서버/DB/동기화, 자동 모델 전환, 새 요약 호출, 실제 셸·PTY 임베딩, Electron/Tauri 최종 선택, 개발 하네스는 이 설계가 선점하지 않는다. 개발 하네스는 별도 작업 `work-e6fb4bac-a332-4515-b3f0-b8fb2adf6529`로 관리하며 Chat 제품에 자동 강제하지 않는다.
