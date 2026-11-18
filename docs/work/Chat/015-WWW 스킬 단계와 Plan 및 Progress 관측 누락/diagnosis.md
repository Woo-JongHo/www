# 현재 진단 회수와 과거 원문

현재 scope는 해당UUID의 문서·허용 검증·독립 감사 회수다. source/전역/인증/Hook 설정을 바꾸지 않는다. 같은 사용자 증상과 실제 관측, 코드로 입증한 경계와 미확인 세션 원인을 구분한다.

current agent-overview는 현재 structured role declaration/명시 요청과 읽기 관측을 나누고 계획 없는 공개 설명을 별도로 보여 준다. 실제 Subagent의 종료/연결 경계와 empty commentary·late delta 회귀가 코드에 있다. 상세 native-activity의 공개 설명 정산 경계도 현재 tests와 대조한다. 이는 코드/검사 준비의 관찰이며 새 GUI/actual 모델 도구선택 성공이 아니다. 현재 단계 선언은 하네스 실행·업무 수용 영수증으로 승격하지 않는다.

과거 전역설정/호스트/차단/실패 설명은 아래 당시 이력이다. 현재 새 증거는 spec/verification의 실행 시각과 source로 연결하고 원본 실패를 삭제하지 않는다.

<details>
<summary>기존 진단 원문</summary>

# 버그 진단 — 스킬 단계와 공개 진행 설명의 관측 누락

## 관찰된 증상

사용자가 제시한 화면에는 문서 작업이 진행 중인데 현재 스킬 선택 미확인, 다섯 스킬 모두 대기, Plan·Progress 자료 미제공이 함께 표시됐다. 해당 화면의 원본 사건·앱 빌드 식별·세션 식별은 이번 요청에 첨부되지 않았다. 사용자 관찰과 현행 소스에서 확인한 표시 조건을 분리한다.

## 영향과 안전 경계

사용자는 스킬 절차가 적용됐는지, 현재 어느 단계를 수행하는지, 실제로 일이 진행되는지 판단하기 어렵다. 관측 자료가 없다는 사실이 실제로 실행 대기 중이라는 뜻으로 읽힐 수 있다. 기능 실행 실패·데이터 손실은 이번 정보만으로 확인되지 않았다.

표시를 채우기 위해 가짜 단계·계획·Subagent를 만들거나 문서 읽기를 실행 완료로 승격하지 않는다. 비공개 reasoning·개인 원본 로그를 표시/게시하지 않는다. 현재 조사와 이슈 등록은 제품 소스·훅·신뢰 설정을 변경하지 않는다.

## 가설과 판별 결과

| 가설 | 판별 검사 | 확인한 결과 | 판정 범위 |
|---|---|---|---|
| 절차 문서 적용이 현재 스킬 선택으로 자동 연결되지 않는다 | `agent-overview.ts`의 selectedSkillId와 `native-activity.ts`의 request 생성 조건 확인 | 선택은 살아 있는 현재 턴의 source=request인 WWW Skill 항목이 하나일 때만 정해진다. userMessage.content의 type=skill 입력을 요청으로 투영한다. 읽기·절차 적용 선언은 이 선택 근거가 아니다. | 현행 코드에서 입증 |
| 자료 없는 스킬이 대기로 표시된다 | `agent-overview-view.tsx`의 행 문구 확인 | 선택도 읽기 관측도 없으면 대기로 출력한다. 명시적 pending 사건을 요구하지 않는 표현이다. | 현행 코드에서 입증 |
| Plan이 없으면 공개 진행 설명을 버린다 | `agent-overview.ts`의 commentary 처리와 반환 조건 확인 | 활성 항목 index가 없으면 처리 경로가 continue하며 최종 progress도 null이 된다. 공개 산문 자체가 있어도 기본 개요에 나오지 않을 수 있다. | 현행 코드에서 입증 |
| tasks.md 작성이 Native Plan으로 자동 전달된다 | Plan 입력 처리 확인 | Plan은 turn/plan/updated에서 읽는다. 계획 문서 작성만으로 그 사건이 발생했다고 볼 수 없다. | 해당 투영의 입력 조건 확인, 문서 연결 경로는 후속 설계 |
| 파일 읽기 관측도 이번 표본에서 누락됐다 | `www-activity.ts`의 리터럴 cat 처리와 nativeDocumentReads 조건 확인 | 보조 파서는 셸 연쇄·확장을 거부하고 단일 리터럴 cat만 참조로 받는다. 구조화 read는 commandActions에 의존한다. 직전 저작의 복합 셸 명령은 보조 참조 파서의 허용 범위 밖이다. | 파서 조건 입증, 실제 표본 commandActions는 미확인 |
| Subagent 0개도 오류다 | 직전 작업 수행과 집계 입력 대조 | Native Subagent를 호출하지 않았다. 외부 Claude CLI 요청은 별도 프로세스이고 시간 초과였으므로 Native Subagent 완료로 합칠 근거가 없다. | 0개가 일관된 표본, 일반 집계의 모든 경로는 미검증 |
| 앱이 오래된 번들이거나 사건 전달을 잃었다 | 실행 중 앱의 빌드 정보·원본 사건 비교 필요 | 이번에는 실제 앱 세션·번들·원본 사건을 수집하지 않았다. | 미확인, 배제하지 않음 |

