# 초기 표시 공백과 채팅 흐름의 예비 진단

## 관측과 요청

사용자는 실행 표시·경과 시간만 보이는 초기 공백이 1분 넘고 첫 내용 이후에는 개별 표시되는 것으로 기억한다. 대기 화면의 모양보다 왜 행동 흐름이 보이지 않는지 먼저 확인하라고 요청했다. 02와 04를 연결해 다루되 초기 지연 원인과 채팅 표현의 미구현은 구분한다.

## 소스에서 확인한 사실

- src/renderer.tsx의 run은 새 대화일 때 startThread가 반환된 뒤 startTurn을 요청한다. src/main.ts의 thread:start는 connect와 thread/start 응답을 기다린다. 실제 사용자 입력은 lifecycle.start의 beforeStart 이후 turn/start로 전달된다.
- main의 message 핸들러는 사건을 받으면 publish하고 renderer 구독은 현재 선택·대화 검사를 통과한 사건을 consumeEvents로 전달한다. 확인한 경로에는 턴 완료까지 전체 사건을 의도적으로 모으는 처리가 없다. bootstrap·전환 중에는 별도 큐가 있으므로 특정 표본의 버퍼링 여부는 수신 로그로 판별해야 한다.
- projection.ts는 공개 commentary·plan·공개 reasoning summary를 설명 블록으로 만든다. 빈 reasoning 시작 사건만으로 설명 문장은 생성하지 않는다. renderer의 WorkFlow는 상태·경과 시간·개수를 표시하고 Native 공개 설명이 없으면 기다리는 문구를 표시한다. 실제 사건을 연결해 앱이 별도 진행 설명을 만드는 경로는 현재 확인한 채팅 코드에 없다.
- native-chat.ts는 새 대화에 첫 도구 전 설명 지침을 넣고 턴에 detailed 공개 요약을 요청한다. 요청했다는 사실은 즉시 제공된다는 보장이 아니다.

## 기존 원장의 시각 근거

사용자가 인용한 첫 공개 설명과 일치하는 원장을 찾았다. 정제한 시각 근거는 .www/evidence/work-632e43ce-dcb8-4726-ad34-8fe85034b6fd/initial-timeline.json에 보존했다. 원문의 사용자 내용·명령 출력·추론 원문은 증거 사본에 넣지 않았다.

- task_started 기록부터 실제 질문의 user message 기록까지 약 122.4초다.
- 해당 user message 기록부터 첫 공개 설명 완료 기록까지 약 3.1초, 첫 명령 완료까지 약 4.5초다.
- 따라서 이 표본의 긴 공백은 원장상 질문 기록 이전 구간에 놓인다. 공개 설명을 모델이 1분 이상 생성하지 않았다는 결론은 이 기록으로 뒷받침되지 않는다.
- 원장 기록 시각은 앱 클릭·RPC 송수신·renderer paint 시각과 같다고 단정할 수 없다. 이 표본이 thread/start 준비 지연인지 turn/start 내부 준비 지연인지, 저장 시점 차이인지 확정하려면 앱/서버 경계를 함께 측정해야 한다.

## 경쟁 가설과 다음 판별

1. 연결·새 스레드·턴 준비 구간이 길다: 전송 클릭, initialize·thread/start·turn/start의 시작/응답 시간을 같은 시계 기준으로 수집한다.
2. 사건은 빨리 받지만 필터·초기 큐·투영 때문에 채팅에 늦게 표시된다: main 수신, renderer 수신, consumeEvents, 첫 콘텐츠 paint 시각을 비교하고 사건 종류·식별자만 기록한다.
3. 초기 준비 사건은 수신하지만 채팅 표현이 없다: 준비·도구·공개 설명 사건의 표시 대응표를 만들고 Native 설명과 앱 설명의 출처를 구분한다.

## 현재 결론과 한계

04의 앱 진행 설명 경로 부재는 정적 소스로 확인했다. 02의 긴 공백은 기존 원장상 실제 질문 기록 전 구간에 있어 초기 준비 경계를 우선 조사할 근거가 있다. 최초 지연의 정확한 원인은 미확정이며 새 실측 재현·제품 수정·최종 독립 감사는 수행하지 않았다. 대기 카드 선택은 철회했고 그 질문의 답변을 진행 조건으로 삼지 않는다.

## 2026-11-16 후속 조사: 경계 계측과 실제 Native 표본

