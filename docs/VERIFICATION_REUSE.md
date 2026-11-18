# 검증 결과의 제한된 재사용

`scripts/workflow/evidence.ts`의 `createVerificationSession`과 `verifyInSession`, `scripts/workflow/work.ts`의 `verifyWork({ reuseSession })`은 같은 프로세스에서 직접 관측한 검증의 반복 실행을 줄인다. 세션을 쓰지 않은 기존 호출의 기본 동작은 유지한다. 세션 객체는 JSON CLI 옵션으로 전달할 수 없으며 로컬 TypeScript 실행기에서 생성·전달한다.

디스크의 로그·과거 PASS·임의 세션 ID를 수입하지 않는다. 실제 명령을 처음 실행하고, 같은 명령·인자·기준 ID·입력 범위·아티팩트 요청에 대해 core를 다시 평가한 뒤에만 재사용한다. 실패·주입·비밀 인자 마스킹·최근 다른 검증·만료·관측 부재는 재실행 사유다. 환경변수 값은 저장하지 않고 호스트·OS·Node·환경변수 전체·실행 파일·명시한 하위 도구·`node_modules` 실제 트리·추가 환경 경로의 내용을 지문화한다. 외부 의존성 링크는 읽기만 하며 순환·읽기 실패는 재사용하지 않는다.

`environmentObserved`는 검사가 의존하는 외부 상태까지 관측했는지를 실행 책임자가 명시하는 조건이다. 원격 API·계정·실모델·GUI의 관측되지 않은 상태, 도구가 사용하는 추가 설정·Rust toolchain/registry 등이 남으면 `false`로 두고 재실행한다. 명시한 도구 외의 하위 프로세스와 외부 상태를 자동 추론하는 기능은 없다. `environmentPaths`에는 입력 밖의 관련 로컬 설정·도구 설치 트리를 포함한다. 읽을 수 없는 범위는 임의로 줄여 hit를 만들지 않는다. 유효기간은 최대 1시간이며 프로세스 종료 시 후보는 사라진다.

```ts
import { createVerificationSession } from './scripts/workflow/evidence.ts';
import { verifyWork } from './scripts/workflow/work.ts';

const reuseSession = createVerificationSession({
  checkId: 'common-unit-tests', scenario: '동결 입력의 단위 검사', phase: 'common',
  maxAgeMs: 300_000, tools: ['node', 'npm', 'bun'],
  environmentPaths: ['.www/development.local.json'], environmentObserved: true,
});
// 각 작업은 이 정확한 명령을 허용해야 한다. 입력에 구현·테스트·설정·요구를 포함한다.
for (const workId of commonWorkIds) {
  const result = await verifyWork({
    repo, workId, command: 'npm', args: ['test'], criterionIds: ['AC-COMMON'], reuseSession,
  });
  console.log(result.reuse, result.reuseReceiptPath);
}
```

두 작업의 전체 기준 정의와 입력 범위가 같고 실제 해당 기준을 이 명령이 덮을 때만 같은 원본 시도를 연결한다. ID만 같은 다른 기준이나 다른 전체 기준 집합은 core가 거부해 재실행한다. 각 작업의 명령 권한은 실행 전과 기록 시 다시 확인한다. 재사용 결과에는 요청·권한·기준·범위·검증 이력의 지문과 프로세스 전용 관측 ticket을 결속한다. 작업 기록 잠금을 얻은 뒤 세션 잠금을 얻어 현재 환경·만료·후보 생존을 재검사하고, 실제 원장 쓰기가 끝날 때까지 세션을 동결한다. 사이에 실패나 다른 맥락이 기록되면 이전 성공을 붙이지 않고 현재 권한으로 실제 재실행한다. 보류 결과 회수에도 같은 검사를 적용하며, 다른 프로세스에 관측 ticket이 없으면 재사용 회수를 거부한다. 독립 검토·권한 영수증을 다른 UUID로 옮기지 않는다. 기록은 기존 `workflow.verifications`·`verification.md`를 사용하고, 별도 불변 사용 영수증은 `.www/evidence/verification-reuse/`에서 원본 시도 ID·현재 작업/요청·명령 실행 여부·사유·시간을 설명한다. 영수증은 디스크 재사용 캐시가 아니다.

집중 변경 검사에는 `phase: 'focused'`, 동결된 최종 통합 검사에는 새 `phase: 'integration'` 세션을 생성한다. 다른 단계의 후보를 가져오는 API는 없다. 환경 관측 전후가 달라지거나 사후 관측에 실패하면 종료 코드가 0이어도 해당 시도를 실패로 기록한다. 같은 검사 세션의 실패·주입 결과는 모든 서명의 이전 후보를 무효화하므로 다른 명령의 실패 뒤 과거 성공으로 되돌아가지 않는다. 전체 저장소 계약 검사와 실제 GUI·Native·독립 감사의 기존 판정은 그대로 필요하다.

`environmentObserved: true` 세션의 실제 실행은 실행 전 확장 환경 digest와 도구·추가 경로를 시도의 `environmentObservation`에 저장한다. 관측 실패는 실패 시도로 보존하고 나중 환경으로 과거 관측을 보완하지 않는다. `evaluateEvidence`는 이 필드가 있는 실제 실행·재사용 증거를 기록 잠금 안의 평가, 보류 결과 회수, 이후 `assess`·`resume`마다 현재 관측과 대조한다. 대기 중이나 기록 뒤 의존성·환경변수·도구·설정이 바뀌면 과거 명령의 성공 이력은 남지만 현재 기준을 통과로 수용하지 않는다. 최초 실제 실행 pending은 새 프로세스에서도 저장된 관측으로 평가하고, 재사용 pending은 기존 프로세스 전용 ticket 검사까지 필요하다. 구형 non-session 증거에는 새 필드를 요구하거나 현재 관측을 소급해 붙이지 않는다.

`npm run check`는 `npm test`와 Electron build를 포함하고 `npm run test:comparison`은 `npm test`·Tauri UI build·Cargo test를 포함한다. 동일 명령을 여러 작업에서 반복할 때 위 세션을 공유할 수 있지만 상위 명령의 성공에서 자식 명령의 성공을 자동 추출하지 않는다. 정확한 `test:comparison` 호출을 요구하는 기존 기준은 그대로 실행한다. 명세·명령 권한이 단계별 실행을 실제 허용하는 경우에만 동일 assertions의 `npm test`, Tauri UI build, Cargo test를 명시적으로 연결하고 공통 `npm test` 세션을 공유한다. 이 변경은 package script와 기존 기준을 수정하지 않는다.

집중 검증은 `node --test test/workflow-evidence.test.ts test/workflow-work.test.ts`다. 실제 카운터 실험에서 같은 입력의 요청 2회에 명령 1회 실행·1회 재사용을 확인한다. 전체검사 시간이나 모델 토큰의 절감률은 별도 실측이 필요하다.
