> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 성능 전문가 검토 체크리스트

범위: SCOPE_BACKEND=true 또는 SCOPE_FRONTEND=true일 때
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"performance","summary":"...","fix":"...","fingerprint":"path:line:performance","specialist":"performance"}
선택 사항: line, fix, fingerprint, evidence, test_stub.
발견 사항이 없는 경우: `NO FINDINGS`만 출력하고 다른 것은 출력하지 않는다.

---

## 범주

### N+1 쿼리
- 즉시 로딩(.includes, joinedload, include) 없이 루프에서 순회하는 ActiveRecord/ORM 연관 관계
- 배치 처리할 수 있는데도 반복 블록(each, map, forEach) 안에서 실행하는 데이터베이스 쿼리
- 지연 로딩 연관 관계를 유발하는 중첩 직렬화기
- 배치 처리 대신 필드마다 쿼리하는 GraphQL 리졸버(DataLoader 사용 여부 확인)

### 누락된 데이터베이스 인덱스
- 인덱스가 없는 열에 새로 추가된 WHERE 절(마이그레이션 파일 또는 스키마 확인)
- 인덱스가 없는 열에 새로 추가된 ORDER BY
- 복합 인덱스가 없는 복합 쿼리(WHERE a AND b)
- 인덱스 없이 추가된 외래 키 열

### 알고리즘 복잡도
- O(n^2) 이상의 패턴: 컬렉션에 대한 중첩 루프, Array.map 안의 Array.find
- hash/map/set 조회를 사용할 수 있는데도 반복하는 선형 검색
- 루프 안의 문자열 연결(join 또는 StringBuilder 사용)
- 한 번이면 충분한데도 큰 컬렉션을 여러 번 정렬하거나 필터링

### 번들 크기 영향(프런트엔드)
- 무겁다고 알려진 새로운 프로덕션 의존성(moment.js, lodash 전체, jquery)
- 딥 임포트(import from 'library/specific') 대신 배럴 임포트(import from 'library')
- 최적화 없이 커밋된 대용량 정적 자산(이미지, 글꼴)
- 라우트 수준 청크의 코드 분할 누락

### 렌더링 성능(프런트엔드)
- 페치 워터폴: 병렬로 실행할 수 있는 순차 API 호출(Promise.all)
- 불안정한 참조로 인한 불필요한 재렌더링(렌더링 중 생성하는 새 객체/배열)
- 비용이 큰 계산에서 React.memo, useMemo 또는 useCallback 누락
- 루프에서 DOM 속성을 읽은 뒤 쓰면서 발생하는 레이아웃 스래싱
- 폴드 아래 이미지의 loading="lazy" 누락

### 페이지네이션 누락
- 제한 없는 결과를 반환하는 목록 엔드포인트(LIMIT 없음, 페이지네이션 매개변수 없음)
- 데이터 양에 따라 커지는 LIMIT 없는 데이터베이스 쿼리
- 확장 가능한 ID 대신 중첩 객체 전체를 포함하는 API 응답

### 비동기 컨텍스트에서의 블로킹
- async 함수 안의 동기 I/O(파일 읽기, subprocess, HTTP 요청)
- 이벤트 루프 기반 핸들러 안의 time.sleep() / Thread.sleep()
- 워커로 오프로딩하지 않고 메인 스레드를 차단하는 CPU 집약적 계산
