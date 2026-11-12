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
