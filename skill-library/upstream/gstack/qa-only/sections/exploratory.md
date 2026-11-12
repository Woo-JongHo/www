> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from exploratory.md.tmpl — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
# 공용 탐색적 QA

**호출자**(/qa, /qa-only, /review 또는 /ship)는 결정, 테스트, 수정 및 발행을 담당합니다. 탐색은 보고서/근거와 소유한 픽스처 상태만 작성하며, 워크플로, 프레임워크 설치 또는 발행은 하지 않습니다.

## 0. 준비 게이트

차터를 작성하거나 프로브하기 전에 다음 Read를 순서대로 완료하세요.
1. 설치된 `qa`/`gstack-qa` SKILL.md 디렉터리를 기준으로 `sections/scope.md` 전체를 읽고 표면을 선택합니다.
2. 아래에서 선택한 표면의 방법을 전체 읽습니다.

이 Read에는 이 호스트에 설치된 `qa`/`gstack-qa` SKILL.md 디렉터리를 사용하세요.

**기능 표면:**
`sections/system-functional.md` 전체를 읽습니다.

**브라우저 표면만:**
`sections/qa-patterns.md` 전체를 읽습니다.

계속하기 전에 성공한 각 Read 결과를 기다리세요. 제공된 대상, 격리 설명,
섹션 색인 또는 기억한 방법은 지시사항 Read를 완료한 것이 아닙니다.
이 호출에서 이미 완료한 Read는 반복하지 말고, 확인된 전체 내용만 재사용하세요. 필요한 Read 중 하나라도 없으면 차터와 사전 점검 전에 지금 완료하세요.
누락되거나 읽을 수 없는 자산, 전제조건 또는 권한은 영향받는 프로브를 막지만 독립적인 안전 점검은 막지 않습니다. QA 설정 차단 요인을 보고하세요.

## 1. 차터 및 사전 점검

해결된 REPORT_DIR을 재사용하고, 그렇지 않으면 새 `.gstack/qa-reports` 하위 디렉터리를 소유하세요.
동작마다 계약, 위험, 진입점, 격리, 종료 조건, 소스, 명령 및 입력을 담은 **차터**를 작성하세요. 차터는 보고서에 Markdown으로 저장합니다.


/qa 및 /qa-only의 경우:
- Browser Quick: SECONDS=180. Browser Full/Regression: SECONDS=900.
- Functional Full, Quick 및 Regression에는 기본 총 타이머가 없습니다.
SECONDS는 더 짧은 모드/호출자 제한으로 설정하며, 무제한 모드는 호출자 제한을 사용합니다.
총 시간 제한이 없으면 DEADLINE_FILE을 만들지 말고 유한한 명령 타임아웃을 알리세요.
범위 내 계약을 테스트했거나 차단되면 중지합니다. 각 필드의 문서화된 입력 규칙에는 그 규칙만 깨고 다른 모든 규칙은 충족하는 프로브가 필요합니다. 프로브/시간 한도에서 확인하지 못한 규칙은 limits에 기록합니다.
시계/체크포인트는 REPORT_DIR을 사용합니다. 혼합 독립 실행은 REPORT_DIR/browser 및 REPORT_DIR/functional을 사용하고 최종 보고서는 REPORT_DIR 하나에 둡니다. 호출자 경로가 우선합니다.
아래에서 쓰는 이름(모든 경로를 인용):
- PROBE_DIR: 위 줄에 따른 이 표면의 소유 프로브 디렉터리입니다. DEADLINE_FILE: `PROBE_DIR/deadline.json`이며, 제한된 실행에서만 존재합니다.
- SECONDS: 위에서 설정한 총 프로브 예산입니다. NNN: 각 캡처 또는 체크포인트마다 새 세 자리 ID(001, 002, ...)이며 절대 재사용하지 않습니다.
- DEADLINE_TOOL = `$HOME/.claude/skills/gstack/bin/gstack-qa-deadline`, 기한 가드입니다. `start`는 DEADLINE_FILE을 만들고, `status`는 `remainingMs`와 `expired`를 출력하며, `run`은 하나의 명령을 실행하고 기한에 중지합니다.
- EVIDENCE_TOOL = `$HOME/.claude/skills/gstack/bin/gstack-qa-evidence`, 기능 근거 기록기입니다. `capture`는 하나의 명령을 실행하고 종료 코드, stdout 및 stderr를 `PROBE_DIR/.qa-evidence/NNN/`에 저장하며 상태 `complete`, `incomplete` 또는 `sensitive`를 출력합니다.

