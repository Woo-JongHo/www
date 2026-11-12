# TypeScript 이관 설계

## 범위와 보존

직접 관리하는 `.mjs` 33개를 `.ts` 구현·테스트·fixture로 이관한다. vendor 스냅샷, 빌드 생성물, 과거 작업 기록과 날짜가 명시된 실행 근거는 보존한다. 병행 중인 Native 화면·보고서 개발과 BoxBox 수정은 소유 범위 밖이다. 현재 파일 내용을 기준으로 이름과 타입을 바꾸며 기존 미게시 변경을 되돌리지 않는다.

## 실행과 타입 경계

Node 개발 도구는 `scripts/package.json`의 ESM 경계와 NodeNext 검사를 사용한다. 비교 도구도 별도 ESM 경계에서 같은 검사에 편입한다. 루트 앱·테스트는 기존 Bundler 검사를 유지하고 테스트는 원래 실행기로 돌린다. `test/package.json`은 이관 전 `.mjs`가 갖던 ESM 경계를 테스트 디렉터리에 명시한다. Electron의 `dist/*.js`는 기존 CommonJS 번들로 생성되므로 루트 package의 모듈 형식은 바꾸지 않는다. 직접 관리하는 `.d.mts` 선언은 구현 `.ts`에 흡수하고 타입 전용 import를 사용한다.

CLI의 JSON·외부 프로세스·작업 레코드 입력은 실제 검사와 unknown 좁히기로 처리한다. strict 검사를 완화하거나 타입 검사 우회 지시문으로 통과시키지 않는다. 공유 작업 타입은 `scripts/workflow/types.ts`, 실행·검토·증거의 구체 타입은 해당 모듈이 소유한다.

테스트는 확장자가 같아져도 기존 실행기 계약을 유지한다. `scripts/test.ts`는 이관한 Node 테스트 목록을 실제 Node로, 기존 TS 테스트와 신규 테스트를 Bun으로 실행한다. 초기 Bun 전체 실행에서 Node 테스트의 시간 초과를 관찰했으며 실행기 차이를 코드·검증에서 구분한다.

## 통합 경로

npm 명령, 하네스 import, 앱의 공유 core import, Native fixture·Rust 테스트 경로, 생태계 화면의 소스 경로와 현행 문서를 함께 갱신한다. 기존 JavaScript 허용 목록은 이관 후 비운다. 외부 BoxBox 런처의 `.mjs` 경로와 JavaScript 차단 회귀 테스트용 문자열은 실제 소스 이관과 구분해 유지한다.

## 검증

소스 정책, strict 타입 검사, 기존 테스트, 실제 Node CLI·fixture, Electron 번들과 Rust fixture 테스트로 실행 경로를 확인한다. 기능 테스트가 실제 Windows 데스크톱 검증이나 현재 실행 중인 패키지 앱 갱신을 의미하지는 않는다. BoxBox 서식 판정은 사용자가 병행하는 별도 작업으로 남기고 기능 검증과 분리한다. 현재 근거에 대한 읽기 전용 Opus 감사와 저작 보고서 작성 후 완료를 판정한다.