## 입증한 원인과 남은 불확실성

소스상 현재 스킬 선택은 명시적 Skill 요청에 한정되고, 미관측 행은 대기 문구를 쓰며, Progress는 활성 Plan을 필수로 요구한다. 이 세 조건은 사용자 증상과 일치하는 표시상의 근거다. 역할이 스킬 절차를 적용한 것과 UI가 수신한 정형 입력을 연결하는 계약이 필요하다.

다만 사용자 표본에서 어떤 사건이 실제 송신·수신됐는지, 설치 앱이 같은 코드였는지까지 입증한 것은 아니다. 전체 관측 누락의 모든 원인을 위 조건 하나로 확정하지 않는다. 실제 단계 호스트 실행·절차 적용 선언·실세션의 Skill 입력을 각각 수집해 대조해야 한다.

## 실제 투영 함수의 합성 입력 대조

현재 `projectNativeActivity`, `projectAgentOverview`, `AgentOverviewView`, `referencedWwwArtifacts`를 직접 불러 동일 thread/turn의 공개 commentary를 입력했다. 제품 소스와 테스트 파일을 수정하지 않은 읽기 전용 실행이다.

- Plan이 없을 때 Native 활동에는 공개 설명이 존재했지만 개요의 plan은 빈 배열, progress는 null, 현재 스킬은 null이었다. 서버 렌더 문자열에는 대기 행 다섯 개가 표시됐다.
- 같은 사건에 단일 inProgress Plan 항목을 앞서 넣으면 같은 공개 설명이 progress.text로 표시됐다.
- 단일 리터럴 cat은 www-spec 참조 하나를 반환했고 복합 cat 연쇄는 빈 배열을 반환했다.
- 실제 함수와 정적 마크업의 대조는 통과했다. 이는 사용자 실제 세션의 사건 전달·앱 빌드·Electron DOM·실모델 실행 검증과 구분한다. 원문은 Git 제외 증거 폴더의 projection-reproduction.json에 보존했다.

## 수정 인계와 회귀 기준

최소 수정은 미관측/명시적 대기 문구 분리와 계획 없는 현재 턴의 공개 설명 표시다. 단계 선택의 전체 연결은 생산자·연결 식별·실행 영수증·소비자의 신뢰 검증을 함께 설계해야 하며 화면 색상 변경만으로 해결했다고 하지 않는다. 임의의 셸 명령 문자열을 더 넓게 실행/해석하는 방식으로 관측을 채우지 않는다.

기준 OBS-EVIDENCE·OBS-LIFECYCLE·OBS-UNKNOWN·PLAN-SOURCE·PROGRESS-FALLBACK·AGENT-TRUTH·OBS-REGRESSION·ISSUE-TRACE와 [실행 계획](tasks.md)을 다음 구현에 전달한다. 모든 제품 기준은 미검증이다. 구현 전 실제 앱/Native 표본과 최소 재현을 확보하고, 수정 후 행동 테스트 및 Electron에서 송신·투영·DOM의 수용까지 확인한다.

</details>
