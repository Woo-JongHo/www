FAIL

20,000개의 서로 다른 Hook 실행은 모두 정확히 반응했고, 같은 연결의 중복과 늦은 시작도 억제됐습니다.  
`seq: 3` live가 먼저 도착하는 최초 snapshot 반례도 현재 renderer 경계에서 처리됩니다.  
다만 **대화 복원 중 들어온 live 사건이 snapshot에 없는데도 재생 이력으로 분류돼 반응을 잃는 결함**을 재현했습니다.  
부모의 실제 Electron 검사는 fixture의 대화 전환 단계에서 실패했고, 실제 Native 읽기 표본은 통과했습니다.

### 이전 두 결함

1. **확률적 중복 판정 — 해결.** `run-0`부터 `run-19999`까지 모두 pulse를 만들었습니다. 같은 연결 복원 뒤 오래된 run과 완료 뒤 늦은 시작은 억제됐고, 새 연결에서는 같은 ID가 다시 허용됐습니다. 20,000건 처리에는 약 130ms가 걸렸습니다. 일반 사건 순번은 scalar로 관리하며, 고유 run/read ID는 정확한 문자열로 보존합니다. 변경된 버킷만 복사하고 이전 state가 변하지 않는 것도 확인했습니다. [activity-sidebar.ts](../../../../src/activity-sidebar.ts#L452)

2. **snapshot/live 순서 경합 — 최초 반례는 해결, 복원 중 live는 미해결.** renderer가 snapshot 요청 전에 사건을 큐에 넣는 경계를 열고, 성공·실패 시 병합하는 연결을 확인했습니다. `seq: 3` live 뒤 `seq: 1` 연결과 `seq: 2` 목록을 받는 반례에서는 목록과 연결을 유지하고 `seq: 3`만 반응했습니다. 그러나 아래 순서에서는 새 활동을 놓칩니다.

### 추가 발견

- **중간 — 대화 복원 중 관측한 새 활동이 점멸하지 않습니다.** [activity-sidebar.ts](../../../../src/activity-sidebar.ts#L558), [renderer.tsx](../../../../src/renderer.tsx#L294)  
  연결 `seq: 1` 처리 후 대화 전환을 시작하고, 전환 대상 thread B의 새 Hook 시작 `seq: 2`를 live 큐에 넣었습니다. 이어 복원 snapshot에만 속한 연결 상태 `seq: 3`과 thread 설정 `seq: 4`를 전달하자, Hook의 최근 관측은 `seq: 2`로 기록됐지만 pulse는 빈 배열이었습니다.  
  main은 대화 복원 시 사건 로그를 교체하므로, 복원 중 받은 live 사건이 반환 snapshot에 없으면서 그 snapshot보다 낮은 seq를 갖는 경로가 있습니다. 현재 코드는 snapshot의 최대 seq 이하라는 이유만으로 그 live 사건을 복원 이력으로 처리합니다. 사용자는 실제 새 Hook 활동을 놓칠 수 있습니다. snapshot에 실제 포함된 사건과 큐에만 있는 live 사건을 구별해 순서대로 병합하고, 중복 snapshot 사건은 재점멸시키지 않는 회귀가 필요합니다. 재현은 실제 renderer가 호출하는 boundary·상태 함수를 이용한 합성 입력이며, Electron IPC 주입까지는 실행하지 못했습니다.

부모의 GUI 실패도 확인했습니다. [activity-app-server.ts](../../../../test/fixtures/activity-app-server.ts#L141)의 대화 목록과 복원 응답에는 Chat006이 요구하는 `originator: "www"`가 없습니다. fixture subprocess와 실제 대화 서비스로 재현했을 때 두 응답 모두 목록에서 제외됐고, 직접 열기도 거부됐습니다. 이는 **검사 fixture의 통합 결함**이며 사용자 대화 데이터의 제품 결함으로 단정하지 않습니다. fixture 응답을 현행 계약에 맞추고, 두 번째 합성 턴을 종료한 뒤 전환 검사를 다시 실행해야 합니다.

### 검증과 적용 범위

- **직접 통과:** 집중 회귀 104건, 타입 검사, 소스 정책, 워크플로 검사, `git diff --check`, 20,000개 run과 snapshot 합성 반례. 대상 변경 코드에서 TODO·skip·only 등 명백한 미완성 표식은 발견하지 못했습니다.
- **부모 실행 기록 검토:** 실제 Electron+합성 Native는 `thread-saved` 전환 실패로 종료 코드 1입니다. 실제 Native 읽기 표본은 종료 코드 0이지만, 이는 `projectNativeActivity` 표본이며 실제 Hook 알림은 0건입니다. 로그의 모델명은 실행 모델 관측값이 아니라 `basis: configured`입니다.
- **직접 미실행:** Electron GUI와 실제 Native 재실행, 정식 빌드, BoxBox. 저자의 현재 소스 `npm run check`·빌드 통과 기록을 확인했습니다. BoxBox의 안전 거부와 테스트 정렬 지적은 미해결 도구 결과로残습니다.

부모 실행 시작의 source digest는 `f41c51af43c5fab034563e22a8235f8c088a8a1aaa287e80cab21e3fa43fa911`이고、criteria digest는 `7103ab06faf91896f58778fdca459186c17070f990ed3da4bf41bef1db52a42d`입니다. 시작 기록의 38개 항목 중 디렉터리를 제외한 파일 digest는 현재 모두 일치합니다. 문서 입력을 포함한 현재 workflow source digest는 `14f3be4e8822962b847626c8ccb3c801d80d336cc340a07abefec4f4b3d6eb07`입니다.

AC-1의 목록·형식과 AC-3의 정확한 중복 억제는 집중 범위에서 확인했습니다. **AC-2와 AC-4는 복원 중 새 활동 누락 반례가 있으며**, AC-5의 Electron 통합 검사는 실패 상태입니다. 초안·승인·중단의 집중 회귀는 통과했으나 현재 소스의 해당 GUI 전체 시나리오는 완료되지 않았습니다.

요청 모델은 Terra이며 실제 모델 메타데이터는 관측하지 못했습니다. 자동 core의 Opus 정책과 BoxBox 결과는 제품 결함과 별개로 보존했습니다. 작업은 `verifying`이며, 이 판정은 게시나 모든 플랫폼의 완전 검증을 뜻하지 않습니다.