
# 수동 관찰과 전체 검사

## Electron 수동 탐색

CUA로 별도 WWW-Ecosystem 패키지의 실제 macOS 창에서 사이드바 생태계 진입, 17개 노드와 실선·점선, 상세 설명과 근거 경로를 관찰했다. 독립 검토 노드의 Enter 선택, EVIDENCE.MJS 검색 1개 결과, 없는 검색어의 빈 결과와 초기화, 결과 버튼으로 검증 증거 선택, 후속 방향 필터 4개, 62%에서 확대와 전체 보기 복귀를 관찰했다. 대화 초안 ‘생태계 전환 확인용 초안’은 전환 뒤 그대로 유지됐다. 실제 모델 요청은 보내지 않았다. 원래 WWW 패키지의 진행 중 대화는 변경하지 않았다.

초기 같은 Electron bundle ID의 여러 창에서는 AX 트리와 캡처가 서로 다른 창을 가리켜 시각 판정에 사용하지 않았다. 별도 bundle ID의 패키지에서 그래프 화면을 다시 관찰했다. 검색 라벨 줄바꿈과 main→core 관계선 경로를 보강했다.

## 전체 저장소 검사

npm run check: workflow·타입 검사는 통과, 테스트는 207 통과·3 timeout(5초 제한)으로 실패했다. 실패를 보존한 뒤 bun test --timeout 30000으로 전체 210개 통과·0 실패를 관찰했다. 원문: .www/scratchpad/ecosystem/check.log 및 retry-tests.log. 당시 결과이며 후속 renderer 보강은 실제 Electron probe로 별도 검사한다.

## BoxBox

프로젝트 로컬 .www/tools/boxbox.mjs로 파일별 guide --authoring과 check --source를 작성 전에 실행했다. 신규 파일의 사전 source check는 FILE_NOT_FOUND이며 guide를 참고해 작성했다. 같은 역할의 데이터는 노드·관계별 레코드로 분리하고 구문 경계에 맞춰 필드를 구성했다. 사후 검사 구문은 4개 파일 모두 valid. ecosystem.ts는 FIXABLE 4개, ecosystem-view.tsx는 REFUSE 4개, renderer.tsx는 REFUSE 11개, 테스트는 FIXABLE 2개로 관찰했다. TSX 승인 규칙 부재와 일부 축의 승인 미확인 상태를 가독성 통과로 쓰지 않으며 수동 공백 정렬·format·align은 실행하지 않았다. Markdown·HTML·mjs는 이 검사의 지원 범위가 아니다. 최종 보강 후 source check 결과는 로컬 증거에 추가한다.

<a id="attempt-fa488026-fc74-4f82-84d7-a35d0989e49b"></a>
## 검증 시도 — 2026-11-12T03:44:54.400Z

- 시도 ID: `attempt-fa488026-fc74-4f82-84d7-a35d0989e49b`
- 실행 시각: 2026-11-12T03:44:22.509Z ~ 2026-11-12T03:44:54.400Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.mjs"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/specs/ecosystem.md`, `package.json`, `scripts/verify-ecosystem.mjs`, `src`, `test/ecosystem.test.ts`, `tsconfig.json`
- 소스 식별: `dc9d17acdf7a6c763619c1a76160ba41662357241b9969e3d8d893ea3cdd318c`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 통합 검사와 독립 검토

node scripts/verify-ecosystem.mjs가 타입·집중 테스트·번들 후 실제 Electron과 합성 Native subprocess를 실행했다. 지도 진입·키보드 선택·파일 경로 검색·대화 복귀·초안·선택 범위·명령 펼침·역사 스크롤 보존, 숫자 승인 ID 42 왕복·interrupted 종료를 확인했다. 작업 core에 AC-1~4의 실제 시도와 소스·기준 지문을 연결했으며 sourceStable와 environmentStable은 true다. 원문 결과는 .www/evidence/ecosystem-huPrBW/electron-probe.json, 캡처는 같은 폴더 electron-chat.png에 있다. 실제 모델 요청·Windows 실기 검증은 수행하지 않았다.

공유 review core로 Opus 읽기 전용 감사를 호출했지만 CLI는 ‘Not logged in · Please run /login’을 반환했다. 실제 모델 사용량과 관측 모델이 없으며 verdict는 not_run이다. 원문은 .www/scratchpad/ecosystem/opus-1794455137781/opus.json이다. 인증 실패는 정책상 Terra 대체 사유가 아니므로 대체하거나 독립 검토 통과·done으로 쓰지 않는다. 기능 기준 통과와 필수 감사 미실행을 구분한다. 로그인 복구 뒤 같은 UUID로 현재 소스·문서 지문을 확인해 검토를 재실행해야 한다.

최종 source check에서 프로젝트 임시 런처 .www/tools/boxbox.mjs가 사라져 MODULE_NOT_FOUND를 반환했다. 자동 설치하지 않고 설치된 영구 플러그인 런처로 동일 check --source를 실행했으며 원문은 .www/scratchpad/ecosystem/boxbox-final-permanent.json에 보존했다. 정렬·format은 실행하지 않았다.
