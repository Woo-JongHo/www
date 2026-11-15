# 검증 기록

## 실제 실행

- BoxBox source의 session-modes/lifecycle-hook/guarded-run 집중 66개 통과, 401 expect, 272.98초. 원문 .www/scratchpad/boxbox-diagnosis/lifecycle-authoring.md.
- 격리 설치 후보 타입 검사와 pack:installer 빌드 종료 코드 0. candidate-types.log, candidate-package.log에 보존.
- 읽기 전용 실제 Opus review-41bec5dd-3ccc-4543-b668-fb782b3db25f 통과, 관측 모델 claude-opus-5-5. 원문 opus-result.md 및 후보의 review receipt 보존.
- 공식 installer 패키지 실행으로 Codex 로컬 개발본 0.2.8 설치, 종료 코드 0. 설치 경로와 등록 경로 실재, 수정 엔진 포함, version·doctor 확인. install.log 보존.
- 설치 CLI 구버전/수정본 동시 runtime 변경 비교는 installed-proof.md, installed-smoke.log에 보존. 새 상태는 NO_GROUPS이며 전 코드 BoxBox PASS로 확대하지 않는다.
- Node 22.22.3에서 타입 주석 .mts를 별도 빌드 없이 실행해 42 출력 확인. 전체 TypeScript 이관의 호환성 증거로 확대하지 않는다.

## 2026-11-12 당시 판정

작업은 verifying이다. 호스트 재시작 후 수용과 실제 소스 가독성의 미해결 범위가 남아 done으로 처리하지 않았다. 기록된 실행은 저장소 바깥 BoxBox 소스와 설치본을 대상으로 하며, WWW workflow의 docs-only 입력에 대한 AC 통과로 옮겨 쓰지 않았다. commit·push·release는 수행하지 않았다.

<a id="attempt-b62c27f6-021b-46e1-a074-e81ee137b974"></a>
## 검증 시도 — 2026-11-15T09:29:20.130Z

