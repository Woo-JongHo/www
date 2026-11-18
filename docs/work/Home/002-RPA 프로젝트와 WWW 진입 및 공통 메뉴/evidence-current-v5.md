# Home 현재 기술 v5 실제 검증 근거

이 문서는 이 UUID의 실제 GUI 관측을 고정한다. 해시 대조나 파일 존재 검사만으로 사용자 시나리오가 실행됐다고 주장하지 않는다. 아래 stdout은 Root가 실제 ordinary host에서 해당 verifier를 실행한 assertion 결과다. 이 문서 작성과 inputs 추가는 GUI 뒤 문서 범위 변화이며 제품 기술 파일은 freeze와 동일함을 captureSource로 직접 확인했다. 이후 정확 기존 unit 실행은 별도의 공식 verify 시도로 기록한다. unit 실행을 GUI 재실행이나 모든 기준 충족으로 표시하지 않는다.

작업 UUID: work-4573f7d4-62eb-4e72-9985-62994c1b30a8
기술 소스 digest: 92ac9550431969000eac58c65ada0905a648bc9dc747d85eee1b3ff201d9138a

## 실제 GUI 실행과 범위

```json
{
  "workId": "work-4573f7d4-62eb-4e72-9985-62994c1b30a8",
  "command": "node",
  "args": [
    "scripts/verify-home.ts"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:19:40.519Z",
  "completedAt": "2026-11-16T23:19:51.471Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "direct dedicated observation; not automatically a registered verifyWork attempt",
  "sourceBefore": "cbf320b9e832a9e9072b2d20d69607f10a8c055b3d960678341cc4245bfb4811",
  "sourceAfter": "cbf320b9e832a9e9072b2d20d69607f10a8c055b3d960678341cc4245bfb4811",
  "sourceStable": true,
  "criteriaDigest": "79a207f08b49cd0f21fad447d8b2d84a11b1ca3be5d49f48a505f76b61bbe3a0",
  "node": "v22.23.1",
  "directories": [
    "home-empty-CznAep",
    "home-multiple-CzqZdH"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/home-empty-CznAep/electron.stderr",
      "bytes": 98,
      "sha256": "a25eacbb57c7861b8b11dc68286c3e69262acf1b5d55fd5c3b9043426628fff9"
    },
    {
      "path": ".www/evidence/home-empty-CznAep/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-empty-CznAep/empty-view-page.png",
      "bytes": 122129,
      "sha256": "f42168146238bd353dd6655f7155950f03b8815f6126157ebb55bd18474374e7"
    },
    {
      "path": ".www/evidence/home-empty-CznAep/empty-www-dashboard.png",
      "bytes": 130698,
      "sha256": "be251cdf3f2b059a64626eef056ee0cfbb07b407e1d8b9279fb74efb4fddc70b"
    },
    {
      "path": ".www/evidence/home-empty-CznAep/summary.json",
      "bytes": 801,
      "sha256": "28d1907216c549e55925e05abe8af5a73669eb03b6e18843e4260e2b55e9bf4a"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/RPA-chat-nav.png",
      "bytes": 108463,
      "sha256": "8f1774fd8d97cbf566523a82fb495112ac6fe5a41aa6bb61c93e3d18b7b2fd81"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/RPA-dashboard-nav.png",
      "bytes": 74835,
      "sha256": "5113cce5cb835d05ca924ac2eec96db43bfeb1b22e34385dd0d84b78e20eba9d"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/RPA-ecosystem-nav.png",
      "bytes": 136136,
      "sha256": "021fbffc4e390344cbc5467d2c0d96d59aca7c6e504fc098b029bf86ed66443f"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/RPA-monitoring-nav.png",
      "bytes": 89853,
      "sha256": "eb10dd25988956644eb010c034591e24db4f1c66e636228f5b9565b938504279"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/RPA-reports-nav.png",
      "bytes": 103224,
      "sha256": "24936ca459bed196cb14ee2e8fccace6f409de3936add5917a77cdcbb3073e1a"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/WWW-chat-nav.png",
      "bytes": 116489,
      "sha256": "3bfb43e414a17576b180f386994d1f802a52cb18353372b05d2d011a8cb274ea"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/WWW-dashboard-nav.png",
      "bytes": 129201,
      "sha256": "bd1be1c1c85089a20a5e1c402dd9fa1b3566268c94cf853bf7c978b82fb734de"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/WWW-ecosystem-nav.png",
      "bytes": 136290,
      "sha256": "0d9dd039f666f1a573bfbdaca11dcf777dbb8f869bc1a4700a51a47bc611eeaa"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/WWW-monitoring-nav.png",
      "bytes": 90443,
      "sha256": "a9fce7af7534011fab820f0c81b979cecfb408fcf8291027cce09552b45b9b0e"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/WWW-reports-nav.png",
      "bytes": 88281,
      "sha256": "4d528bb18b9016fdcb13097c74887a5bedcc5fe896190d7c290a44fc08efcbba"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/calls.jsonl",
      "bytes": 4656,
      "sha256": "ba8531fd836141c64d91454f5579e08ce45c5b7d9fd0dd1d1c6fe8dbf761417c"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/electron.stderr",
      "bytes": 1176,
      "sha256": "1f98ee3d0a1d877756c4515a089e5b0bc955e4428e739765d9a075c7f848e239"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/kanban-detail-narrow-bounds.json",
      "bytes": 1377,
      "sha256": "857e9032fd978446b0c788f021e65757d626348ea2b7fddd2a8be08779dc7ffa"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/kanban-detail-narrow.png",
      "bytes": 68275,
      "sha256": "40ab62b3f2ec9eb162382f5638dfbce8e4becc632c3c020ba3739cdefdce231e"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/kanban-permission-stale.png",
      "bytes": 136314,
      "sha256": "d33253e4b648023ed0feab5fe60987729d472dc891604bd4462160d0f5c6aaac"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/multiple-global-board.png",
      "bytes": 128562,
      "sha256": "f729966165bfdd22e987cc4a1e16c3a61e4f7e7fcbd0e3301af6dae5a40a9304"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/multiple-rpa-board.png",
      "bytes": 71559,
      "sha256": "32a6cd5f8c3b8bb0b4eb1ec211881151af255cc251da0e5522a6d6d32b6b65fb"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/multiple-www-board.png",
      "bytes": 130510,
      "sha256": "74f3bf4c2095019aead5e79eb2bed68e1ebda9a78ca8420212b729a3c47266c6"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/permission-failed.json",
      "bytes": 487,
      "sha256": "cd70d664fc430e63b178fb33ba6d7b8c5ba73dd43bfc46b548d0bf30d772c878"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/permission-partial.json",
      "bytes": 957,
      "sha256": "bc68ade7d3b80e7f0e0377013b52eac6a6bfd95609cf6af308184c724c5b7507"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/summary.json",
      "bytes": 5317,
      "sha256": "874947869871abbcefdb210310e2a32b79d0cd9c3dc5a2794205d6f620d9e8b6"
    },
    {
      "path": ".www/evidence/home-multiple-CzqZdH/view-page-return.png",
      "bytes": 124686,
      "sha256": "4ea8380f4b3711d4e0eee6bf8e742e1057a9fcc52acf319adfa1649aa01091d3"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home002-gui-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home002-gui-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

```jsonl
{"result":"passed","evidence":"/Users/woojongho/woo/00_project/www-handoff-20261116/source/.www/evidence/home-empty-CznAep","checks":["전체 보기와 RPA 추가 버튼 표시","RPA 추가 버튼 활성","RPA 0개 빈 문구·행 0·별도 WWW","RPA 0개 전체 WWW 보드 수집","RPA 0개 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA 0개 WWW 대상 보드 조회","RPA 0개 WWW 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0"],"mode":"empty","coverage":"실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖."}
{"result":"passed","evidence":"/Users/woojongho/woo/00_project/www-handoff-20261116/source/.www/evidence/home-multiple-CzqZdH","checks":["전체 보기와 RPA 추가 버튼 표시","RPA 추가 버튼 활성","등록 RPA 두 개와 전체 보드 준비","전체 보드에 RPA A·B와 WWW 실제 카드","카드 선택에서 실제 IPC·같은 UUID 기준·네 문서 읽기","상세 제목으로 키보드 초점 이동","목록 수집 이후 원장 변경에도 상세 요약과 기준은 동일 응답","상세 담당·영역·원본 경로도 새 상세 원장 응답을 사용","명세 Markdown 표시·스크립트·링크·원격 이미지 비활성","같은 작업의 Todo·검사 방법 표 표시","빈 검증 문서와 미작성 문서 구분","보드 재수집과 상세 응답 완료 뒤 펼친 계획 문서 유지","선택 원장 권한 오류 새로고침 준비","선택 원장 권한 오류 새 snapshot 반영","부분 수집에서 빠진 작업도 이전 상세·시각·계획 펼침·오류·재시도 보존","실제 권한 복원 뒤 상세 재시도 성공·시각 갱신·펼침 보존","권한 복원 후 완전 수집 새로고침 준비","권한 복원 후 완전 수집 새 snapshot 반영","복원된 상세 갱신 완료","640px 실제 휠로 상세 제목과 본문을 가시 영역에 배치","640px 좁은 화면에서 전체 가로 넘침 없이 근거·적용성 표시","상태 변경으로 카드 열이 바뀐 뒤에도 현재 카드로 초점 복귀","복귀 카드에서 실제 Enter로 상세 다시 열기","다른 카드 선택 뒤 이전 작업 내용 격리","동일 UUID도 프로젝트 key로 상세 본문과 기준을 격리","계획 미작성 표시와 이전 계획 비노출","완전 수집 실패 전 상세 열기","프로젝트 전체 수집 실패 새로고침 준비","프로젝트 전체 수집 실패 새 snapshot 반영","전체 수집 실패에도 상세·시각·재시도 보존","실패 중 닫기 뒤 복원 새로고침 준비","실패 중 닫기 뒤 복원 새 snapshot 반영","명시 닫기 뒤 원장 복원으로 과거 상세가 다시 나타나지 않음","삭제 전 상세 응답 도착","선택 원장 실제 삭제 새로고침 준비","선택 원장 실제 삭제 새 snapshot 반영","완전하게 확인한 원장 삭제는 이전 상세를 제거","삭제 뒤 원장 복구 새로고침 준비","삭제 뒤 원장 복구 새 snapshot 반영","삭제된 원장 복구만으로 상세가 자동 복원되지 않음","필터 변경 전 상세 응답 도착","프로젝트 필터 변경은 상세를 회수","같은 범위로 복귀해도 과거 상세를 노출하지 않음","칸반 상세·계획·검증 근거 읽기 실제 자손 fixture 프로세스 0·fixture 호출 0","다중 RPA 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA A 보드 카드 집합은 A만","RPA A 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","보드 비교 중 전체 보기 복귀","RPA 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0","실제 프로젝트 선택 변경 전 상세 읽기","WWW 대상 보드 카드 집합은 WWW만","실제 프로젝트 선택 변경은 이전 상세 캐시를 회수","WWW 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0","WWW 보드에서 전체 보기 복귀","전체 보기 복귀에도 이전 프로젝트 상세가 나타나지 않음","WWW 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0","RPA 대상 대시보드와 화면 프로젝트명·선택 경로","RPA 다섯 공통 메뉴 순서","RPA 대시보드 실제 클릭·화면·선택 대상 유지","RPA 대화 실제 클릭·화면·선택 대상 유지","RPA 생태계 실제 클릭·화면·선택 대상 유지","RPA 리포트 실제 클릭·화면·선택 대상 유지","RPA 모니터링 실제 클릭·화면·선택 대상 유지","RPA 모니터링에서 대화 복귀·선택 대상 유지","RPA 대시보드 복귀·선택 대상 유지","RPA에서 전체 보기 복귀","WWW 대상 대시보드와 화면 프로젝트명·선택 경로","WWW 다섯 공통 메뉴 순서","WWW 대시보드 실제 클릭·화면·선택 대상 유지","WWW 대화 실제 클릭·화면·선택 대상 유지","WWW 생태계 실제 클릭·화면·선택 대상 유지","WWW 리포트 실제 클릭·화면·선택 대상 유지","WWW 모니터링 실제 클릭·화면·선택 대상 유지","WWW 모니터링에서 대화 복귀·선택 대상 유지","WWW 대시보드 복귀·선택 대상 유지","WWW에서 전체 보기 복귀"],"mode":"multiple","coverage":"실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖."}
```

## 현재 기준 전체

```json
[
  {
    "id": "S1",
    "description": "View Page의 왼쪽 탐색에 RPA(+)와 등록 프로젝트 목록, 별도 단일 WWW 진입점을 실제로 표시한다.",
    "required": true
  },
  {
    "id": "S2",
    "description": "RPA 프로젝트 또는 WWW 선택 후 대시보드·대화·생태계·리포트 순서의 공통 메뉴가 선택 대상 범위에서 동작한다.",
    "required": true
  },
  {
    "id": "S3",
    "description": "프로젝트 추가·취소·실패와 실행·승인 중 전환 경계의 관찰 및 검증 시나리오를 기록하고 기존 등록 자료를 보존한다.",
    "required": true
  },
  {
    "id": "S4",
    "description": "이번 직접 구현 요청으로 확대된 권한 안에서 제품 코드·현행 문서·검증을 함께 적용하고, 최초 문서 한정 결정과 미구현 미래 목표는 역사로 구분해 보존한다.",
    "required": true
  },
  {
    "id": "S5",
    "description": "프로젝트 선택 전 전체 대시보드 View Page와 선택 후 대상별 대시보드를 구분하고 RPA·WWW 진입 및 돌아가기를 제공한다.",
    "required": true
  },
  {
    "id": "S6",
    "description": "사용자가 선택한 독립 Codex 대화 탭 여러 개를 동시에 실행하고 출력·승인·중단·프로젝트 상태를 격리한다. 실행·승인 중 및 초안이 남은 탭 닫기와 마지막 탭 닫기를 차단한다.",
    "required": true
  },
  {
    "id": "S7",
    "description": "전체·대상별 칸반 대시보드는 실제 work.json의 UUID·상태·차단 이유를 읽기 전용으로 투영하고 빈 결과·부분 수집·오류를 구분한다. 참고 보드의 제안과 실제 제공 범위를 구별한다.",
    "required": true
  },
  {
    "id": "S8",
    "description": "개발 작업 내부 모델 배분 정책·하네스와 요청/관측/미실행·독립 검토·토큰 효율화 목적을 연결하고, 앱 자동 모델 라우터 미구현과 토큰 절감 미측정을 명시한다.",
    "required": true
  }
]
```

## 미확인과 수용 경계

S1/S2/S5/S7의 View Page·등록 프로젝트·메뉴·보드 관측은 위 실제 assertion에 한정한다. S3의 OS picker 성공·취소·실패와 S6의 실제 동시 대화/승인/중단/닫기 격리는 이 GUI로 전부 실행하지 않았다. 같은 소스의 단위 검사와 실제 추가 관측이 뒷받침하는 범위를 독립 감사가 판단해야 하며 미실행을 PASS로 쓰지 않는다. S4/S8은 현재 문서/권한·모델 배분 구현과 미구현 자동 라우터·절감 미측정 구분의 의미 검토가 필요하다.

엄격 타입·generator·빌드는 Root가 최종 기술 v5에서 실제 실행했다. raw 근거는 native-repair-v5/owned.strict.stdout·owned.strict.stderr 및 authoring-result.json, final/build-v5.log 및 technical-freeze-v5.json이다. 이 문장으로 미존재 파일이나 미실행 항목을 통과로 만들지 않는다. 실제 OS picker·IME·Windows·외부 RPA 및 실제 Native 모델은 별도 경계다. 필수 독립 감사와 완료는 이 문서 작성 시점 아직 미실행이다.

## 추가 고유 실제 실행 — v5 보존

### home002-sessions-formal-v5

```json
{
  "workId": "work-4573f7d4-62eb-4e72-9985-62994c1b30a8",
  "command": "node",
  "args": [
    ".www/evidence/reuse-integrate-resume-20261117/root/execute.mts",
    ".www/evidence/reuse-integrate-resume-20261117/home-closeout/gui-v5-2-sessions-request.json"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:25:45.307Z",
  "completedAt": "2026-11-16T23:25:53.881Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "official verifyWork of existing exact argv inside request; outer process is actual helper",
  "sourceBefore": "8a77487aba3fc3fcc1685756674eeca69e00a7c1322f478deab841a1e1583b8e",
  "sourceAfter": "8a77487aba3fc3fcc1685756674eeca69e00a7c1322f478deab841a1e1583b8e",
  "sourceStable": true,
  "criteriaDigest": "79a207f08b49cd0f21fad447d8b2d84a11b1ca3be5d49f48a505f76b61bbe3a0",
  "node": "v22.23.1",
  "directories": [
    "sessions-ui-U4wehv"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/sessions-ui-U4wehv/calls.jsonl",
      "bytes": 17281,
      "sha256": "47df00a2b926df4358e792e95d17c44625d05e9dbb74e6ec793cdbeb6f4fc824"
    },
    {
      "path": ".www/evidence/sessions-ui-U4wehv/electron.stderr",
      "bytes": 2023,
      "sha256": "de490589984a5d15b1932971bd99e4b1e5664173ca72dec56e001ab0b9c64073"
    },
    {
      "path": ".www/evidence/sessions-ui-U4wehv/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/sessions-ui-U4wehv/sessions-final.png",
      "bytes": 56200,
      "sha256": "78d89a84ff3fef39aec978298eb9d5e7388359e548f765efff612a64392638ee"
    },
    {
      "path": ".www/evidence/sessions-ui-U4wehv/summary.json",
      "bytes": 1909,
      "sha256": "3f6fbfa54ddeec2536d1d12dd9858fc077934e530cad29677141f195b3a6c7dd"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home002-sessions-formal-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home002-sessions-formal-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/sessions-ui-U4wehv/summary.json",
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
    "탭 1eaef113-38ab-4db3-92b3-f03a1836ed8b 활성화",
    "A 초안·읽기 위치·상세 패널 보존",
    "실행·승인 탭 닫기 UI 제한",
    "A 승인 후 B 승인 대기 유지",
    "A 중단 후 B 실행 유지",
    "초안 있는 유휴 탭 닫기 UI 제한",
    "초안 제거 후 닫기 가능",
    "유휴 A 탭 제거와 B 보존",
    "유휴 탭 닫기 후 실제 자식 PID 종료",
    "탭 d4359a22-720b-42f4-ab2b-066b60211fc8 활성화",
    "B 승인 요청 보존",
    "B 종료",
    "마지막 탭 UI 닫기 제한",
    "프로젝트 격리용 탭 생성",
    "탭 d4359a22-720b-42f4-ab2b-066b60211fc8 활성화",
    "같은 탭의 숨은 대화 초안도 탭 닫기 차단",
    "초안 보관 대화 목록",
    "숨은 대화 초안 복원",
    "탭 e7ad309c-ec95-4ee0-bc6f-fbd262a5f910 활성화",
    "WWW 프로젝트 선택 준비",
    "C 프로젝트 전환",
    "새 탭 프로젝트 복제 후 전환은 기존 탭에 영향 없음"
  ]
}
```

## 현재 감사 보류와 남은 수용

위 고유 실행은 v5 소스에서 실제 관측한 결과이며 뒤의 기술 수정에 자동 적용하지 않는다. Root의 Native003/006/013/015 실제 감사가 추가 반례를 발견해 projection·native-activity·agent-overview와 관련 검사/verify-chat oracle의 v6 최소 교정을 준비한다. Home broad src inputs도 영향을 받으므로 전체 Home 독립 감사·최종 결과 승격·업무 완료는 보류한다. 새 소스 뒤 영향 검사를 거쳐 실제 필요한 exact GUI와 전체 기준 actual Terra 의미 수용을 회수한다. S4/S8·DOC-HANDOFF·KANBAN-VERIFY의 의미/감사 조건을 단순 파일checker나 단위 검사 exit0로 통과시키지 않는다. 실제 OS picker·IME·Windows·외부 RPA·실제 Native 모델은 위 fixture GUI 범위 밖이다.
