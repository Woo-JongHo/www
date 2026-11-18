
# 수동 관찰과 전체 검사

## Electron 수동 탐색

CUA로 별도 WWW-Ecosystem 패키지의 실제 macOS 창에서 사이드바 생태계 진입, 17개 노드와 실선·점선, 상세 설명과 근거 경로를 관찰했다. 독립 검토 노드의 Enter 선택, EVIDENCE.MJS 검색 1개 결과, 없는 검색어의 빈 결과와 초기화, 결과 버튼으로 검증 증거 선택, 후속 방향 필터 4개, 62%에서 확대와 전체 보기 복귀를 관찰했다. 대화 초안 ‘생태계 전환 확인용 초안’은 전환 뒤 그대로 유지됐다. 실제 모델 요청은 보내지 않았다. 원래 WWW 패키지의 진행 중 대화는 변경하지 않았다.

초기 같은 Electron bundle ID의 여러 창에서는 AX 트리와 캡처가 서로 다른 창을 가리켜 시각 판정에 사용하지 않았다. 별도 bundle ID의 패키지에서 그래프 화면을 다시 관찰했다. 검색 라벨 줄바꿈과 main→core 관계선 경로를 보강했다.

## 전체 저장소 검사

npm run check: workflow·타입 검사는 통과, 테스트는 207 통과·3 timeout(5초 제한)으로 실패했다. 실패를 보존한 뒤 bun test --timeout 30000으로 전체 210개 통과·0 실패를 관찰했다. 원문: .www/scratchpad/ecosystem/check.log 및 retry-tests.log. 당시 결과이며 후속 renderer 보강은 실제 Electron probe로 별도 검사한다.

## BoxBox

프로젝트 로컬 .www/tools/boxbox.mjs로 파일별 guide --authoring과 check --source를 작성 전에 실행했다. 신규 파일의 사전 source check는 FILE_NOT_FOUND이며 guide를 참고해 작성했다. 같은 역할의 데이터는 노드·관계별 레코드로 분리하고 구문 경계에 맞춰 필드를 구성했다. 사후 검사 구문은 4개 파일 모두 valid. ecosystem.ts는 FIXABLE 4개, ecosystem-view.tsx는 REFUSE 4개, renderer.tsx는 REFUSE 11개, 테스트는 FIXABLE 2개로 관찰했다. TSX 승인 규칙 부재와 일부 축의 승인 미확인 상태를 가독성 통과로 쓰지 않으며 수동 공백 정렬·format·align은 실행하지 않았다. Markdown·HTML·mjs는 이 검사의 지원 범위가 아니다. 최종 보강 후 source check 결과는 로컬 증거에 추가한다.

<a id="attempt-fa488026-fc74-4f82-84d7-a35d0989e49b"></a>
## 검증 시도 — 2026-11-12T03:44:54.400Z

- 시도 ID: `attempt-fa488026-fc74-4f82-84d7-a35d0989e49b`
- 실행 시각: 2026-11-12T03:44:22.509Z ~ 2026-11-12T03:44:54.400Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.mjs"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `a0076fd7d825771902256fa243b902358eaf6b6f`
- 검증 입력: `build.ts`, `docs/specs/ecosystem.md`, `package.json`, `scripts/verify-ecosystem.mjs`, `src`, `test/ecosystem.test.ts`, `tsconfig.json`
- 소스 식별: `dc9d17acdf7a6c763619c1a76160ba41662357241b9969e3d8d893ea3cdd318c`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 통합 검사와 독립 검토

node scripts/verify-ecosystem.mjs가 타입·집중 테스트·번들 후 실제 Electron과 합성 Native subprocess를 실행했다. 지도 진입·키보드 선택·파일 경로 검색·대화 복귀·초안·선택 범위·명령 펼침·역사 스크롤 보존, 숫자 승인 ID 42 왕복·interrupted 종료를 확인했다. 작업 core에 AC-1~4의 실제 시도와 소스·기준 지문을 연결했으며 sourceStable와 environmentStable은 true다. 원문 결과는 .www/evidence/ecosystem-huPrBW/electron-probe.json, 캡처는 같은 폴더 electron-chat.png에 있다. 실제 모델 요청·Windows 실기 검증은 수행하지 않았다.

