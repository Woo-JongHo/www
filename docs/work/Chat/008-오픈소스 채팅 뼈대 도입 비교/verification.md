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