제한된 경우 기준선 전에 한 번 시작합니다: `bun DEADLINE_TOOL start DEADLINE_FILE SECONDS [EARLIER_UTC]`.
EARLIER_UTC = 설정된 경우 호출자의 절대 기한입니다.
기능: `bun EVIDENCE_TOOL capture PROBE_DIR NNN [--public] --deadline DEADLINE_FILE -- COMMAND ARGS`.
무제한: `--deadline DEADLINE_FILE` 대신 `--timeout-ms MS`를 사용합니다.
--public에는 승인된 공개/합성 출력이 필요하며 EVIDENCE_TOOL은 자격 증명을 검사합니다. 완전한 비공개 캡처의 경우 `PROBE_DIR/.qa-evidence/NNN/observation.json`(디코드된 stdout)을 안전하게 Read할 때까지 기다리세요. 민감하거나 불완전한 캡처는 체크포인트를 뒷받침할 수 없습니다.
제한된 브라우저: `bun DEADLINE_TOOL run DEADLINE_FILE -- COMMAND ARGS`. 분리된 프로브는 금지합니다.
DEADLINE_FILE을 절대 재설정하거나 DEADLINE_TOOL을 우회하지 마세요. 만료되거나 유효하지 않거나 누락된 DEADLINE_FILE은 프로브를 중지합니다. 미완료 범위를 보고하세요. QA_DEADLINE 영수증은 관찰이 아닙니다.

## 2. 프로브 루프

각 프로브는 기록 관리를 제외한 하나의 네이티브 명령/상호작용과 점검입니다.
프로브를 일괄 처리하지 마세요.

1. 먼저 성공을 입증합니다: 출력 **및** 지속 효과. 제한된 경우 가드하고 완료를 기다립니다.
2. **다른 프로브가 필요한지 결정합니다.** 제한된 경우 `bun DEADLINE_TOOL status DEADLINE_FILE`를 실행합니다.
   만료됐거나 안전한 다음 프로브가 남지 않았으면 탐색을 **중지**하고 체크포인트가 아닌 보고서(§4)를 작성합니다.
   **복사하기 전에 마지막 결과를 분류합니다.** 공개 또는 합성 관찰의 경우,
   소유한 픽스처 경로, ID, 해시 및 기존 자격 증명 자리표시자를 포함해 전체 결과를 변경 없이 보존합니다. 절대 상태 경로 자체가 비밀인 것은 아닙니다.
   실제 비밀/비공개 페이로드는 해당 값을 보류하고 보고서에 삭제 및 재현 한계를 공개합니다. 안전한 정확 관찰을 보존할 수 없으면
   영향받는 프로브 체인을 중지하세요. 대체 경로, ID 또는 상태를 절대 지어내지 마세요.
   **프로브 전에 발행합니다.** 제한된 경우 기한 옆의 프로브 디렉터리에 (브라우저) 생성하거나 (기능) 작성하는 `exploration-NNN.json`은 정확히 네 개의 최상위 필드를 둡니다.
   observationCommand: 가드를 포함한 마지막 완료 프로브의 전체 외부 명령입니다.
   observed: 정확히 디코드된 자식 JSON(래퍼/추가 키 없음) 또는 전체 비 JSON 텍스트입니다.
   가드된 텍스트는 가드의 started 및 finished 영수증 줄 사이의 전체 범위를 복사합니다.
   공백과 콘텐츠 펜스를 그대로 보존합니다. 요약, 이름 변경 또는 시간 텍스트 추가를 하지 마세요.
   가드는 finished 영수증 앞에 줄바꿈 하나를 추가하며, 그 구분자는 자식 텍스트가 아닙니다.
   가드되지 않은 텍스트는 대신 전체 결과를 복사합니다.
   캡처가 불완전하면 재구성하는 대신 그 한계를 보고합니다.
   hypothesis: nextCommand가 필요한 이유입니다. nextCommand: 제한된 경우 가드된 정확한 명령/요청입니다.
   안전한 모든 프로그램 JSON 키/값과 ID 해시는 변경 없이 보존합니다.
   안전하지 않은 값은 보류하고 한계를 공개하며 해당 체인을 중지합니다.
   발행 전 필드를 점검합니다. 초안/자리표시자 또는 꾸며낸 안전 경로 삭제는 안 되며, 수정으로 발행된 메모를 고칠 수 없습니다.
   기능: 이 파일을 쓰지 마세요. 다음 캡처가 발행합니다: `bun EVIDENCE_TOOL capture PROBE_DIR NNN --deadline DEADLINE_FILE --after PREV --hypothesis 'why' -- CMD` (PREV: 마지막 완전 캡처의 ID). EVIDENCE_TOOL이 observed를 제공하므로 전사하지 마세요.
   브라우저 체크포인트는 Write를 사용합니다.
   성공적인 체크포인트 발행을 기다린 뒤 실행하세요.
   메모를 절대 나중에 채우거나 덮어쓰지 마세요.
