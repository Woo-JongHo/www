# 변경 검증

## 구현과 시나리오 보존

원래16개 테스트를 제품12개와 외부BoxBox4개로 분리했다. preservation.json의 AST 대조에서 16개 이름이 고유하고 모든 테스트 본문 byte/SHA가 일치했다. fixture/helper의 sourceRoot 이동과 import만 정리했다. 기본 suite는 기존 나머지 전체 제품 검사를 보존하며 test/boxbox만 별도다. registry·완료core·허용argv는 변경하지 않았다.

## 실제 실행과 한계

worker 최초 집중검사에서 import누락2실패를 발견/보존 후 복구하여 21pass/0fail. 실제 off명령은 disabled/exit2/files0. 첫 전체 제품검사에서는 Bun1041pass/0fail, Node209pass/1fail였다. 실패는 test/workflow-environment.test.ts의 실제 Node witness가 원래 nodeTests Set선언을 추출하는 계약을 기대하기 때문이었다. tests 기대값을 바꾸지 않고 runner선언3줄을 복구했다. v2 runner9pass와 실제Nodewitness1pass/0fail/skip0. 실패 이력은 local-product-tests.log에 보존했다.

v2 로컬 공식 verifyWork 실제 node scripts/test.ts는 passed/exit0/recorded/sourceStable=true, attempt-6ac0a766-7f06-4c7e-9845-19a25bb1afdf. PRODUCT와BOXBOX에 연결했다. 로컬 build도 exit0. 최초/v2 양쪽 typed pre/post source/type/architecture검사 통과, BoxBox disabled. hostadapter는 외부Codex위임/SSH적용 대기를 위한 injected이며 toolExecutor=process다. 이를 실제 CLI모델 호스트 실행으로 주장하지 않는다. 실제 외부Codexworker 출처는 collaboration boxbox_test_split이며 모델 관측명·usage 미확인이다.

원격 선택 적용은 파일별 초기SHA와 신규파일부재를 확인한 뒤 수행했다. package와 개발문서는 원격의 다른 내용을 유지한 부분변경이다. 로컬 work.json이나 전체 소스트리를 동기화하지 않았다. 원격도 v2 typed post strict/source/architecture/sourceStable=true, BoxBox disabled. v2 실제 off명령 disabled/exit2/files0을 disabled-v2.json에 저장했다.

원격 v1 공식 Reports3 복합기능·Electron·Chrome검사는 각각 passed/recorded/sourceStable/artifactsStable=true였다. runner선언의 v2수정으로 기술입력이 달라졌으므로 v1을 현재 통과로 승격하지 않는다. v2 현재 Reports검증/실제모델AC6은 이후 새 시도로 등록한다.

원격 v2 전체 제품 첫 공식검사는 attempt-7e4dcf7f-c945-4322-9ebe-d1ce674f151a, failed/exit1/sourceStable/recorded였다. 원문출력이 hash만 보존되어 진단1회를 실행했고, 실제 rg무일치 RPC 검사에서 rg미설치 PATH로 code=null/ENOENT였음을 확인했다. 기존 Codex번들 rg15.2.0 경로를 검증프로세스 PATH에만 추가했다. 실제 해당Node회귀1pass/0fail/skip0. 제품코드·전역설정·추가설치 변경 없음. 이후 새 공식 attempt-2278f383-9f70-463d-a64b-a3e4de0f063b가 전체 제품 검사 passed/recorded/exit0/sourceStable로 PRODUCT·BOXBOX에 연결됐다. 이전 실패는 보존했다. rg 경로·버전·SHA와 실제실행은 remote-rg-precondition.json에 있다.

## 독립 검토

Sonnet 사전 검토의 정확argv/16시나리오/소유·SHA CAS/disabled조건 지적을 구현 전에 보완했다. Sonnet 변경검토는 읽기 범위 내 비차단 조건부PASS였고 실제 off코드/전체검사/자동구조생성 출처를 추가확인했다. 최종Opus는 코드/최종증거 동결 뒤 실행한다.

