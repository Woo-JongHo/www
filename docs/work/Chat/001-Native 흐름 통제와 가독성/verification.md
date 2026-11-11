# 검증 기록

<a id="2026-11-12-구현-검증"></a>
## 2026-11-12 구현 검증

- 소스: `028b4a378885938c43e9172b7534fc4e83e7d57e` 위 dirty 작업 트리
- `npm run check`: 통과. Bun 테스트 37개, TypeScript 검사, 번들 빌드 통과.
- `node scripts/check-workflow.mjs`: 통과.
- `node scripts/check-skill-library.mjs`: 통과.
- `git diff --check`: 통과.
- Electron fixture GUI probe: 숫자 승인 ID `42`의 거절 왕복, 스트리밍 알림, 명령·파일 사건, 중단 요청과 `interrupted` 완료를 실제 Electron 브리지에서 확인했다. 로컬 원본은 Git에서 제외된 `.www/evidence/work-e2419fa7-3d27-4c77-812b-2b825326dc70/electron-probe.json`에 있다.
- 같은 probe에서 입력 초안과 선택 범위가 스트리밍 사건 뒤에도 유지됨을 확인했다. 실제 창 캡처 `electron-chat.png`에서 실행 박스, 응답 완료 카드, 공개 설명 미제공, 관측 결과, 검증 비자동 승격, 미해결 요약과 sandbox 한계 문구를 확인했다.
- 실제 Native: `codex login status`는 `Logged in using ChatGPT`; read-only `codex exec`는 `package.json`의 `name`을 `www`로 응답했다. Vercel MCP의 `invalid_token` 경고가 있었으나 해당 로컬 읽기는 완료됐다. 실제 app-server GUI의 승인 edge는 실행하지 않았고 fixture 증거와 구분한다.
- BoxBox `check --source`: 수정 TypeScript/TSX 구문은 유효했다. `shared.ts` 4개, `projection.ts` 5개 그룹은 `FIXABLE`; `main.ts` 4개, `renderer.tsx` 5개 그룹은 승인되지 않은 형태로 `REFUSE`; 테스트는 감지 그룹이 없었다. 작성 전 guide를 누락했으므로 자동 훅 적용이나 정렬 완료를 주장하지 않는다.

### 판정

- AC-1~4, AC-6, AC-7: 단위/fixture/GUI probe 근거로 통과.
- AC-5: 선택 기준이며 영속화는 구현하지 않음.
- AC-8, AC-9: 공개 설명, 관측 결과, 검증, 미해결을 별도 행으로 표시하며 실제 화면 캡처로 통과.
- AC-10: 입력 초안·선택 범위 probe와 하단 추적 조건·새 내용 이동 동작, 실행 박스의 비제어 펼침 상태 구현을 확인해 통과.
- Windows와 한국어 IME 실기, 실제 Native 승인 왕복은 미검증이다.
