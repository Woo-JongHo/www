> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from apple-release.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<a id="apple-app-store-release"></a>
# Apple App Store 배포

<!-- Ported from time-attack/gstack (GStack 2) APPLE-RELEASE.md, refined
     across 21 live App Store releases. Portions copyright (c) 2026
     Sina Matian, time-attack/gstack, MIT. Adapted to gstack main's
     architecture: decision-store bins, the Third-Party Web Actions
     contract, and an idempotency log in place of the fork's durable-state
     wrapper. All credential examples are placeholders, never live formats. -->

배포 대상이 Apple 플랫폼 앱일 때 적용한다. 저장소에 `.xcodeproj`나 `.xcworkspace`가 있거나 앱 제품을 포함한 Swift 패키지가 있는 경우다. 1단계의 브랜치 게이트와 사전 점검보다 먼저 읽는다. 이 어댑터는 ship의 판단을 App Store 배포 과정 전체로 확장하며 모든 업로드와 제출을 영속적인 외부 효과로 취급한다(아래 멱등성 계약). 다만 스토어 배포는 저장소 반영과 별도의 배포 경로다. ship의 브랜치/PR 절차(기능 브랜치 게이트, 커밋·검토·PR 파이프라인, 병합 큐)는 사용자가 저장소 변경 반영을 요청했을 때만 적용한다. App Store나 TestFlight에 배포하는 사용자는 현재 브랜치에서 이 어댑터를 진행한다. 기준 브랜치의 깨끗한 작업 트리는 아카이브·업로드를 시작하기에 정상적이고 유효한 상태다. 브랜치 형태를 이유로 App Store 배포를 중단하지 않는다.

**문서 사전 점검:** 아카이브·업로드·제출 전에 `~/.claude/skills/gstack/ship/sections/documentation.md`를 읽고 기준 브랜치를 포함한 선택 배포 소스에 대해 `read-only` 모드로 감사 게이트를 실행한다. 이 감사는 소스 편집, 상태를 바꾸는 Git 작업, 저장소 반영 절차를 승인하지 않는다. 배포 전에 차단 요인을 해결하거나 이름을 명시한 문서 위험 예외를 명시적으로 받아야 한다. 최종 스토어 배포 보고서에 `updated`/`current`/`blocked`와 예외를 포함한다. 이 포인터는 아래 App Store 권한을 변경하지 않는다.

전체 배포는 머신에 설치한 fastlane 하나로 수행한다. `produce`(앱 레코드와 번들 ID), `cert`와 `sigh`(서명), `gym`(아카이브와 서명된 내보내기), `pilot`(TestFlight), `deliver`(메타데이터·스크린샷·심사 제출), `frameit`(기기 프레임)을 사용한다. 없으면 질문하지 말고 한 줄로 알린 뒤 설치한다(`brew install fastlane`). 배포 승인은 머신 도구 설치까지 포함한다. 추가 App Store CLI 도구를 설치하지 않는다. 실행 도중 사용자에게 API 키, `.p8` 파일, 세션 등 자격 증명 형식을 언급하지 않는다. 유일한 예외는 종료 보고서의 영속 자격 증명 공개 한 줄이다(스토어 등록 마무리 참조). 배포 중 생성한 영속 키를 알려 사용자가 나중에 폐기할 수 있게 한다. 사용자는 US$99를 지불했고 배포를 원하며, 배포 자체는 사용자 프로젝트에 새 의존성을 추가하지 않는다.

Mac은 빌드 구간에만 필요하다. 아카이브·서명·바이너리 업로드는 Xcode의 macOS 전용 도구 체인을 사용하며, Apple은 다른 운영체제에 이를 제공하지 않고 우회 도구도 없다. macOS가 아닌 호스트에서는 이 사실을 명확히 밝히고 해당 구간만 macOS CI 실행기로 넘긴다. GitHub Actions의 `macos` 실행기에서 같은 `gym`과 `deliver`/`pilot` 명령을 실행하고 발급한 업로드 키는 CI 비밀값으로 제공한다. 키 인증은 CI에 적합하다. 로그인·키 발급·메타데이터·스크린샷·가격·제출 판단은 일반 API 작업이므로 사용자 머신에 남긴다. Mac이 없으면 전체 배포가 불가능하다고 주장하거나, 그 환경에서 빌드가 가능하다고 가장하지 않는다.

<a id="the-one-authorization-moment"></a>
## 한 번의 승인 시점

