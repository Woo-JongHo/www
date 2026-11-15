# 검증 기록 보충

## 범위와 관찰

이번 요청은 기존 게시 이력을 유지하고 앞으로 사용할 커밋 절차를 보완하는 작업이다. 실행 코드·Git hook·전역 Git 설정은 변경하지 않았다. HEAD와 index도 변경하지 않았다.

- `skill-creator/scripts/quick_validate.py skills/www/www-commit`: 형식 검사 통과.
- `node scripts/check-workflow.ts`: 스킬·작업 기록·목차·템플릿 계약 검사 통과. 실행 시도 원장은 work.json에 보존한다.
- `git diff --check`: 공백 검사 통과.
- 전역 woo.yaml의 workspace_root를 확장한 실제 경로가 현재 WWW 루트와 일치함을 확인했다. 발견용 `.agents/skills/www-commit` 링크가 수정한 정본 스킬 디렉터리를 가리킴을 확인했다.

## 절차 대조

다음은 문서의 판단 규칙을 수동으로 대조한 결과이며 실제 Git 실행이나 독립 모델 평가가 아니다.

| 요청·상황 | 반영한 판단 |
|---|---|
| 전체 변경에 기능·이관·번역이 섞임 | 포함 범위 승인은 승계하되 독립 목적별 후보를 먼저 구성하고 순서대로 실행 |
| 한 기능의 UI·인터페이스·테스트·설명 | 기능을 성립시키는 변경은 함께 둘 수 있음 |
| 공통 기반을 사용하는 후속 기능 | 기반 후보를 먼저 검증·커밋하고 뒤 후보의 미커밋 변경에 의존하지 않음 |
| 같은 파일에 목적이 섞임 | 검토한 hunk를 분리하거나 불가분인 이유·의존 관계를 기록 |
| 기존 staged 변경 또는 동시 index writer | 기존 index를 임의 해제하거나 다른 후보를 섞지 않고 실행 중단 |
| 이미 푸시한 이력을 유지하며 환경만 보완 | 이력 재작성·stage·commit·push 실행 없이 지침 수정 |

## 머신 전역 반영과 한계

머신 전역 파일은 Git 저장소 밖에 있으며 이 저장소 검사만으로 검증한 것으로 간주하지 않는다. 경로·내용을 별도로 확인한 지문은 다음과 같다.

- `~/.codex/AGENTS.md`: `02c6320e4618dc9a5a621356c2345f11773da2eb457d8b5ea49e3d5252a49be7`
- `~/.codex/woo.yaml`: `ebba5f5aff7412106673908c459ea99f2312674e7b7783d8e8eb3d8ddc8a5bcb`

이는 에이전트가 읽어 따르는 절차이며 Git hook에 의한 자동 차단이 아니다. 새 세션에서 실제 여러 커밋을 생성하는 행동 시험과 독립 Opus 감사는 수행하지 않았다. 기존 이력은 유지하며 이번 설정 변경의 커밋·푸시 권한은 받지 않았다.


<a id="attempt-3e1c3248-30bd-494c-a88e-9686ecf0d513"></a>
## 검증 시도 — 2026-11-12T07:58:39.271Z

- 시도 ID: `attempt-3e1c3248-30bd-494c-a88e-9686ecf0d513`
- 실행 시각: 2026-11-12T07:58:39.078Z ~ 2026-11-12T07:58:39.271Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/check-workflow.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-2`, `AC-3`
- 소스 HEAD: `4ef13d29b18188642bf7f7bef6c7d1bb60bfc3c8`
- 검증 입력: `AGENTS.md`, `docs/skills/templates/commit.md`, `skills/www/www-commit/SKILL.md`
- 소스 식별: `4681d3f62e0cf53c32c3d5240864d5c7b6f8ec128ca991c6c7197f161decfa0b`
- 기준 정의 식별: `7e8d8023b5bcfd9ada3a5d1b266ee1130c2d3c9e25e3d4ac08a599930ce0e51b`
- 검증 중 소스 유지: 확인
- 출력: stdout 96바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

## 2026-11-15 검증 마감 재개

현재 사용자의 “검증마감항목을 지금 진행” 직접 요청에 따라 읽기 전용 포인터·정본 연결·후보 분리 기준 대조 명령을 기존 verifierCommands에 추가했다. 원래 요청 식별과 권한·과거 시도는 보존했다. ~/.codex/woo.yaml의 workspace_root를 realpath로 현재 저장소와 비교하고 전역 지침·정본 스킬·양식에서 목적, 검증, 의존 순서, 공유 변경 예외, 승인 승계와 이력 재작성 경계를 확인한다. 외부 두 파일은 실행 당시 SHA-256으로 관찰하며 저장소 digest에 포함되지 않는 외부 전제라는 한계가 있다. 이번 재개는 commit·push·이력 재작성을 실행하지 않는다.

<a id="attempt-4423e906-648f-4f15-ba21-37b85a6dd1ea"></a>
## 검증 시도 — 2026-11-15T09:26:03.032Z

- 시도 ID: `attempt-4423e906-648f-4f15-ba21-37b85a6dd1ea`
- 실행 시각: 2026-11-15T09:26:02.948Z ~ 2026-11-15T09:26:03.032Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","-e","const fs=require(\"node:fs\"),path=require(\"node:path\"),os=require(\"node:os\"),assert=require(\"node:assert/strict\"),crypto=require(\"node:crypto\"); const pointer=path.join(os.homedir(),\".codex/woo.yaml\"),global=path.join(os.homedir(),\".codex/AGENTS.md\"); const yaml=fs.readFileSync(pointer,\"utf8\"),g=fs.readFileSync(global,\"utf8\");const v=yaml.match(/^workspace_root:\\s*(.+)$/m)[1].trim().replace(/^~/,os.homedir());assert.equal(fs.realpathSync(v),fs.realpathSync(process.cwd()));assert(g.includes(\"skills/www/www-commit/SKILL.md\")&&g.includes(\"용도와 역할별\"));const skill=fs.readFileSync(\"skills/www/www-commit/SKILL.md\",\"utf8\"),form=fs.readFileSync(\"docs/skills/templates/commit.md\",\"utf8\"),agents=fs.readFileSync(\"AGENTS.md\",\"utf8\");for(const text of [\"독립적으로 검토·되돌릴\", \"후보마다\", \"선행\", \"한 후보의 stage·검증·commit\", \"단일 커밋 지시가 아니다\", \"안전하게 분리할 수 없는\", \"이미 승인된 범위의 실행 권한\", \"이력 재작성\"] ) assert(skill.includes(text),text); assert(form.includes(\"목적별 후보와 실행 순서\")&&form.includes(\"검증\")&&form.includes(\"선행\"));assert(agents.includes(\"용도·역할별 후보 분리\"));console.log(JSON.stringify({pointerMatches:true,canonicalLinks:true,candidateBoundaries:true,exceptionsAndApproval:true,readOnly:true,externalSha256:[pointer,global].map(p=>crypto.createHash(\"sha256\").update(fs.readFileSync(p)).digest(\"hex\"))}));"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `AC-1`, `AC-2`, `AC-3`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `AGENTS.md`, `docs/skills/templates/commit.md`, `skills/www/www-commit/SKILL.md`
- 소스 식별: `4681d3f62e0cf53c32c3d5240864d5c7b6f8ec128ca991c6c7197f161decfa0b`
- 기준 정의 식별: `7e8d8023b5bcfd9ada3a5d1b266ee1130c2d3c9e25e3d4ac08a599930ce0e51b`
- 검증 중 소스 유지: 확인
- 출력: stdout 271바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