- 시도 ID: `attempt-b62c27f6-021b-46e1-a074-e81ee137b974`
- 실행 시각: 2026-11-15T09:28:58.787Z ~ 2026-11-15T09:29:20.130Z
- 명령과 인자: `["/opt/homebrew/Cellar/python@3.14/3.14.2_1/Frameworks/Python.framework/Versions/3.14/bin/python3.14","-c","import json,pathlib,tempfile,subprocess,os,threading,time,hashlib,shutil\nroot=pathlib.Path.cwd()\nout=root/'.www/closeout-hook-legacy-20261115'\nout.mkdir(parents=True,exist_ok=True)\nnode='/opt/homebrew/Cellar/node@22/22.22.3/bin/node'\nlauncher='/Users/jonghoPro/.local/share/boxbox/codex/0.2.8/plugin/scripts/boxbox.mjs'\nruntime=json.loads(pathlib.Path(launcher).parent.parent.joinpath('runtime.json').read_text())\ncli=pathlib.Path(runtime['cli'])\ncli_hash=hashlib.sha256(cli.read_bytes()).hexdigest()\nassert cli_hash=='3ea6e779c0f1b2442d8d5286a6bdf254db820d4c7a2ff417d0eb31d5639716db'\ncmd=[node,launcher]\nbefore_mode=subprocess.run(cmd+['mode','--json'],capture_output=True,text=True,check=True)\nassert json.loads(before_mode.stdout)['mode']=='off'\nbase=pathlib.Path(tempfile.mkdtemp(prefix='www-boxbox-closeout-'))\nrecords=[]\ntry:\n for case in ['ignored_runtime','visible_source','unsupported_language']:\n  work=base/case;work.mkdir()\n  data=base/(case+'-data');data.mkdir()\n  subprocess.run(['git','init','-q',str(work)],check=True)\n  (work/'.gitignore').write_text('.www/\\n.gjc/\\n')\n  (work/'.www').mkdir()\n  (work/'sample.py').write_text('value = 1\\n')\n  env={**os.environ,'BOXBOX_MODE':'check','PLUGIN_DATA':str(data)}\n  payload={'session_id':'workflow007-'+case,'cwd':str(work),'tool_name':'Bash'}\n  def hook(mode):\n   return subprocess.run(cmd+['hook',mode,'--root',str(work)],cwd=work,input=json.dumps(payload),capture_output=True,text=True,env=env,timeout=60)\n  start=hook('session')\n  assert start.returncode==0 and 'hook error' not in start.stdout+start.stderr\n  (work/'sample.py').write_text('value = 2\\n')\n  if case=='unsupported_language':(work/'legacy.mjs').write_text('export const value = 1;\\n')\n  stop=threading.Event();count=[0]\n  def mutate():\n   while not stop.is_set():\n    count[0]+=1\n    if case=='visible_source':\n     temporary=work/'.sample.tmp'\n     temporary.write_text('value = 2\\n# revision '+str(count[0])+'\\n'+('# source comment\\n'*10000))\n     temporary.replace(work/'sample.py')\n    else:\n     (work/'.www'/'runtime.json').write_text(str(count[0]))\n     transition=work/'.www'/'lock.transition'\n     transition.mkdir(exist_ok=True)\n     transition.rmdir()\n    time.sleep(.002)\n  thread=threading.Thread(target=mutate)\n  if case!='unsupported_language':thread.start()\n  try:post=hook('post')\n  finally:\n   stop.set()\n   if thread.is_alive():thread.join()\n  receipts=[json.loads(p.read_text()) for p in data.rglob('*.json') if p.name!='baseline.json']\n  observed={'case':case,'writes':count[0],'sessionExit':start.returncode,'postExit':post.returncode,'stdout':post.stdout,'stderr':post.stderr,'receipts':receipts}\n  if case=='ignored_runtime':\n   assert count[0]>0 and 'hook error' not in post.stdout+post.stderr\n   assert len(receipts)==1 and receipts[0]['files']==['sample.py']\n   assert receipts[0]['automaticFixPerformed']==False\n  elif case=='visible_source':\n   assert count[0]>0 and 'Source changed during check' in post.stdout+post.stderr\n   assert not receipts\n  else:\n   assert len(receipts)==1 and 'legacy.mjs' in receipts[0]['unsupported']\n   assert receipts[0]['state']=='UNSUPPORTED'\n  records.append(observed)\n check=subprocess.run(cmd+['check','--source','--file','src/main.ts','--json'],cwd=root,capture_output=True,text=True,timeout=90)\n parsed=json.loads(check.stdout)\n assert parsed['results'][0]['file']=='src/main.ts'\n assert parsed['results'][0]['language']=='typescript'\n assert parsed['results'][0]['summary']['misaligned']>0\n assert check.returncode==1\n policy=json.loads((root/'source-policy.json').read_text())\n after_mode=subprocess.run(cmd+['mode','--json'],capture_output=True,text=True,check=True)\n assert before_mode.stdout==after_mode.stdout\n result={'result':'passed','executor':'actual-installed-cli-isolated-fixtures','cliSha256':cli_hash,'launcher':launcher,'runtimeNode':runtime['node'],'projectMode':json.loads(after_mode.stdout),'cases':records,'sourceCheck':{'exitCode':check.returncode,'summary':parsed['results'][0]['summary'],'syntax':parsed.get('syntax'),'formatReadiness':parsed.get('formatReadiness'),'basis':parsed.get('basis')},'legacyJavaScript':policy.get('legacyJavaScript'),'limitations':['NO_GROUPS is fixture-only coverage, not repository style PASS.','The user project remains off. Only isolated subprocesses force check mode.','Source changed during check is expected and required in visible source negative control.','This CLI fixture does not prove host event acceptance.']}\n (out/'installed-current.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))\n print(json.dumps({k:v for k,v in result.items() if k not in ['cases']},ensure_ascii=False))\nfinally:shutil.rmtree(base)\n"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `.boxbox`, `docs/DEVELOPMENT.md`, `source-policy.json`, `src/main.ts`
- 소스 식별: `07d1bcefe0e269eeca9cd5d04c33c69ccea0e38b075fce7132106b44a1025196`
- 기준 정의 식별: `4c45b69ae8c65e97c44fc57b402565aa9f7804dd241b1ede45aea25044f9993d`
- 검증 중 소스 유지: 확인
- 출력: stdout 4622바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

## 2026-11-15 검증 마감 재개와 권한 근거

사용자의 이번 직접 요청은 “검증마감항목을 지금 진행”하고 Hook 오류의 원인을 찾아 해결하는 것이다. 원래 요청 식별값과 구현·커밋·게시 권한을 보존하고, 이 후속 요청이 허용한 실제 설치본의 읽기 검사·격리 fixture 실행과 이미 관찰된 호스트 수명주기 대조 명령만 verifierCommands에 추가했다. execute 표면도 이 검증 명령의 실행을 위해 추가했으며 commit·publish는 false를 유지한다. 전역 설정·제품 코드는 이 작업에서 수정하지 않았다.

원래 docs-only 입력으로는 현행 main.ts의 가독성 관측과 언어 정책을 식별하지 못하므로 검사 입력에 src/main.ts, source-policy.json, .boxbox를 추가했다. 외부 설치 엔진은 실제 SHA-256 3ea6e779c0f1b2442d8d5286a6bdf254db820d4c7a2ff417d0eb31d5639716db를 검사 실행마다 대조한다. 외부 설치·호스트 증거는 WWW 제품 코드 자체의 테스트로 바꾸지 않는다.

### 관찰과 범위

- 실제 설치 0.2.8을 격리 Git fixture에서 실행한다. subprocess에만 BOXBOX_MODE=check와 별도 PLUGIN_DATA를 주고, WWW project mode는 실행 전후 off 그대로인지 확인한다. 전역·프로젝트 mode를 쓰지 않는다.
- ignored .www runtime과 생성·삭제되는 lock.transition이 연속 변경되어도 검사 대상은 visible sample.py 하나다. NO_GROUPS는 이 작은 fixture에만 적용된다.
- 대조군으로 visible sample.py를 검사 중 연속 변경하면 Source changed during check를 실제로 거부한다. 이 거부는 예상한 안전 동작이며 성공처럼 숨기지 않는다.
- legacy.mjs가 생긴 별도 fixture는 UNSUPPORTED로 관측된다. 현재 WWW source-policy의 legacyJavaScript는 빈 목록이며 .mjs 지원 확대나 승인 없는 언어 변경을 수행하지 않았다.
- 현행 src/main.ts의 명시적 source check는 구문 valid, groups 35, misaligned 26, refused 0, exit 1이다. off는 스타일 PASS가 아니며 이 결과를 저장소 전체 가독성 완료로 승격하지 않는다. AC-1은 이 미해결 범위와 런타임 경합을 구분하는 진단 기준이다.
- 이번 별도 Workflow013에서 플러그인 내용 신뢰가 복구된 뒤, 실제 새 Native 읽기 전용 세션은 BoxBox SessionStart·PostToolUse·Stop을 모두 plugin/completed로 수용했다. SessionStart는 Mode off context를 반환했다. 증거는 .www/hook-trust-20261115/post-tool-lifecycle.json과 hooks-after.json이며, 모든 조건부 Vercel 훅 또는 엔진 가독성 검사가 실행됐다는 뜻은 아니다.

### 과거 기록과의 관계

2026-11-12의 구버전/수정후 비교, 설치 후보 빌드·Opus 기록은 당시 이력으로 보존한다. 이번 검사는 현재 실제 설치 엔진의 동작을 새로 실행하며, 과거 candidate tarball과 현재 설치본이 동일하다고 가정하지 않는다. 과거 48 FIXABLE·17 REFUSE는 당시 관측이고 이번 main.ts 결과로 덮어쓰지 않는다. 미해결 전체 정렬·전체 언어 호환성·Windows 검사는 본 진단의 완료로 주장하지 않는다.

<a id="attempt-6a34d71f-9006-4db4-a542-48c7cd86296b"></a>
## 검증 시도 — 2026-11-15T09:29:23.792Z

- 시도 ID: `attempt-6a34d71f-9006-4db4-a542-48c7cd86296b`
- 실행 시각: 2026-11-15T09:29:23.292Z ~ 2026-11-15T09:29:23.792Z
- 명령과 인자: `["/opt/homebrew/Cellar/python@3.14/3.14.2_1/Frameworks/Python.framework/Versions/3.14/bin/python3.14","-c","import json,pathlib\nbase=pathlib.Path('.www/hook-trust-20261115')\np=json.loads((base/'post-tool-lifecycle.json').read_text())\nassert p['completed'] and p['failed'] is None and p['bypass'] is False\nbox=[r for r in p['runs'] if 'boxbox-plugins/boxbox/0.2.8/' in r['sourcePath']]\nassert {r['eventName'] for r in box}=={'sessionStart','postToolUse','stop'}\nassert all(r['source']=='plugin' and r['status']=='completed' for r in box)\nassert any('Mode off' in e['text'] for r in box for e in r['entries'])\nh=json.loads((base/'hooks-after.json').read_text())['data'][0]['hooks']\nassert len(h)==8 and all(x['enabled'] and x['trustStatus']=='trusted' for x in h)\ni=json.loads((base/'plugin-integrity.json').read_text())\nassert i['boxboxCacheVsInstallerDifferences']==[]\nprint('실제 설치 BoxBox SessionStart·PostToolUse·Stop 호스트 수용 및 mode off 관측. 엔진 스타일 PASS나 모든 조건부 훅 실행으로 확대하지 않음.')\n"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-3`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `.boxbox`, `docs/DEVELOPMENT.md`, `source-policy.json`, `src/main.ts`
- 소스 식별: `07d1bcefe0e269eeca9cd5d04c33c69ccea0e38b075fce7132106b44a1025196`
- 기준 정의 식별: `4c45b69ae8c65e97c44fc57b402565aa9f7804dd241b1ede45aea25044f9993d`
- 검증 중 소스 유지: 확인
- 검증 의존 원문: `.www/hook-trust-20261115/hooks-after.json` (8357바이트, sha256 f06398b7ffe83ea52bb74e063a14fa0fb6ec71ab30defb2119df249675e1a6b2), `.www/hook-trust-20261115/plugin-integrity.json` (135바이트, sha256 3ec683f7a9134fa271ae9163afbfa66bf0e8fa6ea39d44f1950575160a8e0602), `.www/hook-trust-20261115/post-tool-lifecycle.json` (1917바이트, sha256 7b6e81772ed8e1c734735e19d72b485dd468a6cbd86ca8b75c5d8a510646ee20)
- 검증 중 원문 유지: 확인
- 출력: stdout 171바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
