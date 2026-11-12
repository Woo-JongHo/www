# 자연스러운 진행 설명과 공개 추론 요약

## 요청과 범위

사용자는 채팅에서 결과뿐 아니라 행동 이유, 중요한 발견, 실패에 따른 판단 변경과 다음 행동을 자주 자세히 읽고 싶어 한다. 설명은 자연스러운 한국어 문장으로 이어 쓰며 행동 전·확인 후·실패·방향 전환 같은 고정 단계 라벨은 붙이지 않는다. Native가 실제 제공하는 공개 추론 요약도 채팅 흐름에 포함한다. 사용자가 Skills를 통한 진행을 명시했으며 같은 범위의 구현·검증을 수행한다. 커밋·게시 권한은 없다.

현재 공개 commentary는 표시되지만 reasoning 항목 전체가 제외돼 공개 summary도 보이지 않는다. 이번 작업은 새 대화의 설명 지침, 요약 요청과 채팅 투영·표시를 보완한다. 비공개 reasoning content, raw textDelta, analysis는 표시하거나 재구성하지 않는다. 모델의 설명은 실제 명령·파일 사건과 구분하며 실행 성공 증거로 쓰지 않는다.

## 수용 기준과 시나리오

기준 정의의 정본은 work.json의 AC-1~AC-3이다.

- AC-1: 새 스레드에 진행 설명 지침이 추가되고 사용자 원문과 승인·sandbox 설정을 보존한다. 중요한 발견·실패·방향 전환 때 이유와 결과를 설명하도록 요청한다. 모든 명령마다 상투적인 메시지를 강제하지 않는다.
- AC-2: summaryTextDelta와 완료 summary snapshot을 같은 항목으로 갱신한다. summaryIndex별 문단, 늦은 사건, 다른 턴의 같은 item ID, 중복 seq, 종료·EOF와 긴 요약을 검사한다. raw content만 있는 항목은 채팅에 나타나지 않는다.
- AC-3: 기존 회귀 테스트와 타입·빌드를 확인하고 실제 화면·Native 표본과 합성 테스트의 한계를 구분한다. 실제 모델이 지침을 따르는 빈도는 결정론적 테스트의 통과만으로 보장하지 않는다.

## 제외 범위

모델·추론 노력 변경, 전역 Codex 설정 수정, 과거 대화 복구, 강제 시간 간격마다 별도 모델 호출, 원문 사고 공개, 별도 라벨·상태 카드 추가는 하지 않는다.

## 근거

- 공식 프로토콜: https://learn.chatgpt.com/docs/app-server — summaryTextDelta와 summaryPartAdded는 공개 요약, textDelta와 content는 raw reasoning 경로다.
- 로컬 codex-cli 0.167.2의 generate-json-schema 출력에서 thread/start.developerInstructions와 turn/start.summary의 detailed를 확인했다. 사적 생성물은 /tmp/www-chat-public-schema-20261112에 보관한다.