앞 절의 소스 관찰과 미실행 표기는 예비 진단 당시 이력이다. 이후 구현·실측이 진행됐으며 이번 후속 조사는 아래 기존 증거 파일을 읽어 관측 가능한 범위만 정리했다. 이번 패스에서 새 Native 요청, 모델 호출, 성능 실험이나 독립 검토를 실행하지 않았다. 제품 코드와 `work.json`도 변경하지 않았다.

### 기존 122초 표본에서 분리할 수 있는 범위

정제 원본 [initial-timeline.json](../../../../.www/evidence/work-632e43ce-dcb8-4726-ad34-8fe85034b6fd/initial-timeline.json)은 출처 SHA-256 `076386ac91f0c68a6cd104b23c7709028084d9f291f6ac4565a06ef9d8269dfe`를 보존한다. 사건 시각은 다음과 같다.

| Native 원장 사건 | UTC 기록 시각 | 앞의 기준 사건과 간격 |
|---|---|---:|
| task_started | 00:08:54.619 | 기준 |
| context_settings | 00:08:56.898 | task_started 이후 2.279초 |
| user_message_recorded | 00:10:57.033 | task_started 이후 122.414초 |
| first_public_message_completed | 00:11:00.099 | user_message_recorded 이후 3.066초 |
| first_command_completed | 00:11:01.556 | user_message_recorded 이후 4.523초 |

이 파일은 스스로 원장 기록 시각이며 앱 IPC 수신·화면 반영 시각이 아니라고 명시한다. 클릭, initialize, thread/start, turn/start 송수신, main 알림 수신, renderer 수신·consume·paint 시각이나 같은 사건을 잇는 IPC seq가 없다. 따라서 **과거 표본의 Native 수신→renderer 지연은 실제로 분리 계산할 수 없다.** 122.414초를 연결 준비나 Native 생성 시간으로 배정하거나 renderer 지연을 0으로 간주할 근거도 없다. 확인 가능한 결론은 긴 간격이 원장상 user message 기록 전에 있다는 것까지다. 첫 공개 설명의 완료 기록 시각은 생성 시작이나 화면 표시 시각과도 다르다.

### 새 단일 요청 표본에서 관측한 구간

[실행 요약](../../../../.www/session-implementation/real-native-timing.md)과 [정제 메타데이터](../../../../.www/evidence/native-timing-live-DTuec7/summary.json)를 확인했다. 격리 Electron profile·빈 workspace·설치된 실제 Codex app-server를 사용했고 합성 fixture는 아니다. 도구 없는 단문을 1회 보냈으며 턴 완료와 응답 표식 일치 DOM을 관측했다. 실험 도중 Home 진입 경합 수정이 진행됐으므로 해당 표본은 그 수정 전 빌드의 결과다.

| main 경계 | 요청 기준 시작→완료 ms | 직접 계산한 구간 ms |
|---|---:|---:|
| 첫 connect | 0.84→950.20 | 949.36 |
| thread/start | 950.42→1174.96 | 224.54 |
| 턴 시작 전 재사용 connect | 1175.88→1175.91 | 0.03 |
| turn/start | 1176.06→1238.09 | 62.02 |
| turn/start 완료→첫 의미있는 Native 수신 | 1238.09→3571.97 | 2333.89 |

모든 위 차이는 같은 trace의 main 단조 시계 안에서만 계산했다. `first-native completed`의 source는 native이며 `request completed`는 turn/start 응답 수락이다. 이 표본에서 첫 의미있는 수신은 요청 시작 후 약 3.57초였지만 최종 답변이나 화면 첫 paint와 같은 사건이 아니다. initialize 별도 사건은 이 메타데이터에 없어 connect 949.36ms를 initialize 단독 비용으로 분해할 수 없다. 연결이 다른 호출에서 이미 준비 중이었는지 여부도 이 정제 파일만으로 확정하지 않는다.

renderer `frames`의 첫 해당 기록은 같은 trace·`seq:38`의 `first-native completed` 알림에 대해 수신 후 두 번째 animation frame 근사까지 91.7ms다. 이것은 React commit 이후 두 번째 frame을 기다린 **renderer 내부 구간**이며 실제 공개 설명 DOM의 첫 paint를 직접 계측한 값은 아니다. 후속 기록은 같은 seq를 다시 담아 295.7ms, 395.4ms 등으로 늘어난다. 이들을 새로운 수신 표본이나 최초 렌더 지연으로 세지 않는다. main과 renderer의 원점 상관을 기록하지 않았으므로 main 수신→IPC 전달→renderer 수신의 순수 전송 지연, 필터·큐·consume별 비용은 여전히 분리할 수 없다.

### 새 두 탭 동시 요청 표본

