# Home004 기술 v5 실제 검증 근거

작업 UUID: work-84cda38b-7265-40d7-bf47-5a22ece1b3a2

이 문서는 고유 actual GUI·IPC 관측을 보존한다. 파일 SHA 검사는 원문 무변경 대조이며 사용자 시나리오 실행을 대신하지 않는다. 아래 assertion은 Root의 실제 ordinary host 실행 결과다. 단위 검사·정적 의미 검토·실제 Electron은 서로 다른 근거다.

## 추가 고유 실제 실행 — v5 보존

### home004-gui-v5

```json
{
  "workId": "work-84cda38b-7265-40d7-bf47-5a22ece1b3a2",
  "command": "node",
  "args": [
    "scripts/verify-dashboard-race.ts"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:20:02.462Z",
  "completedAt": "2026-11-16T23:20:07.802Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "direct dedicated observation; not automatically a registered verifyWork attempt",
  "sourceBefore": "8985f1ad8e6f5d992d64ce89d57b01607198bc15e05b85236894532a1882f510",
  "sourceAfter": "8985f1ad8e6f5d992d64ce89d57b01607198bc15e05b85236894532a1882f510",
  "sourceStable": true,
  "criteriaDigest": "06ebb9a8a9c841f5d7cd577c5639c4ea78c3a4138e5ab23b3a9e9fd912d604e8",
  "node": "v22.23.1",
  "directories": [
    "dashboard-race-caPSln"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/dashboard-race-caPSln/bundle.log",
      "bytes": 71,
      "sha256": "b882179e060ac5a26522547f1e5990750415c0e07f300fcb67660a972ef87089"
    },
    {
      "path": ".www/evidence/dashboard-race-caPSln/electron.stderr",
      "bytes": 98,
      "sha256": "f27f2c4647f627128f6e7764d9c3745392443050e030ea5650c6b44c486429ba"
    },
    {
      "path": ".www/evidence/dashboard-race-caPSln/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/dashboard-race-caPSln/latest-b.png",
      "bytes": 69141,
      "sha256": "61ebd9bcf8c6bff1cd74bf337fedea85c350619b1f28a8256f412d17eec0ef6d"
    },
    {
      "path": ".www/evidence/dashboard-race-caPSln/summary.json",
      "bytes": 2127,
      "sha256": "3a822fd3db6987d24e4f17b876f34b9dcf4fd62a3863a34fd6046c0f28862e0b"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home004-gui-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home004-gui-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/dashboard-race-caPSln/summary.json",
  "result": "passed",
  "coverage": "실제 Electron·React DashboardView·preload IPC와 정상 backend 조회 응답을 사용한다. 별도 mount에서 snapshot·응답 전달 순서를 제어하고, 상세 응답의 요약 필드·검증 표식을 합성 변경하며 renderer API 실패를 주입했다. 실제 backend 오류·앱 전체 연결·자연 발생 경합·실제 Native 모델/환경의 검증 증거는 아니다.",
  "checks": [
    "실제 Electron 및 preload 준비",
    "실제 목록 IPC를 사용한 컴포넌트 mount",
    "실제 상세 IPC 1 도착",
    "실제 상세 IPC 2 도착",
    "실제 상세 IPC 3 도착",
    "실제 상세 IPC 4 도착",
    "최신 B 응답 표시",
    "이전 응답 2 해제 후 B 유지",
    "이전 응답 1 해제 후 B 유지",
    "이전 응답 0 해제 후 B 유지",
    "같은 최신 상세 응답의 경로·담당·영역 표시",
    "닫기 전 실제 A 상세 IPC 도착",
    "닫기 뒤 지연 응답이 상세를 복원하지 않음",
    "보존 검사 B 상세 도착",
    "보존 검사 정상 B 표시",
    "부분 수집의 카드 부재에도 정상 상세 유지",
    "부분 수집 갱신 실제 상세 IPC",
    "갱신 응답 해제 전에는 고유 표식이 없고 이전 상세와 갱신 중 표시가 있음",
    "부분 수집 갱신 응답의 새 제목·고유 기준 적용 및 갱신 중 해제",
    "상세 갱신 실패 명시",
    "실패 갱신에서도 같은 선택의 정상 상세 유지",
    "완전 수집의 작업 부재는 상세 보존과 구분",
    "완전 수집에서 사라진 선택을 다음 부분 수집이 복원하지 않음",
    "다른 선택 실패 검사 카드 복원",
    "다른 선택 실패 직전 실제 정상 B 상세 IPC 도착",
    "A 실패 검사 직전 정상 B 제목·기준·문서가 실제 표시됨",
    "정상 B에서 A 선택 후 A 실패 표시",
    "정상 B 직후 A 실패에는 이전 B 제목·기준·문서를 표시하지 않음"
  ]
}
```