## 최종 원격 Task별 정식 등록과 현재성

remote-registration-v2-summary.json, remote-registration-v2-readback.json. 기존 허용 argv를 변경하지 않고 실제 verifyWork 프로세스로 등록했다.

- Reports001 AC1~5: attempt-332ffbd0-2e0d-43ea-b163-25e265b68b83, passed/recorded/sourceStable/artifactsStable. AC6 실제모델두 합성공개입력: attempt-d4c97176-2183-4df1-a8a8-34bd3d14398c passed/recorded/sourceStable. 일반판단품질·실제코드저작·관측모델명은 이2표본으로 입증하지 않는다.
- Reports002 AC1~6: attempt-bec084b9-ac0c-4749-9daa-b8bdf045492f, passed/recorded/sourceStable/artifactsStable.
- Reports003 AC1~7: attempt-ea8adeee-5946-45f4-9a2e-f8d7d8649587, passed/recorded/sourceStable/artifactsStable.
- 공식 core 재조회에서 3개Task의19개 기준 모두 usable=true/reasons=[]이며 nextAction=review. 과거독립감사와 문서검토는 현재 유효하지 않아 complete=false를 유지했다. 이3Task 자체를 완료로 주장하지 않는다.

이번 구현 작업의 REGISTER 기준에는 아직 별도 허용 검증명령으로 위 원격 core재조회를 연결하지 않았다. 실제 원격19기준 등록 관측과 이번 로컬 구현레코드의 기준별 자동수용을 혼동하지 않는다. 정적검사만 연결해 REGISTER를 passed로 만들지 않는다. 최종Opus의 변경검토와 원래3Task의 필수완료감사도 구분한다.


<a id="attempt-6ac0a766-7f06-4c7e-9845-19a25bb1afdf"></a>
## 검증 시도 — 2026-11-17T01:51:39.289Z

- 시도 ID: `attempt-6ac0a766-7f06-4c7e-9845-19a25bb1afdf`
- 실행 시각: 2026-11-17T01:49:13.300Z ~ 2026-11-17T01:51:39.289Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `BOXBOX`, `PRODUCT`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/DEVELOPMENT.md`, `package.json`, `scripts/test.ts`, `scripts/verify-reports.ts`, `test/boxbox/work-json.test.ts`, `test/test-runner.test.ts`, `test/work-json.test.ts`
- 소스 식별: `66dae320efadd2c2906b0092bb5f4cf0ac0265a4edf80f6373daa35244ad6e4e`
- 기준 정의 식별: `3d075483605e99fa1212e72d97fa5d19645381a93077b4228910401ae568a7b6`
- 검증 중 소스 유지: 확인
- 출력: stdout 55436바이트, stderr 113896바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 Opus 지적과 문서만의 보완

첫 Opus는 claude-opus-5-5 실제 읽기전용으로 코드 동작에는 결함을 찾지 않았으나 DEVELOPMENT의 과거 두 문단이 BoxBox 실도구 검사를 Reports semantic.log에 포함한다고 과장함을 지적했다. 해당 두 문단을 제품12개·외부4개 분리와 off disabled로 정정했다. 실행 코드·테스트·기준·허용argv는 바꾸지 않았다. BoxBox4개 실도구 검사는 이번 작업에서 미실행이다. 정정 전 원문은 development-before-opus-fix.md, 원격CAS는 remote-documentation-opus-fix.json. 문서변경이 로컬 구현작업 inputs에 포함되므로 PRODUCT/BOXBOX 과거 시도의 자동현재성은 재평가 대상이며 이번 작업을 done으로 주장하지 않는다. 실행코드는 최종제품검사 때와 동일하여 기능검사 전체를 문서수정 때문에 반복하지 않는다. 원래Reports3의 기능검증 inputs에는 DEVELOPMENT가 없으므로 별도 core재조회로19개 usable을 확인한다.
