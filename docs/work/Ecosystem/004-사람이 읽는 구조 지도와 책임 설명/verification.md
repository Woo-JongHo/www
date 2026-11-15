# 검증 기록

<a id="attempt-1b1c1c88-3826-41e8-8487-055bdb408ba1"></a>
## 검증 시도 — 2026-11-15T09:29:00.241Z

- 시도 ID: `attempt-1b1c1c88-3826-41e8-8487-055bdb408ba1`
- 실행 시각: 2026-11-15T09:27:13.205Z ~ 2026-11-15T09:29:00.241Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/architecture-harness.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 실패; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `0c732762a3e97f22d850a90e52e197d44c106aa37b0db720a8884b721004f5f2`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 변경 감지
- 출력: stdout 28바이트, stderr 38929바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-e8199d78-5482-4d05-a065-3393514dd24d"></a>
## 검증 시도 — 2026-11-15T09:29:02.364Z

- 시도 ID: `attempt-e8199d78-5482-4d05-a065-3393514dd24d`
- 실행 시각: 2026-11-15T09:28:42.302Z ~ 2026-11-15T09:29:02.364Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-FLOW`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f1fd91f4d0b41fdf806e41dfae888a9265f6b9687ebc0be87055339b34c1a050`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 3806바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-413bd27d-f5b0-44b9-8448-ed32a0891986"></a>
## 검증 시도 — 2026-11-15T09:29:25.460Z

- 시도 ID: `attempt-413bd27d-f5b0-44b9-8448-ed32a0891986`
- 실행 시각: 2026-11-15T09:28:49.748Z ~ 2026-11-15T09:29:25.460Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-FLOW`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f1fd91f4d0b41fdf806e41dfae888a9265f6b9687ebc0be87055339b34c1a050`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 1253바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-c6979fc2-7556-49fa-b149-623b0ecafa6e"></a>
## 검증 시도 — 2026-11-15T09:31:03.195Z

- 시도 ID: `attempt-c6979fc2-7556-49fa-b149-623b0ecafa6e`
- 실행 시각: 2026-11-15T09:29:34.743Z ~ 2026-11-15T09:31:03.195Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/architecture-harness.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 실패; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `f1fd91f4d0b41fdf806e41dfae888a9265f6b9687ebc0be87055339b34c1a050`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 변경 감지
- 출력: stdout 28바이트, stderr 38898바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-dcce07a3-0e0e-4443-a381-5d3dbf7d2607"></a>
## 검증 시도 — 2026-11-15T09:31:13.929Z

- 시도 ID: `attempt-dcce07a3-0e0e-4443-a381-5d3dbf7d2607`
- 실행 시각: 2026-11-15T09:30:57.187Z ~ 2026-11-15T09:31:13.929Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `1ecfa2244f02604340461e8096fe9fef1a4790a4de47438aeef4e89fc5137922`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37662바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-da38cf90-f5d2-4c99-a4ed-63a85964b2c6"></a>
## 검증 시도 — 2026-11-15T09:31:17.129Z

