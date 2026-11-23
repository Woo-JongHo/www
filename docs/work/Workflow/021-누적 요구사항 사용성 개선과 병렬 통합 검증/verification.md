

## remote-20261116 — 현재 머신 범위와 미실행

Hook 수정·집중103개·Astra 독립4개 반박은 끝났고 소스를 동결했다. 다음 단계는 build의 미해결 BoxBox source 검사 조건 확인이다. 기존/추가 REFUSE·미정렬을 승인·align·mode 변경 없이 보존한다. 첫 injected callback의 ok 누락 실패와 형식 교정 후 별도 사후검사를 모두 보존한다.

실측 환경: macOS 26.5.1 arm64, Node22.23.1, Bun1.4.0, Electron39.8.10. 원문은 .www/evidence/remote-20261116/ 기준 hook-postcheck-result.json / scratch/hook-fix-review.md / opus-attempt.json / electron-crash-summary.json. 실제 Opus 공유 core는 allowFallback=false, executor=process, not_run/authentication, observedModel=null이며 통과가 아니다. 실제 Native 두 검사도 실패했고 추가 시작 진단은 Codex 전역 상태 SQLite 초기화 오류를 관측했다. 승인·인증·설정을 변경하지 않았다.

## 이슈 #24의 1차 마감 일곱 작업 회수

1차 마감 당시 Chat/003·006·008과 Workflow/009·019·023·024는 각자의 최종 보고서에 완료가 기록돼 있었지만, 원격 저장소의 작업 원장 일곱 개는 모두 검증 중이었다. 2026-11-24 같은 UUID와 요청 ID로 대조했다. 각 원격 검증·검토·문서 검토 배열이 현장 원장의 선행 기록과 일치했고, 일곱 건 모두 최종 독립 검토 원문 해시가 저장된 지문과 일치했다. 최종 보고서의 이벤트는 complete, 결과는 completed였으며 각 보고서가 참조한 workRecordHash와 회수한 work.json의 바이트 해시도 일치했다.

이 기록은 각 작업이 마감된 후보의 결과다. 새 결합 후보의 현재 적용성은 해당 기준을 조회해 판정한다. 이후 Workflow/005도 PR #37로 병합하고 이슈 #29를 닫았다. 이에 따라 원래 12개 작업의 완료 이력은 8개이며, Chat/007·012·014와 Development/001은 각각 이슈 #25~#28에서 추적한다.

<a id="attempt-f27c0c3e-e500-43b1-b01c-a4a4491f4c02"></a>
## 검증 시도 — 2026-11-23T23:23:27.569Z

- 시도 ID: `attempt-f27c0c3e-e500-43b1-b01c-a4a4491f4c02`
- 실행 시각: 2026-11-23T23:23:27.213Z ~ 2026-11-23T23:23:27.569Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nimport {readDashboardWork,readDashboardPlan} from \"./src/dashboard.ts\";\nconst project={key:\"www\",path:process.cwd(),name:\"WWW\",kind:\"www\"};\nconst sessionId=\"work-40ae2dc5-86db-4b52-b1fc-09ca61c58898\";\nconst details=await readDashboardWork([project],project.key,sessionId);\nconst file=details.sourcePath;\nconst record=JSON.parse(readFileSync(file,\"utf8\"));\nconst task=details.documents.find(x=>x.kind===\"tasks\");\nassert.equal(task?.status,\"available\");\nassert.deepEqual(details.criteria.map(c=>c.id),[\"SESSION-PLAN\",\"SESSION-INTEGRATION\",\"SESSION-USABILITY\",\"SESSION-CLOSEOUT\"]);\nconst sha=createHash(\"sha256\").update(task.content).digest(\"hex\");\nconst opened=await readDashboardPlan(project,sessionId,sha);\nassert.equal(opened.content,task.content);\nassert.equal(opened.status,\"available\");\nassert.equal(new Set(record.relations.map(r=>r.target)).size,30);\nfor(const r of record.relations){assert(task.content.includes(r.target),r.target);}\nfor(const word of [\"#43\",\"#44\",\"#45\",\"#46\",\"Windows\",\"122.414초\",\"소유\",\"의존성\",\"gpt-6.1-terra\"]){assert(task.content.includes(word),word);}\nconst reopened=await readDashboardWork([project],project.key,sessionId);\nassert.equal(reopened.documents.find(x=>x.kind===\"tasks\")?.content,opened.content);\nconsole.log(JSON.stringify({sessionId,sha256:sha,relations:record.relations.length,reopened:true}));\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-PLAN`
- 소스 HEAD: `f997589a5eca39169b07ac46c9a747b283e898c1`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 출력: stdout 165바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

