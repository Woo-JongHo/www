# 검증 기록

## 현재 검증 근거

- 현재 시도 attempt-ade0f772-be39-4705-9432-592b51129fa6은 고정 업스트림 커밋 네 곳에서 받아 inventory의 해시·크기와 대조한 7개 원문과 실제 문맥 92줄을 검사했다. 기존 재적용 검사로 18개 교정과 현행 번역의 바이트 일치도 확인했다.
- W005와 W023의 2026-11-19 Git 체크포인트 84cecdcd4ae8ccf2819e1eff746a40ec7b3f8e7d을 읽어 보존된 전체 W005 권한과 허용 명령 19개, 요청 ID·SHA, 실패 검증과 실패 리뷰 이력을 현재 원장과 대조했다. 가장 이른 원격 접수 자료인 main-intake.json의 당시 원본은 현재 파일시스템에 없다. 이번 비교 기준선은 실제 Git 체크포인트다.
- 아래의 과거 실행 로그를 읽을 때 현재 증거의 기준선과 시도를 구분한다. 새 확인이 필요하면 명시된 Git SHA와 현재 파일의 필요한 줄을 읽는다.


<a id="attempt-c56d198d-c2c8-469e-818b-9c0a6504c010"></a>
## 검증 시도 — 2026-11-16T23:05:37.051Z

- 시도 ID: `attempt-c56d198d-c2c8-469e-818b-9c0a6504c010`
- 실행 시각: 2026-11-16T23:05:36.769Z ~ 2026-11-16T23:05:37.051Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `552bc124d27bf40f468470203ddfb1e07c3e792e2b92d079b94439dab88ea50a`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-22952fe3-4ed7-44b1-8d88-5ddc1288b5ae"></a>
## 검증 시도 — 2026-11-16T23:06:02.426Z

- 시도 ID: `attempt-22952fe3-4ed7-44b1-8d88-5ddc1288b5ae`
- 실행 시각: 2026-11-16T23:06:01.955Z ~ 2026-11-16T23:06:02.426Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `552bc124d27bf40f468470203ddfb1e07c3e792e2b92d079b94439dab88ea50a`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 3598바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-2ec64f72-02cf-4a8a-907c-3f78d98c9816"></a>
## 검증 시도 — 2026-11-16T23:13:14.372Z

- 시도 ID: `attempt-2ec64f72-02cf-4a8a-907c-3f78d98c9816`
- 실행 시각: 2026-11-16T23:13:14.215Z ~ 2026-11-16T23:13:14.372Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `1765de4e9b9a753381a8a6a59f378aba774242246ceb78f8f589fd8c0772d01d`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-bc414df2-1b60-4af5-8c60-4b9b03f0e93d"></a>
## 검증 시도 — 2026-11-16T23:14:58.408Z

