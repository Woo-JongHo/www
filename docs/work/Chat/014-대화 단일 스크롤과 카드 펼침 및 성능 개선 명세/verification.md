

[표시 창의 입력·휠·명령 카드 측정](visible-input-performance.md)에 #27의 후속 비교 조건, 여섯 실행의 지표와 남은 제한을 기록했다.

## remote-20261116 — 현재 머신 범위와 미실행

composer/status/Steer 회귀와 검사 스크립트까지 공식 inputs를 보강했다. source-machine GUI와 actual 모델 Steer 의미 미반영 관측을 보존한다. 현 GUI·Native runtime 실패, 실제 OS IME·Windows 미실측을 완료로 바꾸지 않는다.

실측 환경: macOS 26.5.1 arm64, Node22.23.1, Bun1.4.0, Electron39.8.10. 원문은 .www/evidence/remote-20261116/ 기준 input-scope-updates.json / codex-startup.stderr. 실제 Opus 공유 core는 allowFallback=false, executor=process, not_run/authentication, observedModel=null이며 통과가 아니다. 실제 Native 두 검사도 실패했고 추가 시작 진단은 Codex 전역 상태 SQLite 초기화 오류를 관측했다. 승인·인증·설정을 변경하지 않았다.