- 시도 ID: `attempt-da38cf90-f5d2-4c99-a4ed-63a85964b2c6`
- 실행 시각: 2026-11-15T09:30:57.635Z ~ 2026-11-15T09:31:17.129Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-FLOW`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `1ecfa2244f02604340461e8096fe9fef1a4790a4de47438aeef4e89fc5137922`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 3860바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 사람이 확인한 변경과 검사 범위

최종 집중 검사 attempt-dcce07a3-0e0e-4443-a381-5d3dbf7d2607과 실제 Electron 검사 attempt-da38cf90-f5d2-4c99-a4ed-63a85964b2c6은 소스·환경이 안정된 상태에서 통과했다. 전자는 계층/집계/포트/비관통/요약·구조 계약·snapshot·개념 모델을, 후자는 실제 DOM·CDP 키보드/포인터와 캡처를 검사했다. GUI 원문과 캡처는 `.www/evidence/architecture-VBxr7w/result.json`, `root.png`, `intermediate.png`, `references-focused.png`, `narrow-860.png`, `narrow-760.png` 등이다. root에서 여섯 책임을 동일 규격 세 열로 읽는 것과 대화 세션의 역할·세 구성·담당 파일을 캡처로 직접 확인했다.

`npm run typecheck`, `npm run check:source`, `npm run build`도 실행해 통과했다. 원문은 `.www/node-map-typecheck.log`, `.www/node-map-source.log`, `.www/node-map-build.log`에 보존했다. BoxBox 공식 설치 런처에서 project mode off를 사전·사후 관측했다. guide/source check 및 align을 수행한 것으로 쓰지 않는다. snapshot은 공식 generator와 pinned canonical CLI로 생성됐으며 직접 편집하지 않았다. 이 세션의 직접 Codex 저작·검사이며 별도 typed subprocess 호스트의 context 수용을 새로 검증한 것은 아니다.

첫 5초 기본 예산의 실도구 fixture가 병행 검사 중 시간 초과했다. 해당 원문은 `.www/node-map-tests.log`에 보존했다. 60초 예산의 후속 두 시도는 프로세스 종료 0이었지만 검사 도중 GUI probe/배치가 수정되어 sourceStable false로 거부됐다. 과거 통과로 승격하지 않고 최종 안정 소스에서 집중 검사와 GUI를 다시 통과시켰다. 첫 ecosystem 통합 시도는 같은 5초 실도구 fixture에서 실패했으며 `.www/evidence/ecosystem-HNl0Dx/failure.txt`에 보존했다. 이 통합 명령은 이후 별도로 다시 실행한다.

새 TODO·미구현 분기·test.skip/only가 없는지 변경 소스를 검색했다. HTML input의 정상 placeholder 속성은 미구현 자리표시가 아니다. 변경한 지도 소스·정본·집중 테스트의 diff whitespace 검사도 통과했다. 다른 세션이 변경한 과거 Chat/Workflow 검증 문서의 EOF 빈 줄은 본 작업이 수정하지 않는다.

실제 GUI는 Electron에 합성 Native fixture를 연결했다. 실제 모델·계정·Windows 실기·OS 한국어 IME를 새로 검증하지 않았다. 지도는 정적 import와 정본 책임 설명이며 데이터 전달·함수 호출·현재 실행 추적을 입증하지 않는다. 다른 세션의 작업·검증·스테이징 변경을 보존했으며 commit·push를 수행하지 않았다.

<a id="attempt-0901e93e-3f69-4eb1-867d-c68d2f87e564"></a>
## 검증 시도 — 2026-11-15T09:32:22.861Z

- 시도 ID: `attempt-0901e93e-3f69-4eb1-867d-c68d2f87e564`
- 실행 시각: 2026-11-15T09:31:51.279Z ~ 2026-11-15T09:32:22.861Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-FLOW`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `1ecfa2244f02604340461e8096fe9fef1a4790a4de47438aeef4e89fc5137922`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 최종 통합과 독립 검토

최종 ecosystem 통합 attempt-0901e93e-3f69-4eb1-867d-c68d2f87e564도 sourceStable true, 종료 0, passed다. 실제 Electron의 지도 전환·키보드 선택·근거 검색·초안과 읽기 위치 보존 및 기존 승인/중단 흐름을 합성 Native로 확인했다. 초기 5초 실도구 시간 초과는 후속 통과로 삭제하지 않았다.

공유 검토 core가 읽기 전용 Opus를 실행했다. 요청 모델 opus, 관측 모델 claude-opus-5-5, 판정 pass, 대체 없음이다. 검토 ID는 review-a8b4b090-3ef3-4911-9cf8-1cb86572e8fa이며 원문 영수증은 `.www/evidence/reviews/review-a8b4b090-3ef3-4911-9cf8-1cb86572e8fa/opus.json`이다. 전문은 원문에 보존하고 저자는 다음 비차단 범위를 수용한다.

- 과거 evidence summary의 '현재 적용 가능'은 기록 당시 표현이다. attempt-e8199d78은 배치/검사 수정 전 소스이므로 최종 근거로 사용하지 않는다. 현재 적용성은 공유 status의 판정을 따르며 최종 GUI da38cf90·집중 검사 dcce07a3·통합 0901e93e가 유효하다.
- 구성 보기의 간선 배열은 비어 있으므로 그 시점의 비관통 검사는 보조 관찰이다. 실제 간선이 표시된 의존 보기의 별도 검사와 고밀도 단위 검사로 MAP-READ를 검증한다. 양방향 경로의 독립성은 모든 노드 쌍 단위 검사도 받친다.
- 현재 정본의 제목은 360px 노드 안에 들어간다. 제목 자체의 자동 줄바꿈은 추가하지 않았고 향후 더 긴 제목의 모든 단계 bbox를 보장했다고 쓰지 않는다. 역할 설명은 두 줄 요약과 상세 원문을 제공한다.
- typecheck/source/build의 실제 실행 로그와 work.json의 기능 기준 증거 연결은 구분한다. 앞선 명령의 성공을 단독 GUI 동작 증거로 사용하지 않는다.

