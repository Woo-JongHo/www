# 채팅 표현 기반 비교와 GJC 참조

조사일: 2026-11-13. 작업: `work-eed41da3-f22e-4fb9-b9df-9a1a7d76c44f`, 관련 기준 `AC-09`. Chat 005의 비교를 출발점으로 삼되 이번에 아래 고정 revision의 공식 소스·패키지·라이선스를 네트워크로 다시 확인했다. 패키지 설치·후보 앱 실행·통합 성능 비교는 수행하지 않았다.

## 이번 선택

첫 파일럿은 기존 Ovis 개작 코드·react-markdown·WWW 사건 투영을 유지한다. 명령 카드와 상태 모니터 개선에는 새 runtime이나 전체 앱 교체가 필요하지 않다. 이미 반입한 Ovis의 논리 행 펼침 상태를 재사용하고 명령 카드의 출력·상태를 WWW 데이터에 연결한다. 라이브러리 수를 늘리는 것 자체를 오픈소스 활용의 성과로 보지 않는다.

| 후보·고정 revision | 확인한 적합성·확장성 | 의존성과 위험 | 이번 판단 |
|---|---|---|---|
| Ovis `d505c75e26c54f31573057d1e9aa431ecc56677f` | React 기반, 논리 행에 펼침·포커스 상태를 두는 구조. 기존 개작 범위에 필요한 상호작용을 직접 연결 가능 | 전체 앱은 herdr·PTY·pane 상태와 다수 의존성에 연결. 전체 앱의 React 버전이 WWW와 같다고 보장하지 않음 | 기존 개작과 MIT 고지 유지. 전체 앱·PTY 반입 없이 현재 뼈대 재사용 |
| assistant-ui `53ab9cbae076b569b37189795b93b71af0a40117` | React 18/19 지원. 외부 상태 adapter와 조합형 UI, 스트리밍·키보드·접근성 기능을 공식 문서가 안내 | core/store/stream·Radix·Zod·Zustand 등. WWW 사건을 메시지·도구 상태로 변환하고 승인·재개를 따로 연결해야 함 | 전체 채팅 조합을 교체할 후속 후보. 현재 카드 파일럿에는 runtime 추가 이득보다 연결 범위가 큼 |
| T3 Code `ee90bdc9405d8d4b8ff78ce2133ccb04844298ab` | Electron 기반 개발 채팅 앱. Markdown·composer와 Codex 연결의 실제 앱 구조를 참고 가능 | Electron·Effect·private workspace contracts/client-runtime 등과 결합. 카드 하나 추출에도 환경·상태 의존 검토 필요 | 전체 앱 기반 교체의 비교 후보로 보존. 현행 Native·보고서·생태계 이주를 이번 UI 개선에 섞지 않음 |

이는 이번 범위에 대한 저자 판단이다. 의존성 목록과 API 확인만으로 실제 Electron 번들·스트리밍 지연·스크린리더 품질을 검증했다고 쓰지 않는다.

## 공식 근거와 라이선스

Ovis의 [패키지](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/package.json), [논리 행 상태](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/src/lib/chatRowState.tsx), [MIT 라이선스](https://github.com/devswha/ovis/blob/d505c75e26c54f31573057d1e9aa431ecc56677f/LICENSE)를 확인했다. 현재 반입 파일·제외한 store와 원문 고지는 [Ovis 사용 고지](../../../third-party/ovis.md)가 소유한다. 이번 조사는 새 Ovis 코드를 복사하지 않았다.

assistant-ui의 [React 패키지](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/packages/react/package.json), [외부 상태 연결 문서](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/apps/docs/content/docs/runtimes/custom/external-store.mdx), [README의 UI 기능](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/README.md), [MIT 라이선스](https://github.com/assistant-ui/assistant-ui/blob/53ab9cbae076b569b37189795b93b71af0a40117/LICENSE)를 확인했다. 외부 상태를 호스트가 소유하고 제공 callback에 따라 편집·분기 등의 기능을 켜는 계약이다. WWW가 제공하지 않는 동작을 UI에 먼저 노출하면 안 된다.

T3 Code의 [desktop 패키지](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/desktop/package.json), [ChatMarkdown](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/apps/web/src/components/ChatMarkdown.tsx), [MIT 라이선스](https://github.com/pingdotgg/t3code/blob/ee90bdc9405d8d4b8ff78ce2133ccb04844298ab/LICENSE)를 확인했다. desktop은 private workspace이며 Markdown도 shared·contracts·호스트 상태에 연결된다. 접근성 관련 의존성의 존재만으로 전체 앱 접근성 통과를 주장하지 않는다.

## GJC 실제 실행과 소스 대조

설치된 `gjc --version`은 `gjc/0.20.0`을 반환했다. `/tmp`에서 `--no-session --no-mcp --no-lsp --no-rules --no-title --no-pty`로 실제 TUI를 열고 모델 요청 없이 shell 입력 `!printf '  first line\n    second line\nthird line\n'`를 실행했다. 제목의 명령, `Running…` 상태, 들여쓰기가 다른 세 줄 출력이 관측됐고 `/exit`로 세션을 종료했다.

로컬 원문은 `.www/evidence/work-eed41da3-f22e-4fb9-b9df-9a1a7d76c44f/gjc-reference.ansi`, 제어문자를 제거한 검색용 사본은 같은 경로의 `gjc-reference.txt`다. 원문은 터미널의 부분 갱신을 포함하므로 검색용 사본을 정확한 최종 화면 스크린샷으로 취급하지 않는다. 현재 모델이 호출한 bash 도구 카드·오류·10줄 경계·마우스 상호작용을 이 실행으로 검증한 것은 아니다.

명령 도구의 구현은 공식 고정 revision `bf188c1cda0665219f8af2edbed1256eede317bc`의 [bash renderer](https://github.com/Yeachan-Heo/gajae-code/blob/bf188c1cda0665219f8af2edbed1256eede317bc/packages/coding-agent/src/tools/bash.ts#L2940-L3045)에서 대조했다. 명령과 출력 구획, 부분·오류·정상 상태 아이콘, 펼침과 미리보기, 보관 절단 안내를 확인했다. 이는 과거 pinned 소스의 사실이며 현재 설치 바이너리와 동일 revision이라는 주장은 아니다. GJC의 화면·소스는 참고만 했고 코드를 반입하지 않았다.

참고하던 과거 조사 파일은 별도 보존 checkout `99_www-desktop/docs/research/2026-09-04-gajae-code-tui-research.md`에서 찾았다. 같은 checkout의 `spikes/tui-bakeoff/captures/gajae*.ansi`는 `@gajae-code/tui`로 만든 WES 데모이므로 실제 GJC 명령 카드의 증거에서 제외했다.

## 파일럿에 반영할 차이

GJC에서 명령·출력·관측 상태의 구분을 가져오되 웹에서는 키보드 포커스와 내부 스크롤을 명시한다. 실행 중에는 최근 10개 논리 줄을 보여주고 정상 종료 후에는 앞 10개 논리 줄로 바꾸는 것은 WWW 명세의 선택이다. GJC와 정확히 같은 줄 수·렌더링 규칙이라고 주장하지 않는다. 사용자 펼침 보존과 보관 한계 고지를 기존 WWW 상태 소유에 연결한다.
