

[표시 창의 입력·휠·명령 카드 측정](visible-input-performance.md)에 #27의 후속 비교 조건, 여섯 실행의 지표와 남은 제한을 기록했다.

## remote-20261116 — 현재 머신 범위와 미실행

composer/status/Steer 회귀와 검사 스크립트까지 공식 inputs를 보강했다. source-machine GUI와 actual 모델 Steer 의미 미반영 관측을 보존한다. 현 GUI·Native runtime 실패, 실제 OS IME·Windows 미실측을 완료로 바꾸지 않는다.

실측 환경: macOS 26.5.1 arm64, Node22.23.1, Bun1.4.0, Electron39.8.10. 원문은 .www/evidence/remote-20261116/ 기준 input-scope-updates.json / codex-startup.stderr. 실제 Opus 공유 core는 allowFallback=false, executor=process, not_run/authentication, observedModel=null이며 통과가 아니다. 실제 Native 두 검사도 실패했고 추가 시작 진단은 Codex 전역 상태 SQLite 초기화 오류를 관측했다. 승인·인증·설정을 변경하지 않았다.

<a id="attempt-b18c9a0e-6974-4d46-928d-f8fd16218d9d"></a>
## 검증 시도 — 2026-11-22T16:38:18.544Z

- 시도 ID: `attempt-b18c9a0e-6974-4d46-928d-f8fd16218d9d`
- 실행 시각: 2026-11-22T16:38:13.423Z ~ 2026-11-22T16:38:18.544Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-chat.ts","--command-cards"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `af3db5dd662c6fc593e9c3226ef2bff28ad91e5dd5e5bcea2245bf96b9ad3c34`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 19975바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-6fdc0131-7f91-446b-a10f-c23372dc9e9f"></a>
## 검증 시도 — 2026-11-23T01:04:15.348Z

- 시도 ID: `attempt-6fdc0131-7f91-446b-a10f-c23372dc9e9f`
- 실행 시각: 2026-11-23T01:04:10.587Z ~ 2026-11-23T01:04:15.348Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-chat.ts","--command-cards"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `c3914c177a11c42d60e710d93ae9aac679be5fb8c5939ea5ca90e82e0f588cd6`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 19975바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-70449ddc-92ad-49df-bac3-cad3b1792b1f"></a>
## 검증 시도 — 2026-11-23T03:18:26.682Z

- 시도 ID: `attempt-70449ddc-92ad-49df-bac3-cad3b1792b1f`
- 실행 시각: 2026-11-23T03:18:15.794Z ~ 2026-11-23T03:18:26.682Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","test","test/native-session.test.ts","test/chat-status.test.ts","test/chat-state.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-11`, `AC-12`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/chat-ui-7d7srI/steer-monitoring.png` (92228바이트, sha256 5256e236aa1932db7f2fc04725a8814737a7fff1c6c3bce2d77b0984d5ef0606), `.www/evidence/chat-ui-7d7srI/summary.json` (1558바이트, sha256 baf5b216849299ea019d9924eacdf7ad0f05830f2b8e5c230572432dadbaf174), `.www/evidence/chat-ui-7d7srI/workspace/fixture-calls.jsonl` (5932바이트, sha256 d6be53c9bdc9388e7f00dfb29f82f5cf5ab50134e6affe75bef8632b4d728d23), `.www/evidence/chat-ui-XszWRr/performance.json` (2288바이트, sha256 0397485434a5cab25f3b033333557f01e77705cefd7c79039801a6087b3acec4), `.www/evidence/dashboard-rollforward-20261123/chat014-current-performance.log` (1170바이트, sha256 5ddef51f7be7ea8f63e2c541e7b4da133411a23f622d4a9ce8ce05830e9bf73d), `.www/evidence/dashboard-rollforward-20261123/chat014-current-steer.log` (1279바이트, sha256 23baf972283fa27c924cb0b76d9f26c0d17a59732ba1ca47bef8a64541e5c213)
- 검증 중 원문 유지: 확인
- 출력: stdout 28바이트, stderr 12536바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 현재 트리의 실제 Electron에서 `node scripts/verify-chat.ts --steer-only`를 실행했다. 합성 Native 프로토콜에 한 번의 일반 턴 시작, 동일 턴의 Steer 3회, 마지막 명시적 중단 1회가 남았다. 반환 턴 불일치에서는 미확인과 원문 복원을 표시했고 자동 재전송 없이 다음 초안을 보존했다. 현재 `native-session`, `chat-status`, `chat-state` 집중 검사와 Electron 요약·합성 호출 원문을 `attempt-70449ddc-92ad-49df-bac3-cad3b1792b1f`에서 AC-11·AC-12에 연결했다. 미지원·다른 실패 경계 전반 및 실계정·IME의 후속 행동까지 이 범위에 포함하지 않는다.
- 별도 `--performance-only`의 현재 합성 입력→다음 프레임 p95는 짧은 화면 7.1ms, 긴 이력 대기 17.3ms, 긴 이력 실행 중 10.5ms였다. 조건별 40표본으로, 긴 이력의 대기와 실행 중 프로브에는 각각 65개와 66개 명령 카드가 있었다. renderer longtask 관측은 0건이다. 이전 표본과 빌드 지문이 다르며 같은 소스의 최적화 전후와 스크롤·실제 OS IME의 개선은 이 수치가 증명하지 않는다. AC-5·AC-7·AC-14는 보류한다. 원문은 `.www/evidence/chat-ui-XszWRr/performance.json`다.