## 2026-11-24 결합 후보의 마감 관찰

검사 대상은 #42의 `4cdef5f`에 #43·44·45·46을 병합한 `f997589a5eca39169b07ac46c9a747b283e898c1`이다. AC-11을 실제 Electron으로 갱신한 #47의 다음 커밋 `8ca894c94b4f3b0b2280e9a798c6d0b620f77391`이 변경한 두 원장 파일을 대조하고 Chat/007을 다시 조회했다. 최종 독립 체크아웃에서 12개 작업의 공식 `assessWork`를 읽었다. 각 원장·보고서 파일의 SHA-256은 아래와 같다. 저장된 done 8건 중 이 체크아웃에서 모든 필수 기준을 수용한 원장은 Workflow/005 하나였다. 이전 완료 원문의 복구와 개별 작업의 전체 재검사는 별도 시점의 행위다. 12건의 상태·기준 수·후속 이슈는 칸반의 계획 문서에서 볼 수 있다.

| 작업 | work.json SHA-256 | 보고서 JSON SHA-256 |
|---|---|---|
| Chat/003 | `6665fa32fe4475b9ec3216f0f41db1e7560e0b6475b11d4b60baa212801dd6b3` | `aa0b0165e5f796d3660951b020ecaa33023ed7577f0e8e6b6107ac153386ad3a` |
| Chat/006 | `329df819c2859b20daa9ddf49ba81bcf6a35d502cae89e0efbeb54241b8dca19` | `82db728ea0d2822a2b08efa17c3484556777dd456ca1902cbede85d0a476179d` |
| Chat/008 | `b8eb630e65afd48975167cb21bd11fa6ea42575ceb755f1e383a24566676a38c` | `d2b05ac488a3dc645b16963c49e573a187f5ab3527f62b7feeee8b0c43f0d77b` |
| Workflow/009 | `c237fe4fd862b33e9ce6559592cee1a9dc3895f57e27fb8829cc821e4451d7fc` | `83e6e61d3c71514a7a8aa74bb2b0e5b8914d907ee026babeb969661b376504dc` |
| Workflow/019 | `ed119bbd2385a5377ed43dc22bda9556aa1ebcd98b3489872245fc5e99b5d1fa` | `9e34fd0bd30fa63588c6a99a3d70d23104751d2095545a15c23663d094b101c7` |
| Workflow/023 | `9fb054f5c2d6c87c81b47d9c704b1361fa1714c0dbb2d700039a3336343db5bd` | `1a5ea9011ed66de083e39b51e64d6d553b623be3b82dd24ce1ba18fc2ba5e3d7` |
| Workflow/024 | `6b9aa188b5502ec37600bb986302654370e894d657107363ba016859f7dcc43d` | `a5381912cd54a0c55223447c8ee786e8383defb9aea876635a543988b2a09058` |
| Workflow/005 | `31b27245ea28870a5926a47a78cfbc5bae9af9e1e215dd5a62549d0e680ea99c` | `e0f6c71e09b00a4544c3dd75c2e51e3505559cdbf4127148d7ede02894fcf649` |
| Chat/007 | `56bf51e4494ad75174548010deeadab9405931814f2a3c814c28c24cc56d0443` | `e77dfaf0b062c90f717770a6aa402f39c56780926e641d4add9d0b0b5d640357` |
| Chat/012 | `8042bd00a1c50d492ef29a5a9f443dba0b0b2c6320fe10430766d329e99d67b8` | `575c0ca7398d3af40a19a1e3de52605b992c14894c18b5ac5b13e6e9bf3212d0` |
| Chat/014 | `1934590a8d7ba2729ef26f4060e914601ec23b3828c867eadbabe3e4e8691ae1` | `63d0f6b69df55bca38ce0271ca38f874a29f6cac4a3ed936d4b0672a48c992e2` |
| Development/001 | `dd430bf50f3065d3276cd091dda2eb624f8d38572fdb3dfeb29ccc144444994d` | `7f3a310a7c097eaa337aa308a2353193012071bb2f6e3df3e5645c7969ef5b24` |

### 사용자 여정과 인계

