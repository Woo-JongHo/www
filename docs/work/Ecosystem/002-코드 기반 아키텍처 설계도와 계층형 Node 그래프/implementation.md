# 구현 실행과 부모 인계

작업 UUID는 `work-9727de0a-072d-47d9-874c-cf79b3de8526`다. 기존 접수와 허용 경로를 재사용했다. main 브랜치의 기존 Chat 활동 사이드바 변경을 보존했으며 commit·push·게시와 done 판정을 하지 않았다.

## 반영한 동작

- TypeScript compiler API로 src와 workflow 핵심 모듈을 분석한다. 파일 해시·행 범위, 각 참조의 구문 종류·타입/값 구분·시작/끝 행·원문을 결정적인 JSON에 저장한다. 해석 실패는 생성과 빌드 실패로 전달한다.
- 계층 개요에서 묶은 방향 연결과 책임·포함 모듈을 읽는다. 모듈 상세에서는 선택 모듈의 직접 참조만 직각 경로로 표시하고 타입 전용 간선을 점선으로 구분한다. 검색·계층 필터·빈 결과·초기화·배율·전체 보기·배경 드래그·키보드와 좁은 창의 세로 배치를 구현했다.
- 기존 생태계 안내는 별도 보기로 유지했다. renderer 변경은 기존 probe에서 기본 설계도를 확인한 뒤 안내 탭을 여는 대응이다. Chat DOM·상태 소유권과 IPC 권한은 확장하지 않았다.
- 코드 설계도 문서와 제품·아키텍처·개발·생태계 정본을 갱신했다. 자동 추출 범위와 수동 의미 설명, 실행 tracing과의 차이를 표시했다.

## 파일 책임

| 파일 | 책임 |
|---|---|
| `scripts/generate-architecture.ts` | AST 분석·모듈 해석·결정적 생성·현재성 대조 |
| `src/architecture.ts`, `src/architecture.generated.json` | 순수 탐색·그룹 집계·배치와 생성 자료 |
| `src/ecosystem-view.tsx`, `src/ecosystem.css` | 코드 설계도·생태계 안내와 근거 상세·접근성 |
| `build.ts`, `src/index.html` | 빌드 전 생성과 스타일 배포 |
| `src/renderer.tsx`, `scripts/verify-ecosystem.ts` | 기존 화면 전환·대화 보존 검사 연결 |
| `scripts/verify-architecture.ts`, `test/architecture.test.ts` | 실제 Electron 검사 경로와 AST·결정성·탐색·경로 집중 검사 |
| `docs/CODE_BLUEPRINT.md`, 관련 정본 | 사용자가 읽을 코드 구조와 추출·검사 경계 |

## 실제 실행 결과

| 실행 | 관찰 | 적용 한계 |
|---|---|---|
| `node scripts/generate-architecture.ts`와 `--check` | 현재 소스와 생성 JSON 일치, 47개 모듈·105개 참조 | 범위 밖 파일·외부 패키지·동적 실행은 분석하지 않음 |
| `bun test test/architecture.test.ts test/ecosystem.test.ts` | 최종 변경 후 7개 통과 | 합성 AST fixture와 실제 저장소 모델 검사, GUI 아님 |
| `npm run typecheck` | 최종 변경 후 두 strict 프로젝트 통과 | 외부 선언은 기존 skipLibCheck 유지 |
| `npm run build` | 최종 변경 후 Electron main/preload/renderer 번들·스타일 배포 성공 | 실제 호스트 표시 확인과 별개 |
| `npm run check` | 소스 정책·작업 기록·타입·Bun 219개·Node 147개·빌드 통과 | 이후 레이블 경로 축약·화면 검사 보강은 집중 검사·타입·빌드로 재확인했으며 전체 결과를 현행 작업 판정에 등록하지 않음 |
| `git diff --check` | 공백 오류 없음 | 구조·동작 검증 아님 |
| 변경한 실행 파일의 TODO·stub·test.skip/.only 직접 검색 | 해당 항목 없음 | 테스트의 음성 fixture는 실제 분석 경계 검증이며 미구현 분기가 아님 |

최종 생성 자료의 코드 digest는 `cac787c0087f`로 시작한다. 이것은 코드 분석 입력의 식별이며 CSS·검증 도구·문서 전체의 증거 지문을 대신하지 않는다. 부모는 검증 직전에 공식 source capture로 최종 입력을 다시 식별해야 한다.

전체 검사 원문: `.www/evidence/work-9727de0a-072d-47d9-874c-cf79b3de8526/repository-check.log`. 자식 런타임은 Node 22.23.1, Bun 1.4.0으로 관측했다.

## 실행하지 못한 실제 화면 검사