- 시도 ID: `attempt-bc414df2-1b60-4af5-8c60-4b9b03f0e93d`
- 실행 시각: 2026-11-16T23:14:58.240Z ~ 2026-11-16T23:14:58.408Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`, `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `1765de4e9b9a753381a8a6a59f378aba774242246ceb78f8f589fd8c0772d01d`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/reuse-integrate-resume-20261117/translation-material18/applied.json` (2685바이트, sha256 5642bae3a6dd538c4a91bf0d1a7957aa97648818ec599d6ea8f00671bf7e489f), `.www/evidence/reuse-integrate-resume-20261117/translation-material18/before-inventory.json` (95853바이트, sha256 f8eaade2e84fa88e4f5e9954b3b5946dbb8c69ba399c8d82bde5afaad0827e9c), `.www/evidence/reuse-integrate-resume-20261117/translation-material18/current/audit3-result.json.review.json` (2107바이트, sha256 4738f123d8058597e7e2cae04f75ef75106f36c6f50ae0864d0b3a954fd7a15e), `.www/evidence/reuse-integrate-resume-20261117/translation-material18/current/content-proof.json` (98946바이트, sha256 ee917b0ad294b662d284439664b8e0c1703d49bf09025a8c40ea0feaebec4059), `.www/evidence/reuse-integrate-resume-20261117/translation-material18/main-intake.json` (578바이트, sha256 364a6be18073d9ce3f63e376a079616f056746d6cddd5475e0a6a33c9de8d647), `.www/evidence/reuse-integrate-resume-20261117/translation-material18/plan.json` (37635바이트, sha256 978f660a8dfcbb4707062b106328e38e53cbf10ad162dd7d655b64a2becd0bf8), `.www/evidence/reviews/review-75e58c8a-92d2-4a8b-9901-4efba1a3bd36/terra.json` (3581331바이트, sha256 3910ea4ac6b2a5b6ad9b74e24d4bc32f598fc9806d5fef64140f5c78f67d784d)
- 검증 중 원문 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-4f1a8d0d-d9fa-4ab7-8c9b-55a9f09d7d29"></a>
## 검증 시도 — 2026-11-16T23:16:14.411Z

- 시도 ID: `attempt-4f1a8d0d-d9fa-4ab7-8c9b-55a9f09d7d29`
- 실행 시각: 2026-11-16T23:16:14.257Z ~ 2026-11-16T23:16:14.411Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `227268c1f39a7c0234fb415fdd11f475ce0eda0baef1cc62689c46066041a442`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-9e018c1a-0824-4d5f-98fb-80266f69f213"></a>
## 검증 시도 — 2026-11-16T23:18:09.663Z

- 시도 ID: `attempt-9e018c1a-0824-4d5f-98fb-80266f69f213`
- 실행 시각: 2026-11-16T23:18:09.488Z ~ 2026-11-16T23:18:09.663Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `1324abe85268f31cf5dd5f27acb8f7a250b786ee7b7da4e0f5abf9f68c50c06b`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-34734bf2-26c3-4525-a4da-54d54c767575"></a>
## 검증 시도 — 2026-11-22T15:45:42.130Z

- 시도 ID: `attempt-34734bf2-26c3-4525-a4da-54d54c767575`
- 실행 시각: 2026-11-22T15:45:41.898Z ~ 2026-11-22T15:45:42.130Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `59f3effa468a9a416c68ffecd59fe9abd13bd5e6e3a6ab7753e52c0a11e734f7`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 3580바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-b4f1e418-20b4-498a-b8e8-96a08442d063"></a>
## 검증 시도 — 2026-11-22T16:01:59.622Z

- 시도 ID: `attempt-b4f1e418-20b4-498a-b8e8-96a08442d063`
- 실행 시각: 2026-11-22T16:01:59.457Z ~ 2026-11-22T16:01:59.622Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`, `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `59f3effa468a9a416c68ffecd59fe9abd13bd5e6e3a6ab7753e52c0a11e734f7`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-current-baseline-recovered.json` (3134바이트, sha256 de56568285a361ff17af35894f56e4d2676879ad7d8c053bc53e75212047a617), `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-a978303d-c8aa-40c8-85ec-55bb0c45d5b6"></a>
## 검증 시도 — 2026-11-22T16:06:56.874Z

- 시도 ID: `attempt-a978303d-c8aa-40c8-85ec-55bb0c45d5b6`
- 실행 시각: 2026-11-22T16:06:56.702Z ~ 2026-11-22T16:06:56.874Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/check-skill-library.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`, `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `59f3effa468a9a416c68ffecd59fe9abd13bd5e6e3a6ab7753e52c0a11e734f7`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-current-baseline-recovered.log` (3134바이트, sha256 de56568285a361ff17af35894f56e4d2676879ad7d8c053bc53e75212047a617), `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 285바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-89866f60-f371-48a4-9009-8fd08a3730b9"></a>
## 검증 시도 — 2026-11-22T16:12:53.687Z

- 시도 ID: `attempt-89866f60-f371-48a4-9009-8fd08a3730b9`
- 실행 시각: 2026-11-22T16:12:53.348Z ~ 2026-11-22T16:12:53.687Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0&&evidence.childFailures.length>0);\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `b91cc8138681dc21f43f01a266aef661ff88097c5918074de68b242ea5a6e5d6`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 0바이트, stderr 431바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-7c5ce0c3-48f0-44f6-a4a7-33d2f8085e09"></a>
## 검증 시도 — 2026-11-22T16:12:54.609Z

- 시도 ID: `attempt-7c5ce0c3-48f0-44f6-a4a7-33d2f8085e09`
- 실행 시각: 2026-11-22T16:12:54.359Z ~ 2026-11-22T16:12:54.609Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `b91cc8138681dc21f43f01a266aef661ff88097c5918074de68b242ea5a6e5d6`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 3584바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-c2c3fecf-ad6d-4e09-94fc-232d70e56d88"></a>
## 검증 시도 — 2026-11-22T16:14:21.521Z

- 시도 ID: `attempt-c2c3fecf-ad6d-4e09-94fc-232d70e56d88`
- 실행 시각: 2026-11-22T16:14:21.188Z ~ 2026-11-22T16:14:21.521Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `b91cc8138681dc21f43f01a266aef661ff88097c5918074de68b242ea5a6e5d6`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-b42533e7-987b-4073-941a-465eed9b6e7a"></a>
## 검증 시도 — 2026-11-22T19:23:37.995Z

- 시도 ID: `attempt-b42533e7-987b-4073-941a-465eed9b6e7a`
- 실행 시각: 2026-11-22T19:23:37.660Z ~ 2026-11-22T19:23:37.995Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `390ce9993b34bd30fa95590d9592ab45421b95ac83a3be1c33c8da872839080d`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-8b9f2fbb-3dd8-4da4-ba45-757cfbf33d28"></a>
## 검증 시도 — 2026-11-22T19:23:38.903Z

- 시도 ID: `attempt-8b9f2fbb-3dd8-4da4-ba45-757cfbf33d28`
- 실행 시각: 2026-11-22T19:23:38.669Z ~ 2026-11-22T19:23:38.903Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `390ce9993b34bd30fa95590d9592ab45421b95ac83a3be1c33c8da872839080d`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 3589바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-08032d58-96c8-4999-866a-e2d997fb660a"></a>
## 검증 시도 — 2026-11-22T19:29:50.844Z

- 시도 ID: `attempt-08032d58-96c8-4999-866a-e2d997fb660a`
- 실행 시각: 2026-11-22T19:29:50.477Z ~ 2026-11-22T19:29:50.844Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `ff8dd3277cc53d28de329be3ad213ff930431380da777af855f631da5a7f60d3`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-f3841c45-07f4-4478-9562-d1b9dd9ea212"></a>
## 검증 시도 — 2026-11-22T19:29:53.040Z

- 시도 ID: `attempt-f3841c45-07f4-4478-9562-d1b9dd9ea212`
- 실행 시각: 2026-11-22T19:29:52.452Z ~ 2026-11-22T19:29:53.040Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `ff8dd3277cc53d28de329be3ad213ff930431380da777af855f631da5a7f60d3`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 출력: stdout 3598바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-caf0e9ed-ce01-4158-98fc-0acf0e043519"></a>
## 검증 시도 — 2026-11-22T23:09:54.430Z

- 시도 ID: `attempt-caf0e9ed-ce01-4158-98fc-0acf0e043519`
- 실행 시각: 2026-11-22T23:09:54.099Z ~ 2026-11-22T23:09:54.430Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `104935f7a05c3c2d55f165179f37c83bc68b61f11792d52008f38994dbff37e9`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-f4ebdb14-4197-4764-80bd-f2a27f9d5d10"></a>
## 검증 시도 — 2026-11-22T23:09:55.326Z

- 시도 ID: `attempt-f4ebdb14-4197-4764-80bd-f2a27f9d5d10`
- 실행 시각: 2026-11-22T23:09:55.101Z ~ 2026-11-22T23:09:55.326Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `104935f7a05c3c2d55f165179f37c83bc68b61f11792d52008f38994dbff37e9`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 3586바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 현재 작업 원장의 독립 검토 입력

- 공식 검증 회차에서 7개 문서의 18개 지정 교정과 W005 승인·과거 실패 이력 연결을 실제 대조했다. 별도의 집중 검사에서 선택 라이브러리 경로·해시·라이선스·무결성 계약을 확인했다. 두 실행이 현재 소스의 세 기준에 연결됐다.
- 전체 번역의 수용은 부모 작업에서 별도로 판단한다. 필요한 파일은 해당 경로를 직접 지정해 읽는다.

- 이번 독립 검토의 제공 파일에는 현행 교정 목록과 실제 검증 결과, 일곱 대상 파일을 넣었다. 변경 전 원문 전체는 검증기가 같은 작업 폴더의 baseline-proof.md에서 직접 대조했다. 별도 원문이 필요하면 현행 교정 목록이 가리키는 개별 경로와 구간을 읽는다.

<a id="attempt-bce0c568-ee02-4b2e-846a-7b7d1ccfebe1"></a>
## 검증 시도 — 2026-11-22T23:15:28.635Z

- 시도 ID: `attempt-bce0c568-ee02-4b2e-846a-7b7d1ccfebe1`
- 실행 시각: 2026-11-22T23:15:28.307Z ~ 2026-11-22T23:15:28.635Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `104935f7a05c3c2d55f165179f37c83bc68b61f11792d52008f38994dbff37e9`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-5a92912c-b5bd-4731-874e-45236f4e5b27"></a>
## 검증 시도 — 2026-11-22T23:15:29.535Z

- 시도 ID: `attempt-5a92912c-b5bd-4731-874e-45236f4e5b27`
- 실행 시각: 2026-11-22T23:15:29.311Z ~ 2026-11-22T23:15:29.535Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `104935f7a05c3c2d55f165179f37c83bc68b61f11792d52008f38994dbff37e9`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 3588바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 과거 근거 범위 정정

- 무결성 검사 세 회차의 종료 이력과 기존 기준 연결을 보존했다. 과거 요약은 당시 명령이 실제 확인한 무결성 검사 범위로 정정했다.
- 변경 전 파일 원문의 현재 확인 범위는 일곱 파일과 지정 교정 18개다.

<a id="attempt-064d337f-c4cd-43a0-adb9-4730105549ed"></a>
## 검증 시도 — 2026-11-22T23:16:41.512Z

- 시도 ID: `attempt-064d337f-c4cd-43a0-adb9-4730105549ed`
- 실행 시각: 2026-11-22T23:16:41.186Z ~ 2026-11-22T23:16:41.512Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","--eval","\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {createHash} from 'node:crypto';\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\nconst sha=value=>createHash('sha256').update(value).digest('hex');\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\nconst review=await readFile(root+'/current-review.md','utf8');\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\nassert.notEqual(heading,-1);\nconst start=review.indexOf('{',heading), end=review.indexOf('\\n}',start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nassert.equal(patches.length,18);\nconst fence=String.fromCharCode(96).repeat(4);\nconst sections=new RegExp('^## (skill-library/[^\\\\n]+) — before SHA ([0-9a-f]{64})\\\\n\\\\n'+fence+'\\\\n(.*?)^'+fence+'$','gms');\nconst seen=new Set();\nlet applied=0;\nconst files=[];\nfor(const match of baseline.matchAll(sections)){\n const [,file,digest,display]=match;\n assert(!seen.has(file));\n seen.add(file);\n const actual=await readFile(file);\n let source=display;\n if(file.endsWith('/capy-pr.md')){\n  const displayed=source.split('\\n').find(line=>line.includes('[<caption>]'));\n  const literal=actual.toString('utf8').split('\\n').find(line=>line.includes('[<caption>]'));\n  assert(displayed&&literal&&displayed!==literal);\n  source=source.replace(displayed,literal);\n }\n const originals=[source,source.endsWith('\\n')?source.slice(0,-1):source];\n const original=originals.find(bytes=>sha(bytes)===digest);\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\n let replaced=original;\n for(const patch of patches.filter(row=>row.path===file)){\n  assert.equal(patch.sha256,digest);\n  assert.equal(replaced.split(patch.old).length,2);\n  replaced=replaced.replace(patch.old,patch.new);\n  applied++;\n }\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\n}\nassert.equal(seen.size,7);\nassert.equal(applied,18);\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\nconst child=(await readWork({workId:childId})).record;\nconst parent=(await readWork({workId:parentId})).record;\nassert.equal(evidence.child,child.id);\nassert.equal(evidence.parent,parent.id);\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\nassert(evidence.parentFailures.length>0);\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\n assert(list.every(id=>retained.has(id)));\n}\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","work-2edb1795-1f7b-4982-a849-e3caa6926426","work-f40cbde5-04ba-4e0a-9c8b-e604be629328",".www/evidence/skill-queue-20261123/w023-parent-current.txt"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `69d96e46e36d0bf20483af39c9e7821dacb886b82edae5636d6d4da3d1921faa`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9)
- 검증 중 원문 유지: 확인
- 출력: stdout 1847바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-5f99bfa3-48e7-4721-bb83-6ab84df2d468"></a>
## 검증 시도 — 2026-11-22T23:16:42.406Z

- 시도 ID: `attempt-5f99bfa3-48e7-4721-bb83-6ab84df2d468`
- 실행 시각: 2026-11-22T23:16:42.182Z ~ 2026-11-22T23:16:42.406Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--test","test/skill-library.test.ts"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `69d96e46e36d0bf20483af39c9e7821dacb886b82edae5636d6d4da3d1921faa`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 3589바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-78b23e5d-2d99-49cf-9f58-96b17f495015"></a>
## 검증 시도 — 2026-11-22T23:22:36.825Z

- 시도 ID: `attempt-78b23e5d-2d99-49cf-9f58-96b17f495015`
- 실행 시각: 2026-11-22T23:22:36.000Z ~ 2026-11-22T23:22:36.825Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","-e","\nimport assert from \"node:assert/strict\";\nimport {execFileSync} from \"node:child_process\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nconst revision=process.argv[1];\nconst get=path=>execFileSync(\"git\",[\"show\",revision+\":\"+path]);\nconst hash=bytes=>createHash(\"sha256\").update(bytes).digest(\"hex\");\nconst inventory=\"skill-library/inventory.json\";\nconst sources=\"skill-library/sources.json\";\nassert.deepEqual(get(sources),readFileSync(sources));\nconst before=JSON.parse(get(inventory));\nconst after=JSON.parse(readFileSync(inventory));\nassert.equal(before.files.length,201);\nassert.equal(after.files.length,201);\nassert.equal(after.files.filter(file=>file.language===\"ko\").length,186);\nassert.equal(after.files.filter(file=>file.language===\"original\").length,15);\nconst current=new Map(after.files.map(file=>[file.localPath,file]));\nassert.equal(current.size,201);\nlet localChanged=0;\nfor(const beforeFile of before.files){\n const item=current.get(beforeFile.localPath);\n assert.ok(item,beforeFile.localPath);\n const {sha256:priorHash,bytes:priorBytes,...priorMetadata}=beforeFile;\n const {sha256:currentHash,bytes:currentBytes,...currentMetadata}=item;\n assert.deepEqual(priorMetadata,currentMetadata);\n const old=get(item.localPath);\n const contents=readFileSync(item.localPath);\n assert.equal(priorHash,hash(old));\n assert.equal(priorBytes,old.length);\n assert.equal(currentHash,hash(contents));\n assert.equal(currentBytes,contents.length);\n if(item.language===\"original\")assert.deepEqual(old,contents);\n if(priorHash!==currentHash)localChanged++;\n}\nconsole.log(JSON.stringify({revision,files:current.size,localChanged,originalFiles:15,koreanFiles:186,sourceMetadataUnchanged:true}));\n","e6e483f7285a6fd1f8b057ab5cb8ca60759b0af5"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `LIBRARY-INTEGRITY`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `69d96e46e36d0bf20483af39c9e7821dacb886b82edae5636d6d4da3d1921faa`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 154바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 원문 메타데이터 보존 대조

- 확인 가능한 이전 Git 커밋 e6e483f7285a6fd1f8b057ab5cb8ca60759b0af5과 현재 inventory의 201개 항목을 기준별로 직접 비교했다. 고정 출처 파일, 원문 경로·해시·크기·언어와 원문 15개 바이트는 일치한다. 이 기준선 이후 현행 로컬 파일 37개의 해시가 달라졌고, 전후 각 원문 및 번역본의 로컬 해시와 바이트를 해당 inventory에서 대조했다. 관련 공식 시도는 attempt-78b23e5d-2d99-49cf-9f58-96b17f495015다.
- 이 Git 기준선은 18개 교정 직전의 별도 로컬 inventory보다 이전이다. 교정 범위를 확인하는 증거는 별도 실행에서 일곱 작업 파일의 교정 직전 사본, 18개 치환, 현재 정확한 바이트를 대조한 결과다. 확인이 끝난 실행의 경로와 종류를 구분해 기록했다.
- 과거 로컬 증거 경로는 현재 호스트에서 발견되지 않았다. 필요한 이전 원문과 inventory는 위 정확한 Git SHA로 읽고, 전체 파일을 읽을 때는 먼저 필요한 줄 범위를 확인한다.

<a id="attempt-4b6505ac-29eb-4ece-b681-5ff1c65a14b9"></a>
## 검증 시도 — 2026-11-22T23:31:01.682Z

- 시도 ID: `attempt-4b6505ac-29eb-4ece-b681-5ff1c65a14b9`
- 실행 시각: 2026-11-22T23:31:01.546Z ~ 2026-11-22T23:31:01.682Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","-e","\nimport assert from \"node:assert/strict\";\nimport {execFileSync} from \"node:child_process\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nconst [relative,childFile,parentFile,rev,rawRoot,replay]=process.argv.slice(1);\nconst current=JSON.parse(readFileSync(childFile));\nconst parent=JSON.parse(readFileSync(parentFile));\nconst older=path=>JSON.parse(execFileSync(\"git\",[\"show\",rev+\":\"+path]));\nconst historicParent=older(parentFile),historicChild=older(childFile);\nassert.equal(historicParent.id,parent.id);\nassert.equal(historicChild.id,current.id);\nassert.deepEqual(parent.workflow.authorization,historicParent.workflow.authorization);\nassert.equal(parent.workflow.requestId,historicParent.workflow.requestId);\nassert.equal(parent.workflow.requestHash,historicParent.workflow.requestHash);\nassert.deepEqual(parent.workflow.verifierAuthorizations,historicParent.workflow.verifierAuthorizations);\nfor(const [before,after] of [[historicParent,parent],[historicChild,current]]){\n  for(const old of before.workflow.verifications.filter(v=>v.result===\"failed\"))assert.deepEqual(after.workflow.verifications.find(v=>v.id===old.id),old);\n  for(const old of before.workflow.reviews.filter(v=>v.verdict===\"fail\"))assert.deepEqual(after.workflow.reviews.find(v=>v.id===old.id),old);\n}\nassert.ok(current.relations.some(v=>v.type===\"relates_to\"&&v.target===parent.id));\nconst review=readFileSync(relative+\"/current-review.md\",\"utf8\");\nconst start=review.indexOf(\"{\",review.indexOf(\"## 18개실제교정과원문문맥\")),end=review.indexOf(\"\\n}\",start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nconst inventory=JSON.parse(readFileSync(\"skill-library/inventory.json\"));\nassert.equal(patches.length,18);\nlet linesVerified=0;\nconst seen=new Set();\nfor(const patch of patches){\n const item=inventory.files.find(file=>file.localPath===patch.path);\n assert.ok(item);\n const bytes=readFileSync(rawRoot+\"/\"+item.source+\"/\"+item.originPath);\n assert.equal(bytes.length,item.originalBytes);\n assert.equal(createHash(\"sha256\").update(bytes).digest(\"hex\"),item.originalSha256);\n const lines=bytes.toString(\"utf8\").split(/\\r?\\n/);\n for(const entry of patch.originalLines){ assert.equal(lines[entry.line-1],entry.text); linesVerified++; }\n seen.add(patch.path);\n}\nassert.equal(linesVerified,92);\nassert.equal(seen.size,7);\nexecFileSync(process.execPath,JSON.parse(replay),{stdio:\"inherit\"});\nconsole.log(JSON.stringify({parent:parent.id,priorAuthorizations:historicParent.workflow.authorization.verifierCommands.length,priorFailures:historicParent.workflow.verifications.filter(v=>v.result===\"failed\").length,checkpoint:rev,files:seen.size,patches:patches.length,linesVerified}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/work.json","docs/work/Workflow/005-Skills 라이브러리 한국어 대체/work.json","84cecdcd4ae8ccf2819e1eff746a40ec7b3f8e7d",".www/evidence/skill-queue-20261123/w023-pinned-upstream","[\"--input-type=module\",\"--eval\",\"\\nimport assert from 'node:assert/strict';\\nimport {readFile} from 'node:fs/promises';\\nimport {createHash} from 'node:crypto';\\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\\nconst sha=value=>createHash('sha256').update(value).digest('hex');\\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\\nconst review=await readFile(root+'/current-review.md','utf8');\\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\\nassert.notEqual(heading,-1);\\nconst start=review.indexOf('{',heading), end=review.indexOf('\\\\n}',start);\\nconst {patches}=JSON.parse(review.slice(start,end+2));\\nassert.equal(patches.length,18);\\nconst fence=String.fromCharCode(96).repeat(4);\\nconst sections=new RegExp('^## (skill-library/[^\\\\\\\\n]+) — before SHA ([0-9a-f]{64})\\\\\\\\n\\\\\\\\n'+fence+'\\\\\\\\n(.*?)^'+fence+'$','gms');\\nconst seen=new Set();\\nlet applied=0;\\nconst files=[];\\nfor(const match of baseline.matchAll(sections)){\\n const [,file,digest,display]=match;\\n assert(!seen.has(file));\\n seen.add(file);\\n const actual=await readFile(file);\\n let source=display;\\n if(file.endsWith('/capy-pr.md')){\\n  const displayed=source.split('\\\\n').find(line=>line.includes('[<caption>]'));\\n  const literal=actual.toString('utf8').split('\\\\n').find(line=>line.includes('[<caption>]'));\\n  assert(displayed&&literal&&displayed!==literal);\\n  source=source.replace(displayed,literal);\\n }\\n const originals=[source,source.endsWith('\\\\n')?source.slice(0,-1):source];\\n const original=originals.find(bytes=>sha(bytes)===digest);\\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\\n let replaced=original;\\n for(const patch of patches.filter(row=>row.path===file)){\\n  assert.equal(patch.sha256,digest);\\n  assert.equal(replaced.split(patch.old).length,2);\\n  replaced=replaced.replace(patch.old,patch.new);\\n  applied++;\\n }\\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\\n}\\nassert.equal(seen.size,7);\\nassert.equal(applied,18);\\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\\nconst child=(await readWork({workId:childId})).record;\\nconst parent=(await readWork({workId:parentId})).record;\\nassert.equal(evidence.child,child.id);\\nassert.equal(evidence.parent,parent.id);\\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\\nassert(evidence.parentFailures.length>0);\\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\\n assert(list.every(id=>retained.has(id)));\\n}\\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\\n\",\"docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정\",\"work-2edb1795-1f7b-4982-a849-e3caa6926426\",\"work-f40cbde5-04ba-4e0a-9c8b-e604be629328\",\".www/evidence/skill-queue-20261123/w023-parent-current.txt\"]"]`
- 명령 결과: 실패, 종료 코드 1, 신호 없음
- 검증 시도 결과: 증거 불충족
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `69d96e46e36d0bf20483af39c9e7821dacb886b82edae5636d6d4da3d1921faa`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/addy-osmani/references/performance-checklist.md` (13292바이트, sha256 ce946457d4a502846e781a2747cf6af50bcc79b1957a66dc024f50557e8982e1), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/checklist.md` (24837바이트, sha256 a32963ef38d9d3613c58c805e8517cd2e593c63769b30dd7d40e2592fa48fc78), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/greptile-triage.md` (12039바이트, sha256 66f3f458cb1124bdb2afde5ac1ad12cad57e37f99f31cbd3b1c9aa59176eb0d8), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/sections/plan-completion.md` (17186바이트, sha256 d33140607ae5ff9cd7fe421204c7522d4b9c1debe4b1cf4ad78dd5c44ab8784d), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/ship/sections/capy-pr.md` (4239바이트, sha256 85d03fbf3eb83a3767eb0d19530199d2818ab00d7649d2b9efd73f9df65d524e), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/matt-pocock/skills/engineering/diagnosing-bugs/SKILL.md` (8664바이트, sha256 849198df88cdb65fd0d97236604c1fca7ff2f22d2f705f9724a800d0266b118d), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/spec-kit/templates/commands/clarify.md` (19507바이트, sha256 5260d798c5671deb9ac7e59d6ffdb69b30c26fb28878d3cc25e30fb71cacc734)
- 검증 중 원문 유지: 확인
- 출력: stdout 0바이트, stderr 2440바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-ade0f772-be39-4705-9432-592b51129fa6"></a>
## 검증 시도 — 2026-11-22T23:32:12.950Z

- 시도 ID: `attempt-ade0f772-be39-4705-9432-592b51129fa6`
- 실행 시각: 2026-11-22T23:32:11.753Z ~ 2026-11-22T23:32:12.950Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","--input-type=module","-e","\nimport assert from \"node:assert/strict\";\nimport {execFileSync} from \"node:child_process\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nconst [relative,childFile,parentFile,rev,rawRoot,replay]=process.argv.slice(1);\nconst current=JSON.parse(readFileSync(childFile));\nconst parent=JSON.parse(readFileSync(parentFile));\nconst older=path=>JSON.parse(execFileSync(\"git\",[\"show\",rev+\":\"+path],{maxBuffer:8*1024*1024}));\nconst historicParent=older(parentFile),historicChild=older(childFile);\nassert.equal(historicParent.id,parent.id);\nassert.equal(historicChild.id,current.id);\nassert.deepEqual(parent.workflow.authorization,historicParent.workflow.authorization);\nassert.equal(parent.workflow.requestId,historicParent.workflow.requestId);\nassert.equal(parent.workflow.requestHash,historicParent.workflow.requestHash);\nassert.deepEqual(parent.workflow.verifierAuthorizations,historicParent.workflow.verifierAuthorizations);\nfor(const [before,after] of [[historicParent,parent],[historicChild,current]]){\n  for(const old of before.workflow.verifications.filter(v=>v.result===\"failed\"))assert.deepEqual(after.workflow.verifications.find(v=>v.id===old.id),old);\n  for(const old of before.workflow.reviews.filter(v=>v.verdict===\"fail\"))assert.deepEqual(after.workflow.reviews.find(v=>v.id===old.id),old);\n}\nassert.ok(current.relations.some(v=>v.type===\"relates_to\"&&v.target===parent.id));\nconst review=readFileSync(relative+\"/current-review.md\",\"utf8\");\nconst start=review.indexOf(\"{\",review.indexOf(\"## 18개실제교정과원문문맥\")),end=review.indexOf(\"\\n}\",start);\nconst {patches}=JSON.parse(review.slice(start,end+2));\nconst inventory=JSON.parse(readFileSync(\"skill-library/inventory.json\"));\nassert.equal(patches.length,18);\nlet linesVerified=0;\nconst seen=new Set();\nfor(const patch of patches){\n const item=inventory.files.find(file=>file.localPath===patch.path);\n assert.ok(item);\n const bytes=readFileSync(rawRoot+\"/\"+item.source+\"/\"+item.originPath);\n assert.equal(bytes.length,item.originalBytes);\n assert.equal(createHash(\"sha256\").update(bytes).digest(\"hex\"),item.originalSha256);\n const lines=bytes.toString(\"utf8\").split(/\\r?\\n/);\n for(const entry of patch.originalLines){ assert.equal(lines[entry.line-1],entry.text); linesVerified++; }\n seen.add(patch.path);\n}\nassert.equal(linesVerified,92);\nassert.equal(seen.size,7);\nexecFileSync(process.execPath,JSON.parse(replay),{stdio:\"inherit\"});\nconsole.log(JSON.stringify({parent:parent.id,priorAuthorizations:historicParent.workflow.authorization.verifierCommands.length,priorFailures:historicParent.workflow.verifications.filter(v=>v.result===\"failed\").length,checkpoint:rev,files:seen.size,patches:patches.length,linesVerified}));\n","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정","docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/work.json","docs/work/Workflow/005-Skills 라이브러리 한국어 대체/work.json","84cecdcd4ae8ccf2819e1eff746a40ec7b3f8e7d",".www/evidence/skill-queue-20261123/w023-pinned-upstream","[\"--input-type=module\",\"--eval\",\"\\nimport assert from 'node:assert/strict';\\nimport {readFile} from 'node:fs/promises';\\nimport {createHash} from 'node:crypto';\\nimport {readWork,authorizationDigest} from './scripts/workflow/work.ts';\\nconst root=process.argv[1], childId=process.argv[2], parentId=process.argv[3], traceFile=process.argv[4];\\nconst sha=value=>createHash('sha256').update(value).digest('hex');\\nconst baseline=await readFile(root+'/baseline-proof.md','utf8');\\nconst review=await readFile(root+'/current-review.md','utf8');\\nconst heading=review.indexOf('## 18개실제교정과원문문맥');\\nassert.notEqual(heading,-1);\\nconst start=review.indexOf('{',heading), end=review.indexOf('\\\\n}',start);\\nconst {patches}=JSON.parse(review.slice(start,end+2));\\nassert.equal(patches.length,18);\\nconst fence=String.fromCharCode(96).repeat(4);\\nconst sections=new RegExp('^## (skill-library/[^\\\\\\\\n]+) — before SHA ([0-9a-f]{64})\\\\\\\\n\\\\\\\\n'+fence+'\\\\\\\\n(.*?)^'+fence+'$','gms');\\nconst seen=new Set();\\nlet applied=0;\\nconst files=[];\\nfor(const match of baseline.matchAll(sections)){\\n const [,file,digest,display]=match;\\n assert(!seen.has(file));\\n seen.add(file);\\n const actual=await readFile(file);\\n let source=display;\\n if(file.endsWith('/capy-pr.md')){\\n  const displayed=source.split('\\\\n').find(line=>line.includes('[<caption>]'));\\n  const literal=actual.toString('utf8').split('\\\\n').find(line=>line.includes('[<caption>]'));\\n  assert(displayed&&literal&&displayed!==literal);\\n  source=source.replace(displayed,literal);\\n }\\n const originals=[source,source.endsWith('\\\\n')?source.slice(0,-1):source];\\n const original=originals.find(bytes=>sha(bytes)===digest);\\n assert(original!==undefined,'교정 전 저장 지문과 다릅니다: '+file);\\n let replaced=original;\\n for(const patch of patches.filter(row=>row.path===file)){\\n  assert.equal(patch.sha256,digest);\\n  assert.equal(replaced.split(patch.old).length,2);\\n  replaced=replaced.replace(patch.old,patch.new);\\n  applied++;\\n }\\n assert.deepEqual(Buffer.from(replaced),actual,'현재 파일에 교정 이외 차이가 있습니다: '+file);\\n files.push({file,beforeSha256:digest,currentSha256:sha(actual)});\\n}\\nassert.equal(seen.size,7);\\nassert.equal(applied,18);\\nconst evidence=JSON.parse(await readFile(traceFile,'utf8'));\\nconst child=(await readWork({workId:childId})).record;\\nconst parent=(await readWork({workId:parentId})).record;\\nassert.equal(evidence.child,child.id);\\nassert.equal(evidence.parent,parent.id);\\nassert(child.relations.some(edge=>edge.type==='relates_to'&&edge.target===parent.id));\\nassert.equal(authorizationDigest(parent.workflow.authorization),evidence.parentAuthorizationDigest);\\nassert.deepEqual(parent.workflow.authorization.verifierCommands,evidence.parentApprovalCommands);\\nassert(evidence.parentFailures.length>0);\\nassert(child.workflow.reviews.some(item=>item.id==='review-4b391d30-fbff-44ab-a3b0-65752557b70a'&&item.verdict==='fail'));\\nfor(const [work,list] of [[parent,evidence.parentFailures],[child,evidence.childFailures]]){\\n const retained=new Set(work.workflow.verifications.filter(row=>row.result==='failed').map(row=>row.id));\\n assert(list.every(id=>retained.has(id)));\\n}\\nconsole.log(JSON.stringify({applied,files,parent:parent.id,child:child.id,priorParentFailures:evidence.parentFailures.length,priorChildFailures:evidence.childFailures.length}));\\n\",\"docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정\",\"work-2edb1795-1f7b-4982-a849-e3caa6926426\",\"work-f40cbde5-04ba-4e0a-9c8b-e604be629328\",\".www/evidence/skill-queue-20261123/w023-parent-current.txt\"]"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `MATERIAL-18`, `PARENT-TRACE`
- 소스 HEAD: `939c7efcfdbf7d1e6344f01153b857b63bee87d6`
- 검증 입력: `agents/www/AGENT.md`, `agents/www/review-policy.json`, `docs/architecture/work-output.json`, `docs/skills/CATALOG.md`, `docs/skills/WORKFLOW.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/baseline-proof.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/current-review.md`, `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/spec.md`, `scripts/check-skill-library.ts`, `skill-library`, `test/skill-library.test.ts`
- 소스 식별: `69d96e46e36d0bf20483af39c9e7821dacb886b82edae5636d6d4da3d1921faa`
- 기준 정의 식별: `358fa6cd724163710be764be022872adc138ec48f37a16daad161dae3f62efcd`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `.www/evidence/skill-queue-20261123/w023-parent-current.txt` (54456바이트, sha256 5889329b341502ce3880ca0baae0b7f3d49e89aa49f07eee4b82699f1d74d4e9), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/addy-osmani/references/performance-checklist.md` (13292바이트, sha256 ce946457d4a502846e781a2747cf6af50bcc79b1957a66dc024f50557e8982e1), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/checklist.md` (24837바이트, sha256 a32963ef38d9d3613c58c805e8517cd2e593c63769b30dd7d40e2592fa48fc78), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/greptile-triage.md` (12039바이트, sha256 66f3f458cb1124bdb2afde5ac1ad12cad57e37f99f31cbd3b1c9aa59176eb0d8), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/review/sections/plan-completion.md` (17186바이트, sha256 d33140607ae5ff9cd7fe421204c7522d4b9c1debe4b1cf4ad78dd5c44ab8784d), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/gstack/ship/sections/capy-pr.md` (4239바이트, sha256 85d03fbf3eb83a3767eb0d19530199d2818ab00d7649d2b9efd73f9df65d524e), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/matt-pocock/skills/engineering/diagnosing-bugs/SKILL.md` (8664바이트, sha256 849198df88cdb65fd0d97236604c1fca7ff2f22d2f705f9724a800d0266b118d), `.www/evidence/skill-queue-20261123/w023-pinned-upstream/spec-kit/templates/commands/clarify.md` (19507바이트, sha256 5260d798c5671deb9ac7e59d6ffdb69b30c26fb28878d3cc25e30fb71cacc734)
- 검증 중 원문 유지: 확인
- 출력: stdout 2043바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

