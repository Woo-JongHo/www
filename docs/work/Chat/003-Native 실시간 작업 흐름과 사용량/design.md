# Native 실시간 활동 설계

## 상태와 책임

기존 AppEvent와 seq를 유일한 실행 관측 원본으로 사용한다. main은 실제 thread 시작 응답의 설정 모델과 계정 한도 조회 결과를 사건으로 전달한다. 기존 src/projection.ts는 대화 블록을 계속 맡고 src/native-activity.ts는 같은 사건의 순수 활동 투영을 맡는다. src/native-activity-view.tsx와 CSS는 오른쪽 패널·과거 턴 선택·최신 추적·실시간 경과 표시를 맡는다. 기존 화면·브리지 권한을 확대하거나 새 추론 요청을 만들지 않는다.

threadId·turnId로 턴을 분리하고 clientRequestId로 전송 요청과 늦은 ACK를 합친다. seq를 정렬해 재생하고 같은 seq와 item/run ID를 중복 표시하지 않는다. 도구 종료를 받지 못한 상태에서 턴·전송이 끝나면 unknown으로 남긴다. 턴 종료는 업무 수용이나 검증 완료가 아니다.

## 관측 의미

Skill userMessage 입력은 명시 요청이다. commandExecution의 구조화 commandActions read가 SKILL.md를 가리키면 읽기 시도를 시작부터 표시하고, 완료 성공·실패·결과 미확인을 구분한다. Skill 적용 성공·독립 실행 사건을 발명하지 않는다. 동기 Hook run의 상태를 표시하며 명시 turn 없는 run은 세션에 둔다. Hook 내부 entries·statusMessage와 비공개 reasoning 본문, 도구 인수·출력은 활동 투영에 복제하지 않는다.

thread 설정 모델은 configured, model/rerouted는 해당 턴의 관측 전환이다. 모든 모델 요청의 실제 실행 모델·모델별 사용량을 보장하지 않는다. tokenUsage.total은 누적 snapshot, last는 최근 모델 요청 사용량으로 각각 보존한다. 턴 합계는 명시 새 스레드 영점 또는 안전한 이전 턴 누적값과의 차이다. 기준 누락·감소·절단·늦은 이전 턴 증가가 있으면 안전한 차이를 제공하지 않는다. 계정 quota bucket의 usedPercent·기간·재설정은 계정 관측이며 턴 청구액이나 비용이 아니다. sparse update는 기존에 확보한 메타데이터와 합친다.

## 표시와 보관

패널은 과거 턴 선택과 최신 추적 상태를 UI에서 소유한다. 진행 중 경과만 갱신하고 종료 시각 뒤에는 고정한다. React 문자열 표시를 사용해 수신 문자열을 HTML로 실행하지 않는다. 동작을 장식 애니메이션에 의존시키지 않고 모션 축소·좁은 화면·키보드로 읽을 수 있어야 한다. 최근 2,000개 메모리 사건의 절단과 미제공을 표시하며 대화 영속 저장을 추가하지 않는다.

## 검증과 위험

순수 투영은 재생·중복·지연·잘못된 값·누락된 종료·Skill 근거·Hook 귀속·비공개 텍스트 배제·누적 차분·quota merge를 합성 테스트로 확인한다. 실제 Electron에 합성 Native subprocess를 연결한 왕복과 실제 Native의 제공 필드 표본을 별도 증거로 남긴다. 타입 검사·빌드·기존 회귀 및 독립 검토도 현재 소스에 적용해야 한다.

최종 통합·실제 Native·GUI 검증과 독립 감사는 이 문서 작성 시점에 완료로 판정하지 않았다. 확인되지 않은 플랫폼·비동기 Hook·모델별 과금은 미검증 또는 미제공으로 유지한다. BoxBox 미승인 형태·FIXABLE은 별도 미해결이며 정렬 승인 없이 우회하지 않는다.
