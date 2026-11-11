# WWW 개발 문서

## 범위와 초기 흐름

이 저장소는 기존 WWW 기능을 계승하지 않고 빈 저장소에서 시작한 Electron 데스크톱 앱이다. 현재 범위는 기존 화면의 3열 배치와 어두운 시각 스타일, 그리고 로컬 `codex app-server`와의 최소 연결뿐이다. 레이아웃은 [runkids/skillshare의 herdr/skillshare](https://github.com/runkids/skillshare/tree/main/herdr/skillshare)를 디자인 참고 자료로만 사용했고 코드는 가져오지 않았다.

사용자는 첫 스레드 전 작업 폴더를 고른 뒤 메시지를 보낸다. 앱은 `initialize`/`initialized`, `thread/start`, `turn/start`, `turn/interrupt`를 수행하고 알림을 화면에 투영한다. 명령 실행과 파일 변경을 표시하며, 지원하는 명령/파일 승인 요청에는 원래 JSON-RPC ID(문자열 또는 숫자)를 보존해 응답한다. 그 외 구조화 요청은 임의 결정을 만들지 않고 지원하지 않는 요청으로 표시한다. 계정 로그인이나 자격 증명 저장·전달은 다루지 않는다.

## 실행과 구성

요구 사항은 Node.js/npm, Bun, Electron 실행 환경, PATH의 `codex` CLI다.

```sh
npm run setup
npm run check
npm start
```

`WWW_CODEX_BIN`은 실행 파일 경로만 바꾼다. 사용자 입력으로 임의 spawn 옵션이나 환경을 받지 않는다.

- `src/main.ts`: Electron 생명주기, 폴더 선택, 검증된 IPC, Codex 프로세스 연결
- `src/rpc.ts`: 크기 제한 JSONL/JSON-RPC 전송, 요청 라우팅, EOF/오류 처리
- `src/projection.ts`: 이벤트를 화면 블록으로 바꾸는 순수 투영
- `src/preload.ts`, `src/shared.ts`: context-isolated 브리지와 공유 계약
- `src/renderer.tsx`: React 화면
- `test/`: 가짜 JSONL child transport와 이벤트 투영의 행동 테스트

전송 프레임은 4 MiB로 제한한다. EOF나 오류가 나면 대기 요청을 실패시키며, 결과가 불확실한 변경 요청을 자동 재시도하지 않는다. 이벤트는 메모리에서 최근 2,000개만 보관하고 개인 원장을 파일로 쓰지 않는다.

## 제외한 기능과 Skills 정책

기존 TUI/PTY 탭, xterm/node-pty, 요청/REPORT/WES 7단계 체계, 기존 에픽·규칙·영수증 훅·런타임 파일과 제어판 기능은 가져오지 않았다. 이 저장소의 `AGENTS.md`가 일반적인 저장소/브랜치/dirty 확인과 변경 보존, 검증, 커밋·푸시 제한을 직접 규정하므로 `woo-entry`는 대체됐다. `woo-feature-template`과 `session-goal`은 옛 TUI 흐름, `woo-commit`·`woo-issue`·`woo-pr`은 옛 control-plane, `html-error-report`는 현재 필요가 없어 제외했다. 깨진 `woo-code-readability` 심볼릭 링크도 복사하지 않았다. 새 custom skill은 만들지 않았다.

## 샌드박스 한계

스레드는 `sandbox: workspace-write`, `approvalPolicy: on-request`로 시작한다. 이는 선택한 작업 폴더 쓰기를 허용하는 Codex 정책 설정이지 “폴더 밖의 모든 작업은 반드시 질문한다”는 보장이 아니다. 실제 제한과 승인 발생 여부는 Codex 버전, 플랫폼 샌드박스, 구성, 명령 종류와 서버 정책에 좌우된다. UI는 관찰한 요청만 표시하며 보안 경계가 아니다.

## 검증과 알려진 한계

검증은 `npm run check`로 타입 검사, fake JSONL transport 테스트, 이벤트 투영 테스트, Bun 번들을 수행한다. 테스트는 응답/알림 라우팅, 스트리밍 완료, 숫자 승인 ID 보존, EOF 시 불확실 실패와 무재시도, 지원하지 않는 요청 표시를 다룬다. 합성 fixture 기반이라 실제 사용자 내용은 포함하지 않는다.

주간 사용량을 소비하지 않기 위해 실제 Codex 추론은 실행하지 않았다. 따라서 설치된 CLI의 schema/help로 프로토콜을 확인했지만 live Codex 세션, 실제 승인 왕복, 플랫폼별 샌드박스 동작과 headless Electron 화면은 아직 검증하지 않았다.