- 2026-11-23 현재 Electron과 설치 Codex CLI 0.171.0에서 실제 Steer의 접수와 응답 반영을 별도로 관측했다. 처음 요청에는 숫자만 적도록 하고, 스트리밍 중 같은 thread·turn에 추가 지시로만 고유 표식을 제공했다. 실제 Native 접수와 같은 턴의 `completed`를 확인했다. 접수 뒤 `final_answer` 항목과 Electron의 답변 DOM 모두 마지막 줄에 그 표식을 표시했다. `turn/started`는 1회였고 중단 요청은 0회였다. 원문 `.www/evidence/chat-ui-4eMVLT/steer-real-response.json`의 SHA-256은 `3e11def53fac938a52b02b5e960b4532ec480d4bb12aafd17ef047d575444b80`이다. 읽기 전용 시험 프로필의 단일 표본이며, 실제 IME와 같은 조건의 변경 전후 입력 성능은 여전히 AC-14의 남은 검증이다.

<a id="attempt-27c5890c-74e7-4e44-be11-a06598743572"></a>
## 검증 시도 — 2026-11-23T03:49:58.573Z

- 시도 ID: `attempt-27c5890c-74e7-4e44-be11-a06598743572`
- 실행 시각: 2026-11-23T03:49:58.458Z ~ 2026-11-23T03:49:58.573Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/dashboard-rollforward-20261123/chat014-mint-audit.mts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-9`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/chat-ui-qgwkW2/mint-contrast.json` (3937바이트, sha256 b40777825c45efea229f3832b15920e31f6668be69253379e6d7995dfefbac4d), `.www/evidence/chat-ui-qgwkW2/www-mint-contrast.png` (151274바이트, sha256 2a91fcb9b89b903ecdd14225f1cb8d158e2b6573fdacac3abf03fb05224f9bc5), `.www/evidence/dashboard-rollforward-20261123/99-www-mint-palette.blob` (14879바이트, sha256 71d4db891af18758211a0a2ce562541466b4d934689a40fe0dfe2a06e81ff9e4), `.www/evidence/dashboard-rollforward-20261123/chat014-mint-audit.mts` (2228바이트, sha256 3eab311adaf033f4f3596a958ba70887203a4ae43fda761b82336563f8724bf3), `.www/evidence/dashboard-rollforward-20261123/chat014-mint-probe.log` (1531바이트, sha256 4725da5c2a123f8327f84b99ff28b1794f05ffb22ac5caa15187938856ada393), `.www/evidence/dashboard-rollforward-20261123/chat014-mint-probe.mts` (119829바이트, sha256 2378266e716c9d8292fc7869e2151decb287be5804debebd08a36f63fb6ae887), `dist/build-info.json` (218바이트, sha256 4b4658543ba9fbe6872081c1a8f8878751256fdf17200c9f8fe1c4732fadbab5)
- 검증 중 원문 유지: 확인
- 출력: stdout 238바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 AC-9 `attempt-27c5890c-74e7-4e44-be11-a06598743572`에서 99_www commit `ed3f9b2c8d0d55325da352f8a297118c3ebe4aa7`의 `mint` 팔레트 10개 토큰과 현재 Electron의 계산된 값을 대조했다. 선택한 WWW Mint에서 채팅, 대화 목록, Agent 패널, 명령 카드, 출력, 상태줄의 색 및 텍스트·기호를 관측했다. 본문·보조·진행·정보·대기·오류와 구문 토큰을 확인했으며, 측정한 전경·배경 조합의 최저 명암비는 5.51:1이다. 키보드 적용·초점 복귀·Escape 취소, 저장 실패 시 기존 선택 유지와 같은 프로필 재시작 후 복원도 통과했다. 무설정 프로필은 현재 제품의 Terminal Basic 정책대로 동작했다. 원문 `.www/evidence/chat-ui-qgwkW2/mint-contrast.json`과 캡처를 이 시도에 연결했다.

