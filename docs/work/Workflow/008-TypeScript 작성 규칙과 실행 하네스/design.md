# TypeScript 작성 규칙과 하네스 설계

## 책임과 적용 범위

source-policy.json은 최초 도입 시점의 legacy JavaScript 경로·내용을 동결하며 새 JavaScript와 기존 JavaScript 변경은 거부한다. 새 실행 코드는 TypeScript와 실제 strict/noEmit 검사 프로젝트에 편입한다. 과거 Tauri 비교 스파이크 2개만 정확한 경로·해시로 보존하며 변경 시 실제 검사 편입이 필요하다. vendor와 생성물만 제외하고 새 스파이크 파일도 자동 예외로 만들지 않는다.

공식 npm workflow는 scripts/workflow.ts이며 기존 core·권한·작업 UUID·호스트 연결을 재사용한다. writes와 deletePaths로 변경 계획을 구분한다. pre 오류는 수정 context로 전달하고, 설정·실행 오류는 모델 실행 전에 거부한다. 실제 변경에 post 정책·타입·BoxBox 검사와 사후 검사 중 소스·명시 설정 지문 유지 여부를 확인한다. 기존 오류 수정을 위해 pre 오류를 모두 blocker로 만들지 않는다.

새 하네스는 작성 단계와 npm check의 진입점을 강화한다. low-level API나 모든 호스트 쓰기를 OS에서 차단하는 기능은 아니다. 테스트 주입과 실제 도구 실행, 실제 모델 행동은 구분한다. 로컬 BoxBox 설정은 Git에서 제외하고 외부 설치본 runtime.json의 Node와 일치하는지 확인한다.

## 비용과 검증

새 가드의 실제 fixture와 Native Node CLI, 실제 Node/tsc/BoxBox 도구 조합을 확인한다. 실제 LLM 저작 호스트는 호출하지 않고 주입 fixture임을 기록한다. 타입 검사와 빌드를 별도 기준으로 분리해 마지막 통과 명령이 이전 실패를 가리지 않게 한다. 새 BoxBox 미승인 패턴의 공백 정렬이나 규칙 자동 승인은 하지 않는다. Electron Native·Windows·IME 검사는 제품 동작 변경이 없어 반복하지 않는다.

## 기능 증거의 입력 범위

동시 진행 Native 보고서 기능의 src/native-reports.ts와 test/native-reports.test.ts 수정으로, exitCode 0인 가드 검사도 넓게 잡은 입력에서 sourceStable=false가 됐다. 이번 작업의 기능 증거는 개발 도구·설정·직접 사용하는 가드 테스트·스킬 context로 한정한다. 앱 기능 자체의 완료나 전체 저장소의 현재 상태를 이 범위로 보증하지 않으며, 전체 상태 검사는 별도 저장소 영수증으로 구분한다. 기존 실패·무효 시도는 보존한다.
