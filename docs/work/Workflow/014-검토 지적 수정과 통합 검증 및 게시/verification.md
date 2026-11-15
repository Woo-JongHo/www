# 검증 기록

## 통합 중간 관측 — 2026-11-15 +09:00

이 절은 아직 최종 고정 대상의 통과 판정이 아니다. 이전 고정 사본의 검토는 보존하고, 수정 후 통합 검사는 별도로 기록한다. 현재 기준 HEAD는 `92de2389b943610f7e12c23a4cd211555d4cae1b`이며 미커밋 변경이 있다. 소유 경로의 통합 전후 SHA는 로컬 `.www/review-fixes-20261115/integrated-files.json`에 보존한다.

| 검사와 실제 실행 | 관측 | 적용 범위와 남은 조건 |
|---|---|---|
| `BOXBOX_MODE=off bun test test/native-lifecycle.test.ts test/projection.test.ts test/conversations.test.ts` | 132 pass / 0 fail, exit 0 | Native·공개 본문 두 구현을 통합한 당시 입력. 이후 Sidebar 통합과 최종 전체 검사와 구분 |
| 위 세 파일과 `test/activity-sidebar.test.ts test/chat-state.test.ts` 결합 실행 | 173 pass / 1 fail, exit 1 | 유일 실패는 기존 2만 고유 Hook 처리의 5초 assertion: 6562ms. 병행 장기 검사 부하가 있어 통제된 재측정 필요. 기준을 높이거나 검사를 삭제하지 않음 |
| `node scripts/check-skill-library.ts` | 번역 교정 후 exit 0 | 7출처·201파일의 현행 기계 계약. 문장별 의미 전수 감사가 아님 |
| `node scripts/check-workflow.ts` | 이식성 보정 전 원본에서 exit 0 | 원본에는 당시 로컬 `.www` 자료가 존재. 깨끗한 사본에서 누락되는 과거 링크 두 곳은 원문 경로·SHA를 남기는 방식으로 보정. 최종 사본 재검사 필요 |
| 변경 파일의 고신뢰 자격증명 패턴 검색 | 180개 파일, 일치 0 | 그 시점 변경 파일의 한정 검색이며 완전한 개인정보·비밀 감사가 아님 |

실행 원문은 각각 `native-summary-integration.log`, `chat-integration.log`, `library-audit/corrected-library-check.log`, `pre-integration-contract.log`, `credential-pattern-scan.json`으로 위 로컬 디렉터리에 보존했다. 원문은 Git 게시 대상으로 자동 승격하지 않는다.

## 추가 재현과 수정 인계

- `FIX-1`: A의 Hook 시작 뒤 개별 Hook 완료 없이 턴 A가 종료되고, 같은 handler·시각의 턴 B 시작을 받으면 새 반응이 누락됐다. 실제 순수 함수 실행은 기대 `[1,3]`, 관측 `[1]`, exit 1이다. 원문 `hook-missing-completion-reproduction.log`. 현재 재현은 성공이나 완료 근거가 아니다. Mac mini의 격리 소스에서 실제 저작·집중 검사로 수정한다.
- `FIX-2`: 구조도 목록 실패는 CDP 키 입력의 keypress 누락이었다. 별도 사본에서 제품 변경 없이 올바른 Enter 입력으로 기존 GUI 84개가 통과했으며, 공식 드라이버 수정 후 같은 assertion으로 다시 통과했다. 이 사본 근거는 원본 최종 번들의 검증과 구분한다.
- `FIX-3`: 실제 app-server 검토 transport와 결과의 내구성 구현은 별도 사본에서 진행 중이다. wrapper 인용·final phase·reroute·입력 binding·권한 철회·제한된 자료 선택이 최종 수용되기 전 실제 모델 감사를 실행하지 않는다.
- `FIX-4`: 라이브러리 과거 지적 45건을 고정 원문과 재대조한 독립 Terra 읽기 검토에서 CEO-SEM-06의 모호성을 발견했다. “영속화 실패를 보고하고 의도적으로 비활성화한 상태를 유지한다.”로 교정하고 inventory의 해당 hash·bytes만 갱신했다. 교정 후 독립 대조는 원문 의미·코드·법문·출처 메타데이터 보존을 확인했다. 186개 번역 전체의 무오류를 주장하지 않는다.
- `FIX-5`: 이번 추가 수정의 커밋·푸시는 아직 실행하지 않았다. 용도별 후보·격리 검증·원격 ref와 이력 기록을 이어서 수행한다.

## 원격 준비의 범위

