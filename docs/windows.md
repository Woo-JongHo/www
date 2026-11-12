# Windows 개발과 패키징

현재 배포 대상은 Windows x64다. WSL에서 실행한 Linux 도구의 결과와 Windows 네이티브 실행을 구분한다. PowerShell에서는 npm 실행 정책을 바꾸지 않고 `npm.cmd`를 사용한다. Codex는 설치된 네이티브 `codex.exe`를 실행하며 `.cmd`를 셸로 우회 실행하지 않는다.

## 새 작업 공간

기존 작업 트리를 덮어쓰지 않는 별도 경로에 현재 저장소를 clone한다. Windows 네이티브 Node, npm, Bun, Git과 Codex 설치가 필요하다.

```powershell
npm.cmd ci
node scripts/windows-setup.ts
npm.cmd run check
```

Git이 `core.symlinks=false`로 받은 `.agents/skills/` 항목은 링크 대상만 적힌 파일이다. setup은 정확히 알려진 링크 텍스트만 저장소 내부 정본 디렉터리의 상대 심볼릭 링크로 바꾼다. 기존 정본을 복사하지 않고, 사용자 수정·다른 링크 대상을 거부한다. 올바른 상대 링크면 그대로 둔다. 모든 링크가 성공한 뒤에만 저장소 로컬 `core.symlinks=true`를 기록한다. 시스템 Developer Mode나 전역 Git 설정은 바꾸지 않는다. 링크 생성 권한이 없으면 원래 링크 텍스트를 복구하고 오류로 끝낸다.

## 앱 실행과 Windows 패키지

```powershell
npm.cmd start
node scripts/windows-package.ts
& '.www\packages\WWW-Electron-win32-x64\WWW-Electron.exe'
```

package 명령은 Windows 네이티브 환경에서 Electron 빌드 후 x64 패키지를 `.www/packages/`에 생성한다. 같은 이름의 이전 빌드 산출물은 교체한다. CLI 인자에 POSIX 전용 작은따옴표를 넣지 않고 packager API를 사용한다. 제품 정책은 `resources/app.asar` 내부 `dist/agents/www/review-policy.json`에 포함된다. 이 산출물은 서명된 설치 프로그램·자동 업데이트 배포가 아니다.

앱은 연결 시 PATH의 `codex.exe` 또는 npm shim 옆의 알려진 Codex 네이티브 배포 경로를 찾는다. 필요한 경우 `WWW_CODEX_BIN`에 실제 `.exe` 경로를 지정한다. 찾지 못하면 앱 창을 유지하면서 연결 오류를 표시한다. 설치 실패를 성공 응답으로 대체하지 않는다. npm 패키지의 알려진 네이티브 배치가 바뀌면 해당 경로 지원과 실제 검증을 함께 갱신한다.

## 검증 범위

실제 Windows 도구·패키지 실행, Native 응답, 사용자 데스크톱과 OS 한국어 IME 검증은 각각 구분해 작업별 `verification.md`에 기록한다. SSH Session 0에서 창 프로세스와 CDP를 확인한 것만으로 로그인 사용자의 데스크톱 입력 검증을 완료했다고 판단하지 않는다. 테스트용 합성 composition 사건도 실제 한국어 IME 조작을 대신하지 않는다.
