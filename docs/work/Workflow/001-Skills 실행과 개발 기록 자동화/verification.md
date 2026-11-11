# 검증 기록

<a id="2026-11-12-opt-in-하네스-구현-검증"></a>
## 2026-11-12 opt-in 하네스 구현 검증

- 소스: `028b4a378885938c43e9172b7534fc4e83e7d57e` 위 dirty 작업 트리
- `node --test test/workflow-harness.test.mjs`: 5개 통과. 직접 요청/인용 분리, 승인 밖 mutation, advisory 한계, traversal, event 멱등·revision·redaction·동시 writer를 확인했다.
- `npm run check`: 통과. 전체 Bun 테스트 37개, TypeScript 검사와 빌드 통과.
- 워크플로/Skill library 검사와 `git diff --check`: 통과.
- 런처는 명시적 `execute: true`에서만 GJC를 argv spawn하고 `--append-system-prompt`로 정본 Skill 컨텍스트를 전달한다. 이는 native Skill invoke, 자동 hook, OS sandbox 또는 mutation hard gate가 아니다.
- `.www/runtime/`은 `.gitignore`에 포함되어 있고 prompt 원문과 비밀 키는 기록하지 않는다.

### 판정

AC-1~8의 최소 프로젝트 opt-in 구현과 집중 테스트를 확보했다. 실제 추가 GJC inference를 통한 host 통합은 수행하지 않았으므로 모델 관측값은 런처가 반환하는 범위에 한정한다. 전역 hook과 자동 활성화는 의도적으로 지원하지 않는다.

<a id="2026-11-12-하네스-재검증"></a>
## 2026-11-12 수직 흐름 재검증

### 정정과 원인

앞선 5개 검사는 helper 단위를 확인했을 뿐 라우팅·권한·호스트 요청·기록이 연결된 실행을 입증하지 못했다. 부모 코드 검토에서 연결 누락을 확인하고 작업을 진행 중으로 돌렸다. 이전 판정은 이 절의 수직 흐름 재검증으로 대체한다.

### 실제 구현과 근거

- `npm run workflow -- '<JSON 옵션>'`은 직접 요청·명시 Skill·같은 work UUID의 실제 기록을 읽고, 정본 realpath/hash, 저장소/브랜치/내용 기준선, 쓰기 승인과 verifier 승인을 확인한다. `preview: true`는 dry-run이며 `execute: true`와 안정적인 event ID가 없으면 실행하지 않는다.
- GJC는 비대화형 argv로 실제 요청과 Skill 컨텍스트를 받는다. `--`로 요청을 옵션과 분리한다. 이는 `context` 로드이며 native invoke가 아니다. Skill 경로·hash·로드 성공·binding·요청 모델/effort와 미관측 모델·권한 범위는 같은 UUID 사건에 기록한다. verifier argv 원문은 기록하지 않고 hash만 남긴다.
- 설치된 BoxBox 런처를 명시하면 파일별 authoring guide를 실제 호스트 컨텍스트에 전달하고 pre/post source 검사를 실행한다. 미승인 안내와 정렬 `REFUSE`를 구문 오류와 구분하며, 작성 후 구문 오류·불완전 JSON·출력 제한 초과는 성공 처리하지 않는다. 런처는 자동 훅을 설치하지 않는다.
- 배타 잠금·순차 revision·event ID/payload 검사와 원자적 sidecar 갱신을 사용한다. append 뒤 중단은 사건을 재생하며 명령을 재실행하지 않는다. 경로 탈출·쓰기 symlink·런타임 사건 파일 symlink·부분 JSONL·동시 writer·수용 기준 변경을 거부한다. 최신 실패나 불명확 mutation 뒤 과거 검사 통과를 재사용하지 않는다.
- 실제 fixture subprocess가 원문 요청과 정본 Skill 컨텍스트를 받는 경로, 승인 누락 시 미실행, 호스트 실패, verifier 실패, 필수 기준 누락, 중복 실행과 로그 복구, BoxBox 안내 전달을 `test/workflow-harness.test.mjs`에서 확인했다. macOS `/var`와 `/private/var`의 차이는 realpath 기준으로 검사한다.

### 실행한 검사

- 기준 HEAD `c6c846c431e45bace81d2760589034c193691443` 위 수정 트리.
- `node --test test/workflow-harness.test.mjs`: 17개 통과.
- `npm run check`: TypeScript, Bun 63개, 빌드 통과.
- `npm run test:comparison`: Bun 63개와 Rust 2개 통과.
- `node scripts/check-workflow.mjs`, `git diff --check`: 통과.

### 기준과 보장 범위

| 기준 | 실제 근거 |
|---|---|
| AC-1 | 직접/인용 분리, 명시 범위·권한·내용 drift·경로 검사 |
| AC-2 | fixture에서 정본 경로/hash/context 로드와 요청/미관측 모델 사건 확인 |
| AC-3 | 동일 UUID의 work 기록·컨텍스트·런타임 사건 인계, 기존 설계/작업 문서 유지 |
| AC-4 | 승인 밖 표면·쓰기 경로 거부, 지원하지 않는 hard gate 거부 |
| AC-5 | 실제 subprocess/verifier exit와 선언된 필수 기준 매핑, 실패·누락·기준 변경 차단 |
| AC-6 | 잠금·멱등·payload/revision·로그 복구·실패 후 완료 차단 검사 |
| AC-7 | context/advisory·미지원 interception·모델 미관측을 명시 |
| AC-8 | 요청 원문 미기록, 비밀 redaction, verifier hash, gitignored runtime/evidence |

**런타임 세션의 `done`과 작업의 `work.json` 완료는 별개다.** verifier의 기준 매핑은 호출자가 선언한 기계 검사 범위이며, 명령 exit 0이 요구 충족의 진실성을 증명하지 않는다. fixture도 작업 `work.json`을 임의로 `done`으로 바꾸지 않는지 검사한다. 최종 작업 수용은 실제 증거 대조로 갱신한다.

추가 유료 GJC 추론·자동 모델 전환·전역 훅·모든 tool의 사전 차단·OS sandbox는 구현 또는 검증했다고 주장하지 않는다. `.mjs`는 BoxBox 미지원이므로 Node/Bun 동작 검사로 검증하며, JSON guide의 비교 축 부재와 TypeScript 정렬 잔여도 가독성 통과로 승격하지 않는다.
