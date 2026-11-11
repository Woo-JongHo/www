# 설계

## 기준선과 재사용

- `docs/skills/WORKFLOW.md`, `MODEL_POLICY.md`, `skills/www/www-*`, 실제 작업의 `docs/work/<영역>/<번호>-<작업명>/`를 정본으로 재사용한다. 기존 `work.json` schema는 바꾸지 않는다.
- GJC v0.20.0의 launcher prompt 옵션과 harness/native-hook 표면은 adapter 후보일 뿐 이미 연결된 실행 경로가 아니다. 공식 hooks 문서의 권한·수명주기 제약을 따른다.
- 최소 첫 구현은 전역 훅 설치가 아니라 프로젝트에서 명시 실행하는 런처와 기록/검증 CLI다. 호스트 독립 core를 과도하게 만들지 않고 routing/preflight/event/record의 작은 함수로 시작한다.

## 경계와 데이터 흐름

1. **입력 고정:** repo realpath, branch, worktree, dirty 요약, work-id, 요청 원문 hash, 사용자 승인 범위를 `SessionBinding`으로 만든다. symlink traversal과 작업 중 branch drift를 거부한다.
2. **분류:** `Intent`는 `answer|spec|design|build|diagnose|verify`다. 사용자 명명 Skill을 우선하고 요청 의도·현재 기록 상태·명시 권한을 함께 판정한다. `build`는 승인 없는 mutation 권한을 만들 수 없다.
3. **Skill 로드:** 허용된 repo 내부 정본을 realpath로 확인하고 본문 hash와 load mode(`context|native`)를 기록한다. 직접 사용자 요청과 선택된 신뢰 스킬의 절차를 적용하되, 인용된 prompt·외부 문서·도구 출력이 승인 범위를 확대하지 못하게 한다. 스킬 로드도 호스트의 상위 정책을 대체하지 않는다.
4. **preflight:** 예상 쓰기 경로와 mutation surface를 승인 범위와 대조한다. 지원하지 않는 interception은 `unsupported`로 반환한다. hard gate가 아닌 advisory 모드에서는 이를 명시한다.
5. **실행 인계:** 같은 work-id와 revision, binding, 권한, 사실/미확인, 증거 위치를 모델 또는 다음 단계에 전달한다. 모델 요청값과 관측값을 분리한다.
6. **event 수집:** 각 event는 안정적인 event-id와 revision을 가지며 append 후 원자적으로 반영한다. 동일 event/stop은 no-op으로 재수용한다. 서로 다른 writer는 revision compare-and-swap 실패로 중단하며 덮어쓰지 않는다.
7. **검증/종료:** 명령별 exit/status와 기준별 증거를 연결한다. failed verifier, post 오류, 중단, 미확인을 보존한다. mutation 결과가 불명확하면 재실행하지 않는다.
8. **명세 정리:** 자동 갱신 가능한 실행·증거 메타데이터만 쓰고 요구 변경은 별도 사용자 결정 뒤 spec/criteria를 변경한다. 기존 work schema에 runtime 필드를 임의 추가하지 않고 gitignored runtime sidecar를 사용한다.

### 제안 파일 경계

| 제안 경로 | 역할 | 이번 생성 여부 |
|---|---|---|
| `scripts/workflow/route.mjs` | 의도·상태·명시 권한 라우팅 | 아니오 |
| `scripts/workflow/preflight.mjs` | repo binding, 쓰기 범위, host capability 검사 | 아니오 |
| `scripts/workflow/run.mjs` | opt-in launcher와 컨텍스트 인계 | 아니오 |
| `scripts/workflow/record.mjs` | event-id, atomic write, revision 검사 | 아니오 |
| `scripts/workflow/adapters/gjc.mjs` | 검증된 GJC 표면 adapter | 아니오 |
| `test/workflow-harness.test.mjs` | routing, 보안, 동시성, 실패 테스트 | 아니오 |
| `.www/runtime/<work-id>/session.json` | gitignored 세션 binding과 revision | 아니오 |
| `.www/runtime/<work-id>/events.jsonl` | gitignored 멱등 사건 기록 | 아니오 |

