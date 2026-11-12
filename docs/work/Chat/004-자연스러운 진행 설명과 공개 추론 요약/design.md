# 최소 설계

## 데이터 흐름

src/native-chat.ts가 한국어 진행 설명 지침과 thread/start·turn/start 매개변수 구성을 소유한다. main은 이 구성을 기존 cwd·approvalPolicy·sandbox·사용자 입력과 함께 전달한다. baseInstructions를 대체하거나 전역 설정을 수정하지 않는다.

projection은 explanation의 출처에 reasoningSummary를 추가해 공개 summary만 투영한다. thread/turn/item을 키로 사용하고 summaryIndex별 텍스트를 보관해 문단을 연결한다. summaryTextDelta는 section에 추가하고 item/completed.summary는 최종 snapshot으로 대체한다. 중복 seq는 억제하고 content·reasoning textDelta·analysis는 계속 무시한다. 종료 누락·EOF에서는 요약 스트리밍 상태를 닫되 완료 성공을 추정하지 않는다. 길이는 기존 출력 제한을 사용하고 절단 여부를 표시한다.

renderer는 commentary와 공개 요약을 자연스러운 문장으로 출력한다. 사용자에게 보이는 단계·출처 라벨을 문장 앞에 붙이지 않고 필요한 구분은 접근성 이름과 스타일에 한정한다. 원래 명령·파일·승인 블록과 시간순을 유지하고 자동 보고서의 최종 답변 선택은 바꾸지 않는다.

## 위험과 검사

- AC-1: 매개변수 구성 검사는 기존 승인·sandbox와 사용자 요청 보존을 확인한다. 실제 설명 빈도는 모델 행동이므로 Native 표본과 분리해 보고한다.
- AC-2: 섹션 델타·완료 snapshot·중복 seq·턴 격리·긴 요약·종료/EOF·raw 제외를 집중 테스트한다. 내부 요약 상태가 다른 item의 메시지와 충돌하지 않도록 출처와 ID를 함께 확인한다.
- AC-3: 기존 projection·activity·input·native-report-input 회귀, 타입 검사·소스 정책·빌드를 수행한다. 기존 작업 트리 변경을 수정하거나 완료 상태를 승격하지 않는다.

## 작업 순서

1. 공식 typed 하네스로 허용된 소스·테스트·현행 문서를 구현한다.
2. 실제 검사 근거와 문서 영향을 같은 UUID에 기록한다.
3. 공유 검토 core로 읽기 전용 Opus 감사를 수행하고 결과를 반영한다.
4. 저작 보고서를 저장하고 필수 기준과 감사가 충족할 때만 완료한다.
