# 기준 원장 27개와 이번 세션의 진행 범위

27개는 최초 요청에서 확정한 목록이다. 이후 생성된 작업은 이 목록에 섞지 않는다. 아래 현재 상태는 원장에 적힌 메타데이터의 관측이며 최신 통합 소스의 완료 승인과 구별한다. 이전 고정 검증 결과와 미실행 조건을 지우거나 자동 done으로 바꾸지 않았다.

| 번호 | 작업 | 고정 검증 당시 상태 | 현재 원장 상태 | 필수 기준 중 미통과 |
|---|---|---|---|---|
| 01 | [Chat/001-Native 흐름 통제와 가독성](../../Chat/001-Native%20%ED%9D%90%EB%A6%84%20%ED%86%B5%EC%A0%9C%EC%99%80%20%EA%B0%80%EB%8F%85%EC%84%B1/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 02 | [Chat/002-중단 접수와 실제 종료 구분](../../Chat/002-%EC%A4%91%EB%8B%A8%20%EC%A0%91%EC%88%98%EC%99%80%20%EC%8B%A4%EC%A0%9C%20%EC%A2%85%EB%A3%8C%20%EA%B5%AC%EB%B6%84/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 03 | [Chat/003-Native 실시간 작업 흐름과 사용량](../../Chat/003-Native%20%EC%8B%A4%EC%8B%9C%EA%B0%84%20%EC%9E%91%EC%97%85%20%ED%9D%90%EB%A6%84%EA%B3%BC%20%EC%82%AC%EC%9A%A9%EB%9F%89/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 |
| 04 | [Chat/004-자연스러운 진행 설명과 공개 추론 요약](../../Chat/004-%EC%9E%90%EC%97%B0%EC%8A%A4%EB%9F%AC%EC%9A%B4%20%EC%A7%84%ED%96%89%20%EC%84%A4%EB%AA%85%EA%B3%BC%20%EA%B3%B5%EA%B0%9C%20%EC%B6%94%EB%A1%A0%20%EC%9A%94%EC%95%BD/work.json) | verifying → verifying | done | 없음(증거 적용성은 별도) |
| 05 | [Chat/005-Skills와 Hook 활동 사이드바](../../Chat/005-Skills%EC%99%80%20Hook%20%ED%99%9C%EB%8F%99%20%EC%82%AC%EC%9D%B4%EB%93%9C%EB%B0%94/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 06 | [Chat/006-오픈소스 채팅 뼈대와 Native 대화 재개 통합](../../Chat/006-%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4%20%EC%B1%84%ED%8C%85%20%EB%BC%88%EB%8C%80%EC%99%80%20Native%20%EB%8C%80%ED%99%94%20%EC%9E%AC%EA%B0%9C%20%ED%86%B5%ED%95%A9/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4 |
| 07 | [Chat/007-실시간 세션 모니터와 채팅 가독성](../../Chat/007-%EC%8B%A4%EC%8B%9C%EA%B0%84%20%EC%84%B8%EC%85%98%20%EB%AA%A8%EB%8B%88%ED%84%B0%EC%99%80%20%EC%B1%84%ED%8C%85%20%EA%B0%80%EB%8F%85%EC%84%B1/work.json) | in_progress → in_progress | in_progress | AC-05, AC-10 |
| 08 | [Chat/008-오픈소스 채팅 뼈대 도입 비교](../../Chat/008-%EC%98%A4%ED%94%88%EC%86%8C%EC%8A%A4%20%EC%B1%84%ED%8C%85%20%EB%BC%88%EB%8C%80%20%EB%8F%84%EC%9E%85%20%EB%B9%84%EA%B5%90/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3 |
| 09 | [Chat/009-채팅과 실시간 사이드바 및 프로젝트 Node Map 개편](../../Chat/009-%EC%B1%84%ED%8C%85%EA%B3%BC%20%EC%8B%A4%EC%8B%9C%EA%B0%84%20%EC%82%AC%EC%9D%B4%EB%93%9C%EB%B0%94%20%EB%B0%8F%20%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%20Node%20Map%20%EA%B0%9C%ED%8E%B8/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 10 | [Development/001-Mac과 Windows 실사용 및 검증 신뢰성 완성](../../Development/001-Mac%EA%B3%BC%20Windows%20%EC%8B%A4%EC%82%AC%EC%9A%A9%20%EB%B0%8F%20%EA%B2%80%EC%A6%9D%20%EC%8B%A0%EB%A2%B0%EC%84%B1%20%EC%99%84%EC%84%B1/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8 |
| 11 | [Ecosystem/001-WWW 생태계 노드 탐색](../../Ecosystem/001-WWW%20%EC%83%9D%ED%83%9C%EA%B3%84%20%EB%85%B8%EB%93%9C%20%ED%83%90%EC%83%89/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4 |
| 12 | [Ecosystem/002-코드 기반 아키텍처 설계도와 계층형 Node 그래프](../../Ecosystem/002-%EC%BD%94%EB%93%9C%20%EA%B8%B0%EB%B0%98%20%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98%20%EC%84%A4%EA%B3%84%EB%8F%84%EC%99%80%20%EA%B3%84%EC%B8%B5%ED%98%95%20Node%20%EA%B7%B8%EB%9E%98%ED%94%84/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 13 | [Ecosystem/003-구조 ID 계약과 단계별 설계도 탐색](../../Ecosystem/003-%EA%B5%AC%EC%A1%B0%20ID%20%EA%B3%84%EC%95%BD%EA%B3%BC%20%EB%8B%A8%EA%B3%84%EB%B3%84%20%EC%84%A4%EA%B3%84%EB%8F%84%20%ED%83%90%EC%83%89/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 14 | [Reports/001-작업 종료 보고서와 앱 리포트](../../Reports/001-%EC%9E%91%EC%97%85%20%EC%A2%85%EB%A3%8C%20%EB%B3%B4%EA%B3%A0%EC%84%9C%EC%99%80%20%EC%95%B1%20%EB%A6%AC%ED%8F%AC%ED%8A%B8/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 |
| 15 | [Reports/002-독자의 판단을 돕는 보고서 양식](../../Reports/002-%EB%8F%85%EC%9E%90%EC%9D%98%20%ED%8C%90%EB%8B%A8%EC%9D%84%20%EB%8F%95%EB%8A%94%20%EB%B3%B4%EA%B3%A0%EC%84%9C%20%EC%96%91%EC%8B%9D/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 |
| 16 | [Workflow/001-Skills 실행과 개발 기록 자동화](../001-Skills%20%EC%8B%A4%ED%96%89%EA%B3%BC%20%EA%B0%9C%EB%B0%9C%20%EA%B8%B0%EB%A1%9D%20%EC%9E%90%EB%8F%99%ED%99%94/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 17 | [Workflow/002-선택 변경의 안전한 커밋 절차](../002-%EC%84%A0%ED%83%9D%20%EB%B3%80%EA%B2%BD%EC%9D%98%20%EC%95%88%EC%A0%84%ED%95%9C%20%EC%BB%A4%EB%B0%8B%20%EC%A0%88%EC%B0%A8/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 18 | [Workflow/003-커밋과 Push의 기본 게시 정책](../003-%EC%BB%A4%EB%B0%8B%EA%B3%BC%20Push%EC%9D%98%20%EA%B8%B0%EB%B3%B8%20%EA%B2%8C%EC%8B%9C%20%EC%A0%95%EC%B1%85/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 19 | [Workflow/004-WWW 개발 역할과 검증 증거 연결](../004-WWW%20%EA%B0%9C%EB%B0%9C%20%EC%97%AD%ED%95%A0%EA%B3%BC%20%EA%B2%80%EC%A6%9D%20%EC%A6%9D%EA%B1%B0%20%EC%97%B0%EA%B2%B0/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 20 | [Workflow/005-Skills 라이브러리 한국어 대체](../005-Skills%20%EB%9D%BC%EC%9D%B4%EB%B8%8C%EB%9F%AC%EB%A6%AC%20%ED%95%9C%EA%B5%AD%EC%96%B4%20%EB%8C%80%EC%B2%B4/work.json) | in_progress → in_progress | in_progress | AC-1, AC-2, AC-3, AC-4 |
| 21 | [Workflow/006-완료 전 문서 영향 검토](../006-%EC%99%84%EB%A3%8C%20%EC%A0%84%20%EB%AC%B8%EC%84%9C%20%EC%98%81%ED%96%A5%20%EA%B2%80%ED%86%A0/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 22 | [Workflow/007-BoxBox 훅 오류와 작성 범위 진단](../007-BoxBox%20%ED%9B%85%20%EC%98%A4%EB%A5%98%EC%99%80%20%EC%9E%91%EC%84%B1%20%EB%B2%94%EC%9C%84%20%EC%A7%84%EB%8B%A8/work.json) | verifying → done | done | 없음(증거 적용성은 별도) |
| 23 | [Workflow/008-TypeScript 작성 규칙과 실행 하네스](../008-TypeScript%20%EC%9E%91%EC%84%B1%20%EA%B7%9C%EC%B9%99%EA%B3%BC%20%EC%8B%A4%ED%96%89%20%ED%95%98%EB%84%A4%EC%8A%A4/work.json) | done → done | done | 없음(증거 적용성은 별도) |
| 24 | [Workflow/009-JavaScript 전체 TypeScript 이관](../009-JavaScript%20%EC%A0%84%EC%B2%B4%20TypeScript%20%EC%9D%B4%EA%B4%80/work.json) | verifying → verifying | verifying | AC-2, AC-3 |
| 25 | [Workflow/010-BoxBox 저작과 전체 변경 검증](../010-BoxBox%20%EC%A0%80%EC%9E%91%EA%B3%BC%20%EC%A0%84%EC%B2%B4%20%EB%B3%80%EA%B2%BD%20%EA%B2%80%EC%A6%9D/work.json) | verifying → verifying | verifying | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 26 | [Workflow/011-용도와 역할별 커밋 후보 분리](../011-%EC%9A%A9%EB%8F%84%EC%99%80%20%EC%97%AD%ED%95%A0%EB%B3%84%20%EC%BB%A4%EB%B0%8B%20%ED%9B%84%EB%B3%B4%20%EB%B6%84%EB%A6%AC/work.json) | verifying → verifying | done | 없음(증거 적용성은 별도) |
| 27 | [Workflow/012-BoxBox 승인 규칙과 새 JSON 출력](../012-BoxBox%20%EC%8A%B9%EC%9D%B8%20%EA%B7%9C%EC%B9%99%EA%B3%BC%20%EC%83%88%20JSON%20%EC%B6%9C%EB%A0%A5/work.json) | done → done | done | 없음(증거 적용성은 별도) |

이번 세션은 이 목록의 기존 검토 지적과 실제 결함을 Workflow/014에서 통합 수정하고 목적별로 게시한다. 환경 재작업 개선은 신규 Workflow/015와 GitHub 이슈 #1에서 명세·설계·사전점검·회귀 검증으로 다룬다. 실제 사람의 Windows 한국어 IME, 실제 모델 전체 흐름처럼 관측하지 못한 동작을 합성 GUI나 패키징 통과로 승격하지 않는다.

원래 요청의 185 표시는 서로 다른 184개 경로와 staged/unstaged 중복 1건으로 집계했다. 파일이 한 번 게시됐다는 사실과 그 파일의 후속 변경까지 게시됐다는 사실은 구별하며 최종 diff와 commit 기록으로 확인한다.
