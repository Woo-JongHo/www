# Vercel 플러그인 Hook 등록 경로 조사

## 요청과 권한

사용자는 Vercel 플러그인이 필요 없다고 밝히고 먼저 왜 어디서 도는지 확인하라고 요청했다. 이번 범위는 전역 설정·설치본·기존 실행 근거의 읽기 전용 조사다. 플러그인 비활성화·삭제·직접 Hook 실행은 수행하지 않았다.

## 확인된 활성화 경로

사용자 전역 ~/.codex/config.toml:403의 plugins."vercel@claude-plugins-official"에 enabled=true가 설정돼 있다. plugin_hooks와 plugins 기능도 true다. 설치본은 ~/.codex/plugins/cache/claude-plugins-official/vercel/0.50.0이다. Hook 5개는 앞서 WWW cwd의 실제 hooks/list에 source=plugin, enabled=true로 나왔다. WWW는 src/main.ts에서 codex app-server를 시작하며 스킬·Hook 목록을 그대로 조회한다. 앱 자체의 Vercel 전용 Hook 정의나 Vercel 배포 호출이 등록 원인이 아니다. 설치를 결정한 사람·요청·시각은 이번 설정·캐시 조회로 확정하지 않는다.

## 등록된 처리기

- SessionStart(startup|resume|clear|compact): session-start-seen-skills.mjs — 이미 주입한 스킬의 세션 중복 상태 관리. 일반 startup/resume은 Claude 호환 경로에서 상태 초기화를 하지 않으며 clear/compact에서 재설정한다.
- SessionStart: session-start-profiler.mjs — 실행 하네스 식별, 프로젝트 활성화 조건 검사, 해당 프로젝트의 Vercel CLI·추천 스킬·설정 탐색, 사용 통계 처리 경로.
- SessionStart: inject-claude-md.mjs — 활성화 조건 충족 시 Vercel 세션 지침·knowledge-update 주입 출력.
- PostToolUse(matcher=Skill): posttooluse-skill-telemetry.mjs — 플러그인 소속 스킬의 호출 통계 처리. 모든 도구 호출을 같은 방식으로 전송하는 구조가 아니며 스킬 도구·이름·통계 활성 조건을 검사한다.
- SessionEnd: session-end-cleanup.mjs — 해당 세션의 vercel-plugin 임시 상태 파일 정리.

## WWW에서의 조건

현재 WWW와 홈 폴더에는 활성화 마커(.vercel/vercel.json/Next 설정/.eve) 및 Vercel 계열 의존성·스크립트가 없었다. 정상 환경에서는 profiler의 Vercel 프로젝트 검사 본문과 지침 주입이 건너뛰어질 조건이다. 하지만 시작 Hook의 진입 자체는 전역 등록에 의해 대상이 되며, profiler의 하네스 식별·활성 세션 표시·조건 확인과 비Vercel 분기의 통계 처리 경로는 존재한다. 통계 코드는 기본 opt-out이고 VERCEL_PLUGIN_TELEMETRY=off에서 비활성화하며 네트워크 요청의 코드상 타임아웃은 3초다. 이번 조사에서 실제 전송 여부는 확인하지 않았다.

## 실행 근거와 한계

등록과 실행 성공은 구분한다. 실제 hooks/list는 처리기 5개의 등록·enabled를 확인한 근거다. 로컬 logs_2.sqlite를 mode=ro로 조회했으나 해당 처리기의 실행을 확인할 Hook 로그를 찾지 못했다. 따라서 개별 실행 시각·횟수·성공·기간 및 앱 첫 응답 지연과의 인과는 미확인이다. Hook을 직접 재실행해 외부 통계 전송이나 임시 상태 변경을 만들지 않았다.

정제한 근거와 설치본 파일 SHA256은 .www/evidence/work-64677750-337f-4488-a503-4e0265356bf5/vercel-plugin-investigation.json에 보존했다. 제거·비활성화의 판단 대상은 WWW 소스보다 사용자 전역 Codex 플러그인 설정이다. 실제 설정 변경은 별도 실행 요청 범위로 구분한다.

## 사용자 요청에 따른 전역 비활성화

후속 직접 요청 “비활성화로 돌려 이건 아예”에 따라 사용자 전역 Codex 설정의 vercel@claude-plugins-official enabled 값만 false로 변경했다. 변경 전 사본은 같은 작업의 Git 제외 증거 폴더에 0600으로 보관했고 TOML 파싱 결과에서 다른 설정이 동일함을 대조했다. 플러그인 파일 삭제는 하지 않았다.

새 codex app-server 프로세스에서 hooks/list·skills/list를 실제 조회했다. complete=true, Vercel Hook 0개·Vercel 스킬 0개, 남은 Hook은 BoxBox 3개였다. 전체 스킬 수는 조회 범위에서 71개였다. 기존 프로세스의 재로딩이나 모든 실행 중인 세션의 적용 상태까지 검증한 결과는 아니다. 근거는 .www/evidence/work-64677750-337f-4488-a503-4e0265356bf5/vercel-disabled-verification.json이다.
