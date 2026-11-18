# 완료 단위 실행 설계

정본 운영 절차: docs/skills/EXECUTION_EFFICIENCY.md.

로컬 소유는 운영 문서와 관측·교차검증뿐이며 원격 제품 코드는 수정하지 않는다. 원격은 기존 누적 root를 안전 경계에서 종료하고 새 Sol 세션에 Reports001/002/003만 인계한다. 새 실행이 실제 정책과 checkpoint를 대조하고 ACK를 남기는 것을 인계 수용 관측으로 삼는다. 완료 조건은 기존 UUID의 core가 소유한다.

Sonnet 사전 검토(claude-sonnet-5-5)의 5개 위험을 반영했다: 실행중 도구/잠금/최근 쓰기 확인, 종료 전후 SHA, 이전 host 종료, 기계적 core 재사용, 새 문맥 baseline과 advisory checkpoint, AGENT 기존 diff 별도 보존. 2분 원장 안정성과 현재 tool 없음은 stop 선행조건이며 완전한 OS격리 보장은 아니다.

20분/반복 실패2/위임2/입력60k는 점검 기준이며 hard token cap은 아니다. 필수 감사 시간을 강제로 자르지 않는다. 프로세스 SIGINT 후 종료 실패/예기치 않은 SHA 차이는 신규 writer를 차단한다. 자동재시작/강제kill/잠금삭제/롤백/커밋/동기화는 하지 않는다.

검증: 정책 링크와 계약 검사, 원격171기술파일/57원장 SHA 보존, 새 세션의 정책 ACK와 실제 호출/토큰 수집, Sonnet 사전검토+최종 Opus. 정책 배치와 첫 수용 관측은 적용이며 Reports업무완료 및 절감률 입증과 다르다.
