# 예시: Native 승인 대기 카드

> 이 문서는 **합성 예시**다. 기능이 구현됐거나 실제 작업이 생성·완료됐다는 뜻이 아니다. 아래 UUID는 예시 재현을 위한 유효한 고정값이며 `docs/work/`에는 가짜 작업을 만들지 않는다.

사용자 요청: “Native가 승인을 기다릴 때 채팅에 승인 카드를 보여주고, 허용/거절 후 결과를 표시해줘.”

예시 문서 경로는 `docs/work/Chat/002-승인 대기 카드/`, 작업 ID는 `work-123e4567-e89b-42d3-a456-426614174000`이다. 경로와 UUID는 독립적이며 이 합성 경로를 실제로 만들지 않는다.

## 단계별 흐름

| 단계 | 담당 스킬 | 생성 | 갱신 | 읽기 | 핵심 판단 |
|---|---|---|---|---|---|
| 1. 접수 | `www-spec` | `work.json`, `spec.md` | — | 현재 `src/shared.ts`, `src/renderer.tsx`, `src/main.ts`, `src/preload.ts`, `src/rpc.ts`, `src/projection.ts`, 기존 테스트 | “Native”가 현재 로컬 app-server 승인 요청임을 확인하고 화면·응답 범위를 고정한다. |
| 2. 설계 | `www-design` | `design.md`, 복수 단위면 `tasks.md` | `work.json`을 `ready`로 바꿀 수 있음 | 명세와 기존 IPC/JSON-RPC 경계 | 승인 ID 보존, 중복 클릭, EOF 불확실성을 설계한다. |
| 3. 구현 | `www-build` | 필요한 경우 실제 테스트 파일 | 기존 소스·테스트, `work.json: in_progress` | 설계와 작업 목록 | 승인된 범위만 구현한다. |
| 4. 검증 | `www-verify` | `verification.md` | 기준 결과, 성공할 때만 `done` | diff, 테스트, 소스 상태 | 합성 fixture 통과와 실제 사용자 수용을 구분한다. |
| 5. 게시·색인 | 미래 기능 | 서버 외부 색인 메타데이터 | 게시/색인 관찰 상태 | GitHub 지정 브랜치 기록 | push 성공과 Mac mini 색인 성공을 별도로 표시한다. 현재는 구현되지 않았다. |
| 6. 후속 버그 | `www-diagnose` | 별도 버그 작업의 `work.json`, `spec.md`, `diagnosis.md` | 새 작업의 검증 기록 | 원작업 설계·Git·과거 검증 | 과거 성공을 덮어쓰지 않고 관계로 연결한다. |

## 1. 접수와 기준선

`www-spec`은 현재 구현이 메모리 전용 Electron 기준선이고 Tauri는 비교안이며, 서버 API·색인이 없고 live Codex 승인이 검증되지 않았음을 기록한다. 영향 영역은 `areas: ["ui", "dev"]`, 주 책임은 `owner: "ui"`다. 패키징·배포·운영 진단을 바꾸지 않으므로 `ops`를 억지로 넣지 않는다.

수용 기준 예시는 다음과 같다.

- `AC-1`: 문자열 또는 숫자 JSON-RPC 승인 ID를 바꾸지 않고 승인 카드를 표시한다.
- `AC-2`: 허용과 거절 각각에 대해 지원되는 응답을 한 번만 보내고 결과를 한국어로 표시한다.
- `AC-3`: 연속 클릭으로 동일 승인에 중복 응답하지 않는다.
- `AC-4`: 지원하지 않는 reply 형식은 성공으로 꾸미지 않고 지원하지 않음으로 표시한다.
- `AC-5`: EOF 시 미결 승인을 성공 처리하지 않고 결과 불확실 상태로 표시하며 자동 재시도하지 않는다.

초기 `work.json`의 작은 예시는 다음과 같다. 아직 실행 전이므로 `draft`와 `unverified`가 맞다.