### home004-fullhome-gui-v5

```json
{
  "workId": "work-84cda38b-7265-40d7-bf47-5a22ece1b3a2",
  "command": "node",
  "args": [
    "scripts/verify-home.ts"
  ],
  "cwd": "/Users/woojongho/woo/00_project/www-handoff-20261116/source",
  "startedAt": "2026-11-16T23:26:39.520Z",
  "completedAt": "2026-11-16T23:26:50.566Z",
  "exitCode": 0,
  "signal": null,
  "error": null,
  "executor": "actual ordinary host child process",
  "registration": "direct dedicated observation; not automatically a registered verifyWork attempt",
  "sourceBefore": "8985f1ad8e6f5d992d64ce89d57b01607198bc15e05b85236894532a1882f510",
  "sourceAfter": "8985f1ad8e6f5d992d64ce89d57b01607198bc15e05b85236894532a1882f510",
  "sourceStable": true,
  "criteriaDigest": "06ebb9a8a9c841f5d7cd577c5639c4ea78c3a4138e5ab23b3a9e9fd912d604e8",
  "node": "v22.23.1",
  "directories": [
    "home-empty-5QGRzE",
    "home-multiple-kSFiCA"
  ],
  "artifacts": [
    {
      "path": ".www/evidence/home-empty-5QGRzE/electron.stderr",
      "bytes": 98,
      "sha256": "b75509204845d5e956b698fec6a79a4e7bc322341b9771bee6aa6dd1f77354b8"
    },
    {
      "path": ".www/evidence/home-empty-5QGRzE/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-empty-5QGRzE/empty-view-page.png",
      "bytes": 120567,
      "sha256": "41b1f6c3ad5d810f6adab1e113ded52209afb808010612c54da26c3cd1921fe5"
    },
    {
      "path": ".www/evidence/home-empty-5QGRzE/empty-www-dashboard.png",
      "bytes": 129326,
      "sha256": "d6c8ebb693341d14208cff44cea65ba30defbae56210ec4af74ddcdf6b3fe127"
    },
    {
      "path": ".www/evidence/home-empty-5QGRzE/summary.json",
      "bytes": 801,
      "sha256": "7744c81737556297b70ecd41633e8fce1e6f7586e457537d8dc1f294979f94ff"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/RPA-chat-nav.png",
      "bytes": 108305,
      "sha256": "985311f07b0b30c31a527ce67b2b85ba2110cef46452592e6e891245d93f9261"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/RPA-dashboard-nav.png",
      "bytes": 75513,
      "sha256": "7617bfdd1cc623ec8fe35bf5a0f2d09ec8455129d239d17d6205ab58a2741938"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/RPA-ecosystem-nav.png",
      "bytes": 135936,
      "sha256": "832a0b1a33b9e2a6ae2e597ec9fa00f35fb8058631210fdd82a4006905e07867"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/RPA-monitoring-nav.png",
      "bytes": 89447,
      "sha256": "808d23b5291cf61e4ad5129b96cca04c120aacf5060c15d6ae528414fb0a0a70"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/RPA-reports-nav.png",
      "bytes": 103139,
      "sha256": "85cef9ef73ee53e909c3741fa056867c211e13cd258e0371b7fcc5caecd2bca6"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/WWW-chat-nav.png",
      "bytes": 116176,
      "sha256": "ce8febd5622df4d2bedc87e6e25e569296d609fad78a8618551d6bc15d34a6f7"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/WWW-dashboard-nav.png",
      "bytes": 128262,
      "sha256": "aff861dbdebfe5ae4fa94afa052dd8c7e70c2058c9c003a86c772f84177816b8"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/WWW-ecosystem-nav.png",
      "bytes": 136101,
      "sha256": "9334b0b1f5cbba082db9dda443bdc233cd8498ec1b5059fe91cc3c3a72f4a857"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/WWW-monitoring-nav.png",
      "bytes": 89885,
      "sha256": "3ed83babf34d0386309ba6028658c792f870ee96d61b241a9557e5a40d117b5a"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/WWW-reports-nav.png",
      "bytes": 88109,
      "sha256": "4b3a1a299e52c6f0f7fec5b9931b542ff96aa5c473161154f1657983df713480"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/calls.jsonl",
      "bytes": 4656,
      "sha256": "c7935edab4d3f0bdfb814d1ed776c32ae09e60fffba420f93fc65365c08ecad6"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/electron.stderr",
      "bytes": 1176,
      "sha256": "1dee3f0ab26cf049e09f7c050e15891c38efd274811d6630f9a3d8057b4b05ab"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/electron.stdout",
      "bytes": 0,
      "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/kanban-detail-narrow-bounds.json",
      "bytes": 1374,
      "sha256": "ee405681415e9861f3e52114ff863f274a1ce3d7228c87e492edb1a74d1159d6"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/kanban-detail-narrow.png",
      "bytes": 69337,
      "sha256": "2c1c6c12623a40994d1ea50c418c2d897874fc30a6bfe84b163f85aabc412a20"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/kanban-permission-stale.png",
      "bytes": 137027,
      "sha256": "f12a402b959c55e4fec075de781e36ae859d5242e3f007c914550a2a293d840f"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/multiple-global-board.png",
      "bytes": 126938,
      "sha256": "bc6fc2b109c84fc31fb8c931d41377e476d58384546fb4eb2fb7f936efeca9db"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/multiple-rpa-board.png",
      "bytes": 72198,
      "sha256": "8c2f7996b4b1b976be9a5bdab99975452a04d3fe9225a7e960bdb946f7db8f23"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/multiple-www-board.png",
      "bytes": 129008,
      "sha256": "ef870abda0ebb38ba968d67266799fab2df4e15e3acfb30e39cd60f69cc8698d"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/permission-failed.json",
      "bytes": 487,
      "sha256": "4aa95dd26219bb4a829754b927b05aabd75e19963284236063b0151c07a88391"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/permission-partial.json",
      "bytes": 957,
      "sha256": "b176159b801a875fc7cae9a33cd13b381c09774143bc5fcea4aacc1fb81e0ec6"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/summary.json",
      "bytes": 5317,
      "sha256": "42cbc8ad2f0c42bcfd29123a3f6c63b615f769a27952d5f489bdca4ad86642d3"
    },
    {
      "path": ".www/evidence/home-multiple-kSFiCA/view-page-return.png",
      "bytes": 123717,
      "sha256": "a084e7753e550afeb76cc41d9b77d881bca35599f236cc31c7bbf7a2d5f24387"
    }
  ],
  "stdout": ".www/evidence/reuse-integrate-resume-20261117/final/home004-fullhome-gui-v5.stdout",
  "stderr": ".www/evidence/reuse-integrate-resume-20261117/final/home004-fullhome-gui-v5.stderr",
  "boundary": "Actual Electron/IPC with each verifier declared fixture/model/OS limits; no cross-UUID PASS or completion inferred."
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/home-empty-5QGRzE/summary.json",
  "result": "passed",
  "coverage": "실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖.",
  "checks": [
    "전체 보기와 RPA 추가 버튼 표시",
    "RPA 추가 버튼 활성",
    "RPA 0개 빈 문구·행 0·별도 WWW",
    "RPA 0개 전체 WWW 보드 수집",
    "RPA 0개 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "RPA 0개 WWW 대상 보드 조회",
    "RPA 0개 WWW 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0"
  ]
}
```

