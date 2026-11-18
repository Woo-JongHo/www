# 검증과 조사 근거

## baseline-20261112

- 저장소: /Users/jonghoPro/woo/00_project/www, main, HEAD 4ef13d29b18188642bf7f7bef6c7d1bb60bfc3c8.
- 실행: npm run check, 이번 세션 PTY 5483, exit 0.
- 관측: 소스 정책, 작업 계약, 앱·도구 타입 검사, Bun/Node 테스트, 빌드 통과. Node tests 147, fail 0, skipped 0, todo 0. Bun 테스트도 성공 후 Node 검사와 빌드로 이어졌다.
- 범위: 오픈소스 도입 전 제품 코드의 기준선. 이후 변경은 이 조사 작업 문서와 목차다. 전체 저장소 검사는 최종 문서 상태를 별도 검사한다.
- 한계: 이번에 실제 Electron GUI·Native 승인·Windows·IME 실기 또는 후보 앱 실행을 수행하지 않았다.

## source-inspection-20261112

- comparison.md의 고정 SHA 링크를 공식 GitHub 연결 도구로 조회하고 adapter·package·license·실제 컴포넌트 import를 읽었다.
- AionUi·Cline 조사 전문: .www/scratchpad/chat-skeleton-upstream.md. 주 저자가 전문을 다시 읽고 비교 문서에 반영했다.
- 목록/README와 실제 코드 존재, 설치·실행, 이식 성공은 별개다. 이 조사에서 마지막 둘은 미실행이다.
- 현재 코어 소스에서 TODO·test.skip·test.only를 검색했고 검색 결과는 없었다. 이는 모든 저장소 파일의 완성 판정이 아니다.
- 최초 공식 typed 진입점에 open을 넘긴 호출은 execute:true 누락으로 실패했고, 실제 신규 등록은 문서화된 work.ts의 open으로 수행했다. 앞선 실패는 제품 검사 성공으로 취급하지 않는다.
- 생성 work.json은 BoxBox 정렬 미준수 경고가 있어 최종 후보에서 직접 검사한다.

## 2026-11-15 마감 재검토 — 과거 조사와 현재 구현 구분

현재 HEAD 92de2389의 제품 기준과 src/renderer.tsx, src/native-chat.ts를 comparison.md의 당시 현황과 대조했다. 현재는 Codex 대화 목록·동일 스레드 재개, Markdown·코드 복사·인용이 구현되어 있으므로 comparison.md의 “목록·영속 저장·읽기·복구 없음”, “Markdown·코드 복사 UI 없음”은 2026-11-12 당시 기준선이며 현재 제품 상태가 아니다. 최신 사용자 정정은 Herdr 같은 완성 앱 중심의 비교를 요구하고, 문서 앞부분은 기존 assistant-ui 우선 권장이 확정안이 아님을 명시한다. 그러나 뒤 결론은 여전히 초기 권장을 사용하므로 현재 권장안의 단일 결론으로 승격할 수 없다.

고정 SHA와 공식 소스·라이선스 링크가 있다는 사실은 확인했다. 이번 패스에서 외부 후보를 설치·실행하거나 새 원격 소스를 조회하지 않았으며 링크 존재만으로 AC-2의 재확인·실제 호환 검증을 통과시키지 않았다. AC-1은 현행 기능표의 재작성·현재 실행 근거 연결, AC-2는 최신 비교 범위의 고정 소스 재확인, AC-3은 사용자 정정을 반영한 일관된 권장안과 후속 선택의 재저작이 남는다. 이전 비교 전문을 덮어쓰지 않고 이 검증 기록으로 시점과 미완료를 구분한다.
