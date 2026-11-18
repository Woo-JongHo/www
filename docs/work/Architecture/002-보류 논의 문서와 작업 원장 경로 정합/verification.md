# 검증 기록

<a id="attempt-526424c9-4339-4786-ad22-76d3c034a82a"></a>
## 검증 시도 — 2026-11-16T22:49:41.125Z

- 시도 ID: `attempt-526424c9-4339-4786-ad22-76d3c034a82a`
- 실행 시각: 2026-11-16T22:49:41.045Z ~ 2026-11-16T22:49:41.125Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","--input-type=module","-e","import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';const p=\"docs/architecture/discussions/central-storage-local-execution.md\";assert.equal(createHash('sha256').update(fs.readFileSync(p)).digest('hex'),\"71785f2a1fe3142a16f03a36b61cbf05b51074cf575648ac5eaca426d23ab3b7\");assert(!fs.existsSync(\"docs/work/Architecture/001-중앙 저장과 로컬 실행/discussion.md\"));assert(!fs.existsSync(\"docs/work/Architecture/001-중앙 저장과 로컬 실행\"));assert(fs.readFileSync('docs/work/INDEX.md','utf8').includes('../architecture/discussions/central-storage-local-execution.md'));assert(fs.readFileSync(p,'utf8').includes('중앙화 개발 보류'));console.log('DOC-BYTES/DOC-FIND: 원문 SHA·보류 결정·목차 링크·잘못된 작업 디렉터리 제거 확인');"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `DOC-BYTES`, `DOC-FIND`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/architecture/discussions/central-storage-local-execution.md`, `docs/skills/WORKFLOW.md`, `docs/work/Architecture/001-중앙 저장과 로컬 실행/discussion.md`, `docs/work/Architecture/002-보류 논의 문서와 작업 원장 경로 정합/spec.md`, `docs/work/INDEX.md`
- 소스 식별: `5342eab895ec36699a59b3146e7a04b52c32e641efe33b416fda5f9ea1e87e8b`
- 기준 정의 식별: `f068a5a2412b8551dd03068c24a1d1b66c2dc080131619bed1aef58664ea34ed`
- 검증 중 소스 유지: 확인
- 출력: stdout 106바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-cde3a7b7-39dc-4e7a-873f-e5f96748142b"></a>
## 검증 시도 — 2026-11-16T22:49:42.020Z

- 시도 ID: `attempt-cde3a7b7-39dc-4e7a-873f-e5f96748142b`
- 실행 시각: 2026-11-16T22:49:41.184Z ~ 2026-11-16T22:49:42.020Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/check-workflow.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `DOC-CONTRACT`
- 소스 HEAD: `a720468172a0ea64cb3b4a8e1de36289144df98d`
- 검증 입력: `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT.md`, `docs/PRODUCT.md`, `docs/architecture/discussions/central-storage-local-execution.md`, `docs/skills/WORKFLOW.md`, `docs/work/Architecture/001-중앙 저장과 로컬 실행/discussion.md`, `docs/work/Architecture/002-보류 논의 문서와 작업 원장 경로 정합/spec.md`, `docs/work/INDEX.md`
- 소스 식별: `5342eab895ec36699a59b3146e7a04b52c32e641efe33b416fda5f9ea1e87e8b`
- 기준 정의 식별: `f068a5a2412b8551dd03068c24a1d1b66c2dc080131619bed1aef58664ea34ed`
- 검증 중 소스 유지: 확인
- 출력: stdout 96바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

