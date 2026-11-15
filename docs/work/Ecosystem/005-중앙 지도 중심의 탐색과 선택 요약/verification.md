# 검증 기록

<a id="attempt-10f6d1c1-7dfa-4291-b525-7a75adbe8856"></a>
## 검증 시도 — 2026-11-15T09:48:32.659Z

- 시도 ID: `attempt-10f6d1c1-7dfa-4291-b525-7a75adbe8856`
- 실행 시각: 2026-11-15T09:48:23.411Z ~ 2026-11-15T09:48:32.659Z
- 명령과 인자: `["/Users/jonghoPro/.bun/bin/bun","test","test/architecture-tree.test.ts","test/architecture.test.ts","test/architecture-contract.test.ts","test/ecosystem.test.ts","--timeout","60000"]`
- 실행 결과: 통과; 종료 코드 0, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `bed0b888e7d0253f59188ac07fee32bd493e98e77b94a9b1ca96af5884851b4a`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 28바이트, stderr 37605바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.

<a id="attempt-a8f8dcdb-d458-4e1c-886e-dfd1510d61dd"></a>
## 검증 시도 — 2026-11-15T09:48:42.620Z

- 시도 ID: `attempt-a8f8dcdb-d458-4e1c-886e-dfd1510d61dd`
- 실행 시각: 2026-11-15T09:48:24.504Z ~ 2026-11-15T09:48:42.620Z
- 명령과 인자: `["/opt/homebrew/Cellar/node@22/22.22.3/bin/node","scripts/verify-architecture.ts"]`
- 실행 결과: 실패; 종료 코드 1, 신호 없음
- 실행기: 실제 자식 프로세스
- 관련 기준: `CANVAS-CONTROL`, `CANVAS-SELECT`, `CANVAS-SPACE`
- 소스 HEAD: `92de2389b943610f7e12c23a4cd211555d4cae1b`
- 검증 입력: `docs/architecture/structure.json`, `docs/specs/architecture.md`, `docs/specs/ecosystem.md`, `package.json`, `scripts/architecture-contract.ts`, `scripts/generate-architecture.ts`, `scripts/verify-architecture.ts`, `scripts/verify-ecosystem.ts`, `src`, `test/architecture-contract.test.ts`, `test/architecture-tree.test.ts`, `test/architecture.test.ts`, `test/ecosystem.test.ts`
- 소스 식별: `bed0b888e7d0253f59188ac07fee32bd493e98e77b94a9b1ca96af5884851b4a`
- 기준 정의 식별: `64c10ccb549acf2b2cd57581a48656d4726a10590153c92248e25f7745cd68b7`
- 검증 중 소스 유지: 확인
- 출력: stdout 0바이트, stderr 481바이트. 비밀 노출을 피하도록 원문을 보관하지 않음.
- 한계: 선언한 입력과 기준만 검사한다. 명령 종료와 기준 연결의 적절성은 별도 검토하며 현재 적용 여부는 소스·기준·실행 환경을 다시 대조한다.
