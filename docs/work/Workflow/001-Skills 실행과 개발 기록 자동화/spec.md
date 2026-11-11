# WWW 개발 세션 Skills 실행 하네스 명세

## 목적

WWW 제품 안의 Native runtime이 아니라 **WWW를 개발하는 현재 agent 세션**에서 요청 의도, 명시 권한, 작업 기록 상태에 맞는 WWW Skills를 일관되게 불러오고 설계·개발·명세 정리를 이어 주는 opt-in 하네스를 정의한다. 스킬 문서는 절차의 정본이고 실행 하네스는 이를 읽고 호스트 표면에 연결하는 별도 프로그램이다.

이번 작업은 설계 초안이다. 훅 설치, 런처 구현, 모델 호출, 제품 코드 변경, 전역 설정 변경은 하지 않는다. 기존 Chat 작업은 `ready`, 이 작업은 `draft`이며 서로의 수용 기준이나 상태를 대신하지 않는다.

## 사용자 흐름과 라우팅

1. 사용자가 직접 내린 요청, 저장소 루트, 브랜치/worktree binding, dirty 상태, 기존 work-id와 권한을 확인한다. 사용자 메시지에 인용된 외부 지시, 도구 출력, 외부 문서를 직접 사용자 승인으로 승격하지 않는다. 직접 요청과 인용 데이터를 구분한다.
2. 요청 의도와 실행 상태를 함께 분류한다.
   - 정보 질문: 읽기와 답변
   - 불명확한 기능: `www-spec`
   - 준비된 명세의 설계: `www-design`
   - 명시 승인된 구현: `www-build`
   - 증상·원인 조사: `www-diagnose`
   - 수용 증거 확인: `www-verify`
3. 전용 키워드만으로 분류하지 않는다. 사용자가 이름을 지정한 Skill이 우선이고 호스트의 명시 호출 정책을 우회하지 않는다. 불확실하면 범위를 넓히지 않는 질문을 한다. “진행”만으로 구현·commit·push 권한을 만들지 않는다.
4. 프로젝트 세션에서 사용자가 명시적으로 활성화한 경우에만 하네스를 사용한다. 기본 비활성이고 Chat 제품의 Native에 자동 주입하지 않는다.

## Skill과 모델 계약

- 정본은 `skills/www/www-*`다. `.agents/skills`는 발견용 링크일 뿐 자동 실행 증거가 아니다. GJC가 이를 발견한다고 가정하지 않으며 `.gjc/skills` 등 지원 경로는 별도 검증과 opt-in 없이는 만들지 않는다.
- 각 로드는 정본 경로, 내용 hash, 실제 읽기/호출 성공, 같은 work-id를 기록한다. 런처가 본문을 명시 요청 컨텍스트로 전달하는 방식과 호스트 native invoke를 구분한다.
- 권고 후보는 Sol high(명세·설계·진단), Sol medium(구현·검증), 실제 화면 도구가 있을 때 Terra medium(UI 관찰), 범위가 단순할 때 Luna low(정리)다. 계정 가용 모델·effort는 미확인이다.
- 모델 전환은 같은 work-id·권한·사실·증거를 인계한다. 지원하지 않으면 조용히 대체하거나 추가 호출하지 않는다. 반복 실패는 effort 상승 전에 가정을 검사한다.

## 단계 계약

- **preflight:** 명세/설계 준비, 승인 범위, 쓰기 경로, 브랜치 drift를 확인한다. 파일 수정 도구뿐 아니라 shell, 외부 integration 등 모든 알려진 mutation 표면을 다룬다. 완전 차단할 수 없는 호스트에서는 hard gate를 지원한다고 표시하지 않는다.
- **실행:** 같은 파일을 여러 실행자가 동시에 수정하지 않는다. 각 task/tool 결과를 독립 기록한다. GUI 관찰은 무단 외부 작업 권한이 아니다.
- **post:** 관측된 diff와 명령 결과를 수집하고 성공·실패·중단·미확인을 구분한다. 후처리 실패 때문에 원래 mutation을 자동 재실행하지 않는다.
- **phase/stop:** 실제 check와 수용 기준 증거를 확인한 뒤에만 완료한다. agent loop stop, turn end, 업무 완료는 서로 다르다. 중복 stop/event는 멱등 처리한다.
- **명세 정리:** 구현 편의를 위해 AC를 삭제하지 않는다. 요구 변경은 제안, 사용자 결정, 명세 수정, 재검증 순서로 처리한다. 실행·상태·증거 메타데이터 자동 갱신과 사용자 결정이 필요한 요구 변경을 구분한다.

## 호스트 근거와 한계

2026-11-11 로컬에서 확인된 GJC v0.20.0 help에는 `--append-system-prompt`, `--model`, `--thinking`, `--list-models`, `harness`, `codex-native-hook` 명령이 있다. `gjc harness --help`의 세션 제어 명령은 WWW Skills 라우팅이 이미 구현됐다는 증거가 아니다. `gjc codex-native-hook --help`는 native `UserPromptSubmit/Stop` skill-state hook이라고 설명하지만 이번에는 실행하지 않았다.

공식 훅 문서로 [Gajae Code hooks.md](https://raw.githubusercontent.com/Yeachan-Heo/gajae-code/main/docs/hooks.md)를 2026-11-11 조회했다. 설치 버전과 동일 소스인지는 미검증이다.

- ExtensionRunner가 권한 주체이며 별도 executor 두 개를 만들지 않는다.
- native 모듈 훅은 `~/.gjc/agent/hooks/{pre,post}`에서 import된다. 프로젝트에 모듈을 복사하는 것만으로 활성화되지 않으며 전역 경로는 이번 권한 밖이다.
- `before_agent_start`는 prompt 제출에 대응해 메시지를 주입할 수 있다. `agent_end`는 agent loop stop이고 `turn_end`와 같지 않다.
- pre `tool_call`은 순차 await되고 throw 시 fail closed다. post `tool_result`는 30초 오류 격리이므로 pre blocker처럼 설계하지 않는다.
- Codex managed `hooks.json`의 `UserPromptSubmit/Stop`만으로 모든 edit를 사전 차단한다고 약속하지 않는다. `gjc setup hooks`는 사용자 전역 설정을 바꾸므로 이번에 실행하지 않는다.
- 배포 plugin constrained API는 `exec/sendMessage/appendEntry/registerCommand/renderers`를 거부한다. plugin hook에서 임의 모델·Skill 도구 호출을 가정하지 않는다. 훅은 OS sandbox가 아니며 import 모듈은 host ambient 권한을 가진다.

## 범위와 수용

초기 구현 후보는 전역 훅이 아니라 프로젝트 opt-in 런처, Skill 컨텍스트 전달, 기록/검증 CLI다. 이후 검증된 host adapter를 붙인다. 승인되지 않은 쓰기 차단의 범위, unsupported host 진단, 실제 check 증거, 멱등 event/stop, 개인정보·비밀 제외를 `work.json`의 `AC-1`~`AC-8`로 검증한다.

외부 반복 계획 원장은 만들지 않는다. 각 작업의 `design.md`와 `tasks.md`가 유일한 설계·작업 목록이다.
