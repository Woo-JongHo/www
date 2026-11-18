# 검증 기록

## 2026-11-16 집중 검사

`node --test test/workflow-reports.test.ts`와 `bun test test/report-service.test.ts`를 각각 실행했다. 원문은 `.www/evidence/session-completion-20261116/reports-node.log`와 `reports-service-bun.log`에 남겼다. 기존 저장·읽기·보안·이력 검사와 여섯 절의 앵커, 자동 기록 미기록, 완료 및 차단 반례, 인쇄 제외 안내를 확인했다. HTML 문자열과 스타일 선언의 검사는 브라우저에서 실제 링크·인쇄가 동작했다는 증거가 아니다.

첫 시도에서 서비스 테스트를 Node로 실행해 확장자 없는 앱 import 해석 오류가 났고, 이전 이력의 미기록 문구까지 검사한 새 테스트가 실패했다. 서비스 테스트는 기존 Bun 실행기로 바꾸고 완료 entry 구간을 확인하도록 수정해 재실행했다. 실패 원문은 `.www/evidence/session-completion-20261116/reports-focused.log`에 남겼다.

실제 Electron·일반 브라우저·키보드·색 대비·오프라인·인쇄, 전체 타입·빌드, 독립 감사는 이 시도에서 실행하지 않았다. 전체 수용 기준의 현재 적용성과 완료 판정은 통합 검증에 남는다.

## 독립 검토 지적 수정

reader의 빈 nextActions가 기존 narrative.next를 가리는 반례와 두 출처 모두 행동이 있는 반례, 펼친 이력을 인쇄 CSS에서 숨기지 않는 선언 검사를 추가했다. 수정 전 `reports-correction-red.log`에는 세 반례의 실패가 남아 있다. 수정 후 `reports-correction-green.log`에서 재실행했다. 선택한 이력의 원시 상세와 접힌 이력은 출력하지 않으며 펼친 이력 본문은 인쇄 CSS가 숨기지 않는다. 실제 브라우저 인쇄 관찰은 여전히 미실행이다.

<a id="attempt-7ca1c4d6-29e3-42cf-a96e-e536e56db676"></a>
## 검증 시도 — 2026-11-16T07:31:12.266Z

- 시도 ID: `attempt-7ca1c4d6-29e3-42cf-a96e-e536e56db676`
- 실행 시각: 2026-11-16T07:29:34.720Z ~ 2026-11-16T07:31:12.266Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-reports.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/design-system.md`, `docs/skills/REPORTS.md`, `scripts/verify-reports.ts`, `scripts/workflow/report-view.ts`, `scripts/workflow/reports.ts`, `src/renderer.tsx`, `src/reports-view.tsx`, `src/reports.css`, `test/report-service.test.ts`, `test/workflow-reports.test.ts`
- 소스 식별: `70f112b9034d60c64252544c395c189a5bc0764bdea5585dd1e8fbe840def5b8`
- 기준 정의 식별: `6b70bf39012ec889b2c5cf2b28d8ad6dcde5779f644ad30bbf72e8385beac44b`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 64바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