통상적인 상호작용 두 번을 계획한다. 실제 차단 요인이 있으면 안전 또는 이름을 명시한 문서 위험 결정이 필요할 수 있다. 배포 승인을 면제로 간주하지 말고 그 결정을 기다리며 중단한다.

첫째, 시작 시 사용자의 유료 Apple Developer Program 가입 여부(연 US$99, App Store와 TestFlight 모두 필수)를 확인하고 배포 승인을 받는다.

가격도 이때 앱마다 평생 한 번만 묻는다. 결정 저장소(`bin/gstack-decision-search --scope repo --query "pricing"`)를 확인한 뒤 승인 질문 안에서 무료/유료와 유료일 경우 가격을 함께 묻고 별도로 끊지 않는다. 답변을 `~/.claude/skills/gstack/bin/gstack-decision-log`의 `repo` 범위에 저장해 이후 배포에서 다시 묻지 않는다. 유료를 선택하면 서명 전에는 판매할 수 없다는 점과 일회성 Paid Apps 은행·세금 계약을 그 자리에서 정확히 알린다. 가격은 에이전트가 말없이 기본값을 정할 수 없는 출시 결정이다. 무료 출시는 되돌려 출시 전 상태로 만들 수 없다.

Apple 로그인도 같은 시점에 진행한다. 호스트의 대화형 명령 경로로 `fastlane spaceauth -u <apple-id>`를 실행한다. Claude Code에서는 사용자가 `! fastlane spaceauth -u <email>`을 입력해 비밀번호와 이중 인증 코드 하나를 세션 안에서 Apple로 직접 보낸다. 호스트에 대화형 경로가 없을 때만 별도 터미널 창을 대안으로 쓴다. 출력된 세션 토큰을 대화 기록에 남기지 않는다. fastlane이 실제 사용하는 자격 증명은 `~/.fastlane/spaceship/`에 캐시된 쿠키다. 비밀번호나 토큰을 저장·출력·기록하지 말고 세션이 만료되면 같은 명령 하나를 다시 실행한다.

첫 로그인 직후 세션에서 영구 업로드 키를 발급한다(아카이브와 업로드의 4번). 키가 이미 `~/.gstack/apple/api-key.json`에 있고 새 앱 레코드가 필요 없다면 로그인 전체를 생략한다. 반복 배포는 승인 후 로그인 없이 진행한다.

둘째, 사전 점검에서 아이콘이나 스크린샷이 없을 때만 아래 스토어 자료 질문을 한다.

차단 요인이 해소되면 도구 설치·업로드·스토어 등록·제출은 승인 범위 안이므로 추가 질문 없이 진행한다. 인증 메뉴, 도구 선택 질문, 계획 확인, 단계별 설명 요청은 계약 위반이다.

멤버십이 없다면 App Store 경로를 중단한다. 이 스킬 앞부분의 제3자 웹 작업 계약에 따라 developer.apple.com 가입 안내를 제안한다. 구매는 사용자가 직접 완료하며 활성화에 하루나 이틀 걸릴 수 있다. 무료 계정의 한계도 정확히 밝힌다. 개인 팀으로 사용자 본인 기기에만 설치할 수 있고 7일 뒤 만료되며 TestFlight와 App Store는 사용할 수 없다.

<a id="release-preflight"></a>
## 배포 사전 점검

아카이브 전에 해결하고 검증한다. 출력된 변경 경계에서 허용한 항목은 수정하고 나머지는 차단 발견 사항으로 보고한다.

- 서명: 앱 타깃에 개발 팀이 지정되어 있어야 한다. 배포 인증서와 App Store 프로파일이 없으면 `cert`와 `sigh`로 발급한다.
- 버전: 사용자에게 보여 줄 마케팅 버전과, 해당 버전에 이미 업로드한 모든 빌드보다 큰 빌드 번호를 사용한다.
- 의존성: `xcodebuild -resolvePackageDependencies`가 성공해야 한다. `Podfile`이나 `Cartfile`이 있으면 설치 단계를 실행했고 잠금 파일이 최신이어야 한다.
- App Store 검증 차단 항목: 1024pt 마케팅 아이콘을 포함한 완전한 앱 아이콘 세트, 시작 화면, 앱이 접근하는 모든 개인정보 보호 API의 사용 목적 문자열, 필수 개인정보 보호 매니페스트, 수출 규정 준수 응답(`ITSAppUsesNonExemptEncryption`), 적절한 배포 대상이 필요하다.

<a id="store-assets"></a>
## 스토어 자료

