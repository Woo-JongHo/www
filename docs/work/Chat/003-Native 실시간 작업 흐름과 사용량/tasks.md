# Native 실시간 작업 흐름과 사용량 — 현재 인계와 이전 계획

UUID `work-005bdf73-4e11-441b-a485-51468cc8acf4`. 현재 단계·기준 결과·권한·남은 조건은 work.json과 verification.md의 최신 공식 read/status가 소유한다. 아래 이전 계획의 현재/GO 대기/검사 수는 당시 상태이며 최신 판정으로 읽지 않는다.

새 반례·문서 정합 교정 뒤 소스를 동결하고 같은 UUID의 기존 허용 exact 검증→문서 영향 검토→고유 읽기 전용 독립 감사→저작 보고서·앱 읽기→공식 완료/read/status를 회수한다. GUI·build·actual Native 읽기 표본과 제품 소스 교정은 Root가 소유한다. 다른 UUID의 PASS·영수증을 복사하거나 구현 계획을 성공으로 표시하지 않는다.

새 반례 이후 구현/검사/감사 성공은 이 계획에서 미리 주장하지 않는다. status가 done이면 추가 구현 지시를 만들지 않는다. 기준 ID·정의·필수 여부·권한·일반 검토 정책은 변경하지 않으며 commit/push/배포는 별도 실행 요청 전 수행하지 않는다.

## 이전 계획 전문 — 당시 단계와 다음 행동

<details>
<summary>문서 정합 전 계획 원문</summary>

# Native 실시간 작업 흐름과 사용량 단일 현재 인계

UUID `work-005bdf73-4e11-441b-a485-51468cc8acf4`. 현재 단계와 남은 조건은 같은 UUID의 work.json 및 공식 status가 소유한다. Root가 고정한 현재 소스에서 승인된 exact 검증 명령과 최신 GUI·actual Native 증거를 연결하고 문서 검토·고유 독립 감사·저작 보고서·완료 판정을 차례로 회수한다. GUI·build·actual Native 표본 실행은 Root가 소유하며 이 문서 담당자가 중복 실행하지 않는다. status가 done이면 새로운 구현 지시를 만들지 않는다.

1. 현재 여정/기준은 spec.md·work.json이고 과거 source/실패/summary는 보존한다. Source가 바뀌면 이UUID current 검사를 직접 다시 실행한다.
2. 선행검사가 남은GUI를 대체하지 않는다. 실제 Electron은 독립profile로 확인하고 actual Native·모델선택·OS실기를 합성검사와 구분한다.
3. 현재 정본에 대한 문서영향검토와 exact 직접원문의 ReviewAuthority/fullbinding/allowFallbackfalse actualTerra를 이UUID에서 실행한다. 감사pin에 mutable verification을 넣지 않고 공식append 후 review.usable을 확인한다.
4. 모든필수현재근거·문서검토·유효감사 조건이 맞으면 저작보고서→앱read→공식complete/read/status까지 수행한다. 부족하면 실제사유/해제조건을 남기고 제품bug는Root에게전달한다. source수정/원장수동PASS/commit/push는 하지 않는다.

<details>
<summary>이전 계획 — 현재 지시가 아님</summary>

# 구현 단위와 다음 행동

기준 정의·필수 여부·판정은 work.json이 소유한다. 이 문서는 실행 순서와 현재 회수 상태를 설명하며 완료 승인을 대신하지 않는다.

| 단위 | 책임·대상 | 현재 상태와 다음 행동 |
|---|---|---|
| 실제 프로토콜 확인 | 공식 app-server 문서와 설치 CLI schema | 부모가 확인한 자료를 모델·UI의 입력 기준으로 사용한다. 문서와 실제 제공 표본을 구분한다. |
| 순수 활동 투영 | src/native-activity.ts, test/native-activity.test.ts | 집중 16개·66 assertions와 전체 앱·도구 타입 검사 통과를 회수했다. 승인 귀속, Skill 읽기 시작·종료, 누적 감소와 후속 기준 무효화를 포함한다. BoxBox REFUSE/FIXABLE은 미해결이다. |
| 패널과 기존 화면 연결 | src/native-activity-view.tsx, CSS, renderer | 통합했고 실제 Electron에서 두 턴·선택 유지·기존 초안·승인·중단·생태계·340px 패널·모션 축소를 관측했다. 아래 소스 변경으로 현재 적용성은 재확인한다. |
| Native 실제 응답 연결 | main, 공유 IPC·사건 | 설정 모델·계정 한도 조회를 연결했다. 제품과 같은 experimentalApi:false로 실제 공개 답변·토큰·Skill 읽기·Hook 12건을 관측했다. 실제 계정 한도 값은 이번 표본에서 별도로 확정하지 않는다. |
| 집중·회귀·빌드 | 모델 tests, 기존 tests, 타입, 앱 bundle | 전체 check 실패와 GUI 단독 통과를 분리했다. 다른 터미널의 ecosystem·native-report-input 변경으로 최종 시도에 sourceStable=false가 기록돼 현재 소스의 통과로 수용하지 않는다. 전체 runner는 npm run check 원문을 저장하도록 보강했다. |
| 실제 표면 검증 | scripts/verify-native-activity.ts, 합성 Native, 실제 Native 표본 | GUI·실제 Native의 성공 관측은 보존하고, 마지막 소스 변경 이후의 전체 실행을 다시 회수한다. 미확인 플랫폼과 비동기 Hook까지 확대하지 않는다. |
| 검토와 기록 수용 | verification.md, 독립 검토, work.json | claude-opus-5-5 실제 읽기 전용 감사는 증거 현재성·전체 검사 실패·서식 미해결을 지적했다. 소스가 고정된 실행과 원문을 회수해 재검토하며 최종 완료는 대기한다. |

커밋·push·게시 요청은 없으므로 수행하지 않는다. 이후 작업은 미완료 검증과 감사 회수이며, 합성 테스트 통과를 실제 Native 전체 검증으로 승격하지 않는다.

</details>

</details>