- 과거 #39의 실제 Electron 보드에서 Chat/007 카드를 열어 원장 10/12, 현재 0/12와 사유를 확인했다. 현재 결합 후보에서는 칸반 상세 API로 Workflow/021 계획 문서를 열고 SHA-256으로 재조회·복귀해 같은 바이트임을 확인했다.
- #45의 Mac 사용자 실기는 두벌식으로 ‘가’를 조합하고 Enter 한 번을 눌렀을 때 최종 음절이 fixture에 한 번 도착했다. 합성 취소·Shift·키 반복은 별도 검사다. Windows는 사용자가 같은 후보의 한글 입력과 Shift 줄바꿈을 확인한 뒤 #25·#28에 결과를 추가한다.
- #44의 합성 Native·실제 Electron에서 계측 12순번 중 프레임 기록이 3개에서 12개로 회복됐다. 과거 정제 시각의 122.414초를 발생시킨 구간은 자료가 없어 #26의 AC-2를 열어 둔다.
- #43의 표시 창 스트리밍 표본에서 입력 p95 중앙값은 52.7→47.4ms, 대기 입력 p95 중앙값은 8.0→9.1ms였다. 휠 최대 간격의 개선도 확인되지 않았다. #27의 IME·연속 추가 지시·탭 격리는 각 여정 판정을 유지한다.
- #46의 원래 후보에서 AC-11의 화면 검사를 통과했고, 이어 공용 renderer가 변경된 결합 후보에서 기존 시도는 `source_changed`로 판정됐다. 같은 소스에서 실제 Electron 검사를 1회 실행한 새 원문이 8ca894c에 연결된 뒤 AC-11만 현재 유효(1/12)로 바뀌었다.
- 2026-11-16 실행에서 기록한 주입 build callback 성공, 실제 Opus 인증 실패, Native 실행 실패와 현재 실사용·합성 검사를 구별했다. 미검증 플랫폼과 남은 사용자 여정을 포함한 SESSION-USABILITY 전체 판정은 열어 둔다.

<a id="attempt-018d2a9e-7107-4c4b-9b0f-9ef408981057"></a>
## 검증 시도 — 2026-11-23T23:24:01.689Z

- 시도 ID: `attempt-018d2a9e-7107-4c4b-9b0f-9ef408981057`
- 실행 시각: 2026-11-23T23:24:01.186Z ~ 2026-11-23T23:24:01.689Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nimport {readDashboardWork,readDashboardPlan} from \"./src/dashboard.ts\";\nconst project={key:\"www\",path:process.cwd(),name:\"WWW\",kind:\"www\"};\nconst sessionId=\"work-40ae2dc5-86db-4b52-b1fc-09ca61c58898\";\nconst details=await readDashboardWork([project],project.key,sessionId);\nconst file=details.sourcePath;\nconst record=JSON.parse(readFileSync(file,\"utf8\"));\nconst task=details.documents.find(x=>x.kind===\"tasks\");\nassert.equal(task?.status,\"available\");\nassert.deepEqual(details.criteria.map(c=>c.id),[\"SESSION-PLAN\",\"SESSION-INTEGRATION\",\"SESSION-USABILITY\",\"SESSION-CLOSEOUT\"]);\nconst sha=createHash(\"sha256\").update(task.content).digest(\"hex\");\nconst opened=await readDashboardPlan(project,sessionId,sha);\nassert.equal(opened.content,task.content);\nassert.equal(opened.status,\"available\");\nassert.equal(new Set(record.relations.map(r=>r.target)).size,30);\nfor(const r of record.relations){assert(task.content.includes(r.target),r.target);}\nfor(const word of [\"#43\",\"#44\",\"#45\",\"#46\",\"Windows\",\"122.414초\",\"소유\",\"의존성\",\"gpt-6.1-terra\"]){assert(task.content.includes(word),word);}\nconst reopened=await readDashboardWork([project],project.key,sessionId);\nassert.equal(reopened.documents.find(x=>x.kind===\"tasks\")?.content,opened.content);\nconsole.log(JSON.stringify({sessionId,sha256:sha,relations:record.relations.length,reopened:true}));\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-PLAN`
- 소스 HEAD: `f997589a5eca39169b07ac46c9a747b283e898c1`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `docs/work/Workflow/021-누적 요구사항 사용성 개선과 병렬 통합 검증/tasks.md` (22613바이트, sha256 234efc30c03d503fc23a250e8ab9b50d17a7ccb47f32cbf427d1da0e51a4bdaa)
- 검증 중 원문 유지: 확인
- 출력: stdout 165바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-bc82c736-adb6-4c09-a1c0-128998e24fb3"></a>
## 검증 시도 — 2026-11-23T23:24:53.885Z