공유 review core로 Opus 읽기 전용 감사를 호출했지만 CLI는 ‘Not logged in · Please run /login’을 반환했다. 실제 모델 사용량과 관측 모델이 없으며 verdict는 not_run이다. 원문은 .www/scratchpad/ecosystem/opus-1794455137781/opus.json이다. 인증 실패는 정책상 Terra 대체 사유가 아니므로 대체하거나 독립 검토 통과·done으로 쓰지 않는다. 기능 기준 통과와 필수 감사 미실행을 구분한다. 로그인 복구 뒤 같은 UUID로 현재 소스·문서 지문을 확인해 검토를 재실행해야 한다.

최종 source check에서 프로젝트 임시 런처 .www/tools/boxbox.mjs가 사라져 MODULE_NOT_FOUND를 반환했다. 자동 설치하지 않고 설치된 영구 플러그인 런처로 동일 check --source를 실행했으며 원문은 .www/scratchpad/ecosystem/boxbox-final-permanent.json에 보존했다. 정렬·format은 실행하지 않았다.

## 2026-11-15 검증 마감 재개 권한

사용자의 “검증마감항목을 지금 진행” 요청으로 현재 공식 TypeScript 검증 경로 `node scripts/verify-ecosystem.ts`를 허용 검사 목록에 추가했다. 원래 `.mjs` 실행 이력·요청 해시·구현 및 게시 권한은 보존하며 제품 수정·커밋·push 권한을 추가하지 않는다. 검사 의존 범위의 구형 `.mjs`는 현재 `.ts` 및 실제 참조 문서·도구 설정으로 갱신하고 과거 증거는 당시 이력으로 남긴다.

## 2026-11-15 검증 마감 재개

이번 요청은 기존 검증 대기 항목을 현재 입력에서 다시 확인하는 작업이다. 과거 검증·실패·저작 보고서는 보존하며, 현재 소스에 적용되는 실제 검사·문서 영향 검토·정책상 독립 검토와 새 저작 보고서를 확보하기 전에는 완료로 바꾸지 않는다. 별도 Ecosystem/004 변경이 병행 중이므로 검사 전후 입력 지문 변화와 UI 영향을 구분한다. 제품 수정·새 커밋·push는 이 재검증에서 수행하지 않는다.

<a id="attempt-e425d4dc-ad2d-463c-b958-aa0a92194166"></a>
## 검증 시도 — 2026-11-15T09:35:29.982Z

- 시도 ID: `attempt-e425d4dc-ad2d-463c-b958-aa0a92194166`
- 실행 시각: 2026-11-15T09:35:11.111Z ~ 2026-11-15T09:35:29.982Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/skills/WORKFLOW.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture.test.ts`, `test/ecosystem.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `0b5a76d76912409e94f750db0db833fe57f433cbfc8feeb27425ffa75555e025`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


### 실제 도구 의존 범위 보완

현재 검사에서 타입 도구 프로젝트와 build의 구조 생성기가 실제로 읽는 scripts, docs/architecture, docs/specs, build·패키지·소스 정책·타입 설정을 기존 입력에 추가했다. 범위를 줄이거나 과거 시도를 다시 연결하지 않는다. scope_changed인 과거 통과는 이력으로 보존하며 최종 판단은 추가된 입력 범위의 새 실행으로 확인한다.

<a id="attempt-a8aaec1c-eacc-4f61-a779-da9decbf361f"></a>
## 검증 시도 — 2026-11-15T09:37:38.064Z