<a id="attempt-8acec2d5-4c01-4406-a42a-b280e857a98c"></a>
## 검증 시도 — 2026-11-23T03:54:59.501Z

- 시도 ID: `attempt-8acec2d5-4c01-4406-a42a-b280e857a98c`
- 실행 시각: 2026-11-23T03:54:59.369Z ~ 2026-11-23T03:54:59.501Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/dashboard-rollforward-20261123/chat014-working-audit.mts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-8`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/chat-ui-JONOl2/working-status-unknown.png` (145561바이트, sha256 89fea8ef27b74e6248481587c60faadc57eeea19d168e634e89dd6bbbf1e3954), `.www/evidence/chat-ui-JONOl2/working-status.json` (5434바이트, sha256 3a0b492ee14a9586212617199d4f7fcafff032abbdb97facd3936d4a476a7497), `.www/evidence/dashboard-rollforward-20261123/chat014-working-audit.mts` (1885바이트, sha256 34fce1eed6e8723d43646308e47408263b6bd3f734cb903c55706adb332adbdb), `.www/evidence/dashboard-rollforward-20261123/chat014-working-fixture.mts` (20841바이트, sha256 709cee7e8e69d27d290df73ea28c56502c44ae70336c78a061302cfbf23e05db), `.www/evidence/dashboard-rollforward-20261123/chat014-working-probe.log` (4169바이트, sha256 3bdda9b1b19b7a765a8bd8f19d5e7f80909de2fa6af25cd2b204b32d9e5034ad), `.www/evidence/dashboard-rollforward-20261123/chat014-working-probe.mts` (120647바이트, sha256 5ab02913f6bad503efb8a000f27c52cc112bf4f856e869ea91f4cc6989d4d519), `dist/build-info.json` (218바이트, sha256 4b4658543ba9fbe6872081c1a8f8878751256fdf17200c9f8fe1c4732fadbab5)
- 검증 중 원문 유지: 확인
- 출력: stdout 185바이트, stderr 447바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 AC-8 `attempt-8acec2d5-4c01-4406-a42a-b280e857a98c`에서 실제 Electron과 합성 Native stdio로 전송, 수락 전 시작 대기, Working, 승인 대기, 실제 종료 확인 전 중단 대기, `interrupted`, `completed`, `failed` 및 subprocess EOF의 연결 미확인을 각각 관측했다. 긴 과거 이력의 휠 스크롤에서 입력 위 상태줄 위치를 대조했고, 상세 모니터와 새 탭을 오간 뒤 활성 탭의 현재 상태를 확인했다. 상태 텍스트·기호와 `role=status`도 확인했다. 합성 fixture의 일부 응답에 지연을 줘 각 대기 화면을 관측했다. 원문 `.www/evidence/chat-ui-JONOl2/working-status.json`과 현재 집중 테스트를 연결했다.

<a id="attempt-fe3a2e28-a4f7-4c8e-91b6-ba78f4e3882e"></a>
## 검증 시도 — 2026-11-23T03:56:50.694Z

- 시도 ID: `attempt-fe3a2e28-a4f7-4c8e-91b6-ba78f4e3882e`
- 실행 시각: 2026-11-23T03:56:34.967Z ~ 2026-11-23T03:56:50.694Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/dashboard-rollforward-20261123/chat014-electron-regression-current.mts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-6`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/chat006-closeout/build.log` (86바이트, sha256 83831f39e2fd97c6e12abdf454940fe748bc5b091eed1b7e7d5a638f22b2d189), `.www/evidence/chat006-closeout/gui-stdout.blob` (30730바이트, sha256 759b21f8773a8c5d2d1eeb20184e8c418d2971d78988d555bfb2cb1bff7650c7), `.www/evidence/chat006-closeout/verify-reused-current.mts` (3251바이트, sha256 c023f0421bfc31f47beb27ebf1168733f5d7512e890709491dd0667ababbf781), `.www/evidence/dashboard-rollforward-20261123/chat014-electron-regression-current.mts` (2982바이트, sha256 48a2fbc7beeb025b96a002bf7c2256ac441772542b3442899779ec0840bb5792)
- 검증 중 원문 유지: 확인
- 출력: stdout 793바이트, stderr 35238바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 AC-6 `attempt-fe3a2e28-a4f7-4c8e-91b6-ba78f4e3882e`에서 휠 스크롤, 키보드 `Ctrl+T`·원문 전환, 긴 보관 출력, 실시간 출력·읽기 위치, 실패, 전환과 복원에 해당하는 현재 Electron 결과를 대조했다. 실제 실행 `attempt-e83889b1`의 명령·적용성·stdout 원문 지문과 이미 수행한 빌드 `attempt-9c6e7ea9`의 명령·적용성·의존 스크립트 지문을 확인했다. 최신 소스 정책과 타입, 명령 미리보기·채팅 상태·투영·Native 세션 집중 회귀는 이 UUID에서 새로 실행했다. 같은 Electron 및 빌드는 보존한 실제 원문을 사용했다.