3. 그 정확한 프로브를 실행합니다. 제한된 경우 DEADLINE_TOOL이 기한을 강제합니다.
   거부는 미실행으로 보고하고 초기 상태/입력/결과를 보존합니다. 2단계부터 반복합니다.
4. 동일한 초기 픽스처 상태에서 2–3단계로 정확히 실패한 명령/요청을 재실행합니다(같은 네이티브 명령, 새 캡처 ID).
   이렇게 확인한 뒤 그 게이트를 통해 최소화합니다. 만료 시 확인/최소화는 미완료로 남습니다.
   다른 입력이나 회귀 테스트는 그 재실행이 아닙니다.
5. 사용자 또는 다른 프로세스가 소스, 명령 또는 픽스처를 바꾸면 영향받는
   계약을 검토하고 영향받는 각 재검증마다 2단계로 돌아갑니다(미입증=영향받음). 제품 변경은 직접 하지 마세요.
   원래 한계/메모를 유지하고, 새 근거로만 결과를 갱신합니다.

## 3. 상위 전달

셸, 이름 변경, 삭제, 커밋, stash 또는 편집 후 복원을 포함한 어떤 도구로도 제품 코드, 테스트, 구성, 의존성 또는 Git을 절대 변경하지 마세요.
실패한 계약과 예상 assertion을 담은 test_stub 제안만 반환하세요. 테스트를 만들거나 버그 출력을 고정하지 마세요.

## 4. 최종 보고서

표면 보고서 템플릿을 사용하고 각 체크포인트를 연결하세요. 브라우저 점수, 기능 결과 및 제안/실행 테스트를 분리합니다.
Markdown 전에 `PROBE_DIR/annotations.json {evidence: [{capture, command, contract, expected, classification}], limits: ["checkpoint 001"]}`를 작성합니다(limits는 객체가 아닌 비어 있지 않은 문자열 배열, 브라우저 전용: evidence []). 그런 다음 `bun EVIDENCE_TOOL materialize PROBE_DIR annotations.json`을 실행합니다(observed/metadata를 채우고 reportLinks를 출력하며 PROBE_DIR마다 한 번 실행). 분류는 여러분이 합니다. 실패/재실행을 포함한 모든 안전 캡처에 주석을 답니다. 생략된 캡처는 보류되며 판정은 불확정으로 유지됩니다. 입력 변경 전에 취한 캡처는 `superseded`로 분류하며, 현재 입력에서 같은 명령을 재실행하면 종료됩니다. 보류/불완전 근거를 공개하세요.
근거는 호출 로컬입니다.
누락된 전제조건/기대/관찰, 타임아웃 및 거부는 절대 통과가 아닙니다.
통과하려면 필요한 모든 현재 입력 계약이 통과하고 필요한 잔여가 없어야 합니다.
차단됨, 불확정 및 미실행 범위를 성공이라고 주장하지 말고 보고하세요.