최종 소스 정책 로그는 `.www/node-map-final-source.log`다. 변경한 파일의 미구현·skip/only 및 whitespace 검사 범위는 위와 같다. 다른 세션의 변경을 수정하거나 커밋하지 않았다.

<a id="attempt-f014edb7-a456-419c-9305-f5762d5d59d2"></a>
## 검증 시도 — 2026-11-15T09:36:39.159Z

- 시도 ID: `attempt-f014edb7-a456-419c-9305-f5762d5d59d2`
- 실행 시각: 2026-11-15T09:36:26.156Z ~ 2026-11-15T09:36:39.159Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `283e2f45df1dae04ca83b37468c61317550d36c375e413f5ac9af02976bb3caf`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37629바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-a3b4f6fe-dc19-4f5d-9bd5-97196dab957f"></a>
## 검증 시도 — 2026-11-15T09:36:43.049Z

- 시도 ID: `attempt-a3b4f6fe-dc19-4f5d-9bd5-97196dab957f`
- 실행 시각: 2026-11-15T09:36:26.912Z ~ 2026-11-15T09:36:43.049Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-DETAIL`, `MAP-FLOW`, `MAP-NODE`, `MAP-READ`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `283e2f45df1dae04ca83b37468c61317550d36c375e413f5ac9af02976bb3caf`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 3860바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 동시 작업 이후 현재 snapshot 재검증

첫 검토 후 다른 세션이 scripts/workflow/run.ts의 BoxBox 런처 basename 검사를 boxbox.ts에서 기존 정본 boxbox.mjs로 고쳤다. 이 변경은 본 작업이 작성하거나 되돌리지 않았다. 공식 generator가 해당 모듈 내용 해시를 반영하면서 src/architecture.generated.json과 전체 snapshot digest가 바뀌었다. 의미상 지도 UI 변경이 없어도 공유 core는 과거 증거와 문서 검토·독립 검토를 source_changed로 무효화했다. 이를 우회하지 않고 현재 snapshot으로 재빌드·문서 영향 검토·집중 검사와 GUI를 다시 수행했다.

- attempt-f014edb7-a456-419c-9305-f5762d5d59d2: 현재 소스 집중 검사 passed, 종료 0, sourceStable true.
- attempt-a3b4f6fe-dc19-4f5d-9bd5-97196dab957f: 현재 snapshot의 실제 Electron GUI passed, 종료 0, sourceStable true. 구성/의존 보기와 대화 세션 설명·키보드·검색·줌·팬·좁은 창·지도/채팅 왕복 보존을 다시 검사했다.
- `.www/node-map-integrated-build.log`: 현재 snapshot 재빌드 통과.

앞선 pass와 Opus 영수증은 그 당시 소스의 이력으로 보존한다. 최종 수용은 현재 source digest에 연결된 증거와 후속 독립 검토로만 판단한다.

<a id="attempt-59b47add-42e8-4aae-87d1-6503003d0e37"></a>
## 검증 시도 — 2026-11-15T09:37:24.192Z

- 시도 ID: `attempt-59b47add-42e8-4aae-87d1-6503003d0e37`
- 실행 시각: 2026-11-15T09:37:11.769Z ~ 2026-11-15T09:37:24.192Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-ecosystem.ts"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `MAP-FLOW`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `283e2f45df1dae04ca83b37468c61317550d36c375e413f5ac9af02976bb3caf`
- 기준 정의 식별: `c7bacd3aae26921d22012016802806c67f8d70d959a55e41f3c799c70cc8f43d`
- 검증 중 소스 유지: 확인
- 출력: stdout 236바이트, stderr 0바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.


## 현재 소스의 최종 수용

후속 독립 검토 review-32127cf0-3158-4dd1-9cee-b2bfe166a327는 실제 claude-opus-5-5, 읽기 전용, pass다. 원문: .www/evidence/reviews/review-32127cf0-3158-4dd1-9cee-b2bfe166a327/opus.json. 현재 snapshot의 통합 시도 attempt-59b47add-42e8-4aae-87d1-6503003d0e37도 passed, sourceStable true다. 집중 검사·GUI·문서 검토·독립 검토의 현재 적용성을 공유 완료 core에서 다시 확인한다. 최종 집중 검사는 architecture-harness.test.ts를 포함하지 않으며, 해당 테스트가 현재 소스에서 통과했다고 주장하지 않는다. 기존 방향키는 시각적 격자의 상하 이동이 아닌 선형 순서로 동작하며 이 한계를 보존한다.
