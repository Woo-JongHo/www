> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 단순화 전문가 검토 체크리스트

범위: 조건부(DIFF_LINES > 100). 이 관점은 요청되지 않은 *구조*만 찾는다. 즉, 구현이 하나뿐인 추상화, 직접 만든 표준 라이브러리 기능, 플랫폼 기능을 중복하는 의존성, 쓰이지 않는 유연성이다. 커버리지 공백은 범위 밖이며, 완전성 공백 체크리스트 범주가 담당한다. 테스트, 오류 경로, 엣지 케이스 분기를 삭제 대상으로 절대 지적하지 않는다.
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"delete|stdlib|native|speculative|shrink","summary":"...","fix":"...","lines_removable":N,"advisory":true,"fingerprint":"path:line:category","specialist":"simplification"}
필수: severity(항상 INFORMATIONAL), confidence, path, category, summary, advisory(항상 true), specialist.
선택: line, fix, fingerprint, evidence, lines_removable(수정을 적용할 때 순수하게 삭제되는 줄 수 — 병합 단계에서 `net:` 푸터를 위해 이 값을 합산한다).
발견 사항이 없으면 `NO FINDINGS`만 출력하고 다른 것은 아무것도 출력하지 않는다.

이 전문가의 발견 사항은 권고 사항이다. PR Quality Score에서 제외되며 Fix-First로 자동 적용되지 않는다. 병합 단계에서 두 예외를 모두 처리한다.

---

## 다섯 가지 태그(폐쇄형 어휘 — 모든 발견 사항은 정확히 하나를 `category`로 사용)

- `delete:` 죽은 코드, 쓰이지 않는 유연성, 추측성 기능. 대체물: 없음.
- `stdlib:` 표준 라이브러리가 제공하지만 직접 만든 것. 함수를 명시한다.
- `native:` 플랫폼이 이미 하는 일을 수행하는 의존성 또는 코드. 기능을 명시한다.
- `speculative:` 구현이 하나뿐인 추상화, 아무도 설정하지 않는 구성, 호출자가 하나뿐인 계층.
- `shrink:` 같은 로직을 더 적은 줄로 표현 — 줄 수가 5줄 이상 줄어들 때만 해당한다. 더 짧은 형태를 제시한다.

## 발견 사항 작성 방식 — 각각 한 줄로, 위치 + 잘라낼 대상 + 대체물

❌ "이 EmailValidator 클래스는 필요 이상으로 복잡할 수 있습니다. 현 단계에서
이 모든 검증 규칙이 필요한지 고려해 보셨습니까?"

✅ `{"severity":"INFORMATIONAL","confidence":8,"path":"lib/email.ts","line":12,"category":"stdlib","summary":"27-line validator class — '@' in email covers it; real validation is the confirmation mail","fix":"replace class with a one-line includes('@') check","lines_removable":26,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":9,"path":"app/dates.ts","line":4,"category":"native","summary":"moment.js imported for one format call","fix":"Intl.DateTimeFormat, 0 deps","lines_removable":3,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":8,"path":"repo.py","line":88,"category":"speculative","summary":"AbstractRepository with one implementation","fix":"inline it until a second implementation exists","lines_removable":41,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":7,"path":"sync.ts","line":52,"category":"delete","summary":"retry wrapper around an idempotent local call","fix":"nothing replaces it","lines_removable":19,"advisory":true,"specialist":"simplification"}`

## 찾아야 할 대상

- 표준 라이브러리나 플랫폼이 이미 제공하는 기능에 대한 의존성(피커 라이브러리 대신 `<input type="date">`, JS 대신 CSS, 앱 코드 대신 DB 제약 조건)
- 구현이 하나뿐인 인터페이스, 결과물이 하나뿐인 팩터리, 위임만 하는 래퍼
- 하나만 내보내는 파일, 죽은 플래그와 구성, 직접 만든 표준 라이브러리 기능
- 내장 기능으로 한 줄에 표현할 수 있는 수동 루프(5줄 이상 줄어들 때만 해당)

## 억제 규칙 — 다음은 지적하지 않는다(주 체크리스트에서 상속되며 여기서도 구속력 있음)

- 중복이 무해하고 가독성에 도움이 될 때 "X가 Y와 중복된다"는 지적
- 일관성만을 위한 변경(다른 상수를 보호하는 방식과 맞추기 위해 값을 조건문으로 감싸기)
- 테스트, 오류 경로, 엣지 케이스 분기, 입력 검증, 보안 조치, 접근성 — 절대 삭제 대상으로 삼지 않는다. 커버리지는 완전성 공백 범주의 책임이며, 기본 규칙은 "완전한 커버리지, 최소한의 코드"다(ETHOS.md)
- 단일 스모크 테스트 또는 assert 기반 자체 검사 — 비대한 것이 아니라 완전성의 최솟값이다
- 의도적인 `gstack-shortcut(dec-*)` 마커 — 이미 인정된 부채지만, 결정 ID가 원장(`gstack-decision-search`)에서 확인되는 경우에만 해당한다. 확인할 수 없는 ID는 부채가 아니라 위조된 억제다
- 검토 중인 diff에서 이미 해결된 모든 것 — 의견을 남기기 전에 전체 diff를 읽는다