[실행 요약](../../../../.www/session-implementation/real-native-sessions.md)과 [정제 메타데이터](../../../../.www/evidence/native-sessions-live-icxcTQ/summary.json)는 최신 dist에서 실제 Native 요청 2회의 중첩과 각각의 완료를 보고한다. 서로 다른 session·thread·turn의 요청이며 첫 단일 요청 표본과 빌드 및 부하 조건이 다르다.

| 각 요청 내부 main 구간 | 탭 A ms | 탭 B ms |
|---|---:|---:|
| 첫 connect 시작→완료 | 3925.50 | 3614.89 |
| thread/start 시작→완료 | 1020.84 | 1016.99 |
| turn/start 시작→완료 | 428.64 | 125.87 |
| turn/start 완료→첫 의미있는 Native 수신 | 4821.00 | 5865.72 |
| 요청 시작→첫 의미있는 Native 수신 | 10240.82 | 10630.61 |

표는 각 trace 내부의 차이이며 탭 사이 renderer 시각을 main 값과 섞지 않았다. 첫 의미있는 수신은 약 10.24초와 10.63초였다. 이 표본도 122초 현상을 재현하지 않았고 부하·연결·모델 처리·네트워크의 원인을 분리하지 않았다. 두 실험 모두 실제 선택 모델 식별, 이전 문제의 환경과 요청 일치, 반복 분포를 확보하지 않았다. 따라서 새 수치와 122.414초를 전후 비교하거나 개선율로 계산하지 않는다.

### 미확정 원인과 다음 재현

| 경쟁 가설 | 현재 증거로 가능한 판단 | 다음에 필요한 관측 |
|---|---|---|
| 연결·새 스레드 또는 복원 준비 지연 | 새 표본에서 각 대기 구간을 분리했지만 과거 122초의 소속은 미확정 | 문제 당시 작업 폴더·새/기존 대화·연결 상태를 구분한 재현에서 click/send, connect, initialize, thread/start 또는 read/resume/history, turn/start 요청·응답을 같은 trace로 수집 |
| Native가 요청을 받은 뒤 첫 내용을 늦게 생성 | 새 표본의 turn/start 응답→의미있는 수신 간격은 실측됨. 생성·전송·서버 내부 준비는 이 구간 안에서 미분리 | turn/start 송신·응답과 첫 의미있는 알림의 종류·thread/turn ID·main 수신 시각을 기록하고 원장 사건과 같은 요청임을 연결. RPC 응답만으로 생성 시작을 단정하지 않음 |
| main 수신 후 IPC·선택 필터·큐·투영·렌더가 지연 | 새 renderer 내부 frame 근사는 있으나 과거 구간과 순수 IPC·consume 비용은 미확정 | 같은 seq의 main 수신/송신, renderer 최초 수신, 필터·큐 이유와 해제, consume 진입/종료, 해당 내용 DOM commit 및 두 번째 frame을 기록. 프로세스 간에는 왕복 상관 또는 명시한 시계 변환 근거를 확보 |
| 준비 사건과 공개 설명의 표현 공백 | 준비·실제 사건의 출처를 구분하는 계측과 화면 표현이 추가됨 | 원래 긴 공백을 재현해 각 시점에 어떤 준비 사실·실제 Native 내용이 수신되고 보이는지 관찰. 대기 안내가 보인다는 사실을 지연 단축으로 판정하지 않음 |

다음 재현은 동일한 최소 요청을 새 대화의 미연결 상태, 연결 재사용 상태, 기존 대화 복원 상태로 나누고 우선 단일 탭에서 수행한다. 원래 문제가 발생한 작업 폴더·설정·요청 특성을 확인할 수 있는 경우 그 조건을 따로 연결한다. 재현되지 않으면 제한된 시도 수와 조건·관측 범위를 기록하고, 여러 표본의 분포를 확보하기 전 인과나 개선율을 주장하지 않는다. 취소·연결 종료·프로젝트/대화 전환 뒤 늦은 사건은 별도 결과로 격리한다. 기록은 식별자·단계·상태·시각만 보존하고 prompt·명령·출력·추론 본문은 추가하지 않는다.

### 현행 판정

AC-2의 최초 122초 지연 원인은 **미확정 blocker**다. 계측 경로와 새 실제 표본을 확보한 것은 조사 진전이며 원인 규명이나 개선의 완료 근거가 아니다. 이번 패스는 기존 증거의 읽기 전용 조사와 문서 정리이며 독립 리뷰·새 실험·제품 수정·작업 완료 판정을 대신하지 않는다.