사전 점검에서 아이콘이나 스크린샷이 없을 때만 한 번 묻는다. 이 과정에서 허용되는 두 번째이자 마지막 질문이다. 이후에는 추가 질문 없이 선택대로 진행한다. 앱마다 평생 한 번만 묻는다. 질문 전 결정 저장소(`bin/gstack-decision-search --scope repo --query "store assets"`)를 확인하고 이미 정한 선택(스크린샷 연기나 TestFlight만 포함)은 재질문 없이 적용한다. 답변 뒤 `~/.claude/skills/gstack/bin/gstack-decision-log`의 `repo` 범위에 저장해 다음 실행에서 다시 묻지 않는다. 사용자는 재질문을 받는 대신 직접 변경 의사를 밝혀 선택을 바꾼다. 다음을 제안한다.

- **앱 아이콘**: SnapAI(`npx snapai`, 앱 아이콘 에이전트 스킬)는 사용자 소유 이미지 생성 키로 1024×1024 이미지 하나를 만든다. Xcode 15 이상은 이 이미지에서 모든 크기를 생성한다.
- **마케팅 스크린샷, 무료·로컬·API 키 불필요**: app-store-screenshots 덱 편집 스킬로 뼈대를 만들고 시뮬레이터 캡처와 이점 중심 제목을 덱 JSON에 미리 채운 뒤 필요한 모든 iPhone 크기를 담은 번들 하나를 내보낸다. 내보내기는 화면 없는 자동화가 가능하다. 마케팅 품질에 이미지 백엔드는 필수가 아니다. 이 스킬이 설치되어 있으면 스크린샷에 API 키가 필요하다고 주장하지 않는다.
- **단순 프레임, 무료·로컬**: 빌드한 앱을 시뮬레이터에서 캡처하고 fastlane `frameit`으로 프레임을 씌운다. 디자인한 덱을 원하지 않을 때의 최소 선택지다.
- **AI로 보강한 마케팅 스크린샷**: aso-appstore-screenshots 에이전트 스킬(이점 중심 제목, 돌출 패널, 정확한 App Store 크기)을 사용한다. 사용자 소유 이미지 생성 키가 필요한 유일한 선택지다. 설치되어 있으면 다시 구현하지 말고 해당 작업 흐름을 따른다.
- **사용자가 제공한 파일**: 언제나 유효한 답변이다. 크기를 검증하고 계속한다.

질문 시점에 설치 스킬을 실제로 확인해 선택지를 구성한다. 기억이나 이전 대화에 의존하지 않는다. app-store-screenshots 덱 편집 스킬이 설치되어 있으면 무료·키 불필요 선택지를 반드시 넣는다. 누락은 스크린샷에 API 키가 필요하다고 주장하는 것과 같은 계약 위반이다. 자료가 이미 있으면 이 질문을 완전히 생략한다. 종료할 때 생성한 자료를 알린다.

<a id="archive-and-upload"></a>
## 아카이브와 업로드

