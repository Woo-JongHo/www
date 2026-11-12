# chacada 백그라운드 개발 인계

## 요청과 실행 책임

사용자는 남은 개발 1~8을 승인했고, Windows 부분은 SSH 서버에 Handoff를 전달해 그곳 에이전트가 독립적으로 실행하도록 정정했다. 원격 데스크톱 로그인이나 사용자에게 직접 입력을 요구하지 않는다. Windows 자동 검사·패키징·Native 연결과 실제 OS IME 실기는 구분한다. 실제 입력기 근거가 없으면 미검증으로 기록한다.

Mac은 공통 구현·통합·독립 Opus 검토를 소유한다. chacada의 Codex는 전달받은 소스와 이 계약으로 Windows 네이티브 검사·패키징·실행 증거·실패 진단·결과 보고를 수행한다. 부모가 SSH 명령을 매번 실행하는 방식과 구분해 독립 프로세스·로그·상태·보고 파일을 남긴다.

## 소스와 변경 경계

Windows 전용 별도 checkout은 `www-windows`, 브랜치는 `windows-native-20261112`, 게시 기준은 `a0076fd`다. 부모의 후속 미커밋 공통 변경은 해시 manifest로 전달했다. 시작 전 실제 cwd·Git 상태와 manifest를 확인하고, 게시 기준과 다르다는 이유로 초기화하거나 다른 작업자 변경을 되돌리지 않는다.

기존 `99_www`는 다른 저장소이며 미게시 커밋과 사용자 변경이 있어 사용하지 않는다. 전역 workspace 포인터·인증·실행 정책·Developer Mode·호스트 키를 변경하지 않는다. Windows 전용 scripts·tests·문서만 맡고 공통 코드 수정 필요 사항은 별도 패치·근거로 회수한다. commit·push·release를 실행하지 않는다.

실행 전 프로젝트 `AGENTS.md`, `agents/www/AGENT.md`, 공통 작업 계약과 프로젝트 검토 정책을 읽는다. 이 문서의 도구 버전·경로보다 실제 설치·소스·실행 결과를 우선 관찰한다. 작성자가 자기 결과를 독립 감사로 승인하지 않는다.

## Windows 작업과 완료 조건

1. Windows 네이티브 PowerShell·Node·Bun·Git·Codex·Claude 가용성을 확인한다. WSL 실행 결과를 Windows 결과로 쓰지 않는다.
2. `node scripts/windows-setup.mjs`로 정본 발견 링크를 확인한다. 정확한 Git 링크 placeholder만 상대 symlink로 전환하고 실패 시 복구한다.
3. `npm.cmd run check`를 실제 실행한다. 실패를 skip·가짜 성공으로 바꾸지 않고 원인과 필요한 최소 패치를 보존한다.
4. `node scripts/windows-package.mjs`로 x64 산출물을 만들고 파일 지문과 실제 OS·아키텍처를 기록한다.
5. 환경변수로 Codex 경로를 덮어쓰지 않은 패키지를 자동 시험해 실제 Native 응답과 턴 종료를 대조한다. loopback 프로그래매틱 시험을 사용자 데스크톱 실기로 쓰지 않는다.
6. 정책 원본·dist·asar의 세 해시와 앱의 실제 policy IPC 해시를 대조한다. 원격 작업 폴더 API도 실제 관측하며 추정값으로 채우지 않는다.
7. 부모가 마지막에 전달한 입력 handler 변경도 포함됐는지 manifest로 확인하고 최종 회귀 검사를 수행한다. OS IME를 자동 합성 사건으로 대체하지 않는다.
8. 실행 명령·종료 코드·관찰·미검증·변경 파일·다음 행동을 한국어 보고서에 남긴다. 패치는 공통 통합 담당자에게 전달하며 실행 종료와 업무 수용을 구분한다.

## 실행과 회수의 증거

원격 작업별 폴더에는 Handoff 원문, 실행기·에이전트 PID, 시작·종료 상태, stdout JSONL·stderr, 결과 Markdown을 둔다. SSH 종료 뒤 새 연결로 상태를 확인하고, PID 존재만으로 Handoff 수용을 주장하지 않는다. 실제 에이전트의 문서 읽기·명령 수행 사건을 확인한다.

원문은 사적 `.www/scratchpad/eight-items/background/`에 회수한다. 이 문서는 인계 계약이며 독립 프로세스 실행 성공이나 최종 Windows 검증의 완료 선언이 아니다. 관찰한 결과는 같은 작업의 검증 기록에 추가한다.
