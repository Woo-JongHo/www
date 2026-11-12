# BoxBox 훅 오류와 작성 범위 진단

## 관찰과 입증된 원인

1. 기존 Codex 0.2.7 훅은 Git ignore를 따르지 않는 snapshot으로 .www 증거와 .gjc 실행 상태까지 검사했다. 검사 중 갱신되면 Source changed during check, 삭제되는 lock.transition 디렉터리를 읽으면 ENOENT가 발생했다. 실제 설치 CLI를 같은 격리 Git fixture에서 비교해 구버전은 runtime 203회 갱신 중 Source changed 오류, 수정 설치본은 175회 갱신 중 오류 없음과 sample.py만 검사됨을 확인했다. exit code 0만으로 성공 판정하지 않고 hook 오류 내용·receipt 검사 대상을 확인했다.
2. Missing SessionStart baseline은 새 cwd에 실제 SessionStart 기록 없이 post 검사를 실행할 때 재현됐다. baseline을 임의 생성하거나 기존 세션의 기록을 덮어쓰지 않았다. 호스트 재시작·새 세션에서 실제 등록 경로의 수용 확인이 남는다.
3. 훅 기본 모드는 check이며 자동 정렬하지 않는다. 당시 TypeScript 계열 10파일의 구문은 valid지만 48 FIXABLE·17 REFUSE 그룹과 적용 가능한 승인 0개를 확인했다. 코드가 BoxBox 가독성을 충족했다고 주장할 수 없다.
4. WWW 개발 core의 .mjs는 기존 Node 직접 실행 관례를 따랐다. 설치 BoxBox의 언어 범위에 포함되지 않는다. 새 모듈 작성 시 언어·타입·BoxBox 지원을 함께 확인하지 못한 저작상의 공백이다. Node 22.22.3의 단순 타입 주석 .mts 실행도 실제 확인했으므로 .mjs 선택이 기술적으로 필수였다고 설명하지 않는다.

## 수정과 결정

BoxBox 정본의 lifecycle은 Git ignored untracked 파일·디렉터리를 각 snapshot에서 제외한다. tracked 파일과 Git visible 소스의 drift 거부, non-Git의 기존 전체 범위, guarded-run 기본 범위는 유지한다. source 파일 2개·회귀 검사 1개·소유 문서 1개를 수정했다.

사용자 기존 dirty 변경 4파일을 설치 후보에서 제외하기 위해 BoxBox HEAD a50f14c1401bd2b7f32d1b4ee7621984139d2204 archive와 소유 변경 4파일로 격리 후보를 만들었다. 해당 후보를 빌드한 로컬 개발 설치본이며 공개 배포된 0.2.8과 동일한 내용이라고 주장하지 않는다. 설치 tarball SHA256: 32422c7b0f7280466004e4eb79cb07cb19ee79fe18544f1bc91ca272494745a1.

WWW 제품 소스의 언어 전환, BoxBox JavaScript 지원 추가, 미승인 규칙 자동 승인·공백 정렬은 수행하지 않았다. 사용자의 후속 질문에 기존 확장자를 따른 이유와 판단 누락을 설명했고 언어 지원 확대 제안은 보류했다.

## 남은 범위

- Codex 재시작 후 실제 SessionStart 및 PostToolUse가 수정 설치본을 수용하는지 확인. 격리 CLI 실험과 실제 호스트 수용을 구분한다.
- TypeScript 코드의 BoxBox 가독성과 승인 규칙 범위는 미해결이다. 엔진의 미승인 자동 쓰기 거부를 우회하지 않는다. .mjs/TypeScript 구조 통일은 별도 결정 전까지 변경하지 않는다.
- source 신규 FIXABLE 6개와 기존 2개도 미해결로 보존했다. 전체 저장소·Windows·새 언어 호환성 검사는 수행하지 않았다.


## 2026-11-12 정렬 거부 후속 조사

사용자는 거부 보고서를 읽고 해결 진행을 요청했다. 이 절은 추가 진단 결과이며 완료 판정이나 새 규칙 승인 기록이 아니다.

- 설치 CLI의 doctor는 Node·Python·설정·승인 레코드 5개를 정상으로 확인했다. 설치 누락 가설은 약해졌고, 파일별 실제 key와 preset의 좁은 scope가 맞지 않는 것이 승인 거부의 직접 원인이다.
- 현재 세션 검사 대상 13개 파일의 source check에서 미승인 lookup key 13종을 수집했다. WWW의 열거한 파일에만 적용할 미승인 제안서를 로컬 보고서 폴더에 준비했으며 전역·preset·프로젝트 DB는 변경하지 않았다.
- main.ts 실험 사본은 원본과 같이 syntax valid·REFUSE 13개였다. Number(...) / 1e6만 곱셈으로 치환한 진단 사본도 REFUSE 13개였다. 이 치환은 반올림 의미가 달라질 수 있어 제품 수정안으로 선택하지 않았다.
- 호출 뒤 나눗셈의 최소 예제는 REFUSE 1개였고, 같은 숫자를 변수에 담고 나눈 예제는 REFUSE 0개였다. 정규식 직전 unary !와 호출 뒤 나눗셈을 모두 제거한 진단 사본은 REFUSE 0개·FIXABLE 13개였다.
- BoxBox 원본의 token-preservation 검사에는 호출·괄호 뒤 slash를 보수적으로 거부하는 코드와 회귀 테스트가 존재한다. unary !는 TypeScript non-null assertion과도 구분해야 하므로 승인 없이 prefix whitelist를 넓히거나 안전 검사를 제거하는 방향은 선택하지 않았다.
- 원본의 !regex.test(key)를 regex.test(key) === false로 표현하고, 경과 nanoseconds의 Number 변환과 나눗셈을 분리한 최소 수정 후보는 실제 source check에서 syntax valid·REFUSE 0개·FIXABLE 13개였다. 원본 제품 파일에는 아직 적용하지 않았으며 타입·실제 Electron 검증은 미실행이다.
- 보고서·작업 기록 writer는 JSON.stringify(..., null, 2)를 사용하므로 정렬된 JSON을 나중에 다시 생성하면 공백이 제거될 수 있다. 일회성 정렬을 재발 방지로 보고하지 않는다. 신규 보고서가 늘어 검사 범위가 바뀌는 현상도 별도로 관찰했다.

로컬 원본: .www/evidence/boxbox-refusal/의 current-check.json, main-original.check.json, division-call.check.json, division-name.check.json, main-division-probe.check.json, main-slash-free.check.json, main-candidate.check.json, main-candidate.patch. 규칙 제안은 .www/reports/boxbox-refusal/approval-proposal.md이며 미승인 상태다. 이전 검사·승인 상태는 덮어쓰지 않았다.
