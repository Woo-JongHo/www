# WWW 버전과 릴리즈

## 실행 빌드 식별

`npm start`는 빌드 후 Electron을 연다. 앱 제목·왼쪽 WWW 옆·하단 상태줄에 `0.1.n[-dirty] · 커밋 앞 8자리 · 소스 digest 앞 12자리`를 표시한다. 표시 위에 포인터를 두면 전체 커밋·digest를 확인한다. 실행 파일에 주입된 값이므로 작업 폴더나 Git HEAD가 실행 중 바뀌어도 기존 앱의 식별은 유지된다. 업데이트 후 다시 실행해 식별이 바뀌었는지 비교한다. 서버 조회·자동 업데이트 설치는 이번 범위에 포함하지 않는다.

`package.json#releaseBase`는 `0f7661ded359b69a95cbdde67392287d63fffb69`이며 그 커밋이 0.1.0이다. HEAD에서 first-parent로 기준점까지의 거리가 n이다. merge의 옆가지 커밋은 추가로 세지 않는다. 같은 커밋의 재빌드는 같은 버전이며 브랜치 사이 버전 중복은 전체 커밋으로 구별한다. 기준점은 버전 연속성 계약이므로 임의로 갱신하지 않는다. shallow 또는 기준점이 first-parent에 없는 이력은 실패한다. `package.json#version`은 개발 도구용 기본값이며 배포 앱 버전은 계산한 값을 사용한다.

`npm run version:info`로 식별을 조회한다. SHA-256 소스 digest는 Git이 인식한 추적·미추적 경로, 파일 내용·실행 가능 여부·심볼릭 링크 대상과 삭제 상태를 포함한다. Git이 무시하는 설치물·dist·.www 출력은 제외한다. 타임스탬프는 넣지 않는다. dirty 여부는 저장소 전체의 추적·미추적 변경을 반영한다. `dist/build-info.json`과 main·renderer에 동일한 객체를 넣는다.

## 로컬 배포 패키지

macOS arm64에서 깨끗한 소스로 `npm run release:package`를 실행한다. 환경·구조 현재성·소스 정책·workflow·strict 타입·전체 테스트·빌드 순으로 검사하고 검사 전후 커밋·소스 digest·dirty 여부, 번들 식별을 대조한 뒤 Electron을 패키징한다. 실패한 검사는 배포를 차단한다.

출력은 실행별로 격리된 `.www/releases/0.1.n-<임의값>/`의 `WWW-0.1.n-darwin-arm64.zip`, `manifest.json`, `SHA256SUMS`다. manifest는 버전·커밋·dirty·소스 digest·대상 플랫폼·실행한 검사 목록과 zip의 크기·SHA-256을 가진다. 번들만 격리 staging에 복사해 소스·문서·로컬 설정·개발 CLI를 앱에 넣지 않는다. 서명·공증은 적용하지 않았고 manifest에도 이를 명시한다. macOS의 배포 신뢰 처리와 실제 설치 실행 확인은 별도다. Codex CLI는 여전히 사용 머신에 필요하다.

Packager의 `appVersion`, `buildVersion`, `electronVersion`은 [공식 옵션](https://electron.github.io/packager/main/interfaces/Options.html)에 따라 전달한다. ZIP bytes의 재현성을 약속하지 않으며 같은 소스 버전과 실제 산출물 체크섬을 구분한다.

## GitHub Actions 준비와 게시

두 workflow는 full-history checkout, Node 22.22.3, Bun 1.4.0과 `npm ci`를 사용한다. PR/main 검증과 main 패키지 artifact 전달은 `ci.yml`, `v0.1.*` 태그의 검증·패키징과 GitHub Release 게시는 `release.yml`이 담당한다. 태그 이름이 계산 버전과 정확히 일치하고 태그가 HEAD를 가리켜야 한다. Release는 [공식 gh release create](https://cli.github.com/manual/gh_release_create)의 `--verify-tag`를 사용한다. main artifact는 정식 Release와 구별한다.

BoxBox는 [공개 npm boxbox-plugin@0.2.8](https://www.npmjs.com/package/boxbox-plugin/v/0.2.8)의 `npm exec --yes --package=boxbox-plugin@0.2.8 -- boxbox --engine-only`로 설치한다. 공개 tarball 무결성 SHA-512와 실제 headless 설치 성공을 로컬에서 확인했다. Codex/Claude 호스트 등록이나 인증은 필요하지 않다. workflow는 `XDG_DATA_HOME=$RUNNER_TEMP/boxbox-engine`에 설치하고 `$XDG_DATA_HOME/boxbox/codex/0.2.8`을 `BOXBOX_CI_ROOT`로 전달한다. `setup:ci`는 공개 CLI SHA `2bd10f87c24e4b9a31476a66203b804808d8c86b83bc44d7fa6e1bba37d189d0`, package 0.2.8, 실제 runtime Node와 현재 Node의 동일 실행파일·22.22.3 버전, 기존 registry 네 파일 SHA를 확인한다. runtime.json을 쓰지 않으며 `.www/development.local.json`이 이미 있으면 실패한다. 머신 경로는 생성된 로컬 설정에만 보관한다. 기존 로컬 개발본 CLI와 공개 CLI의 해시는 다르지만 기존 snapshot canonical 출력은 바이트 단위로 일치했다.

[GitHub 공식 runner 목록](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)의 arm64 `macos-15`를 사용한다. 외부 fork를 포함한 PR은 contents read 권한의 새 hosted VM에서 동일 검사를 받는다. 환경 검사가 요구하는 Codex 실행파일은 고정 `@openai/codex@0.167.2`로 설치하며 로그인하지 않는다. workflow_dispatch, 45분 제한과 artifact 14일 보존을 명시한다. 게시 job만 contents write를 갖고 10분 제한으로 실행한다. 단일 artifact는 이번 실행 output 디렉터리의 파일만 업로드한다. [download-artifact의 단일 named artifact 경로](https://github.com/actions/download-artifact#download-single-artifact)는 파일을 지정 디렉터리에 직접 풀므로 게시 glob는 `release-assets/*`다.

`npm run release:check`는 dirty·shallow·잘못된 태그·태그 HEAD 불일치와 origin/main first-parent 밖 커밋을 거부한다. CI의 full-history checkout은 origin/main을 포함한다. 로컬에서는 먼저 main ref를 fetch해야 한다. tag 없는 clean main CD도 허용한다. `release:verify`는 빌드 전에 구조 snapshot 현재성을 검사하므로 stale clean snapshot을 빌드로 고쳐 통과시키지 않는다. `package:electron`은 기존 개발 패키징 명령으로 dirty 개발 소스를 허용하며 정식 `release:package`와 구분한다. 원격 workflow·artifact 게시·Release는 아직 실행하지 않았다.

현재 작업에서 commit·push·태그 생성·Release 게시는 실행하지 않는다. 검토 후 커밋된 깨끗한 소스에서 로컬 패키지와 설치 실행을 확인하고, main을 게시해 artifact를 확인한 뒤 일치하는 태그로 정식 Release를 실행한다.
