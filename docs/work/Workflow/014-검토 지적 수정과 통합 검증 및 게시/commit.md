# 세션 커밋·푸시 기록

요청한 변경을 용도와 역할별로 나누어 `origin`의 `refs/heads/main`으로 게시했다. 원격 URL은 `https://github.com/Woo-JongHo/www.git`다. 아래 기록은 실제 커밋과 원격 ref 대조 결과이며 서버 색인은 확인하지 않았다.

## 최초 380개 변경의 게시

| 커밋 | 목적 |
|---|---|
| [60a0603](https://github.com/Woo-JongHo/www/commit/60a060388895d815c8407fda245c68906a3f44ca) | 프로젝트 소개 조사와 실행 기록을 보존한다 |
| [068a813](https://github.com/Woo-JongHo/www/commit/068a8136cc925b984220fb8c4e3b8b14a28a4ff9) | 승인된 TypeScript 정렬 규칙과 인간 응답 근거를 등록한다 |
| [ed63803](https://github.com/Woo-JongHo/www/commit/ed63803bdccb3d01d3a23ea16b3448ba577a4268) | 하네스가 BoxBox 프로젝트 off 모드를 존중한다 |
| [2ac7b54](https://github.com/Woo-JongHo/www/commit/2ac7b54ed4e105937aa823584253001fe671be6d) | Native 진행 설명의 시작과 중간 안내를 구체화한다 |
| [ca16d1d](https://github.com/Woo-JongHo/www/commit/ca16d1d439f054c9ab936c1cb8f49b12156c040e) | 중단된 Native 보고서의 재시도를 거부한다 |
| [8a7d8b9](https://github.com/Woo-JongHo/www/commit/8a7d8b9d4321d318066be13b8d9a3c2ef831fb7d) | 작업 원장의 읽기 상한을 8 MiB로 통일한다 |
| [bae5f9e](https://github.com/Woo-JongHo/www/commit/bae5f9ea8f81dbe0cc96c1b5ba2eafe9d6432be4) | 구조 ID 계약과 책임 단계별 코드 지도를 연결한다 |
| [4eb4863](https://github.com/Woo-JongHo/www/commit/4eb4863ae325dfda92a84d3110957cd7dfd67ec2) | 프로젝트별 대화와 실시간 리소스 상태를 보존한다 |
| [6aeadbd](https://github.com/Woo-JongHo/www/commit/6aeadbde6cfcdf89df9d13541711854d725305dd) | 승인된 모델과 테스트의 열 정렬을 적용한다 |
| [92de238](https://github.com/Woo-JongHo/www/commit/92de2389b943610f7e12c23a4cd211555d4cae1b) | 새 작업과 보고서 JSON 출력 및 검증 기록을 연결한다 |

## 검토 지적 수정과 추가 게시

| 커밋 | 목적 | 확인 |
|---|---|---|
| [6c1def2](https://github.com/Woo-JongHo/www/commit/6c1def2aabd2b81b5718586f0b12073ff9b10103) | 검증 마감의 시도와 미완료 상태를 기록한다 | verified |
| [c95665d](https://github.com/Woo-JongHo/www/commit/c95665dd495b1f61bd8d886857add725e65d20c6) | BoxBox 외부 런처의 확장자 판정을 바로잡는다 | verified |
| [5d2232c](https://github.com/Woo-JongHo/www/commit/5d2232c7044b58f7b86dd46a0c3c49c3aa3d4b47) | 구조 지도의 책임 설명과 중앙 탐색을 개선한다 | verified |
| [3bdff3f](https://github.com/Woo-JongHo/www/commit/3bdff3f5a22158209bbb08e7f662b4104e9cde66) | Native 대화 사건의 순서와 수명주기를 보존한다 | verified |
| [b33ca14](https://github.com/Woo-JongHo/www/commit/b33ca141808c1002feca1a237223490903f9b3e4) | 승인 재사용과 Native 재연결의 GUI 경계를 검증한다 | verified |
| [e5ddc81](https://github.com/Woo-JongHo/www/commit/e5ddc8117d0593a2454f482e0fb174010e487a49) | 비활성화 상태 보존의 번역과 자료 해시를 바로잡는다 | verified |
| [b21b285](https://github.com/Woo-JongHo/www/commit/b21b28576a1d3a42989141c4e5e4592d74ad7847) | 채팅 뼈대 비교에 현행 권고와 고정 출처 근거를 연결한다 | verified |
| [e7eb1c7](https://github.com/Woo-JongHo/www/commit/e7eb1c7cf51ec0e5cc2c21cd890cfda6ff020efd) | 실제 Terra 검토와 결과 원장의 복구를 연결한다 | verified |
| [15e9484](https://github.com/Woo-JongHo/www/commit/15e9484a369db9908711abd1a3f836329916033c) | Windows 패키징에서 개발용 심볼릭 링크를 제외한다 | verified |

사용자의 185개 표시를 기준 시점의 184개 고유 경로와 staged/unstaged 중복 1건으로 구분했다. 현재까지 184개 고유 경로 모두 게시 이력에 포함됐다. 이는 각 파일의 후속 변경까지 자동 완료했다는 뜻이 아니며 잔여 diff와 검증 상태를 따로 확인한다.

다른 세션이 게시한 명령 카드 변경 `f00b522`는 부모 커밋으로 보존했다. 같은 파일의 뒤 변경을 덮어쓰지 않도록 공유 문서와 생성 JSON은 검증한 후보에서 분리해 게시했다. 이후 생긴 Home 연구와 해당 목차 변경은 이 세션 소유 범위에 포함하지 않고 보존한다.

Native 동작은 공통 사건의 main·preload·renderer·투영·활동 수명주기 API가 함께 성립해야 하므로 같은 기능 커밋으로 묶었다. 검토 core의 RPC 실행·receipt·원장 기록·잠금 복구도 같은 결과 수명주기 계약이어서 함께 게시했다. 번역, 비교 연구, Windows 패키징, GUI 검사 도구는 각각 분리했다.

## 검증 범위

- Native 격리 후보: 집중 230개 통과. 실제 Electron GUI 161개 통과(그때 게시된 명령 카드 포함). 뒤 경계 드라이버 수정 후보는 실제 GUI 205개 통과. 실제 모델·Windows 사람의 한국어 IME 전체 흐름으로 확대하지 않는다.
- Core 격리 후보: strict type·source·architecture·workflow 계약 통과, Node 집중 35개 통과. 실제 Terra 모델 검토는 이 기록 뒤 별도 실행·회수한다.
- Windows 패키징: 실제 Windows build·package exit0. EXE SHA256 `84cadf491046a58f2e4a60fa108f2fbb7ac8135d5d35877885bcd5a6144c4728`.
- 구조 지도: 실제 Electron 85개 통과. 라이브러리 자료 검사: 출처 7개·파일 201개 통과. 전체 번역 의미 검토로 해석하지 않는다.

환경 사전점검의 신규 설계·구현은 [이슈 #1](https://github.com/Woo-JongHo/www/issues/1)과 Workflow/015에서 이어진다. 미실행 검토와 기존 실제 기기·사람 입력 한계가 남으면 전체 완료로 쓰지 않는다.

## 검토 지적 수정과 환경 시스템의 후속 게시 이력

원래 185 표시는 고유 184경로와 staged/unstaged 중복 1건이며 전부 게시 이력에 포함됐다. 아래는 목적별 후속 커밋과 origin/main 관측을 회수한 목록이다. 동시 세션의 릴리스·Home 변경은 별도 범위로 보존했다.

| 커밋 | 목적 | 원격 게시 |
|---|---|---|
| `6c1def2aabd2b81b5718586f0b12073ff9b10103` | 검증 마감의 시도와 미완료 상태를 기록한다 | 확인 |
| `c95665dd495b1f61bd8d886857add725e65d20c6` | BoxBox 외부 런처의 확장자 판정을 바로잡는다 | 확인 |
| `5d2232c7044b58f7b86dd46a0c3c49c3aa3d4b47` | 구조 지도의 책임 설명과 중앙 탐색을 개선한다 | 확인 |
| `3bdff3f5a22158209bbb08e7f662b4104e9cde66` | Native 대화 사건의 순서와 수명주기를 보존한다 | 확인 |
| `b33ca141808c1002feca1a237223490903f9b3e4` | 승인 재사용과 Native 재연결의 GUI 경계를 검증한다 | 확인 |
| `e5ddc8117d0593a2454f482e0fb174010e487a49` | 비활성화 상태 보존의 번역과 자료 해시를 바로잡는다 | 확인 |
| `b21b28576a1d3a42989141c4e5e4592d74ad7847` | 채팅 뼈대 비교에 현행 권고와 고정 출처 근거를 연결한다 | 확인 |
| `e7eb1c7cf51ec0e5cc2c21cd890cfda6ff020efd` | 실제 Terra 검토와 결과 원장의 복구를 연결한다 | 확인 |
| `15e9484a369db9908711abd1a3f836329916033c` | Windows 패키징에서 개발용 심볼릭 링크를 제외한다 | 확인 |
| `92b1b31fc77c9555f83a48a0cf998ad8abd3f5de` | 세션 게시 이력과 기준 원장 27개 및 비용 점검을 기록한다 | 확인 |
| `ebf31e2e443e303af44faf9962fe056a6aee3742` | 실행 전 환경 진단과 원문 출력 보존을 연결한다 | 확인 |
| `202a07ee66303e6e8218e3582af47b702043238b` | 실제 검토 서버의 사용자 입력 echo를 검증해 수용한다 | 확인 |
| `53308d1aab23aafc65e7c0b45d7e0af9754eb409` | 환경 사전점검 실패 후 같은 요청을 다시 실행할 수 있게 한다 | 확인 |
| `0f7661ded359b69a95cbdde67392287d63fffb69` | 대화 목록 갱신을 기다린 뒤 복구 대화를 선택한다 | 확인 |
| `01376d161af68aa15992c64246e3fbe87bc10265` | 대기 중인 낮은 순번의 새 활동도 중복 없이 반응시킨다 | 확인 |
| `9619f57b0b7258e6fe524557f0756fd975756927` | 재연결 뒤 전송 실패에도 같은 대화의 초안을 보존한다 | 확인 |
| `3be2942af0f5be5a5e537c2f76d47dc06a95b066` | 직접 Codex 호출도 원문 보존 경로를 먼저 검증한다 | 확인 |
| `d267a3a41f7d84158f535dbac560efe1da1e685d` | 전송 실패 시 공백과 줄바꿈을 포함한 원문 초안을 복원한다 | 확인 |
| `f799fbdebc4194993d2c13bf3d120c2ca437b64d` | 환경 사전점검의 Terra 통과와 고정 범위 완료를 기록한다 | 확인 |
| `2ec109f06906426eac2819086e31d52c436b63e7` | 검토 입력과 누적 작업 원장의 크기 제한을 분리한다 | 확인 |
| `a144d6bcb498ec7cea7f115d5d8ae827c70799ea` | 새 초안과 충돌한 실패 요청을 명시적으로 복구한다 | 확인 |

통합 수용은 고정 소스 기준이다. 환경 수용은 3be 입력13개와 f799 완료기록을 원본 그대로 보존했다. 후속 공백 초안 d267·원장 제한 2ec·새 초안 충돌 a144는 각각 집중 검사·타입·빌드·화면·실제 검토 근거에 연결했다. 최종 실제 Terra 검토 review-79375c8a-5426-4fc9-921f-d22d18a9a732가 통과했고 Work014 FIX1~5 및 report-complete가 완료됐다. 현재 공유 소스의 별도 릴리스 변경을 통과로 간주하지 않는다.

최신 화면 검사는 실제 Electron225개이며 실제 Windows·사람의 한국어 IME·실제 모델 전체 대화는 이 합성 Native 검사 범위에 포함하지 않는다. 기준27개 목록과 잔여 기준은 ledger.md에 유지한다.

이 문서 자체의 마지막 기록 커밋 해시는 자기 참조를 만들지 않고 Git 이력과 원격 ref 확인 결과로 회수한다.