Mac mini와 Windows의 기존 작업 트리를 보존하고 새 격리 디렉터리에 의존성을 준비했다. 양쪽 `npm ci`는 223개 설치·exit 0이며 입력 package 두 파일의 SHA를 대조했다. 이는 제품 검사나 사람의 IME 실측이 아니다. Windows는 공식 BoxBox `--engine-only`로 필요한 0.2.8 엔진을 준비했고 Mac mini는 기존 설치를 보존했다. 호스트 등록·신뢰 상태를 이 작업으로 변경하지 않았다.

Mac mini의 별도 구현 사본은 현행 1032개 파일의 바이트·모드·심볼릭 링크가 일치하며 HEAD `92de2389`에서 준비했다. 실제 저작·검사·분리 생존·최종 결과는 완료 후 별도 시도로 기록한다. 원문 위치는 로컬 `external-evidence/PREPARE.md`, `external-evidence/HANDOFF_HOOK.md`다.

## Mac mini 실제 저작과 회수 — 2026-11-15T13:52:02Z

`hook-missing-completion-macmini-20261115-v1`의 실제 Codex 저작에서 위 Hook 완료 누락과 교차 turn 완료 선관측을 수정했다. 모델 `gpt-6.1-sol`은 실제 프로세스 argv에서 관측했으며 서버가 반환한 실행 모델은 별도 미제공이다. SSH 종료 후 새 연결에서 supervisor의 PPID 1과 typed Node·Codex 자식 생존을 확인했다. 같은 실행을 기다렸으며 중복 모델 실행으로 대체하지 않았다.

- 수정 전 실패 회귀: 29 pass / 3 fail, exit 1. 원문 `sidebar/.www/macmini-hook-fix/returned/evidence/hook-before.log`.
- 수정 후 집중 검사: 178 pass / 0 fail, 763 assertions, exit 0. 소스 정책·두 strict 타입 프로젝트도 exit 0. 기존 2만 Hook 성능 기준 5,000ms를 그대로 적용해 121.16ms로 통과했다. 이는 이 장비의 관측이며 서로 다른 장비의 개선율을 계산하지 않는다.
- 실제 저작 host와 공식 typed 하네스: 모두 exit 0/ok, `executor=process`, `toolExecutor=process`, `sourceStable=true`, errors 없음, 공식 구조 generator 수용. BoxBox는 disabled/off이며 스타일 PASS가 아니다.
- 원본 통합은 source·test 두 파일만 전후 hash를 대조해 수행했다. 최종 SHA-256은 각각 `69f8041e91c6544d9633b16b88898c9076b4ebfb21baab61ec824aa98495da8a`, `dd7be09c241a2cb5883c3957fb844ca7c56ac0ae9b24c7aaa29f01c8c7653ada`다. 사본의 자동 생성 JSON·원장·보고서는 원본에 복사하지 않았다.

전문과 실행 영수증은 로컬 `.www/review-fixes-20261115/workspaces/sidebar/.www/macmini-hook-fix/RETURN_MANIFEST.json` 및 `returned/evidence/`에 보존했다. 이 결과는 최종 통합 번들의 실제 Electron·Native·전체 검사·독립 검토를 대신하지 않는다.

## 외부 BoxBox 고정 소스 전체 실행과 표적 재검증

외부 정본 HEAD `21b1b52260466b3ad35c3fe6afe76d846e47fe42`의 Git 가시 파일 1583개를 고정해 Mac mini에서 검사했다. 로컬에서 먼저 실행한 장기 검사는 load 65와 시간 초과·parser probe 실패를 보존한 뒤 종료 143으로 중단했다. 로컬 실행을 통과로 쓰지 않는다.

Mac mini 최초 `bun run check`도 **exit 1: 1231 pass / 22 fail**이다. 최초 사본에 Git 기준이 빠져 있었고 lint-changed의 `git rev-parse` 실패와 Hook baseline·ignored 경계 실패를 관측했다. 실행이 끝난 뒤 credential/config를 포함하지 않는 원본 Git bundle로 같은 HEAD·branch·index를 준비하고, 실패 관련 4개 파일만 재실행해 **68 pass / 0 fail, exit 0**을 확인했다. 최초 전체 실패로 실행되지 않은 타입 검사와 셸 구문 검사도 별도로 exit 0이다. 후속 표적 통과로 최초 전체 명령의 exit를 소급 변경하지 않는다.

전송 후·전체 실행 후·표적 실행 후 source 1583개의 바이트·모드·심볼릭 링크 변경은 모두 0이다. 별개 설치 런타임의 호스트 수용과 외부 정본의 이 회귀는 다른 증거다. 전문은 로컬 `.www/review-fixes-20261115/boxbox-remote/FINAL.md`와 같은 폴더의 원문이다.