- 시도 ID: `attempt-a8aaec1c-eacc-4f61-a779-da9decbf361f`
- 실행 시각: 2026-11-15T09:37:23.171Z ~ 2026-11-15T09:37:38.064Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`, `AC-4`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/architecture`, `docs/skills/WORKFLOW.md`, `docs/specs`, `docs/specs/ecosystem.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-ecosystem.ts`, `source-policy.json`, `src`, `test/architecture.test.ts`, `test/ecosystem.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `c16c22adfa2433612ac1bc48f98a4046da91f5db81737f0f9f5459dd7134a743`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


### 독립 검토 지적과 실제 조작 보강

Opus `review-da4e09f7-b2bd-478c-b2ac-c183f3c80791`는 verify-ecosystem.ts가 AC-3의 영역 필터·확대/축소·전체 보기·연결 관계 버튼을 직접 조작하지 않는다고 지적했다. 기존 통과 이력은 보존하지만 이 명령만으로 해당 기준 전체를 증명하지 않는다는 판단을 수용한다. 2026-11-12의 CUA 수동 관찰도 현재 소스의 새 관찰로 재사용하지 않는다. 현재 사용자 검증 마감 요청에 따라 현재 실제 Electron에서 위 버튼을 CDP 마우스로 직접 눌러 결과 수·배율·선택 상세를 확인하는 정확한 별도 node eval 명령을 추가했다. 원문은 `.www/closeout-reports-20261115/guide-command.json`에 있으며 제품 코드·원래 요청 해시·커밋/게시 권한은 변경하지 않는다.

공통 전체 저장소 검사는 `.www/hook-trust-20261115/current-full-check.log`에서 Bun 771 통과·3 실패였다. 시간 제한 관련 두 건은 같은 파일의 별도 30초 검사에서 400 통과·0 실패(`timeout-recheck.log`)로 확인됐다. 남은 공통 실패는 병행 test/architecture-tree.test.ts의 새 declaration 구문 세 key에 승인된 BoxBox 공개 proof가 없다는 사실이다(`current-proof-pending.json`). 이 실패를 생태계 전용 현재 suite의 통과로 지우지 않으며 BoxBox project off도 스타일 PASS로 쓰지 않는다. 이전 문서 영향 검토에서 전체 실패가 이 문서에 기록됐다고 한 서술은 당시 누락이었고 이 절에 실제 실행 경로·범위를 명시해 바로잡는다.

### 현재 공통 검사와 작업 고유 검사의 경계

공통 `npm run check`는 `.www/hook-trust-20261115/current-full-check.log`에 Bun 771 통과·3 실패로 남았다. 5초 시간 제한 관련 두 건은 같은 파일의 별도 30초 재검사에서 400 통과·0 실패(`.www/hook-trust-20261115/timeout-recheck.log`)였으며, 남은 공통 실패는 별도 test/architecture-tree.test.ts 새 declaration 구문 3 key의 BoxBox 승인 proof 미충족(`.www/hook-trust-20261115/current-proof-pending.json`)이다. Node 전체는 `.www/hook-trust-20261115/current-node-suite.log`에서 148 통과·0 실패였다. 이는 이 작업의 모든 기준을 자동 통과시키거나 기존 전체 검사를 성공으로 바꾸는 근거가 아니다. BoxBox mode off는 스타일 PASS와 구분한다.

<a id="attempt-fcd8fbba-835b-441b-890a-cf386aaa3196"></a>
## 검증 시도 — 2026-11-15T09:42:58.373Z

- 시도 ID: `attempt-fcd8fbba-835b-441b-890a-cf386aaa3196`
- 실행 시각: 2026-11-15T09:42:54.845Z ~ 2026-11-15T09:42:58.373Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","--eval","import {spawn} from 'node:child_process';\nimport {promises as fs} from 'node:fs';\nimport {createServer} from 'node:net';\nimport path from 'node:path';\nimport assert from 'node:assert/strict';\nimport {ecosystemNodes} from './src/ecosystem.ts';\nconst root=process.cwd(),directory=await fs.mkdtemp(path.join(root,'.www/evidence/ecosystem-guide-controls-'));\nlet child,socket;const checks=[];const pause=ms=>new Promise(r=>setTimeout(r,ms));\ntry{\n const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));\n const env={...process.env,WWW_NATIVE_PROBE:'1',WWW_PROBE_PATH:path.join(directory,'disabled-probe.json'),WWW_PROBE_WORKSPACE:root,WWW_CODEX_BIN:path.join(root,'test/fixtures/fake-app-server.ts')};for(const k of ['ELECTRON_RUN_AS_NODE','WWW_PROBE_REPORTS','WWW_PROBE_NATIVE_REPORTS','WWW_PROBE_ACTIVITY','WWW_PROBE_DEVELOPMENT_WORK_ID'])delete env[k];\n const log=await fs.open(path.join(directory,'electron.log'),'w');\n child=spawn(path.join(root,'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'),[root,'--remote-debugging-port='+port,'--user-data-dir='+path.join(directory,'profile')],{cwd:root,env,stdio:['ignore',log.fd,log.fd]});await log.close();\n let endpoint;for(let i=0;i<200&&!endpoint;i++){if(child.exitCode!==null)throw Error('Electron 조기 종료');try{const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();endpoint=targets.find(x=>x.type==='page')?.webSocketDebuggerUrl;}catch{}if(!endpoint)await pause(100);}assert(endpoint,'debugger 연결');\n socket=new WebSocket(endpoint);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});\n let id=0;const pending=new Map();socket.addEventListener('message',event=>{const x=JSON.parse(String(event.data)),p=pending.get(x.id);if(!p)return;pending.delete(x.id);clearTimeout(p.timer);x.error?p.reject(Error(JSON.stringify(x.error))):p.resolve(x.result);});\n const command=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP 시간 초과 '+method));},10000);pending.set(n,{resolve,reject,timer});socket.send(JSON.stringify({id:n,method,params}));});\n const evaluate=async expression=>{const x=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(x.exceptionDetails)throw Error(JSON.stringify(x.exceptionDetails));return x.result.value;};\n const wait=async(expression,label)=>{for(let i=0;i<150;i++){if(await evaluate('Boolean('+expression+')')){checks.push(label);return;}await pause(50);}throw Error('화면 조건 실패 '+label);};\n const click=async selector=>{const p=await evaluate('(()=>{const e=document.querySelector('+JSON.stringify(selector)+');if(!e)throw Error(\"대상 없음\");e.scrollIntoView({block:\"center\",inline:\"center\"});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()');for(const type of ['mousePressed','mouseReleased'])await command('Input.dispatchMouseEvent',{type,x:p.x,y:p.y,button:'left',buttons:type==='mousePressed'?1:0,clickCount:1});await pause(100);};\n const base='.ecosystem-page:not([hidden]) ';\n await wait('document.querySelector(\"[data-testid=ecosystem-nav]\")','앱 준비');await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await click('[data-testid=ecosystem-nav]');await click('[data-testid=ecosystem-guide-tab]');\n await wait('document.querySelector('+JSON.stringify(base+'.ecosystem-work')+')','개념 관계 지도 활성');\n const zoom=()=>evaluate('Number(document.querySelector('+JSON.stringify(base+'.ecosystem-zoom output')+').textContent.replace(\"%\",\"\"))');\n const initialZoom=await zoom();const initialWidth=await evaluate('document.querySelector('+JSON.stringify(base+'.ecosystem-svg')+').getAttribute(\"width\")');\n await click(base+'[aria-label=\"지도 확대\"]');assert((await zoom())>initialZoom,'실제 확대');checks.push('확대 버튼이 실제 배율 증가');\n await click(base+'[aria-label=\"지도 축소\"]');assert.equal(await zoom(),initialZoom);checks.push('축소 버튼이 실제 배율 감소');\n await click(base+'[aria-label=\"지도 확대\"]');await click(base+'.ecosystem-zoom button:last-child');assert.equal(await zoom(),initialZoom);assert.equal(await evaluate('document.querySelector('+JSON.stringify(base+'.ecosystem-svg')+').getAttribute(\"width\")'),initialWidth);checks.push('전체 보기로 초기 크기맞춤 복귀');\n await click(base+'.ecosystem-filters .eco-future');const count=ecosystemNodes.filter(n=>n.group==='future').length;\n await wait('document.querySelector('+JSON.stringify(base+'.ecosystem-filters .eco-future[aria-pressed=true]')+')','후속 방향 필터 실제 선택');\n assert.equal(await evaluate('document.querySelectorAll('+JSON.stringify(base+'.ecosystem-results button:not(.ecosystem-clear)')+').length'),count);assert.equal(await evaluate('document.querySelectorAll('+JSON.stringify(base+'.eco-node:not(.is-dimmed)')+').length'),count);checks.push('필터 일치 수와 밝은 노드 수가 모델의 '+count+'개와 일치');\n await click(base+'.ecosystem-clear');await wait('!document.querySelector('+JSON.stringify(base+'.ecosystem-results')+') && !document.querySelector('+JSON.stringify(base+'.eco-node.is-dimmed')+')','필터 초기화 실제 복귀');\n const nextTitle=await evaluate('document.querySelector('+JSON.stringify(base+'.ecosystem-connections button strong')+').textContent');await click(base+'.ecosystem-connections button');\n await wait('document.querySelector('+JSON.stringify(base+'.ecosystem-detail h2')+').textContent === '+JSON.stringify(nextTitle),'연결 관계 버튼이 대상 상세로 이동');\n assert.equal(await evaluate('document.querySelector('+JSON.stringify(base+'.eco-node[aria-pressed=true] .eco-node-title')+').textContent'),nextTitle);checks.push('연결 대상의 SVG 선택 상태 동기화');\n const image=await command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(directory,'guide-controls.png'),Buffer.from(image.data,'base64'));\n const result={result:'passed',evidence:path.relative(root,directory),checks,initialZoom,futureNodes:count,selectedTitle:nextTitle,limitation:'실제 현재 Electron의 개념 지도 조작이며 합성 Native/격리 profile을 사용했다. 일반 OS 입력·스크린리더·모든 크기 검사나 런타임 호출 trace 증명은 아니다.'};await fs.writeFile(path.join(directory,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));\n}catch(error){await fs.writeFile(path.join(directory,'failure.txt'),String(error));console.error(JSON.stringify({result:'failed',evidence:path.relative(root,directory),error:String(error)}));process.exitCode=1;}finally{socket?.close();if(child){child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),3000);await new Promise(r=>child.exitCode!==null||child.signalCode!==null?r():child.once('close',r));clearTimeout(timer);}}"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/architecture`, `docs/skills/WORKFLOW.md`, `docs/specs`, `docs/specs/ecosystem.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-ecosystem.ts`, `source-policy.json`, `src`, `test/architecture.test.ts`, `test/ecosystem.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `c16c22adfa2433612ac1bc48f98a4046da91f5db81737f0f9f5459dd7134a743`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `dist/main.js` (332361바이트, sha256 5b24d057a11cd31523b64126166d29002221dd1964300a29ed64d04012783de8), `dist/preload.js` (3423바이트, sha256 9180e0212aab30263b73f01b40ff53e56c671238977d9f731acd88b3d2f52d51), `dist/renderer.js` (2112230바이트, sha256 0fc6e5ec88ea7cbe58c6886076fa58262dc85322096de6120f7d114d3619dec8)
- 검증 중 원문 유지: 확인
- 출력: stdout 783바이트, stderr 447바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


### 현재 AC-3의 별도 실제 조작 결과

`attempt-fcd8fbba-835b-441b-890a-cf386aaa3196`는 현재 Electron에서 실제 CDP 마우스로 지도 확대→축소→다시 확대→전체 보기, 후속 방향 필터와 초기화, 연결 관계 버튼을 직접 조작했다. 최초/복귀 배율은 61%이며 SVG 너비도 원복됐다. 후속 방향 결과 버튼과 밝은 SVG 노드는 각각 모델과 같은 4개였고 초기화 뒤 결과·dimmed 상태가 사라졌다. 연결 버튼은 제한된 브리지 상세 및 SVG 선택을 함께 갱신했다. sourceStable/environmentStable/artifactsStable 모두 true이며 실행한 main/preload/renderer bundle의 SHA도 artifact에 묶었다. 증거 `.www/evidence/ecosystem-guide-controls-CIA16f/summary.json`과 화면 PNG를 보존했다. 이는 기존 suite의 미관찰 영역을 보강한 새 실행이며 과거 수동 관찰이나 기존 시도를 수정한 것이 아니다.

## 2026-11-15 최종 현재성 재평가와 부분 반환

별도 세션에서 `docs/specs/ecosystem.md`, `scripts/verify-architecture.ts`, `src/architecture.generated.json`, `src/ecosystem-view.tsx`, `src/ecosystem.css`, `src/renderer.tsx`가 검사 도중 다시 바뀌었다. 우리 병렬 작업자의 제품 소스 동결과 실제 전체 워크스페이스의 동결은 달랐다. 통과 영수증은 당시 소스에 묶인 결과로 보존하고 현재 소스 통과로 승격하지 않는다. 공식 resume로 현재 기준·검토·문서 적용성을 재평가했으며 완료를 요청하지 않는다. 추가 유료 검사는 중단했고, 다른 세션 종료 후 현재 소스 재검증 또는 고정 스냅샷 기준의 마감 선택이 남았다. 부분 저작 보고서에 실제 확인 범위·실패·소스 변화·남은 조건을 연결한다.

<a id="attempt-7bfbad2b-6065-4b7c-bc82-893386be9bd8"></a>
## 검증 시도 — 2026-11-16T23:58:38.439Z

- 시도 ID: `attempt-7bfbad2b-6065-4b7c-bc82-893386be9bd8`
- 실행 시각: 2026-11-16T23:58:31.554Z ~ 2026-11-16T23:58:38.439Z
- 명령과 인자: `["/Users/woojongho/.hermes/node/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-4`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `build.ts`, `docs/ARCHITECTURE.md`, `docs/CODE_BLUEPRINT.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/architecture`, `docs/design-system.md`, `docs/skills/WORKFLOW.md`, `docs/specs`, `docs/specs/ecosystem.md`, `package-lock.json`, `package.json`, `scripts`, `scripts/verify-ecosystem.ts`, `source-policy.json`, `spikes/tauri/scripts`, `src`, `test`, `test/architecture.test.ts`, `test/ecosystem.test.ts`, `tsconfig.json`, `tsconfig.tools.json`
- 소스 식별: `631ba37e902acfa1edbfa67ee4705ab80a90480583cdc1f59595b521568af6a0`
- 기준 정의 식별: `c6bf19975fc9cd9096600c89e9f5e4b01e0c4c19ab1dbed9d6dc7b64560c61ff`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
