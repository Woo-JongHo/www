# 커밋 버전·릴리즈·CI/CD 설계

## 요청과 정책

대상은 이 www 저장소다. 99_www나 99_www-desktop을 수정하지 않는다. 기존 dirty 문서는 보존한다. commit/push/태그 생성/원격 릴리즈 실행은 하지 않는다. 저자는 Codex이며 부모가 별도 검토·최종 보고서를 소유한다.

## 버전

권장 기본값은 커밋마다 증가하며 같은 커밋 재빌드는 같은 버전이다. 현재 HEAD `0f7661ded359b69a95cbdde67392287d63fffb69`를 0.1.0 기준점으로 고정하고 그 이후 first-parent 커밋 수를 patch에 더한다. 기준점이 현재 first-parent 이력에 없거나 shallow이면 실패한다. 소스 아카이브를 미상 버전으로 대체하지 않는다. package.json의 0.1.0은 기준 버전이며 실행/패키징에는 계산한 버전을 사용한다. 분기 간 동일 patch는 커밋 전체 ID로 구분하고 정식 릴리즈는 main 선형 이력의 정확한 태그만 허용한다. 개발 빌드에는 SHA·dirty 여부·dirty source digest·build time을 담아 업데이트 추적을 제공한다. 같은 dirty 내용은 동일 digest, 실제 변경은 다른 digest여야 한다. 빌드 생성물 architecture.generated.json의 자기 참조로 영원히 dirty가 되는 순환을 피한다. 실제 추적/미추적 소스는 식별한다. dist/build-info.json과 main·renderer에 동일 메타데이터가 들어가며 화면 항상 보이는 곳에 버전, 상세 툴팁에 SHA와 수정 여부/시각을 제공한다. Native initialize clientInfo.version도 계산 버전을 쓴다. Electron About panel과 창 제목에서도 식별할 수 있다. renderer는 Node나 filesystem 접근 없이 build define을 사용한다.

## 구현 소유 경로

work.json의 writePaths만 수정한다. src/build-info.ts는 번들 define의 shared metadata 타입/상수와 label을, scripts/release.ts는 Git 버전 계산·release preflight·package/manifest 및 CLI를, scripts/setup-ci.ts는 headless BoxBox 준비 로컬 설정을 소유한다. 구조 정본과 requirement catalog에 실제 책임/선행 JSDoc을 등록하고 공식 generator로 snapshot을 갱신한다. 기존 src/main.ts/renderer.tsx/build.ts에 최소 배선만 한다. 불필요한 IPC 추가는 하지 않는다. 새 TS는 strict 검사에 들어간다. BoxBox project mode는 현재 off이고 전역/프로젝트 mode를 변경하지 않는다. 승인되지 않은 수동 공백 정렬은 하지 않는다.

## 릴리즈 하네스

npm run release:info는 읽기 전용 정보, release:check는 clean/full history/expected v0.1.n 태그 및 main 이력 preflight, release:package는 별도 staging에서 macOS arm64 Electron 앱을 계산 app-version으로 패키징하고 zip·SHA256SUMS·manifest(version/commit/digest/platform/arch/size/hash)를 만든다. 소스 루트 전체를 packager로 복사하지 말고 runtime dist·runtime package metadata·필요한 runtime 의존성만 포함한다. 빌드 후 source 변경, dirty, 태그 불일치, artifact 재사용 오염을 거부한다. package는 checks+build를 실행하거나 검증 증거와 입력을 대조해 검증되지 않은 dist 사용을 막는다. 개발용 package:electron 기존 의미를 불필요하게 바꾸지 않는다. 생성 manifest/체크섬과 실제 파일을 비교하는 tests 포함. 릴리즈는 서명·공증되지 않은 macOS arm64 zip임을 문서화한다. 자동 업데이트/설치는 범위에 없다.

## CI/CD

GitHub Actions CI는 pull_request/main push 및 수동 실행에 full fetch-depth 0, 고정 Node 22.22.3, 로컬 확인 Bun 1.4.0, npm ci, headless BoxBox 준비, source/type/집중 및 기존 전체 checks/build를 실행한다. main 성공 빌드는 검증한 macOS arm64 artifact를 보존한다. tag v0.1.* push는 정확 버전/clean/main ancestry를 확인한 후 같은 검증·패키징 경로로 GitHub Release와 zip/manifest/SHA256SUMS를 전달한다. CI contents read, release 게시 job만 contents write. 동시 실행 방지·timeout·artifact retention·실패 전달을 명시한다. PR은 read-only이며 secrets나 self-hosted runner 사용하지 않는다. main CD와 tag 릴리즈를 구분한다. 원격 워크플로 실행/게시를 이 작업에서 실제 수행하지 않는다.

BoxBox는 현재 로컬 설치본 0.2.8에 `--engine-only`가 있다. npm installer boxbox-plugin@0.2.8의 --engine-only를 사용하면 Codex 설치/자격 증명/호스트 등록 없이 CLI를 준비할 수 있다. 설치본 runtime.json/cli/package/runtime Node를 읽어 canonical CLI SHA와 기존 .boxbox registry 4파일의 SHA를 확인한 로컬 설정을 CI에 생성한다. 기존 .www/development.local.json을 조용히 덮어쓰지 않는다. 머신 절대경로를 Git 파일에 넣지 않는다. package registry version 지원/engine-only를 실제 다운로드로 검증해야 한다. 생성 snapshot check가 다른 도구 버전으로 달라지면 실패로 보존한다. 참고 공식 문서: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax https://github.com/actions/setup-node https://github.com/oven-sh/setup-bun

## 검증

임시 Git 저장소의 baseline/후속 commit/같은 commit 재빌드/다른 dirty 소스/태그 불일치/shallow/기준점 없는 branch/실패 종료/zip 체크섬을 실제 검사한다. test/release.test.ts는 bun:test로 작성하고 @verifies를 등록한다. source policy/typecheck/build 및 필요한 architecture tests를 수행한다. Electron 실제 DOM에서 표시 label과 dist/build-info.json 값을 대조하는 probe를 부모가 수행한다. CI와 실제 원격 release 미실행을 통과로 쓰지 않는다.

## 실행 지침

이 설계를 구현한다. 이미 공식 typed 하네스의 실제 Codex 호스트로 실행되고 있으므로 하네스를 다시 실행하거나 새 work를 만들지 않는다. work UUID를 재사용한다. 다른 작업과 함께 작업 중이므로 타인의 변경을 되돌리거나 정리하지 않는다. 구현 후 .www/release-work/implementation.md에 변경 파일·검증 명령과 결과·미해결 한계의 전문을 저장하고 주 결과에는 3~5줄과 그 경로만 반환한다. 부모가 검토·보고서·기준 판정을 소유한다. 별도 에이전트를 생성하지 않는다.
