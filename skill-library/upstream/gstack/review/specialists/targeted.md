> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 대상별 검토 브리프: 금액, 게이트, 인증 및 비밀 코드

범위: 모든 깊이에서 `gstack-review-plan` TARGETED 줄이 클래스를 지목하는 모든 diff. 독자는 전문과 적중한 각 클래스의 블록을 받는다.
출력: 한 줄에 발견 사항 하나인 JSON 객체. 스키마:
{"severity":"CRITICAL|INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"money|gate|auth|secret","summary":"...","fix":"...","fingerprint":"path:line:category","specialist":"targeted"}
선택: line, fix, fingerprint, evidence, test_stub, cause.
발견 사항이 없으면 `NO FINDINGS`만 출력하고 다른 것은 아무것도 출력하지 않는다. `NO FINDINGS`는 완전한 결과이지, 살펴보지 못했다는 뜻이 아니다.

---

읽기 전용: diff와 diff에서 도달하는 코드를 읽고, 쓰기를 수행하는 편집, 커밋, 게시 또는 실행은 하지 않는다.
추가된 줄만큼 삭제된 줄도 면밀히 읽는다. 제거된 한도, 검사 또는 민감 정보 가림 처리가 검토 대상 변경일 수 있다.
변경된 각 값을 실제로 강제되는 지점까지 추적한다. 존재하지만 절대 도달하지 않는 한도, 검사 또는 민감 정보 가림 처리는 누락된 것이다.

CRITICAL은 차단하는 최저 등급이다. 테스트를 실패시키거나, 프로덕션을 망가뜨리거나, 데이터 또는 비밀을 잃게 하거나, 보안 구멍(injection, auth bypass, secret exposure)을 여는 발견 사항이 해당한다. 그 밖의 모든 것은 INFORMATIONAL이다.

## money
체크리스트의 강제 CRITICAL 줄은 이 블록을 다룬다(review/checklist.md). 한도 없는 지출, 즉 "한도 없는 유료 호출, 재시도 또는 루프"는 "발견 즉시 CRITICAL"이며 어떤 레인, 전문가, 중복 제거 단계 또는 저장된 결정도 이를 하향 조정하지 않는다.
- 한도 없이 도달 가능한 유료 호출(모델 API, 클라우드 VM, 유료 검색), 또는 호출 횟수나 지출에 제한이 없는 재시도, 루프, 팬아웃.
- 읽었지만 강제되지 않는 한도: 지출 후 검사하거나, 잘못된 단위(cents와 dollars, tokens와 USD)로 비교하거나, 누락된 값을 무제한으로 해석함.
- 제거되거나 완화되었거나 기본값이 off인 플래그 뒤로 이동한 한도 검사.
- 잘못 기록된 지출: 추정치를 실제 비용으로 저장하거나, 실패한 호출을 0으로 기록하거나, 중복 계산하거나, 원장 쓰기를 건너뛸 수 있음.

## gate
- 열린 상태로 실패하는 검사: 오류, 시간 초과, 누락된 입력 또는 읽을 수 없는 파일을 통과로 해석하거나 빈 결과를 green으로 해석함.
- 완화되거나 건너뛰거나 선택 사항이 된 임계값, 필수 검사, 허용 목록 또는 규칙. 또는 보호하던 가드와 함께 건너뛰거나 삭제된 테스트.
- 잘못된 대상에 연결된 판정: 병합 대상이 아닌 다른 commit, tree, branch, PR 또는 run에 연결되거나 오래된 결과를 재사용함.
- 그러한 편집을 감지하는 규칙 해시, 핀 또는 래칫이 요구하는 증거 없이 같은 diff에서 변경됨.

## auth
- 우회: 형제들이 수행하는 신원 검사 없이 도달 가능한 route, command 또는 path, 혹은 허용하는 기본값.
- 잘못된 대상에 대한 권한 검사: owner 대신 caller를 검사하거나, 입력에서 role을 읽거나, object가 확인되기 전에 검사함.
- 만료, 폐기 또는 역할 변경 후에도 session이나 token을 수락하거나, single-use state 값을 건너뛰는 callback.

## secret
- 다른 사람이 읽을 수 있는 곳에 쓰인 비밀: log, error message, PR body, comment, artifact, URL, 읽을 수 있는 file 또는 child process의 argument.
- 제거되거나 우회된 redaction, scrub, mask 또는 file mode, 혹은 기존 redactor를 건너뛰는 새 output path.
- 이전보다 더 넓은 source에서 읽은 key, 하드코딩된 값으로의 fallback, 또는 code나 fixture에 커밋된 실제 credential.