- 시도 ID: `attempt-bc82c736-adb6-4c09-a1c0-128998e24fb3`
- 실행 시각: 2026-11-23T23:24:53.377Z ~ 2026-11-23T23:24:53.885Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nimport {readDashboardWork,readDashboardPlan} from \"./src/dashboard.ts\";\nconst project={key:\"www\",path:process.cwd(),name:\"WWW\",kind:\"www\"};\nconst sessionId=\"work-40ae2dc5-86db-4b52-b1fc-09ca61c58898\";\nconst details=await readDashboardWork([project],project.key,sessionId);\nconst file=details.sourcePath;\nconst record=JSON.parse(readFileSync(file,\"utf8\"));\nconst task=details.documents.find(x=>x.kind===\"tasks\");\nassert.equal(task?.status,\"available\");\nassert.deepEqual(details.criteria.map(c=>c.id),[\"SESSION-PLAN\",\"SESSION-INTEGRATION\",\"SESSION-USABILITY\",\"SESSION-CLOSEOUT\"]);\nconst sha=createHash(\"sha256\").update(task.content).digest(\"hex\");\nconst opened=await readDashboardPlan(project,sessionId,sha);\nassert.equal(opened.content,task.content);\nassert.equal(opened.status,\"available\");\nassert.equal(new Set(record.relations.map(r=>r.target)).size,30);\nfor(const r of record.relations){assert(task.content.includes(r.target),r.target);}\nfor(const word of [\"#43\",\"#44\",\"#45\",\"#46\",\"Windows\",\"122.414초\",\"소유\",\"의존성\",\"gpt-6.1-terra\"]){assert(task.content.includes(word),word);}\nconst reopened=await readDashboardWork([project],project.key,sessionId);\nassert.equal(reopened.documents.find(x=>x.kind===\"tasks\")?.content,opened.content);\nconsole.log(JSON.stringify({sessionId,sha256:sha,relations:record.relations.length,reopened:true}));\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-PLAN`
- 소스 HEAD: `8ca894c94b4f3b0b2280e9a798c6d0b620f77391`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `docs/work/Workflow/021-누적 요구사항 사용성 개선과 병렬 통합 검증/tasks.md` (22613바이트, sha256 a1a508ae793e8e3e97d0b9707b2b2c1c69bd8ab20e23e72020475ec3975ecaa4)
- 검증 중 원문 유지: 확인
- 출력: stdout 165바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

Workflow/005의 칸반 상세는 이 후보에서 현재 2/4이며 AC-1과 AC-4를 **실행 파일 확인 범위 밖**으로 미평가했다. 공식 하네스는 4/4를 수용했다. 나머지 열한 카드의 현재 수치는 하네스와 일치했다. 칸반 계획 표의 현행 유효 열은 공식 하네스 수치다.

### 현장 원문 지문