## 2026-11-23 변경 전후 성능 비교

변경 전은 통합 커밋 `e6e483f` 직전 `d4db970`을 별도 worktree에 고정했다. 이관본에서 네 승인 지문이 모두 일치하는 당시 BoxBox 설정을 확인해 과거 빌드도 공식 명령으로 생성했다. 변경 전 빌드의 구조 생성 결과에는 BoxBox 테스트 참조가 새로 반영됐다. 같은 Electron 39.8.10 설치와 Node·Bun, 단일 Native fixture, 같은 viewport에서 두 빌드를 교대로 각각 3회 측정했다. 파일·fixture·실행 원문은 `.www/evidence/dashboard-rollforward-20261123/chat014-comparable-performance-6-runs.blob`에 연결했다.

| 조건 | 변경 전 p95 중앙값 | 현재 p95 중앙값 |
|---|---:|---:|
| 짧은 입력 | 7.7ms | 7.1ms |
| 긴 이력 대기 중 입력 | 13.7ms | 16.1ms |
| 긴 이력 실시간 출력 중 입력 | 24.7ms | 12.4ms |
| 긴 이력 휠 프레임 간격 | 8.1ms | 7.1ms |

입력 값 갱신부터 다음 RAF까지 조건별로 40개씩 계측했다. 휠은 같은 방향과 입력을 사용했으며 배치 차이로 실제 이동 거리가 달랐다. 이전 빌드의 긴 이력 대기 상태에서는 완료 카드 65개를 둔 합성 입력 40회 동안 `CommandView`가 매 실행 2,600회 보고됐다. 현재 코드에서는 별도 양성 대조의 초기 마운트 때 `CommandView` 65회를 확인했고 이어지는 입력 40회 구간에서는 해당 함수 호출 행이 보고되지 않았다. 현재 호출 횟수를 직접 0회로 계수한 결과로 쓰지 않는다.

스트리밍 중 입력은 빨라졌고 긴 이력 대기 상태의 입력 중앙값은 늦어졌다. 비교는 여러 변경이 포함된 전후 빌드 사이의 관측이다. OS IME, React commit 직접 계측 및 대기 상태 지연 원인이 남아 있어 AC-5를 보류한다.

<a id="attempt-dbb8e653-bd0f-49e2-9219-cd9ecb11ac88"></a>
## 검증 시도 — 2026-11-23T04:04:54.217Z

