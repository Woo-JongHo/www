> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 데이터 마이그레이션 전문가 검토 체크리스트

범위: SCOPE_MIGRATIONS=true일 때
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"data-migration","summary":"...","fix":"...","fingerprint":"path:line:data-migration","specialist":"data-migration"}
선택 사항: line, fix, fingerprint, evidence, test_stub.
발견 사항이 없으면 `NO FINDINGS`만 출력하고 다른 것은 출력하지 않습니다.

---

## 범주

### 가역성
- 데이터 손실 없이 이 마이그레이션을 롤백할 수 있는가?
- 대응하는 down/rollback 마이그레이션이 있는가?
- 롤백이 실제로 변경을 취소하는가, 아니면 아무 작업도 하지 않는가?
- 롤백하면 현재 애플리케이션 코드가 중단되는가?

### 데이터 손실 위험
- 여전히 데이터가 있는 열 삭제(먼저 사용 중단 기간을 추가해야 함)
- 데이터를 잘라내는 열 유형 변경(varchar(255) → varchar(50))
- 코드가 참조하지 않는지 확인하지 않고 테이블 제거
- 모든 참조(ORM, raw SQL, views)를 갱신하지 않고 열 이름 변경
- 기존 NULL 값이 있는 열에 NOT NULL 제약 조건 추가(먼저 백필 필요)

### 잠금 시간
- 대형 테이블에서 CONCURRENTLY 없이 ALTER TABLE 실행(PostgreSQL)
- 행이 100K개를 초과하는 테이블에 CONCURRENTLY 없이 인덱스 추가
- 한 번의 잠금 획득으로 결합할 수 있는 여러 ALTER TABLE 문
- 트래픽 피크 시간에 배타적 잠금을 획득하는 스키마 변경

### 백필 전략
- DEFAULT 값이 없는 새 NOT NULL 열(제약 조건 적용 전 백필 필요)
- 배치로 채워야 하는 계산된 기본값이 있는 새 열
- 기존 레코드용 백필 스크립트 또는 rake task 누락
- 배치 처리 대신 모든 행을 한 번에 갱신하는 백필(테이블 잠금)

### 인덱스 생성
- 프로덕션 테이블에서 CONCURRENTLY 없이 CREATE INDEX 실행
- 중복 인덱스(새 인덱스가 기존 인덱스와 같은 열을 포함)
- 새 외래 키 열에 인덱스 누락
- 전체 인덱스가 더 유용한 곳의 부분 인덱스(또는 그 반대)

### 다단계 안전성
- 애플리케이션 코드와 특정 순서로 배포해야 하는 마이그레이션
- 현재 실행 중인 코드를 중단시키는 스키마 변경(코드를 먼저 배포한 다음 마이그레이션)
- 배포 경계를 가정하는 마이그레이션(이전 코드 + 새 스키마 = 충돌)
- 롤링 배포 중 이전/새 코드를 함께 처리하기 위한 기능 플래그 누락
