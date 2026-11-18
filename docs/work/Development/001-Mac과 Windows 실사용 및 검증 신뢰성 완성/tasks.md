# 현재 원격 재개 — 플랫폼별 검증 분리

현재 작업은 같은 UUID `work-e9007dfb-f546-426b-88c6-58174641acc8`의 새 source 사본에서 진행한다. 아래 접힌 과거 Mac/Windows 성공은 당시 소스·환경의 기록이며 현재 PASS가 아니다. 외부 `ssh chacada`와 릴리스/배포는 이번 범위 밖이므로 접속하거나 실행하지 않는다.

현재 macOS 일반 호스트의 Electron39.8.10·Chrome 및 Native 읽기 실행은 가능하다. 원격머신 전체의 DB/GUI 고장으로 단정하지 않는다. 제품에 SQLite 중앙 DB를 구축하거나 Codex 자기 상태 DB를 이전·삭제하지 않는다.

실제 OS 입력 가능성 조회는 `.www/evidence/resume-20261116/os-input-host/`에 보존했다. Swift의 조회 전용 API는 `consoleSession=1`, `loginDone=1`이고 `AXIsProcessTrusted=false`, `CGPreflightPostEventAccess=false`, `CGPreflightScreenCaptureAccess=false`를 반환했다. PATH의 Orca는 실제 spawn ENOENT다. 이는 이 조회 프로세스·현재 도구 출처의 권한이며 모든 앱의 영구 상태를 일반화하지 않는다. 인증·시스템 승인·입력 소스·전역 설정은 바꾸지 않았다. 실제 OS IME 조합 검사는 미실행이며 CDP·합성 composition 회귀로 대체하지 않는다.

현재 수용 범위는 실제 가능한 Native·공통 중단/복원·잠금·완료 검토·일관성 동작을 현재 명령으로 검사하는 것이다. Windows x64 실행·패키지·한글/공백 경로와 양 OS 실제 IME는 별도 실환경 근거가 필요하다. 접근 승인 없이 권한을 바꾸거나 과거 Windows 근거를 현행으로 올리지 않는다. 다음 행동은 현재 공통 검사·관측 모델과 감사 출처의 구분·보고서 회수이며 미충족 기준은 완료로 바꾸지 않는다.

추가로 Electron39.8.10/내장 Node22.22.1 프로세스의 공식 API 조회도 `accessibilityTrusted=false`, `screenCapture=denied`였다. 이 조회는 권한 요청 UI를 열지 않았고 Native나 앱 기능 검사를 대체하지 않는다. 실제 코드/strict/컴파일/프로세스 영수증은 `.www/evidence/resume-20261116/os-input-host/electron-*`에 보존했다.

<details>
<summary>이전 소스·환경의 실행과 인계 — 역사 기록</summary>

# 실행 분리와 현재 상태

## Mac·공통 구현

| 범위 | 현재 결과 |
|---|---|
| 실제 Native 개발 흐름 | 동결된 현재 소스에서 읽기·실제 변경·명령 실패·승인 허용/거절·중단을 재실행해 확인 |
| 중단 상태 | 요청·접수·불확실·실제 종료를 구분하고 중복·늦은 사건·EOF 회귀 통과 |
| 한국어 입력 처리 | 실제 사용자 이벤트열의 과거 Enter 재전달을 수정하고 비정상 timestamp 복구·줄바꿈·전송 회귀 통과 |
| 잠금 복구 | 실제 종료된 소유자만 명시 복구, 살아 있거나 미확인인 소유자 보호 검사 통과 |
| 검토·증거 | 모델 미확인 거부, 소스·기준·원문·실행 환경·실제 Opus 영수증 대조 통과 |
| 전체 검사 구분 | 기능 증거와 별도 저장소 일관성의 유효성 분리 구현·검사 통과 |
| 독립 감사 | 두 차례 반려 원문 보존·수정 후 실제 Opus 세 번째 감사 pass, 실제 영수증 검사 pass |

Mac 구현·자동 검증은 마무리했다. 실제 OS 입력기와 수정 후 수동 재실기는 통과로 주장하지 않는다. 사용자가 원격 백그라운드 인계를 요청했으므로 추가 데스크톱 조작·입력 요청을 강제하지 않는다. 전체 1~8의 기존 AC-4는 이 미검증을 보존해 `done`으로 바꾸지 않는다.

## Windows 원격 담당

Windows 구현·플랫폼별 자동 검사·패키징과 후속 수정은 chacada의 독립 Codex가 소유한다. 부모 Mac 작업은 Windows의 다음 개발 결과를 기다리는 상태로 두지 않는다. 상세 실행 계약은 [원격 인계](remote-handoff.md), 실행 당시의 원문·보고서는 사적 background 디렉터리에서 회수한다.

원격 작업 `windows-20261112-0145`는 별도 `www-windows` checkout에서 같은 부모 UUID의 하위 실행으로 기록한다. 공통 수정이 필요하면 원격에서 패치·근거를 만들고 Mac 담당자에게 인계하며 로컬 공통 소스를 자동 덮어쓰거나 commit·push하지 않는다. SSH 종료 독립성, 모델의 실제 Handoff 읽기와 자율 실패 수정, 최종 승인 소스에서의 Windows 검사·패키지·Native 성공을 확인했다. 사용자 데스크톱·양 OS IME 실기는 그 자동 검사와 구분한다.

## 다음 행동

Mac의 이 범위 구현에는 필수 코드 수정이 남아 있지 않다. 이후 제품 기능은 이 작업의 목표를 임의로 늘리지 않고 별도 작업으로 접수한다. Windows 담당자는 자신의 결과·미검증·다음 행동을 원격 보고서에 유지한다. 전체 상태의 정본은 `work.json`, 소스별 실제 근거와 한계는 [검증 기록](verification.md)이다.

</details>