[이슈 #24 본문](https://github.com/Woo-JongHo/www/issues/24)과 [첫 마감 추가 코멘트](https://github.com/Woo-JongHo/www/issues/24#issuecomment-7115621704)의 GitHub 본문 UTF-8 SHA-256은 각각 `45fc94c60ce5338fa2710766867daf181ae99a4c56ebb9c649ac612a4d43c168`, `20fb90543b8168221877dc55afc9d4b27e34c56735717c7f40502250a81815bb`이다. 아래 값은 각 PR의 로컬 검증 원문 파일 바이트에서 계산했다. 공개 저장소에는 개인 대화 원문을 포함하지 않는다.

| 검사 | 원문 파일 | SHA-256 |
|---|---|---|
| #25 macOS 실기 관찰 | `macos-ime-appkit/manual-XwZq75/observation.json` | `c2776894284e02cea6f4cb5be6398a143c78b722561756b644b8860ca38a5495` |
| #45 합성 조합 회귀 | `chat-ui-cDN8jE/summary.json` | `9eac8a3c7ec7cd6b5e26eb703909d915219770df3fd2d97cf86a18571f09b120` |
| #47 결합 후보의 합성 조합 회귀 | `chat-ui-rfWDzH/summary.json` | `5f52a4a382233a8132e34eb021679d8b95d67486f6e01c22d9597d5cd9fa3bfb` |
| #26 수정 전 Electron 순번 | `issue26/before.json` | `50b8bbc49f5d4009a478050deff359ad3d7ced62d8c58b10cd04d7f1726807ba` |
| #26 최종 Electron 검사 | `issue26/accepted-timing.log` | `23baf87718c583a082a1ee2d60ab3c9c6880623524139be7b22c62096ce1f01b` |
| #39 Electron 칸반 카드·상세 | `dashboard-applicability-uEkw4T/summary.json` | `ec1da0c9f89b9dccdb9cbaab217bbc522d4cfc7bca313561858a040b0ada8418` |

마감 시점에 남은 네 작업은 각각 [Chat/007 #25](https://github.com/Woo-JongHo/www/issues/25), [Chat/012 #26](https://github.com/Woo-JongHo/www/issues/26), [Chat/014 #27](https://github.com/Woo-JongHo/www/issues/27), [Development/001 #28](https://github.com/Woo-JongHo/www/issues/28)의 원문과 후속 코멘트에서 추적한다. 이 집계의 후보는 #47이며 이후 세션의 PR은 다음 판정에서 다룬다.

<a id="attempt-b14ac4d2-231e-4753-973f-d09a13811f26"></a>
## 검증 시도 — 2026-11-23T23:31:33.758Z

- 시도 ID: `attempt-b14ac4d2-231e-4753-973f-d09a13811f26`
- 실행 시각: 2026-11-23T23:31:33.240Z ~ 2026-11-23T23:31:33.758Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";\nimport {readFileSync} from \"node:fs\";\nimport {createHash} from \"node:crypto\";\nimport {readDashboardWork,readDashboardPlan} from \"./src/dashboard.ts\";\nconst project={key:\"www\",path:process.cwd(),name:\"WWW\",kind:\"www\"};\nconst sessionId=\"work-40ae2dc5-86db-4b52-b1fc-09ca61c58898\";\nconst details=await readDashboardWork([project],project.key,sessionId);\nconst file=details.sourcePath;\nconst record=JSON.parse(readFileSync(file,\"utf8\"));\nconst task=details.documents.find(x=>x.kind===\"tasks\");\nassert.equal(task?.status,\"available\");\nassert.deepEqual(details.criteria.map(c=>c.id),[\"SESSION-PLAN\",\"SESSION-INTEGRATION\",\"SESSION-USABILITY\",\"SESSION-CLOSEOUT\"]);\nconst sha=createHash(\"sha256\").update(task.content).digest(\"hex\");\nconst opened=await readDashboardPlan(project,sessionId,sha);\nassert.equal(opened.content,task.content);\nassert.equal(opened.status,\"available\");\nassert.equal(new Set(record.relations.map(r=>r.target)).size,30);\nfor(const r of record.relations){assert(task.content.includes(r.target),r.target);}\nfor(const word of [\"#43\",\"#44\",\"#45\",\"#46\",\"Windows\",\"122.414초\",\"소유\",\"의존성\",\"gpt-6.1-terra\"]){assert(task.content.includes(word),word);}\nconst reopened=await readDashboardWork([project],project.key,sessionId);\nassert.equal(reopened.documents.find(x=>x.kind===\"tasks\")?.content,opened.content);\nconsole.log(JSON.stringify({sessionId,sha256:sha,relations:record.relations.length,reopened:true}));\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-PLAN`
- 소스 HEAD: `8ca894c94b4f3b0b2280e9a798c6d0b620f77391`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `docs/work/Workflow/021-누적 요구사항 사용성 개선과 병렬 통합 검증/tasks.md` (22871바이트, sha256 96823205b401605a6eec1fc1b3bdd9bb80b4afe3a7400fcb2bd8c6b94e0c9d27)
- 검증 중 원문 유지: 확인
- 출력: stdout 165바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

### 재실행한 이유와 대기 측정

결합에서 renderer가 바뀐 Chat/007 AC-11은 공식 하네스 `explicit_verifier`로 실행했다. 실제 원문 `attempt-cebd3662-e384-4787-8c7b-cca59990cf87`의 사건 시각(UTC)은 23:23:45.679 요청, 45.787 프로세스 시작, 50.114 종료, 50.572 등록·반환이다. 요청→프로세스 시작 108ms, 프로세스 4.327초, 종료→등록 458ms, 합계 4.893초였다. 그 밖의 11개 AC를 이 명령으로 실행하지 않았다. 시간 원문 SHA-256은 `f5baaf7938fededf466bce1eab934bdd96ade5a162b34da8cd5a6146592856ad`다. 이 한 번의 시간은 과거 17시간 전체의 절감률을 추정하는 자료가 아니다.

칸반 계획의 독립 읽기 검토에서 11월 19일 과거 계획의 ‘현재 단계 build’가 남아 있음이 발견됐다. 과거 날짜·실행 시점을 표시하고 접어 둔 뒤 대체 모델 `gpt-6.1-terra`가 계획을 수용했다(검토 `review-428eb6b8-6d0a-4e6b-a1aa-5da392c18e3d`). 변경한 파일을 실제로 열고 재조회한 최종 공식 SESSION-PLAN 시도는 `attempt-b14ac4d2-231e-4753-973f-d09a13811f26`이다.

[결합 후보 #47의 전체 CI](https://github.com/Woo-JongHo/www/actions/runs/45288478553/job/138091082985)가 통과했다. 원격 validate의 생성→시작은 10초, 시작→완료는 415초였다(2026-11-23T23:24:45Z~2026-11-23T23:31:40Z). 환경·구조·소스 정책·워크플로·타입·테스트·빌드를 수행한 `release:verify` 원문의 SHA-256은 `770a672608769869ac1bb93a898e90421c3454dacc510028f00264d52efd5cd6`다. 검사 체크아웃, 트리, 기준, PR head 순서로 출력한 실제 영수증은 다음과 같다.

```text
WWW_VERIFIED_TREE b095341fdd939f55edcb37328e28d97daeff6c41 0d5c08ecae5e463a67d1e2192fc8ed3baa5eaba5 ab758d3186d1f5df8cfded9aafc2aec042430526 8ca894c94b4f3b0b2280e9a798c6d0b620f77391
```

[PR #47](https://github.com/Woo-JongHo/www/pull/47)은 2026-11-23T23:31:50Z에 main에 병합됐다. 병합 커밋 `bab4ad6cb6f8a7ddf30c38ea69c59c0021bcef84` 트리는 이 영수증과 같다. 이 후보와 같은 제품 파일에 대해 release 전체 검사를 다시 실행하지 않고 해당 원문과 현재 소스 지문을 대조했다. Workflow/021의 부분 마감 PR은 별개 게시 단위다.

<a id="attempt-c7695c6a-e91b-474c-b19f-32eba4fc5eb6"></a>
## 검증 시도 — 2026-11-23T23:32:28.447Z

- 시도 ID: `attempt-c7695c6a-e91b-474c-b19f-32eba4fc5eb6`
- 실행 시각: 2026-11-23T23:32:26.329Z ~ 2026-11-23T23:32:28.447Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";import {execFileSync} from \"node:child_process\";import {createHash} from \"node:crypto\";\nconst sha=\"8ca894c94b4f3b0b2280e9a798c6d0b620f77391\",runId=\"45288478553\",jobId=\"138091082985\",repo=\"Woo-JongHo/www\";\nconst git=(...args)=>execFileSync(\"git\",args,{encoding:\"utf8\"}).trim(),api=p=>JSON.parse(execFileSync(\"gh\",[\"api\",\"repos/\"+repo+\"/\"+p],{encoding:\"utf8\"}));\nconst run=api(\"actions/runs/\"+runId),job=api(\"actions/jobs/\"+jobId);assert.equal(run.head_sha,sha);assert.equal(job.run_id,Number(runId));assert.equal(job.name,\"validate\");assert.equal(job.conclusion,\"success\");assert.equal(job.steps.find(s=>s.name===\"체크아웃 검증 및 필요한 패키징\")?.conclusion,\"success\");\nfor(const part of [\"src\",\"test\",\"scripts\",\"package.json\",\".github/workflows/ci.yml\"]){assert.equal(git(\"rev-parse\",\"HEAD:\"+part),git(\"rev-parse\",sha+\":\"+part));}\nconst log=execFileSync(\"gh\",[\"run\",\"view\",runId,\"--repo\",repo,\"--job\",jobId,\"--log\"],{maxBuffer:32*1024*1024,encoding:\"utf8\"});const markers=[...log.matchAll(/WWW_VERIFIED_TREE ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9a-f]{40}) ([0-9a-f]{40})/g)];assert(markers.some(m=>m[2]===git(\"rev-parse\",sha+\"^{tree}\")&&m[4]===sha));for(const stage of [\"check:architecture\",\"check:source\",\"typecheck\",\"test\",\"build\"]){assert(log.includes(\" \"+stage),stage);}\nconsole.log(JSON.stringify({head:sha,tree:git(\"rev-parse\",sha+\"^{tree}\"),runId,jobId,started:job.started_at,finished:job.completed_at,logSha256:createHash(\"sha256\").update(log).digest(\"hex\")}));\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-INTEGRATION`
- 소스 HEAD: `8ca894c94b4f3b0b2280e9a798c6d0b620f77391`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `docs/work/Workflow/021-누적 요구사항 사용성 개선과 병렬 통합 검증/tasks.md` (22871바이트, sha256 96823205b401605a6eec1fc1b3bdd9bb80b4afe3a7400fcb2bd8c6b94e0c9d27)
- 검증 중 원문 유지: 확인
- 출력: stdout 293바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-2cffa84a-3613-43d7-8ae0-4ae95ceba018"></a>
## 검증 시도 — 2026-11-23T23:32:59.814Z

- 시도 ID: `attempt-2cffa84a-3613-43d7-8ae0-4ae95ceba018`
- 실행 시각: 2026-11-23T23:32:41.565Z ~ 2026-11-23T23:32:59.814Z
- 명령과 인자: `["/Users/woojongho/.bun/bin/bun","-e","import assert from \"node:assert/strict\";import fs from \"node:fs\";import path from \"node:path\";import {createHash} from \"node:crypto\";import {readDashboardWork} from \"./src/dashboard.ts\";import {assessWork} from \"./scripts/workflow/work.ts\";\nconst root=process.cwd(),project={key:\"www\",path:root,name:\"WWW\",kind:\"www\"},sessionId=\"work-40ae2dc5-86db-4b52-b1fc-09ca61c58898\";\nconst detail=await readDashboardWork([project],project.key,sessionId),task=detail.documents.find(x=>x.kind===\"tasks\").content,proof=detail.documents.find(x=>x.kind===\"verification\").content;\nconst hash=b=>createHash(\"sha256\").update(b).digest(\"hex\");\nconst listed=task.split(\"\\n\").filter(s=>s.includes(\"| \`work-\")&&s.split(\"|\").length===8);\nassert.equal(listed.length,12);let done=0;\nfor(const line of listed){const cells=line.split(\"|\").map(x=>x.trim());const id=cells[2].replaceAll(\"\`\",\"\");const a=await assessWork({repo:root,workId:id});const d=await readDashboardWork([project],project.key,id);const req=d.criteria.filter(c=>c.required),stored=req.filter(x=>x.result===\"passed\").length,valid=req.filter(x=>x.applicability?.status===\"current\").length;const applicable=a.criteria.filter(c=>c.usable&&req.some(r=>r.id===c.id));for(const c of applicable){const ui=req.find(x=>x.id===c.id)?.applicability;if(ui?.status===\"current\")continue;assert.equal(id,\"work-f40cbde5-04ba-4e0a-9c8b-e604be629328\");assert([\"AC-1\",\"AC-4\"].includes(c.id));assert.equal(ui?.status,\"unassessed\");assert(ui?.reasons.includes(\"실행 파일 확인 범위 밖\"));}for(const c of req.filter(x=>x.applicability?.status===\"current\"))assert(applicable.some(x=>x.id===c.id));assert.equal(cells[3],d.status);assert.equal(cells[4],stored+\"/\"+req.length);assert.equal(cells[5],applicable.length+\"/\"+req.length);assert(cells[6].length>0);assert(proof.includes(hash(fs.readFileSync(d.sourcePath))));const reportDir=path.join(path.dirname(d.sourcePath),\"reports\");const reports=fs.readdirSync(reportDir).filter(p=>p.endsWith(\".json\"));assert.equal(reports.length,1);assert(proof.includes(hash(fs.readFileSync(path.join(reportDir,reports[0])))));if(d.status===\"done\")done++;}\nassert.equal(done,8);assert(proof.includes(\"122.414초\"));assert(proof.includes(\"Windows\"));console.log(JSON.stringify({checked:listed.length,historicalDone:done,explicitDashboardLimits:[\"Workflow/005 AC-1\",\"Workflow/005 AC-4\"]}));\n\nconst sessionReportDir=path.join(path.dirname(detail.sourcePath),\"reports\");\nconst reports=fs.readdirSync(sessionReportDir).filter(p=>p.endsWith(\".json\"));\nconst entry=JSON.parse(fs.readFileSync(path.join(sessionReportDir,reports[0]),\"utf8\")).entries.at(-1);\nconst narrative=JSON.stringify(entry.narrative);for(const term of [\"8/12\",\"122.414초\",\"Windows\",\"2/4\"])assert(narrative.includes(term),term);\n"]`
- 명령 결과: 정상 종료, 종료 코드 0, 신호 없음
- 검증 시도 결과: 통과
- 실행기: 실제 자식 프로세스
- 관련 기준: `SESSION-CLOSEOUT`
- 소스 HEAD: `8ca894c94b4f3b0b2280e9a798c6d0b620f77391`
- 검증 입력: `agents`, `docs/architecture`, `docs/skills`, `docs/specs`, `package.json`, `scripts`, `skills`, `src`, `test`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `fa1e858b4265091528c84b1737123adce2ff41d86d318f13cd5767be7fd8fa1d`
- 기준 정의 식별: `5113844c159263a140d271d35b3159d089ccc07b9cfbdaf97d4c24644cca59ed`
- 검증 중 소스 유지: 확인
- 검증 중 실행 환경 유지: 확인
- 검증 의존 원문: `docs/work/Chat/003-Native 실시간 작업 흐름과 사용량/work.json` (1498890바이트, sha256 6665fa32fe4475b9ec3216f0f41db1e7560e0b6475b11d4b60baa212801dd6b3), `docs/work/Chat/006-오픈소스 채팅 뼈대와 Native 대화 재개 통합/work.json` (1220595바이트, sha256 329df819c2859b20daa9ddf49ba81bcf6a35d502cae89e0efbeb54241b8dca19), `docs/work/Chat/007-실시간 세션 모니터와 채팅 가독성/work.json` (1721639바이트, sha256 56bf51e4494ad75174548010deeadab9405931814f2a3c814c28c24cc56d0443), `docs/work/Chat/008-오픈소스 채팅 뼈대 도입 비교/work.json` (2649376바이트, sha256 b8eb630e65afd48975167cb21bd11fa6ea42575ceb755f1e383a24566676a38c), `docs/work/Chat/012-스크롤과 첫 응답 및 진행 설명 개선 논의/work.json` (420515바이트, sha256 8042bd00a1c50d492ef29a5a9f443dba0b0b2c6320fe10430766d329e99d67b8), `docs/work/Chat/014-대화 단일 스크롤과 카드 펼침 및 성능 개선 명세/work.json` (515978바이트, sha256 1934590a8d7ba2729ef26f4060e914601ec23b3828c867eadbabe3e4e8691ae1), `docs/work/Development/001-Mac과 Windows 실사용 및 검증 신뢰성 완성/work.json` (888678바이트, sha256 dd430bf50f3065d3276cd091dda2eb624f8d38572fdb3dfeb29ccc144444994d), `docs/work/Workflow/005-Skills 라이브러리 한국어 대체/work.json` (4162112바이트, sha256 31b27245ea28870a5926a47a78cfbc5bae9af9e1e215dd5a62549d0e680ea99c), `docs/work/Workflow/009-JavaScript 전체 TypeScript 이관/work.json` (5430808바이트, sha256 c237fe4fd862b33e9ce6559592cee1a9dc3895f57e27fb8829cc821e4451d7fc), `docs/work/Workflow/019-분업 계약과 완료 게이트 강화 및 상태도 연결/work.json` (3028252바이트, sha256 ed119bbd2385a5377ed43dc22bda9556aa1ebcd98b3489872245fc5e99b5d1fa), `docs/work/Workflow/021-누적 요구사항 사용성 개선과 병렬 통합 검증/tasks.md` (22871바이트, sha256 96823205b401605a6eec1fc1b3bdd9bb80b4afe3a7400fcb2bd8c6b94e0c9d27), `docs/work/Workflow/023-선택 라이브러리 잔여 의미 18문구 교정/work.json` (2153025바이트, sha256 9fb054f5c2d6c87c81b47d9c704b1361fa1714c0dbb2d700039a3336343db5bd), `docs/work/Workflow/024-BoxBox 외부 검사 분리와 Reports 공식 검증 복구/work.json` (63452바이트, sha256 6b9aa188b5502ec37600bb986302654370e894d657107363ba016859f7dcc43d)
- 검증 중 원문 유지: 확인
- 출력: stdout 102바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

### 부분 마감 판정

SESSION-PLAN의 최종 계획 조회, SESSION-INTEGRATION의 #47 원격 검사 원문 대조(`attempt-c7695c6a-e91b-474c-b19f-32eba4fc5eb6`), SESSION-CLOSEOUT의 12개 칸반 상세·공식 판정·보고서 원문 대조(`attempt-2cffa84a-3613-43d7-8ae0-4ae95ceba018`)가 통과했다. SESSION-USABILITY의 남은 실사용 조건을 유지해 Workflow/021 상태는 검증 중이다.