실제 verifier summary (레이아웃 원시 측정은 원본 파일에서 읽는다):

```json
{
  "path": ".www/evidence/home-multiple-kSFiCA/summary.json",
  "result": "passed",
  "coverage": "실제 Electron·CDP 포인터·preload IPC, 합성 Native fixture. RPA 0개는 내부 WWW workspace 선택 상태다. 폴더 선택 OS 대화상자 성공·취소·실패와 실제 모델·Windows는 이 검사 범위 밖.",
  "checks": [
    "전체 보기와 RPA 추가 버튼 표시",
    "RPA 추가 버튼 활성",
    "등록 RPA 두 개와 전체 보드 준비",
    "전체 보드에 RPA A·B와 WWW 실제 카드",
    "카드 선택에서 실제 IPC·같은 UUID 기준·네 문서 읽기",
    "상세 제목으로 키보드 초점 이동",
    "목록 수집 이후 원장 변경에도 상세 요약과 기준은 동일 응답",
    "상세 담당·영역·원본 경로도 새 상세 원장 응답을 사용",
    "명세 Markdown 표시·스크립트·링크·원격 이미지 비활성",
    "같은 작업의 Todo·검사 방법 표 표시",
    "빈 검증 문서와 미작성 문서 구분",
    "보드 재수집과 상세 응답 완료 뒤 펼친 계획 문서 유지",
    "선택 원장 권한 오류 새로고침 준비",
    "선택 원장 권한 오류 새 snapshot 반영",
    "부분 수집에서 빠진 작업도 이전 상세·시각·계획 펼침·오류·재시도 보존",
    "실제 권한 복원 뒤 상세 재시도 성공·시각 갱신·펼침 보존",
    "권한 복원 후 완전 수집 새로고침 준비",
    "권한 복원 후 완전 수집 새 snapshot 반영",
    "복원된 상세 갱신 완료",
    "640px 실제 휠로 상세 제목과 본문을 가시 영역에 배치",
    "640px 좁은 화면에서 전체 가로 넘침 없이 근거·적용성 표시",
    "상태 변경으로 카드 열이 바뀐 뒤에도 현재 카드로 초점 복귀",
    "복귀 카드에서 실제 Enter로 상세 다시 열기",
    "다른 카드 선택 뒤 이전 작업 내용 격리",
    "동일 UUID도 프로젝트 key로 상세 본문과 기준을 격리",
    "계획 미작성 표시와 이전 계획 비노출",
    "완전 수집 실패 전 상세 열기",
    "프로젝트 전체 수집 실패 새로고침 준비",
    "프로젝트 전체 수집 실패 새 snapshot 반영",
    "전체 수집 실패에도 상세·시각·재시도 보존",
    "실패 중 닫기 뒤 복원 새로고침 준비",
    "실패 중 닫기 뒤 복원 새 snapshot 반영",
    "명시 닫기 뒤 원장 복원으로 과거 상세가 다시 나타나지 않음",
    "삭제 전 상세 응답 도착",
    "선택 원장 실제 삭제 새로고침 준비",
    "선택 원장 실제 삭제 새 snapshot 반영",
    "완전하게 확인한 원장 삭제는 이전 상세를 제거",
    "삭제 뒤 원장 복구 새로고침 준비",
    "삭제 뒤 원장 복구 새 snapshot 반영",
    "삭제된 원장 복구만으로 상세가 자동 복원되지 않음",
    "필터 변경 전 상세 응답 도착",
    "프로젝트 필터 변경은 상세를 회수",
    "같은 범위로 복귀해도 과거 상세를 노출하지 않음",
    "칸반 상세·계획·검증 근거 읽기 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "다중 RPA 전체 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "RPA A 보드 카드 집합은 A만",
    "RPA A 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "보드 비교 중 전체 보기 복귀",
    "RPA 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "실제 프로젝트 선택 변경 전 상세 읽기",
    "WWW 대상 보드 카드 집합은 WWW만",
    "실제 프로젝트 선택 변경은 이전 상세 캐시를 회수",
    "WWW 대상 보드 조회 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "WWW 보드에서 전체 보기 복귀",
    "전체 보기 복귀에도 이전 프로젝트 상세가 나타나지 않음",
    "WWW 보드에서 전체 보기 복귀 실제 자손 fixture 프로세스 0·fixture 호출 0",
    "RPA 대상 대시보드와 화면 프로젝트명·선택 경로",
    "RPA 다섯 공통 메뉴 순서",
    "RPA 대시보드 실제 클릭·화면·선택 대상 유지",
    "RPA 대화 실제 클릭·화면·선택 대상 유지",
    "RPA 생태계 실제 클릭·화면·선택 대상 유지",
    "RPA 리포트 실제 클릭·화면·선택 대상 유지",
    "RPA 모니터링 실제 클릭·화면·선택 대상 유지",
    "RPA 모니터링에서 대화 복귀·선택 대상 유지",
    "RPA 대시보드 복귀·선택 대상 유지",
    "RPA에서 전체 보기 복귀",
    "WWW 대상 대시보드와 화면 프로젝트명·선택 경로",
    "WWW 다섯 공통 메뉴 순서",
    "WWW 대시보드 실제 클릭·화면·선택 대상 유지",
    "WWW 대화 실제 클릭·화면·선택 대상 유지",
    "WWW 생태계 실제 클릭·화면·선택 대상 유지",
    "WWW 리포트 실제 클릭·화면·선택 대상 유지",
    "WWW 모니터링 실제 클릭·화면·선택 대상 유지",
    "WWW 모니터링에서 대화 복귀·선택 대상 유지",
    "WWW 대시보드 복귀·선택 대상 유지",
    "WWW에서 전체 보기 복귀"
  ]
}
```

## 현재 감사 보류와 남은 수용

위 고유 실행은 v5 소스에서 실제 관측한 결과이며 뒤의 기술 수정에 자동 적용하지 않는다. Root의 Native003/006/013/015 실제 감사가 추가 반례를 발견해 projection·native-activity·agent-overview와 관련 검사/verify-chat oracle의 v6 최소 교정을 준비한다. Home broad src inputs도 영향을 받으므로 전체 Home 독립 감사·최종 결과 승격·업무 완료는 보류한다. 새 소스 뒤 영향 검사를 거쳐 실제 필요한 exact GUI와 전체 기준 actual Terra 의미 수용을 회수한다. S4/S8·DOC-HANDOFF·KANBAN-VERIFY의 의미/감사 조건을 단순 파일checker나 단위 검사 exit0로 통과시키지 않는다. 실제 OS picker·IME·Windows·외부 RPA·실제 Native 모델은 위 fixture GUI 범위 밖이다.
