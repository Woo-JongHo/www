# Home 현재 기술 v5 실제 검증 근거

이 문서는 이 UUID의 실제 GUI 관측을 고정한다. 해시 대조나 파일 존재 검사만으로 사용자 시나리오가 실행됐다고 주장하지 않는다. 아래 stdout은 Root가 실제 ordinary host에서 해당 verifier를 실행한 assertion 결과다. 이 문서 작성과 inputs 추가는 GUI 뒤 문서 범위 변화이며 제품 기술 파일은 freeze와 동일함을 captureSource로 직접 확인했다. 이후 정확 기존 unit 실행은 별도의 공식 verify 시도로 기록한다. unit 실행을 GUI 재실행이나 모든 기준 충족으로 표시하지 않는다.

작업 UUID: work-0e282d77-1c00-4663-8860-483d28148f74
기술 소스 digest: 92ac9550431969000eac58c65ada0905a648bc9dc747d85eee1b3ff201d9138a

## 실제 GUI 실행과 범위

```json
{
  "workId": "work-0e282d77-1c00-4663-8860-483d28148f74",
  "command": "node",
  "args": [
    "scripts/verify-home.ts"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:19:51.514Z",
  "completedAt": "2026-11-16T23:20:02.411Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "direct dedicated observation; not automatically a registered verifyWork attempt",
  "sourceBefore": "53fb3aa98b14b8b95ae2e99d34a8a108767cee2e39652dc9e361e7da5f9a2f24",
  "sourceAfter": "53fb3aa98b14b8b95ae2e99d34a8a108767cee2e39652dc9e361e7da5f9a2f24",
  "sourceStable": true,
  "criteriaDigest": "a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393",
  "node": "v22.23.1",
  "directories": [
    "home-empty-tSIcnL",
    "home-multiple-3znLzs"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/home-empty-tSIcnL/electron.stderr",
      "bytes": 98,
      "sha256": "7e493111b03e3c83f7d281a5e231f78a1be9a3103ec9d6532bbaf82824f4f02d"
    },
    {
      "path": ".www/evidence/home-empty-tSIcnL/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-empty-tSIcnL/empty-view-page.png",
      "bytes": 122324,
      "sha256": "1144d1c2c77aec1cba0e8d6618f092e477ab5d471242099ea03477cfa2b7f183"
    },
    {
      "path": ".www/evidence/home-empty-tSIcnL/empty-www-dashboard.png",
      "bytes": 130695,
      "sha256": "2b235307425b70ea22a101b026d55c681c4b2af7413cd4734287a0620c38afa7"
    },
    {
      "path": ".www/evidence/home-empty-tSIcnL/summary.json",
      "bytes": 801,
      "sha256": "a44890bc1129b877f785d71f449819f0606c220ca881ac36ceb9d8f805e2a47a"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/RPA-chat-nav.png",
      "bytes": 108373,
      "sha256": "eb3d702189906e7b134239ee18780b0612d2eaeed6c09b32f9d051dc1b40d708"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/RPA-dashboard-nav.png",
      "bytes": 74761,
      "sha256": "040511d26b8bf3919029d082e385b1664bb4391e20567730ad2a653db0839ba8"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/RPA-ecosystem-nav.png",
      "bytes": 136136,
      "sha256": "021fbffc4e390344cbc5467d2c0d96d59aca7c6e504fc098b029bf86ed66443f"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/RPA-monitoring-nav.png",
      "bytes": 89096,
      "sha256": "0f41c17f51b0cd3feb12880906baffc94f48f237d7782ecf5180807e6cb5bfaa"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/RPA-reports-nav.png",
      "bytes": 102891,
      "sha256": "604cd4a23d29996a2a5b7ece9867f81872040a4d433a3c6766c1816cd8516e27"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/WWW-chat-nav.png",
      "bytes": 116489,
      "sha256": "3bfb43e414a17576b180f386994d1f802a52cb18353372b05d2d011a8cb274ea"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/WWW-dashboard-nav.png",
      "bytes": 129208,
      "sha256": "9815586a571eae2a3d03fd9dd39b481c4332a258c66c76f9a113f4153080e01b"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/WWW-ecosystem-nav.png",
      "bytes": 136290,
      "sha256": "0d9dd039f666f1a573bfbdaca11dcf777dbb8f869bc1a4700a51a47bc611eeaa"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/WWW-monitoring-nav.png",
      "bytes": 89673,
      "sha256": "1fab8af5741a542b38795dc29a6d0da0510988e9a6e5039822d50dfa0e0e4e4f"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/WWW-reports-nav.png",
      "bytes": 88281,
      "sha256": "4d528bb18b9016fdcb13097c74887a5bedcc5fe896190d7c290a44fc08efcbba"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/calls.jsonl",
      "bytes": 4656,
      "sha256": "1507191a5ad93554a5b2625f17e5c52707bfdf64eeb253957ac42b7de42c93fe"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/electron.stderr",
      "bytes": 1176,
      "sha256": "b063aa75f0276cf9f68fd030eb4d2e389a676eb30ea81060118b1eee32a2db8f"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/kanban-detail-narrow-bounds.json",
      "bytes": 1377,
      "sha256": "857e9032fd978446b0c788f021e65757d626348ea2b7fddd2a8be08779dc7ffa"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/kanban-detail-narrow.png",
      "bytes": 68300,
      "sha256": "71ab36328a1d3e07b091a0411f39efd0784995b9c31a7eb32a2955b809399723"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/kanban-permission-stale.png",
      "bytes": 136412,
      "sha256": "2b787aa597e7c9b27db37911491671b2e39598c9d3b0a0dd6f0f54fb0777cbe7"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/multiple-global-board.png",
      "bytes": 128822,
      "sha256": "0cddddf24ba8f57a0bcdc8ef66967a6eb7ab9933d352a6071903616cd4c767fe"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/multiple-rpa-board.png",
      "bytes": 71531,
      "sha256": "d52ea678ce5418b1719df8f69db0f730ea891dae179a401f7950ef32775545d1"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/multiple-www-board.png",
      "bytes": 130807,
      "sha256": "4f2d0db180b69f62b8d22524186dff13fa3edb8de6ddbcdea5bdc34d0c959c9e"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/permission-failed.json",
      "bytes": 487,
      "sha256": "d42b8b1d0f019c0240e7f542752a2baa8f58f513217908e063319136a9db4dfe"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/permission-partial.json",
      "bytes": 957,
      "sha256": "685a691b5f0b78179d98852c87157e0b7dbb89766e48df4bb1fd378b6f1eb7f5"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/summary.json",
      "bytes": 5317,
      "sha256": "d2569a9ff836a401b02c317d33c588943cac0e1266fd0fead0daef90a3d23b1b"
    },
    {
      "path": ".www/evidence/home-multiple-3znLzs/view-page-return.png",
      "bytes": 124531,
      "sha256": "aedc4e86718f4efd25ac6da515bd79c7384acc3ca5c1d49b245227ae13dade39"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home003-gui-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home003-gui-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

```jsonl
{"result":"passed","evidence":"/Users/woojongho/woo/00_project/www-handoff-20261116/source/.www/evidence/home-empty-tSIcnL","checks":["전체 보기와 RPA 추가 버튼 표시","RPA 추가 버튼 활성","RPA 0개 빈 문구·행 0·별도 WWW","RPA 0개 전체 WWW 보드 수집","RPA 0개 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA 0개 WWW 대상 보드 조회","RPA 0개 WWW 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0"],"mode":"empty","coverage":"실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖."}
{"result":"passed","evidence":"/Users/woojongho/woo/00_project/www-handoff-20261116/source/.www/evidence/home-multiple-3znLzs","checks":["전체 보기와 RPA 추가 버튼 표시","RPA 추가 버튼 활성","등록 RPA 두 개와 전체 보드 준비","전체 보드에 RPA A·B와 WWW 실제 카드","카드 선택에서 실제 IPC·같은 UUID 기준·네 문서 읽기","상세 제목으로 키보드 초점 이동","목록 수집 이후 원장 변경에도 상세 요약과 기준은 동일 응답","상세 담당·영역·원본 경로도 새 상세 원장 응답을 사용","명세 Markdown 표시·스크립트·링크·원격 이미지 비활성","같은 작업의 Todo·검사 방법 표 표시","빈 검증 문서와 미작성 문서 구분","보드 재수집과 상세 응답 완료 뒤 펼친 계획 문서 유지","선택 원장 권한 오류 새로고침 준비","선택 원장 권한 오류 새 snapshot 반영","부분 수집에서 빠진 작업도 이전 상세·시각·계획 펼침·오류·재시도 보존","실제 권한 복원 뒤 상세 재시도 성공·시각 갱신·펼침 보존","권한 복원 후 완전 수집 새로고침 준비","권한 복원 후 완전 수집 새 snapshot 반영","복원된 상세 갱신 완료","640px 실제 휠로 상세 제목과 본문을 가시 영역에 배치","640px 좁은 화면에서 전체 가로 넘침 없이 근거·적용성 표시","상태 변경으로 카드 열이 바뀐 뒤에도 현재 카드로 초점 복귀","복귀 카드에서 실제 Enter로 상세 다시 열기","다른 카드 선택 뒤 이전 작업 내용 격리","동일 UUID도 프로젝트 key로 상세 본문과 기준을 격리","계획 미작성 표시와 이전 계획 비노출","완전 수집 실패 전 상세 열기","프로젝트 전체 수집 실패 새로고침 준비","프로젝트 전체 수집 실패 새 snapshot 반영","전체 수집 실패에도 상세·시각·재시도 보존","실패 중 닫기 뒤 복원 새로고침 준비","실패 중 닫기 뒤 복원 새 snapshot 반영","명시 닫기 뒤 원장 복원으로 과거 상세가 다시 나타나지 않음","삭제 전 상세 응답 도착","선택 원장 실제 삭제 새로고침 준비","선택 원장 실제 삭제 새 snapshot 반영","완전하게 확인한 원장 삭제는 이전 상세를 제거","삭제 뒤 원장 복구 새로고침 준비","삭제 뒤 원장 복구 새 snapshot 반영","삭제된 원장 복구만으로 상세가 자동 복원되지 않음","필터 변경 전 상세 응답 도착","프로젝트 필터 변경은 상세를 회수","같은 범위로 복귀해도 과거 상세를 노출하지 않음","칸반 상세·계획·검증 근거 읽기 실제 자손 fixture 프로세스 0·fixture 호출 0","다중 RPA 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA A 보드 카드 집합은 A만","RPA A 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","보드 비교 중 전체 보기 복귀","RPA 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0","실제 프로젝트 선택 변경 전 상세 읽기","WWW 대상 보드 카드 집합은 WWW만","실제 프로젝트 선택 변경은 이전 상세 캐시를 회수","WWW 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","WWW 보드에서 전체 보기 복귀","전체 보기 복귀에도 이전 프로젝트 상세가 나타나지 않음","WWW 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA 대상 대시보드와 화면 프로젝트명·선택 경로","RPA 다섯 공통 메뉴 순서","RPA 대시보드 실제 클릭·화면·선택 대상 유지","RPA 대화 실제 클릭·화면·선택 대상 유지","RPA 생태계 실제 클릭·화면·선택 대상 유지","RPA 리포트 실제 클릭·화면·선택 대상 유지","RPA 모니터링 실제 클릭·화면·선택 대상 유지","RPA 모니터링에서 대화 복귀·선택 대상 유지","RPA 대시보드 복귀·선택 대상 유지","RPA에서 전체 보기 복귀","WWW 대상 대시보드와 화면 프로젝트명·선택 경로","WWW 다섯 공통 메뉴 순서","WWW 대시보드 실제 클릭·화면·선택 대상 유지","WWW 대화 실제 클릭·화면·선택 대상 유지","WWW 생태계 실제 클릭·화면·선택 대상 유지","WWW 리포트 실제 클릭·화면·선택 대상 유지","WWW 모니터링 실제 클릭·화면·선택 대상 유지","WWW 모니터링에서 대화 복귀·선택 대상 유지","WWW 대시보드 복귀·선택 대상 유지","WWW에서 전체 보기 복귀"],"mode":"multiple","coverage":"실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖."}
```

## 현재 기준 전체

```json
[
  {
    "id": "NAV-KEEP",
    "description": "프로젝트 목록을 열고 탐색하거나 닫는 동안 중앙의 현재 프로젝트·화면·선택 상태를 유지하며 홈 보드로 강제 이동하지 않는다.",
    "required": true
  },
  {
    "id": "NAV-SELECT",
    "description": "현재 프로젝트 재선택은 기존 화면을 유지하고 다른 프로젝트의 명시 선택 성공 때만 해당 대상의 대시보드로 전환한다. 프로젝트 추가 취소·실패 시 기존 화면과 선택을 보존한다.",
    "required": true
  },
  {
    "id": "NAV-GUARD",
    "description": "프로젝트 목록 열기는 실행 중에도 가능하며 실제 다른 프로젝트 전환에는 전송·실행·대화 준비·미결 승인·실패 원문 보호를 유지한다. 사이드바 탐색으로 Native 실행을 중단하거나 새 요청을 만들지 않는다.",
    "required": true
  },
  {
    "id": "NAV-MENU",
    "description": "프로젝트 공통 메뉴를 대시보드·대화·생태계·리포트·모니터링 순서로 제공하고 프로젝트 목록과 명시적 전체 대시보드 열기를 구분한다.",
    "required": true
  },
  {
    "id": "MON-ENTRY",
    "description": "대화 상단의 상세 모니터·세션 모니터 접기/열기 두 기존 버튼을 JSX 주석 처리해 비활성화하고 모니터링 메뉴로 세션 개요와 상세 관측에 접근한다. 숨은 버튼이 키보드 초점이나 클릭 대상에 남지 않는다.",
    "required": true
  },
  {
    "id": "MON-SCOPE",
    "description": "모니터링은 현재 선택한 Codex 대화 탭의 sessionId·프로젝트·thread 범위에 연결되고 활성 턴과 과거 턴의 출처를 구분한다. 다른 탭의 사건·승인·리소스를 혼합하지 않는다.",
    "required": true
  },
  {
    "id": "MON-STATES",
    "description": "모니터링에서 기존 공개 실행·Plan/Progress·Skills/Hooks·리소스·사용량·사건 관측을 재사용하며 새 대화·자료 없음·로딩·연결 종료·수집 오류·부분 이력·오래된 관측을 사실에 따라 표시한다. 관측 열기만으로 새 thread/turn·자동 재전송을 만들지 않는다.",
    "required": true
  },
  {
    "id": "STATE-RETURN",
    "description": "대화·모니터링·프로젝트 목록·다른 탭을 왕복해도 같은 대화의 입력 초안·읽기 위치·출력 카드 펼침을 유지하며 리포트 선택과 생태계 경로 등 현재 화면 상태를 보존한다. 비활성 화면에서도 실행 관측을 놓치지 않는다.",
    "required": true
  },
  {
    "id": "ACCESS-VERIFY",
    "description": "프로젝트 목록·명시적 화면 이동·모니터링을 키보드와 좁은 창에서 사용할 수 있고 현재 프로젝트·세션·선택 메뉴와 초점이 식별된다. 실제 Electron과 합성 Native 시나리오·스크린샷·소스 식별을 연결해 검증한다.",
    "required": true
  },
  {
    "id": "DOC-HANDOFF",
    "description": "명세·설계·실행 계획에 기준별 구현·검증·관련 기존 작업과 권한을 연결하고 현행 구현·새 목표·미실행 검토를 구분한다. 문서 작성만으로 제품 구현이나 완료를 표시하지 않는다.",
    "required": true
  }
]
```

## 미확인과 수용 경계

다섯 메뉴와 프로젝트 선택·모니터링 진입/복귀는 위 실제 assertion에 한정한다. NAV-KEEP/NAV-GUARD/MON-SCOPE/MON-STATES/STATE-RETURN/ACCESS-VERIFY 전체 조건(실행·승인·초안·읽기 위치·실패/부분/EOF·모니터 키보드)은 이 Home GUI만으로 모두 재실행하지 않았다. 정확 단위 검사와 소스 및 현재 추가 관측이 뒷받침하는 범위를 독립 감사가 판단해야 한다. DOC-HANDOFF는 현재 문서와 원장 연결의 의미 검토가 필요하다.

엄격 타입·generator·빌드는 Root가 최종 기술 v5에서 실제 실행했다. raw 근거는 native-repair-v5/owned.strict.stdout·owned.strict.stderr 및 authoring-result.json, final/build-v5.log 및 technical-freeze-v5.json이다. 이 문장으로 미존재 파일이나 미실행 항목을 통과로 만들지 않는다. 실제 OS picker·IME·Windows·외부 RPA 및 실제 Native 모델은 별도 경계다. 필수 독립 감사와 완료는 이 문서 작성 시점 아직 미실행이다.

## 추가 고유 실제 실행 — v5 보존

### home003-chat-formal-v5

```json
{
  "workId": "work-0e282d77-1c00-4663-8860-483d28148f74",
  "command": "node",
  "args": [
    ".www/evidence/reuse-integrate-resume-20261117/root/execute.mts",
    ".www/evidence/reuse-integrate-resume-20261117/home-closeout/gui-v5-3-chat-request.json"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:25:53.925Z",
  "completedAt": "2026-11-16T23:26:30.443Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "official verifyWork of existing exact argv inside request; outer process is actual helper",
  "sourceBefore": "be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729",
  "sourceAfter": "be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729",
  "sourceStable": true,
  "criteriaDigest": "a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393",
  "node": "v22.23.1",
  "directories": [
    "chat-ui-JY4rE9"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/chat-ui-JY4rE9/chat-viewport-1040x680.png",
      "bytes": 114368,
      "sha256": "9591bbeeaf46d005e78ab2e0046792bbb81f029474ecc8710b5eb1aabd5b7545"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/chat-viewport-1440x680.png",
      "bytes": 120755,
      "sha256": "93c06ef65dfa0a3e516a0f66b22e71c1adb9b95c499b75e49b39eda3f5ad594d"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/chat-viewport-860x680.png",
      "bytes": 81186,
      "sha256": "5fcc74e3bfe007b5c01b1fd62169c3c3adbdfba6ae2d5e51ed9f07984ca9d5a3"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/chat-width-1040.png",
      "bytes": 149310,
      "sha256": "422013cd280d4a8fb3039b24a04ef7cd72251bb26e169ce1c8a2f01854c5d07c"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/chat-width-1440.png",
      "bytes": 156719,
      "sha256": "505b8286ad5759ee33be83995a02f827eb80ef2d5f93148bc75d87a4e39e7274"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/command-json-formatted.png",
      "bytes": 187863,
      "sha256": "4c83b69a589a882dd342703903a7711b0ebc9f80ea40cf34330f3a01232f94f6"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-1.stderr",
      "bytes": 4387,
      "sha256": "4dd538d7a1d05f6d2066c7e70c5fb786f3e975cd5e9342c6e1b72d533ce6be08"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-1.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-2.stderr",
      "bytes": 602,
      "sha256": "abf6f9a51e8a62e420ae34f1e295c906d21ffba559e7d746f91ce69803d79d93"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-2.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-3.stderr",
      "bytes": 2810,
      "sha256": "38754bc1ef402b893d676c3484a34f8636fe89c28c62c45c6d9dcd4188ae0646"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/electron-3.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/home-1.png",
      "bytes": 123546,
      "sha256": "cbe748f39551bb8c029c1fde954cf0210bf9ee6c7be50fcf357d32b47457abbc"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/home-2.png",
      "bytes": 123204,
      "sha256": "7d2a51c678ee70849ba9b3e0f6858171da70e0f7894e05c066f46dcace8e9e42"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/home-3.png",
      "bytes": 129743,
      "sha256": "9834546ce4b3177ccb6df9686fd1860c75d5a8a3c74784d4c672b624b6633270"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/live-command.png",
      "bytes": 164298,
      "sha256": "f022ff8c38ee7744bfc933b9186a85b7fa0c029e245b7c45868fc7c1dc4ddaaf"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/native-boundaries.json",
      "bytes": 401,
      "sha256": "105d48a0c45846458f33ab8bf9b57308bd92d3b5c3565a492d9f5c18c1c69c46"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/new-chat.png",
      "bytes": 156799,
      "sha256": "25f65d6da072149cc7d3323ae81f5c2fde590efe45f7603a65ba111037bef7ea"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/project-isolation.json",
      "bytes": 1547,
      "sha256": "63b5c17a7af040357aba30cf65f52131acbf4f9f6c0042163159a4f234097ba3"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/project-isolation.png",
      "bytes": 161556,
      "sha256": "e36f6a3be7ecfe0a05b01247ae65c73a62989e0fafe6a05d7cbea5aa65fe4605"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/project-navigation-narrow.png",
      "bytes": 59415,
      "sha256": "4ee8fe2414211487b7fefe1ba967f91f17a982a6775ed72fc257a705ec106d2f"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/project-storage-warning-roundtrip.png",
      "bytes": 94207,
      "sha256": "164f28dbd164cf5f2be28767d093e77730d5b5be0a0216dd017345a0ea9e5091"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/project-storage-warning.png",
      "bytes": 114724,
      "sha256": "ad9575c2be8072c799d929bfe170fb3a89684ba2d4ad836dc9c8d9924f94be69"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/reconnect-draft-conflict.json",
      "bytes": 231,
      "sha256": "e85f7b3e1da23ce0e379bbd096fae57d070b6b912c268a450c4627752e99fa0b"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/reconnect-draft-conflict.png",
      "bytes": 172703,
      "sha256": "85804e16cb115d4ceabf831929b2d1119da5bfa6502cc4790c589093514aca89"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/reconnect-draft.json",
      "bytes": 258,
      "sha256": "5c90ae450b593783e2be89fa9734316886de4f9d7543ec37e354041cd6ae6c51"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/restart-chat.png",
      "bytes": 157850,
      "sha256": "03c97054fee8e5f077f60685fd34098640429e9c6646026d3c3a260de3fe9ed0"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/restored-chat.png",
      "bytes": 165641,
      "sha256": "c5a1770d5723f8adf0b2feb650072dbe05cc766c6b6e759f6084389f19415793"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/session-monitoring.png",
      "bytes": 97696,
      "sha256": "f3786158575961d94c6907ceb4b98fa6aecc1a99ecf91f356082adc6803e7478"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/sidebar-first-request.png",
      "bytes": 158732,
      "sha256": "57f6debff7eb45d3046e9346e4c05d2ea80dd8f0832f81a226bc24a3646693ef"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/sidebar-second-request.png",
      "bytes": 159194,
      "sha256": "d1fa490513ca8efa783cffa1cb2391597920a1034b96b1521bc554b55f8b338e"
    },
    {
      "path": ".www/evidence/chat-ui-JY4rE9/summary.json",
      "bytes": 46327,
      "sha256": "5e550e938886696797e4af55064bf548d50cfa049144926ec366feb350fd4b18"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home003-chat-formal-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home003-chat-formal-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/chat-ui-JY4rE9/summary.json",
  "result": "passed",
  "coverage": "실제 Electron DOM·preload IPC·stdio·합성 Native 원장·앱 재시작. 창 크기 검사는 CDP renderer viewport이며 폭 999px 이하는 실제 Native 최소 창보다 작은 합성 viewport다. 실제 모델·Windows·실제 한국어 IME는 미검증.",
  "checks": [
    "프로젝트 선택 전 전체 보기",
    "전체 보기에서 Native 자동 실행 없음",
    "현재 프로젝트 대시보드 진입",
    "프로젝트 저장 대화 목록",
    "실제 비동기 false 조건은 대기 만료로 거부",
    "저장 대화 Markdown 복원",
    "표와 fenced code 실제 DOM",
    "비공개 reasoning 미노출",
    "명령 카드 10줄 미리보기",
    "명령 출력 들여쓰기와 종료 후 앞 10줄",
    "짧은 실패 출력은 단일 pre에 전체 표시하고 확장 버튼 없음",
    "한도 초과 실패 출력 자동 펼침과 보관 범위 안내",
    "보관된 전체 출력 펼치기",
    "접힌 출력은 단일 pre에 앞 10줄만 표시",
    "Ctrl+T는 포커스된 첫 카드만 펼침",
    "Ctrl+T는 두 번째 카드만 독립 전환",
    "각 카드 Ctrl+T 접힘 독립 유지",
    "종료 코드 0과 검토 미실행 분리·JSON 2칸 정렬",
    "실제 JSON 4종 색상·셸 옵션 강조·명령 줄바꿈",
    "출력 펼침 Enter 포커스",
    "정렬된 전체 출력의 큰 정수 보존·긴 줄 줄바꿈",
    "원문 전환 버튼 키보드 포커스",
    "키보드 원문 전환과 종료 개행까지 원본 일치",
    "원문 복사 Enter 포커스",
    "원문 클립보드 쓰기 성공 안내",
    "실제 클립보드 원문 완전 일치",
    "출력 접기 Space 포커스",
    "Space로 출력 한 번 접기·미리보기 유지",
    "출력 내부 끝에서 실제 휠 입력",
    "대화 빈 영역 휠은 대화 스크롤",
    "실제 휠 전후 문서 scrollTop과 입력 사각형 불변",
    "긴 답변 마지막 문장과 입력창 분리",
    "기준선 DOM 치수 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "긴 URL과 코드 줄바꿈으로 가로 넘침 방지",
    "viewport 1040x680 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "창 1040x680 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동",
    "창 폭 1040에서 본문·입력 접근",
    "창 1040 명령 카드 가로 넘침 격리",
    "viewport 1040x900 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "창 1040x900 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동",
    "창 폭 1040에서 본문·입력 접근",
    "창 1040 명령 카드 가로 넘침 격리",
    "viewport 1440x680 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "창 1440x680 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동",
    "창 폭 1440에서 본문·입력 접근",
    "창 1440 명령 카드 가로 넘침 격리",
    "viewport 860x680 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "창 860x680 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동",
    "창 폭 860에서 본문·입력 접근",
    "창 860 명령 카드 가로 넘침 격리",
    "viewport 1440x900 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "창 1440x900 전체 넘침·프레임 가시 범위·본문 세로 이동·코드/긴 표 가로 이동",
    "창 폭 1440에서 본문·입력 접근",
    "창 1440 명령 카드 가로 넘침 격리",
    "기본 Agent 개요와 모니터링 분리",
    "기본 Skills 다섯 개와 상세 Hook 분리",
    "기존 토글은 DOM과 초점 순서에 없음",
    "입력 반영",
    "프로젝트 목록 탐색 중 중앙 대화 유지",
    "현재 프로젝트 재선택은 초안과 읽기 위치 보존",
    "모니터링 메뉴의 세션 상세",
    "관측 대상 세션과 대화 식별",
    "Escape로 대화 복귀",
    "모니터링 왕복 후 초안과 과거 읽기 보존",
    "모니터 닫기 뒤 의미 있는 메뉴 초점 복귀",
    "입력 반영",
    "코드 복사 클릭 성공",
    "인용은 초안에 추가",
    "다른 저장 대화 선택",
    "짧은 대화 여백 실제 휠 뒤 문서 scrollTop·입력 사각형 유지",
    "입력 반영",
    "대화별 인용 초안 보존",
    "대화별 읽기 위치 보존",
    "재마운트 뒤 짧은 실패는 확장 버튼 없음",
    "재마운트 뒤 수동 접힘은 새 실패에도 유지",
    "신규 계약은 실제 보이는 기본 사이드바에서 검사",
    "입력 반영",
    "실제 Native 하위 작업 시작",
    "도구 호출 완료만으로 하위 작업 완료 처리하지 않음",
    "Native 상태 완료 후 하위 작업 완료 표시",
    "기본 사이드바의 실제 첫 요청 plan과 Hook 제외",
    "첫 요청 종료",
    "상세 모니터에 두 Hook 실패·완료 보존",
    "실제 main 해시 경계에서 미등록 문서 두 개·중복 병합·비공개 경로 비저장 확인",
    "입력 반영",
    "B 전송 중 기본 사이드바에서 A plan·Hook 결과를 제거",
    "B 수락 후 plan·호출 미제공을 이전 A 완료로 채우지 않음",
    "B의 새 plan만 기본 사이드바에 갱신",
    "기본 사이드바 두 번째 요청 종료",
    "입력 반영",
    "Electron 키보드 Enter 전송",
    "키보드 전송 종료",
    "입력 반영",
    "Electron Shift+Enter 줄바꿈",
    "입력 반영",
    "합성 한국어 조합 Enter는 전송하지 않음",
    "합성 조합 종료 후 별도 Enter 전송",
    "합성 조합 전송 종료",
    "입력 반영",
    "전송 실패 뒤 초안 보존과 오류 표시",
    "입력 반영",
    "실시간 관측은 모니터링 페이지에서 확인",
    "후속 요청 경과 시간은 현재 턴에서 시작",
    "턴 종료 전 실시간 카드 최근 10줄",
    "잘못된 JSON 경고와 살아 있는 연결·명령 스트리밍 구분",
    "요청 클릭→실시간 카드 관측 35ms (수신→반영 지연과 별개)",
    "실시간 사건 중 과거 읽기 위치 유지",
    "실패 종료 후 앞 10줄과 보관 출력 펼침",
    "실시간 카드 턴 종료",
    "실시간 관측 뒤 상세 닫기와 기본 사이드바 복원",
    "입력 반영",
    "15초 무활동은 실패가 아닌 대기로 표시",
    "무활동 턴 종료",
    "입력 반영",
    "알 수 없는 종료의 흐름과 결과 요약",
    "결과 미확인 턴 종료",
    "입력 반영",
    "명령 거절 확인은 실제 수신 상태를 표시",
    "명령 거절 확인 턴 종료",
    "입력 반영",
    "턴 중단 확인은 실제 수신 상태를 표시",
    "턴 중단 확인 턴 종료",
    "입력 반영",
    "재개 후 실제 turn 요청과 답변",
    "후속 요청 최종 종료",
    "입력 반영",
    "Native 승인 대기 표시",
    "작업 흐름의 승인 대기 우선 표시",
    "실행 중 대화 변경 차단",
    "프로젝트 전환 거부 후 기존 승인 보전",
    "승인 응답 왕복",
    "승인 턴 실제 종료 뒤 다음 요청 허용",
    "입력 반영",
    "printf boundary-approval-1은 실제 main이 허용한 승인 버튼 표시",
    "printf boundary-approval-2은 실제 main이 허용한 승인 버튼 표시",
    "오래된 token 거부 뒤 새 승인 버튼 보존",
    "실제 IPC는 이전 token 응답을 거부하고 fixture response 수를 늘리지 않음",
    "printf boundary-approval-3은 실제 main이 허용한 승인 버튼 표시",
    "printf boundary-approval-4은 실제 main이 허용한 승인 버튼 표시",
    "오래된 token 거부 뒤 새 승인 버튼 보존",
    "실제 IPC는 이전 token 응답을 거부하고 fixture response 수를 늘리지 않음",
    "동일 프로세스 numeric/string 승인 ID 네 번의 실제 응답 완료",
    "같은 Native PID에서 42/42/문자열42/문자열42를 각각 한 번 승인",
    "입력 반영",
    "printf boundary-resolved-first은 실제 main이 허용한 승인 버튼 표시",
    "실제 resolved 알림만으로 턴 종료 전에 대기 승인 카드 닫힘",
    "승인 해소 뒤 실제 interrupted 종료와 선택 복구",
    "입력 반영",
    "printf boundary-resolved-next은 실제 main이 허용한 승인 버튼 표시",
    "오래된 token 거부 뒤 새 승인 버튼 보존",
    "실제 IPC는 이전 token 응답을 거부하고 fixture response 수를 늘리지 않음",
    "해소한 request ID를 새 token으로 정상 승인",
    "입력 반영",
    "실제 stdio summary A·commentary B·summary C의 DOM 수신 순서",
    "완료 요약은 기존 두 조각 위치와 commentary 상대 순서를 보존하고 A/C를 제거",
    "정정된 요약 조각의 시간 위치 대응은 미확인 경고로 명시",
    "교차 공개 설명 턴 종료",
    "복원 pulse를 검사할 실제 상세 모니터 열기",
    "입력 반영",
    "Native Hook 사건은 실제 카탈로그 행에 관측됨",
    "idle Native subprocess 종료를 실제 transport closed로 수신",
    "종료 전 실제 Hook pulse가 끝난 뒤 복원 관측 시작",
    "입력 반영",
    "재연결은 과거 본문을 한 번 교체하고 새 live 설명·답변을 보존",
    "idle 종료 뒤 동일 thread 후속 턴 완료",
    "재연결 marker는 scope가 같은 historical snapshot이며 fresh userPrompt보다 앞섬",
    "새 Native PID의 read/resume/turns-list 뒤 같은 thread 후속 요청",
    "복원 중 과거 Hook pulse 추가 0개",
    "입력 반영",
    "실패 복구 검사 전 idle Native 종료",
    "입력 반영",
    "전송 오류 전에 실제 재연결 snapshot이 화면에 수용됨",
    "재연결 뒤 같은 turn/start 실패는 비운 초안을 정확 복원",
    "실제 idle 종료→read/resume→snapshot 수용 뒤 turn/start 오류에서도 초안 보존·자동 재전송 0회",
    "입력 반영",
    "입력 반영",
    "충돌 검사 요청이 실제 Native 오류 gate에서 대기함",
    "입력 반영",
    "실제 전송 실패 원문과 새 초안을 공백·줄바꿈까지 별도로 보존",
    "충돌 원문을 해결하기 전 중복 전송·선택 전환을 막고 이유와 해결 버튼 표시",
    "리포트 화면에서도 실패 원문을 확인할 대화 복귀 안내 표시",
    "화면 전환 뒤에도 대화 탭으로 돌아와 원문 해결 가능",
    "입력 반영",
    "새 초안을 비운 뒤 원문 복원 허용",
    "명시적 원문 복원은 입력창만 채우고 충돌 보관을 해제",
    "전송 중 새 초안과 실패 원문을 따로 보존하고 명시적 복원만 허용·자동 전송 0회",
    "입력 반영",
    "입력 반영",
    "실행 중 Native subprocess 종료 수신",
    "실행 중 단절 결과를 확인한 뒤 수동 요청 가능",
    "미확정 턴 뒤 다른 대화를 실제 UI로 명시적으로 열기",
    "목록 갱신 뒤 원래 대화 A 버튼 표시·활성 대기",
    "원래 Native 대화를 명시적으로 다시 열어 수동 복구 허용",
    "입력 반영",
    "명시한 수동 후속 요청의 새 실제 답변 수신",
    "단절 뒤 사용자가 명시한 새 후속 요청만 완료",
    "실행 중 단절의 미확정 turn/start는 자동·수동 복구 뒤에도 총 1회",
    "입력 반영",
    "현재 중단 요청의 실행 중 중단 버튼",
    "중단 최종 결과 확인",
    "중단 결과 요약",
    "새 대화 이력 분리",
    "입력 반영",
    "새 스레드 생성 전 낙관적 접수 카드",
    "새 Native 스레드 요청",
    "프로젝트 선택 전 전체 보기",
    "전체 보기에서 Native 자동 실행 없음",
    "현재 프로젝트 대시보드 진입",
    "프로젝트 저장 대화 목록",
    "앱 재시작 뒤 Native 저장 이력 재열기",
    "재시작 뒤 실제 대화 원장과 마지막 저장 revision 복원",
    "즐겨찾기 조작을 위한 프로젝트 목록",
    "접근 가능한 이름으로 프로젝트 즐겨찾기 키보드 초점 접근",
    "실제 즐겨찾기 저장",
    "프로젝트 선택 전 전체 보기",
    "전체 보기에서 Native 자동 실행 없음",
    "현재 프로젝트 대시보드 진입",
    "프로젝트 저장 대화 목록",
    "긴 한국어 프로젝트 860×680 선택행·아이콘·탐색 배경의 지역 경계 보전",
    "다른 프로젝트 앱 재시작에서 최근·즐겨찾기 복원",
    "같은 thread 문자열의 프로젝트 B 관측 복원",
    "입력 반영",
    "실제 프로젝트 전환과 대화 목록 재연결 프로젝트 목록",
    "실제 프로젝트 전환과 대화 목록 재연결 대시보드",
    "실제 프로젝트 전환과 대화 목록 재연결 대화 목록",
    "프로젝트 A의 원래 Native 대화 재연결",
    "입력 반영",
    "프로젝트 B 복귀 프로젝트 목록",
    "프로젝트 B 복귀 대시보드",
    "프로젝트 B 복귀 대화 목록",
    "동일 thread 문자열의 프로젝트별 초안 격리·복원",
    "서로 다른 프로젝트의 동일 thread 관측·초안 격리",
    "재시작 후 즐겨찾기·누적 원장 복원",
    "동일 userData의 두 번째 main은 Native 시작 없이 종료",
    "이전 선택 요청과 승인 중 프로젝트 전환 차단",
    "입력 반영",
    "격리 profile 실제 파일 경로 방해로 원장 저장 실패와 미확정 revision 재현",
    "저장 실패 뒤 A 전환 프로젝트 목록",
    "저장 실패 뒤 A 전환 대시보드",
    "저장 실패 뒤 A 전환 대화 목록",
    "다른 프로젝트로 전환해도 이전 B의 저장 미확정 경고 보전",
    "전체 flush의 실제 실패 scope B만 진단하고 정상 A로 귀속하지 않음",
    "이전 저장 경고를 새 프로젝트의 원장 데이터로 수용하지 않음",
    "전체 보기에서도 실제 실패 scope 진단 유지",
    "B 실패 후 정상 A에서 다시 전환해도 A를 실패 대상으로 덮지 않음",
    "미선택 실패 thread의 경고와 새 빈 대화 리소스는 왕복 뒤에도 분리",
    "반복 Enter는 실제 stdio 요청 1개"
  ],
  "sameNativeThread": true
}
```

### home003-sessions-formal-v5

```json
{
  "workId": "work-0e282d77-1c00-4663-8860-483d28148f74",
  "command": "node",
  "args": [
    ".www/evidence/reuse-integrate-resume-20261117/root/execute.mts",
    ".www/evidence/reuse-integrate-resume-20261117/home-closeout/gui-v5-3-sessions-request.json"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:26:30.487Z",
  "completedAt": "2026-11-16T23:26:39.478Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "official verifyWork of existing exact argv inside request; outer process is actual helper",
  "sourceBefore": "be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729",
  "sourceAfter": "be59b5541a5ae5af90f78a7c0e2a373f47af0795c70833f08c7e03e5d9ae3729",
  "sourceStable": true,
  "criteriaDigest": "a84db83fd0b7f08c63a6bce9ab7b9b94cda673028f7d4c7f088d3521b29a8393",
  "node": "v22.23.1",
  "directories": [
    "sessions-ui-kePnVw"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/sessions-ui-kePnVw/calls.jsonl",
      "bytes": 17281,
      "sha256": "3143e25dc90674c9a95c66e95474d0719157f33e08870870df376048a892f1b9"
    },
    {
      "path": ".www/evidence/sessions-ui-kePnVw/electron.stderr",
      "bytes": 2023,
      "sha256": "8c4d923d7cb472c162877433da47cbb509983098ebbe74c48fbe4415e42e7451"
    },
    {
      "path": ".www/evidence/sessions-ui-kePnVw/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/sessions-ui-kePnVw/sessions-final.png",
      "bytes": 56200,
      "sha256": "78d89a84ff3fef39aec978298eb9d5e7388359e548f765efff612a64392638ee"
    },
    {
      "path": ".www/evidence/sessions-ui-kePnVw/summary.json",
      "bytes": 1909,
      "sha256": "1cb067afb5fa413db8395924e96e2a5826fe29f7c4fb2566039d76477d998816"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home003-sessions-formal-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home003-sessions-formal-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/sessions-ui-kePnVw/summary.json",
  "result": "passed",
  "coverage": "실제 Electron·IPC·별도 stdio 자식, 합성 Native fixture. 실제 모델·Windows·OS IME 미검증.",
  "checks": [
    "최초 세션 탭 준비",
    "세션 화면 준비",
    "현재 프로젝트 준비",
    "프로젝트 대시보드 진입",
    "A 승인과 실행 중",
    "A 읽기 위치를 확인할 스크롤 영역",
    "두 번째 독립 탭 생성",
    "세션 화면 준비",
    "B는 A 소유 thread를 IPC에서 거부하고 Native read 미호출",
    "두 세션 동시 실행·동일 ID 승인 대기",
    "같은 requestId 42의 서로 다른 토큰과 교차 오용 거부",
    "양쪽 Native 출력 스트리밍",
    "탭 469c75ec-c046-485d-8c01-00e993af1672 활성화",
    "A 초안·읽기 위치·상세 패널 보존",
    "실행·승인 탭 닫기 UI 제한",
    "A 승인 후 B 승인 대기 유지",
    "A 중단 후 B 실행 유지",
    "초안 있는 유휴 탭 닫기 UI 제한",
    "초안 제거 후 닫기 가능",
    "유휴 A 탭 제거와 B 보존",
    "유휴 탭 닫기 후 실제 자식 PID 종료",
    "탭 e7a0d5c0-9fb0-41d2-b55f-0ba3299b1cb3 활성화",
    "B 승인 요청 보존",
    "B 종료",
    "마지막 탭 UI 닫기 제한",
    "프로젝트 격리용 탭 생성",
    "탭 e7a0d5c0-9fb0-41d2-b55f-0ba3299b1cb3 활성화",
    "같은 탭의 숨은 대화 초안도 탭 닫기 차단",
    "초안 보관 대화 목록",
    "숨은 대화 초안 복원",
    "탭 1c342c7e-024a-4fa0-a1b8-5646d671f7c2 활성화",
    "WWW 프로젝트 선택 준비",
    "C 프로젝트 전환",
    "새 탭 프로젝트 복제 후 전환은 기존 탭에 영향 없음"
  ]
}
```

## 현재 감사 보류와 남은 수용

위 고유 실행은 v5 소스에서 실제 관측한 결과이며 뒤의 기술 수정에 자동 적용하지 않는다. Root의 Native003/006/013/015 실제 감사가 추가 반례를 발견해 projection·native-activity·agent-overview와 관련 검사/verify-chat oracle의 v6 최소 교정을 준비한다. Home broad src inputs도 영향을 받으므로 전체 Home 독립 감사·최종 결과 승격·업무 완료는 보류한다. 새 소스 뒤 영향 검사를 거쳐 실제 필요한 exact GUI와 전체 기준 actual Terra 의미 수용을 회수한다. S4/S8·DOC-HANDOFF·KANBAN-VERIFY의 의미/감사 조건을 단순 파일checker나 단위 검사 exit0로 통과시키지 않는다. 실제 OS picker·IME·Windows·외부 RPA·실제 Native 모델은 위 fixture GUI 범위 밖이다.