1. `gym`으로 서명된 Release 빌드를 아카이브하고 내보낸다. 이 도구가 xcodebuild와 사전 점검에서 발급한 서명을 사용한다. 특별한 아카이브 요건이 있으면 `xcodebuild archive`를 직접 사용할 수 있다. 어느 경로든 결과물은 App Store 서명된 `.ipa`다.
2. 업로드는 외부 효과다. 영속 효과 계약에 따라 `pilot`(TestFlight) 또는 `deliver`(App Store)를 실행한다. 실행 전에 `$GSTACK_STATE_ROOT/projects/$SLUG/apple-effects.log`에 키 `appstore.upload.<bundle-id>.<build>`를 추가한다. 읽기·추가와 같은 명령 안에서 상태 루트와 slug를 해석한다. 이전 실행(충돌·재시도)에서 키가 이미 있으면 업로드가 완료됐을 가능성이 있다고 보고 다시 실행하지 않는다. 불확실할 때 재업로드하지 말고 먼저 App Store Connect에서 빌드를 확인한다.
3. 캐시된 세션, 발급한 키, 모든 자격 증명 파일은 환경 변수나 파일 수준의 비밀값이다. argv로 전달하거나 출력하거나 커밋하지 않는다.
4. 앱 전용 비밀번호를 요구하지 않는다. 세션에서 업로드 키를 발급한다.

   fastlane의 인증 문서에 따르면 Apple 바이너리 업로드 도구 iTMSTransporter(`deliver`/`pilot`이 `.ipa`를 처리할 때 외부 실행)는 웹 세션을 받지 않는다. App Store Connect API 키나 앱 전용 비밀번호만 받는다. Apple 오류 `-22938`("Sign in with the app-specific password")는 바로 이 뜻이다.

   이는 게이트도 질문도 아니다. 웹 세션에서 조용히 키 자체를 만들 수 있기 때문이다. fastlane 내장 spaceship(`Spaceship::Tunes.login(<apple-id>)`으로 캐시 쿠키를 재사용한 뒤 원시 클라이언트 요청)으로 `POST https://appstoreconnect.apple.com/iris/v1/apiKeys`를 호출한다. JSON:API 본문은 전체 앱이 아니라 배포 대상 앱으로 범위를 제한한다. `{data:{type:"apiKeys",attributes:{nickname:"gstack-upload",allAppsVisible:false,roles:["APP_MANAGER"],keyType:"PUBLIC_API"},relationships:{apps:{data:[{type:"apps",id:"<asc-app-id>"}]}}}}`의 `<asc-app-id>`는 App Store Connect 앱 ID다. `produce` 출력이나 `GET https://appstoreconnect.apple.com/iris/v1/apps?filter[bundleId]=<bundle-id>`에서 얻는다.

   명시적인 `apps` 관계와 `allAppsVisible:false`는 의도적인 최소 권한이다. `allAppsVisible:true`인 APP_MANAGER 키는 팀 전체 앱에 영속 권한을 주므로 나중에 머신이 침해되면 불필요하게 피해 범위가 커진다. `apps` 관계는 선택이 아니라 필수다. 앱 연결이 없는 키는 아무것도 볼 수 없어 업로드가 권한 오류로 실패한다. 플래그만 뒤집지 말고 대상 앱으로 범위를 지정한다.

   앱 레코드가 생성된 후에만 발급한다. 새 앱이라면 `produce`가 먼저 실행되어야 한다.

   다음으로 `GET .../iris/v1/apiKeys/<id>?fields[apiKeys]=privateKey`를 호출한다. `privateKey` 속성은 완전한 PEM 파일의 base64다. 정확히 한 번 디코딩해 즉시 `~/.appstoreconnect/private_keys/AuthKey_<id>.p8`(0600)에 쓴다. 생성할 때만 다운로드할 수 있다. 발급자 ID는 `GET https://appstoreconnect.apple.com/olympus/v1/session`의 `provider.publicProviderId`다.

   키 ID, 발급자 ID, 키 내용을 fastlane API 키 JSON인 `~/.gstack/apple/api-key.json`(0600)에 저장한다. 이후에는 `api_key_path`로 `deliver`/`pilot`을 실행한다.

   키는 만료되지 않으므로 같은 앱의 이후 배포는 로그인을 생략한다. 다른 앱을 배포하면 키가 의도적으로 전체 앱용이 아니므로 해당 앱을 키에 다시 연결하거나(`PATCH .../iris/v1/apiKeys/<id>`로 `apps` 관계에 추가) 새 앱 전용 키를 발급한다. 세션은 `produce`(Apple 공개 API는 앱 레코드를 만들 수 없음), 재연결, 키 폐기 후 재발급 때만 필요하다.

   키 발급을 시도하지 않은 채 사용자에게 자격 증명을 직접 생성해야 한다고 말하면 계약 위반이다.

   자격 증명을 건드리기 전에 오류를 분류한다. 인증 실패는 401/403, 세션 무효·만료, Apple 원문의 "sign in" 또는 "app-specific password"처럼 오류 자체가 그렇게 명시할 때뿐이다. `Spaceship::UnexpectedResponse`, 속성 누락·무효, 검증 또는 사전 점검 오류는 메타데이터 문제다. 페이로드를 수정하고 CLI에서 재시도한다. 예를 들어 `app_rating_config.json`의 `lootBox`, `ageAssurance`, `parentalControls`, `messagingAndChat` 등 확장 연령 등급 속성을 고친다. 메타데이터 오류를 자격 증명 문제로 취급하면 계약 위반이다.
