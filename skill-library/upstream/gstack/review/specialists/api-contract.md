> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# API 계약 전문가 검토 체크리스트

범위: SCOPE_API=true일 때
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"api-contract","summary":"...","fix":"...","fingerprint":"path:line:api-contract","specialist":"api-contract"}
선택 사항: line, fix, fingerprint, evidence, test_stub.
발견 사항이 없으면 `NO FINDINGS`만 출력하고 다른 것은 출력하지 않습니다.

---

## 범주

### 호환성을 깨는 변경
- 응답 본문에서 필드 제거(클라이언트가 해당 필드에 의존할 수 있음)
- 필드 유형 변경(string → number, object → array)
- 기존 엔드포인트에 새로운 필수 매개변수 추가
- HTTP 메서드(GET → POST) 또는 상태 코드(200 → 201) 변경
- 기존 경로를 리디렉션/별칭으로 유지하지 않고 엔드포인트 이름 변경
- 인증 요구 사항 변경(public → authenticated)

### 버전 관리 전략
- 버전을 올리지 않고 호환성을 깨는 변경 적용(v1 → v2)
- 같은 API에서 여러 버전 관리 전략 혼용(URL vs header vs query param)
- 종료 일정이나 마이그레이션 안내 없이 엔드포인트 사용 중단
- 버전별 로직이 중앙화되지 않고 컨트롤러 전반에 흩어짐

### 오류 응답 일관성
- 새 엔드포인트가 기존 엔드포인트와 다른 오류 형식을 반환
- 오류 응답에 표준 필드 누락(error code, message, details)
- 오류 유형과 맞지 않는 HTTP 상태 코드(오류에 200, 유효성 검사에 500)
- 내부 구현 세부 정보(stack traces, SQL)를 노출하는 오류 메시지

### 속도 제한 및 페이지네이션
- 유사한 엔드포인트에는 있는데 새 엔드포인트에는 속도 제한이 없음
- 하위 호환성 없이 페이지네이션 변경(offset → cursor)
- 문서화 없이 페이지 크기 또는 기본 제한 변경
- 페이지네이션 응답에 전체 개수 또는 다음 페이지 표시 누락

### 문서 불일치
- OpenAPI/Swagger 명세가 새 엔드포인트나 변경된 매개변수에 맞게 갱신되지 않음
- 변경 후에도 README 또는 API 문서가 이전 동작을 설명함
- 더 이상 작동하지 않는 요청/응답 예시
- 새 엔드포인트 또는 변경된 매개변수 문서 누락

### 하위 호환성
- 이전 버전 클라이언트가 중단되는가?
- 강제 업데이트할 수 없는 모바일 앱에서도 API가 계속 작동하는가?
- 구독자에게 알리지 않고 웹훅 페이로드가 변경되었는가?
- 새 기능을 사용하려면 SDK 또는 클라이언트 라이브러리를 변경해야 하는가?