`node scripts/verify-architecture.ts`는 snapshot 대조 후 `listen EPERM: operation not permitted 127.0.0.1`로 중단됐다. 해당 환경에서 CDP 포트를 열지 못했으며 어떤 GUI 시나리오도 통과한 것으로 쓰지 않는다. 원문은 `.www/evidence/architecture-Rfn8fC/result.json`이다. 이 시도의 코드 digest는 당시 값으로 보존한다.

`node scripts/verify-ecosystem.ts`는 타입·모델·빌드 후 Electron이 SIGABRT로 종료됐다. 원문은 `.www/evidence/ecosystem-dsIFtq/failure.txt`와 같은 폴더의 로그다. Electron 종료만으로 제품 오류의 원인을 확정하지 않는다.

`node scripts/verify-chat.ts`도 루프백 포트의 EPERM으로 종료됐다. 원문은 `.www/evidence/work-9727de0a-072d-47d9-874c-cf79b3de8526/chat-attempt.log`다. 이 자식에서는 실제 Electron 화면 캡처·초안과 읽기 상태 보존·키보드와 포인터·좁은 화면을 확인하지 못했다.

새 화면 검사 스크립트는 현재 snapshot과 **실제 번들이 표시한 digest 일치**를 확인한 뒤 기본 계층, 방향키·Space·Tab·Enter, 검색·필터·빈 결과, 원문 근거, 타입 간선, 배율·전체 보기·실제 포인터 드래그, 레이블 폭, 좁은 화면의 상세 접근과 보조 안내를 검사한다. 성공 시 `overview-desktop.png`, `module-desktop.png`, `module-narrow.png`, `detail-narrow.png`와 result.json을 해당 evidence 폴더에 남긴다. 아직 성공 산출물은 없다.

## BoxBox 미해결

모든 변경 TypeScript의 구문은 valid다. 원문과 요약은 위 work-ID evidence 폴더의 `post-boxbox-*.json`, `boxbox-summary.json`이다.

| 파일 | misaligned | REFUSE |
|---|---:|---:|
| build.ts | 0 | 0 |
| src/architecture.ts | 6 | 0 |
| src/ecosystem-view.tsx | 0 | 4 |
| src/renderer.tsx | 0 | 20 |
| scripts/generate-architecture.ts | 8 | 0 |
| scripts/verify-architecture.ts | 6 | 0 |
| scripts/verify-ecosystem.ts | 0 | 0 |
| test/architecture.test.ts | 2 | 0 |

renderer의 REFUSE 20개는 전달받은 사전 관찰에도 있었다. 나머지 새 미해결은 이번 구현에 속한다. 제공된 guide는 해당 Block·type-alias·object-rows·call-statements의 자동 정렬 규약을 승인하지 않았고 TSX guide는 ok:false였다. 개발 안내의 “승인되지 않은 형태를 수동 공백 정렬·format·align으로 우회하지 않는다”를 따라 formatter·align·수동 열 맞춤으로 숨기지 않았다. 이 결과는 하네스 통과가 아니며 부모가 구조적 간결화 또는 정본 규약에 따른 처리 후 사후 검사를 이어야 한다.

## 백그라운드 관찰과 부모의 다음 행동

현재 호스트 이름은 `ujonghoui-Macmini-2.local`, TMUX 환경값은 `/private/tmp/tmux-501/default,107,0`이다. AC 전원 설정에서 시스템 sleep 0을 읽었다. `.www/background/architecture/run.sh`에는 caffeinate와 공식 typed workflow 호출·build.log·결과·종료 코드 기록이 있다. `.www/runtime/<work-id>/session.json`과 events.jsonl에는 부모가 기록한 running 사건이 있다.

자식 샌드박스에서는 ps와 tmux 소켓 조회가 Operation not permitted였다. 따라서 다른 터미널의 실제 PID·세션 생존 확인이나 노트북 덮개 동작을 검증했다고 주장하지 않는다. 백그라운드 프로세스 종료 영수증도 부모 실행 종료 뒤 연결해야 한다.

부모는 같은 UUID에서 BoxBox 미해결을 해결하고 사후 하네스 결과를 기록한 뒤 허용된 데스크톱 환경에서 `npm run build`, `node scripts/verify-architecture.ts`, `node scripts/verify-ecosystem.ts`, `node scripts/verify-chat.ts`를 실행한다. 생성된 PNG를 직접 검토하고 실패하면 같은 범위로 수정한다. 이어 실제 검증 시도를 현재 소스·기준에 연결하고 정본 문서 영향 검토·정책의 읽기 전용 독립 검토·저작 보고서를 연결한다. AC 결과와 완료 판단은 이 자식이 올리지 않았다.