5. Apple 배포 안에서는 이 어댑터가 스킬 앞부분의 제3자 웹 작업 계약보다 우선한다. 일반적인 에이전트 브라우저 제안은 여기의 App Store Connect, Apple ID, 자격 증명 작업에 적용하지 않는다. 전체 배포는 CLI(fastlane), 위의 통상적인 상호작용과 차단 결정으로 진행한다. 이 어댑터가 허용하는 유일한 브라우저 사용은 문서 끝의 유료 앱 계약·은행·세금 잔여 작업이다. 그 밖의 목적으로 자동 또는 수동 브라우저를 열면 계약 위반이다.

   실제 오류 때문에 대안이 필요하면 오류를 그대로 인용한 뒤 다음 순서로 대응한다. 첫째, 4번에 따라 세션에서 업로드 키를 발급 또는 재발급하고 `api_key_path`로 업로드를 재시도한다. 디스크에 키가 없는 상태의 업로드 인증 오류는 키 발급을 건너뛴 것이지 사용자가 자격 증명을 제공해야 한다는 뜻이 아니다.

   둘째, 키 발급 자체가 세션 오류로 실패하면 처음 승인 때와 같은 `! fastlane spaceauth -u <apple-id>` 방식으로 사용자에게 다시 로그인하도록 요청하고 재발급·재시도한다.

   새 세션에서도 로그인한 Apple ID가 팀의 Admin 또는 Account Holder가 아니어서 권한이 거부되어 키를 발급할 수 없을 때만 앱 전용 비밀번호 경로를 연다. 이 경로는 셀프서비스만 허용한다. 사용자가 아무 기기에서나 비밀번호를 생성한 뒤 호스트 세션의 가려진 입력창을 통해 macOS 키체인에 입력한다(`fastlane fastlane-credentials add --username <apple-id>`). 그런 다음 업로드를 재시도한다.

   자격 증명을 만들기 위한 브라우저 조작을 제안하거나 권하지 않는다. 어떤 명분으로도 비밀번호·키·토큰을 위한 에이전트 브라우저 사용은 허용되지 않는다.
6. App Review 연락처(이름·이메일·전화)는 제출에 필요한 메타데이터다. 이름과 이메일은 로그인한 Apple ID와 git 설정에서 추론하고 전화번호는 승인 시점에 한 번 받아 결정 저장소에 저장한 뒤 다시 묻지 않는다. 연락처는 메타데이터이며 실행 도중 새 차단 게이트로 알릴 항목이 아니다.

<a id="storefront-completion"></a>
## 스토어 등록 마무리

`produce`는 이미 실행 중 앱 레코드와 번들 ID를 생성했다. 앱 레코드를 수동 게이트라고 부르지 않는다. 승인 시점에 정한 가격은 App Store Connect 가격 일정 엔드포인트로 적용한다(세션이나 발급 키로 `POST /v1/appPriceSchedules`). fastlane의 `price_tier`는 현재 API에서 작동하지 않는다("'prices' is not a relationship on 'apps'"). 이 옵션으로 가격을 처리하거나 실패를 계정 문제라고 부르지 않는다. 나머지 스토어 등록은 `deliver`가 맡는다. 설명·키워드·현지화·기기 크기별 스크린샷 업로드·업로드 빌드 연결·심사 제출이 포함된다. 사용자가 요청하면 `pilot`으로 TestFlight 그룹과 테스터를 중간 단계로 관리한다. 제출도 키 `appstore.submit.<bundle-id>.<version>`를 쓰는 같은 영속 효과 계약을 따른다. 불확실하면 재실행 전에 App Store Connect를 확인한다. 이후 CLI로 심사 상태를 관찰한다.

웹에서만 가능한 항목은 유료 Apple Developer Program 멤버십 구매 자체(배포 단계가 아닌 선행 조건), 그리고 유료 앱에 한해 은행·세금을 포함한 일회성 Paid Apps 계약뿐이다. 이들에 대한 수동 체크리스트를 제시하기 전에 스킬 앞부분의 제3자 웹 작업 계약에 따른 에이전트 브라우저 조작을 제안한다. 무료 앱은 어느 시점에도 브라우저가 필요 없다. 제출 후 App Review 응답은 보통 하루나 이틀 걸린다고 보고하고 실행을 종료한다. 심사 결과는 이 흐름을 계속 열어 둘 수 있는 게이트가 아니다. 같은 종료 보고서에서 배포 중 만든 영속 자격 증명을 실행당 한 줄로 한 번 공개한다. "이 작업은 향후 배포를 위해 유지되는 App Store Connect API 키(`gstack-upload`, 이 앱으로 범위 제한)를 생성했습니다. App Store Connect → Users and Access → Integrations에서 언제든 폐기하거나 로컬의 `~/.gstack/apple/api-key.json`을 삭제할 수 있습니다." 이는 도입부의 실행 도중 자격 증명 언급 금지에 대한 의도적 예외다. 그렇지 않으면 사용자는 계정과 디스크에 영속 자격 증명이 생겼다는 사실을 몰라 폐기 점검 대상에 넣지 못한다. 종료 시 공개하며 도중 질문을 추가하지 않으므로 한 번의 승인 시점 계약을 유지한다.