```json
{
  "schemaVersion": 1,
  "id": "work-123e4567-e89b-42d3-a456-426614174000",
  "title": "승인 대기 카드를 채팅에 표시",
  "kind": "feature",
  "areas": ["ui", "dev"],
  "owner": "ui",
  "status": "draft",
  "blockedReason": null,
  "relations": [],
  "criteria": [
    {
      "id": "AC-1",
      "description": "문자열 또는 숫자 승인 ID를 보존해 카드를 표시한다.",
      "required": true,
      "result": "unverified",
      "evidence": []
    }
  ]
}
```

## 2. 설계와 파일 지도

```text
docs/work/Chat/002-승인 대기 카드/
├── work.json          # 접수 때 생성, 전 과정의 기준 상태
├── spec.md            # 접수 때 생성
├── design.md          # 설계가 시작될 때 생성
├── tasks.md           # 구현 단위가 필요할 때만 생성
└── verification.md    # 실제 검증을 실행할 때 생성

src/main.ts            # 현재 Electron 프로세스·승인 연결 후보
src/preload.ts         # 현재 격리 브리지 후보
src/shared.ts          # 현재 공유 타입 후보
src/renderer.tsx       # 현재 채팅 카드 UI 후보
src/rpc.ts             # 현재 JSON-RPC ID·응답·EOF 처리
src/projection.ts      # 현재 이벤트 화면 투영
test/rpc.test.ts       # 현재 전송 행동 테스트
```

`test/approval-card.test.tsx` 같은 이름은 **향후 생성할 수 있는 예시 경로**일 뿐 현재 파일이라고 주장하지 않는다. 설계는 shared React view를 유지하고 선택된 데스크톱 백엔드 경계만 연결한다. Electron/Tauri 결정을 이 기능이 대신하지 않는다.

`tasks.md`가 필요하다면 (1) 요청 상태와 ID 보존, (2) 카드와 단일 응답 제어, (3) EOF·unsupported 오류 표시, (4) 행동 테스트 순으로 끝까지 동작하는 단위를 둔다. UI/Dev/Ops는 별도 순차 팀이 아니라 같은 작업의 영향 분류다.

## 3. 구현과 검증

`www-build`은 명시적 구현 승인 후에만 위 후보를 실제 diff로 좁힌다. 템플릿만으로 소스를 생성하지 않는다. 검증은 문자열 ID와 숫자 ID, allow와 reject, unsupported reply, 빠른 반복 클릭, 응답 전 EOF를 각각 실행한다. fixture 테스트만으로 비즈니스 수용이나 live Codex 왕복 성공을 주장하지 않는다.

실행할 때만 `verification.md`를 만들고 시도마다 명령·source commit·dirty 여부·핵심 결과·한계를 추가한다. 추적 가능한 요약 앵커가 생긴 뒤에만 기준 증거에 예를 들어 `verification.md#attempt-1`을 넣는다. required 기준 전부가 실제 증거로 통과하기 전에는 `done`이 아니다.

## 4. 게시, 서버 보기와 후속 버그

미래에는 GitHub push 뒤 Mac mini가 지정 브랜치의 코드와 기록을 검증·색인하고 데스크톱 Roadmap/Node/Canvas가 같은 투영을 읽는다. push 성공 화면과 “commit X 색인됨” 화면은 별개다. 원격 실행·소스 동기화·브랜치 통합은 이 흐름에 없다.

나중에 “연결이 끊겼는데 오래된 승인 카드가 활성 상태다”라는 증상이 나오면 `docs/work/Chat/003-연결 종료 후 승인 카드 정리/`라는 합성 경로와 새 버그 ID(예: `work-123e4567-e89b-42d3-a456-426614174001`)를 만들고 `relations: [{"type":"fixes","target":"work-123e4567-e89b-42d3-a456-426614174000"}]`로 연결한다. `diagnosis.md`에는 “EOF 정리 누락”을 먼저 가설로 두며 테스트 전에는 원인으로 쓰지 않는다. 기존 설계, Git 이력, 옛 `verification.md`를 읽되 과거 당시의 통과 결과를 지우지 않는다. 수정과 새 검증은 새 작업의 미래 실행이다.