- 시도 ID: `attempt-dbb8e653-bd0f-49e2-9219-cd9ecb11ac88`
- 실행 시각: 2026-11-23T04:04:43.278Z ~ 2026-11-23T04:04:54.217Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node",".www/evidence/dashboard-rollforward-20261123/chat014-steer-errors-audit.mts","work-2d8887e6-0a74-40e4-8dc7-f000f8b3b118"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-13`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/chat-ui-oPO0jF/steer-errors.json` (3630바이트, sha256 485e9be255f3825ca0b23414ffacfc5cadc0eddb01c33db0f362c0d96a19f4d0), `.www/evidence/chat-ui-oPO0jF/steer-errors.png` (149175바이트, sha256 5720c6abfb0c64130e552353743ff8b166f3a3546a8fb59240576a84e093b123), `.www/evidence/chat-ui-oPO0jF/workspace/fixture-calls.jsonl` (4903바이트, sha256 70bfbcf2ef46f908cbcfca12322c5b826de8b341b2579cbe33b79fbddf39ae25), `.www/evidence/dashboard-rollforward-20261123/chat014-steer-errors-audit.mts` (2646바이트, sha256 aefc50b8772c04aec911e4430463f23fd25e6e1949ae3fcf182b02450d343ced), `.www/evidence/dashboard-rollforward-20261123/chat014-steer-errors-fixture.mts` (20888바이트, sha256 7a1b6046685fcb44fa32e67ea7795ce6ee13b8b131f372d9013cb7fceb392662), `.www/evidence/dashboard-rollforward-20261123/chat014-steer-errors-probe.log` (3061바이트, sha256 e9aea313993bd436c8c1ae64af5580da38ecbc0891825533eea0cab7667e6197), `.www/evidence/dashboard-rollforward-20261123/chat014-steer-errors-probe.mts` (120657바이트, sha256 7064072c4e733bcbaf34cd187189ca8b298dc34bc64632f1f24743c0008f42ee), `dist/build-info.json` (218바이트, sha256 4b4658543ba9fbe6872081c1a8f8878751256fdf17200c9f8fe1c4732fadbab5)
- 검증 중 원문 유지: 확인
- 출력: stdout 393바이트, stderr 8693바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 AC-13 `attempt-dbb8e653-bd0f-49e2-9219-cd9ecb11ac88`에서 실제 Electron에 합성 Native의 미지원(`-32601`), 전송 실패(`-32001`), 턴 불일치, 종료 경합 및 전송 후 EOF를 재현했다. 앞선 AC-8은 같은 앱의 시작 대기·승인·중단 확인을 관측했다. 현재 집중 테스트는 이 세 경계와 이전·다른 세션·중복 거부를 확인한다. 명시한 일반 턴은 2회, Steer는 고유 ID로 각각 1회씩 5회였고 자동 재전송·새 턴 전환은 관측되지 않았다. 오류 원문과 새 초안을 따로 보존하고 원문만 수동 복원했으며 공백·줄바꿈까지 대조했다. 원문은 `.www/evidence/chat-ui-oPO0jF/steer-errors.json`과 합성 서버 호출 기록에 있다.

<a id="attempt-94f95952-1c64-44ff-a17a-71c3bc3a17fb"></a>
## 검증 시도 — 2026-11-23T04:11:47.864Z

- 시도 ID: `attempt-94f95952-1c64-44ff-a17a-71c3bc3a17fb`
- 실행 시각: 2026-11-23T04:11:43.199Z ~ 2026-11-23T04:11:47.864Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-chat.ts","--command-cards"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `build.ts`, `docs/architecture`, `docs/specs`, `docs/specs/chat.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-chat.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `src/chat-composer.tsx`, `src/chat-message.tsx`, `src/chat-row-state.tsx`, `src/chat-status.ts`, `src/chat.css`, `src/command-card.tsx`, `src/command-preview.ts`, `src/native-chat.ts`, `src/native-session.ts`, `src/preload.ts`, `src/projection.ts`, `src/renderer.tsx`, `src/session-api.tsx`, `src/shared.ts`, `test`, `test/chat-state.test.ts`, `test/chat-status.test.ts`, `test/command-preview.test.ts`, `test/native-session.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `422a27b5d77f64ac1ba333f0bc22343a680e76d976138c7360dd5ba5180eeb91`
- 기준 정의 식별: `de4e752ca41cfec76466ff6eeed5fe421d875d40e2c889157a72bcbd776868ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 19977바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


- 2026-11-23 공용 소스 변경 전의 AC-1~4 결과가 현재 입력에서 오래된 상태임을 확인했다. 네 카드 기준의 기존 승인 명령 `node scripts/verify-chat.ts --command-cards`만 현재 소스에서 다시 실행했다. 시도 `attempt-94f95952-1c64-44ff-a17a-71c3bc3a17fb`가 통과했고 현재 상태의 적용 가능 기준은 10개다. 전체 Electron 기능 검사를 다시 실행하지 않았다.

## 1차 마감 기록 회수와 성능 측정 환경

2026-11-24에 같은 작업 UUID와 원래 요청에 속한 시도 8건을 회수했다. 1차 마감 시점의 기록은 14개 중 10개 통과이며, 시도가 참조한 경로와 SHA-256의 고유 조합 30개를 기존 작업 디렉터리의 실제 바이트와 대조했다. 새 결합 후보에서의 현재 적용성은 별도 판정한다.

기존 성능 실행기는 숨겨진 Electron 창에서 합성 입력과 animation frame을 측정했다. 긴 대화에서 완료 카드를 CSS로 건너뛰는 실험은 숨긴 창에서 입력 p95를 줄였으나 스크롤 최대 간격 666.7ms를 기록했다. 이 실험으로 실제 화면의 성능 개선을 확정할 수 없어 표시된 창에서 후속 비교한다. AC-5·7·10·14는 열어 둔다. Windows 실제 한글 입력은 사용자가 직접 시험하기로 했다.