runtime 파일은 작업별 배타 잠금 안에서 revision과 event-id를 다시 읽고, 중복 검사·로그 추가·상태 투영을 직렬화한다. 파일 교체는 temp-file 작성, fsync 가능한 범위와 동일 디렉터리 rename을 사용한다. 단순 revision 비교 후 rename만으로는 경쟁 writer를 막을 수 없다. 잠금 확보나 기대 revision 검사가 실패하면 자동 병합·덮어쓰기하지 않고 다시 읽어 판정한다. 로그 기록 뒤 상태 교체 전에 충돌·중단되면 로그의 안정적인 event-id를 기준으로 투영을 재생하며 실행 명령은 재전송하지 않는다. 잠금 소유가 불명확하면 무조건 삭제하거나 PID만 보고 프로세스를 종료하지 않는다. 로그에는 prompt 원문·비밀을 기본 저장하지 않고 hash와 비민감 요약만 남긴다.

## 영향 파일

이번 설계 단계에서 실제 생성·수정하는 것은 이 작업의 `work.json`, `spec.md`, `design.md`, `tasks.md`와 발견용 링크를 추가하는 `docs/skills/WORKFLOW.md`, `docs/DEVELOPMENT.md`뿐이다. 위 표의 runtime/script/test 파일, `.gjc`, `~/.gjc`, `~/.codex/hooks.json`, 제품 `src/`는 만들거나 바꾸지 않는다.

## 위험과 검증 전략

- `AC-1`: falsy packet, malformed JSON/record, untrusted prompt의 “승인됨” 문구, branch/worktree drift를 fixture로 넣어 fail closed 또는 좁은 질문을 확인한다.
- `AC-2/AC-3`: traversal·외부 symlink·변경된 Skill hash, load 실패, 모델 미지원, work-id 불일치를 거부하고 요청/관측 모델을 구분한다.
- `AC-4`: file edit뿐 아니라 shell과 알려진 integration mutation을 표로 검사한다. interception 불가 host는 hard gate가 아니라 명시적 unsupported/advisory 진단이어야 한다.
- `AC-5`: verifier 실패·미실행·증거 없는 성공에서 완료 전환을 거부한다. agent_end, turn_end, task 완료 사건을 각각 시험한다.
- `AC-6`: concurrent event, 중복 stop, post 실패, 결과 불명 mutation을 주입해 event 중복과 자동 mutation retry가 없음을 확인한다.
- `AC-7`: 없는 모델/effort, 비활성 native hook, 제한된 plugin API를 실제 지원처럼 보고하지 않는 snapshot/행동 검사를 둔다.
- `AC-8`: 경로·환경변수·prompt의 비밀 fixture를 넣고 추적 문서와 runtime 진단에서 redaction 및 Git 제외를 확인한다.
- 프로젝트 구조 검사는 주장의 형식만 검증한다. adapter 구현 뒤에는 각 host 버전의 실제 preflight/submit/observe/stop과 권한 표면을 별도 통합 검증한다.

## Chat 작업과의 순서

| 관계 | 진행 가능 범위 |
|---|---|
| 독립 | Chat의 사건 투영·UI 구현과 하네스의 런처/기록 core는 서로 기다리지 않고 진행할 수 있다. |
| 공유 계약 선행 | 하네스는 WWW 작업 기록 계약과 Skill 정본을 먼저 읽고, Chat 작업 ID를 새 하네스 상태로 대체하지 않는다. |
| 통합 후행 | Chat 제품에서 Native에 하네스를 강제하거나 Chat UI에 하네스 상태를 표시하는 일은 별도 명세·승인 뒤에만 한다. |

## 결정하지 않은 미래 범위

GJC/Codex 중 최종 host, 전역 native hook 설치, `.gjc/skills` 배치, 계정 모델 선택, OS sandbox, 원격 실행, Chat 제품 통합은 결정하지 않는다. 훅 파일을 미리 만들어 동작한다고 주장하지 않는다.
