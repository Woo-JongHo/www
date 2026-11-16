# SSH 조사 기준선

## 조사 범위와 한계

2026-11-16 이 대화에서 `ssh chacada`로 설계 문서·YAML 지도·진입 코드의 AST import/함수·일부 Git HEAD와 기존 HTML/미리보기 이미지를 읽었다. 원격 업무 실행·설정/파일 변경·테스트·빌드·메일·배포는 수행하지 않았다. 과거 README에 적힌 통과 수는 이번 실행 증거로 사용하지 않는다.

주 조사 루트는 `/mnt/c/Users/woo/woo/00_project`다. `/home/woo/woo/00_project`의 사본과 이전 WWW 문서도 비교했다. `/mnt/c/Users/woo/00_project`는 다른 위치다. 다음 세션에서 경로·브랜치·dirty 및 소스 식별을 다시 확인한다.

## 지도와 코드가 확인된 프로젝트

GMB 경로의 공통 접두부는 `05_GMBKOREA/RPA/`다. 아래 수는 이번에 읽은 각 루트 `rpa-map.yaml`의 선언을 계산한 값이며 실제 실행 완료량이 아니다.

| 프로젝트/경로 | Process | Task | Unit | 업무 흐름 |
|---|---:|---:|---:|---|
| 제어설계검증/14_HelixQAC | 1 | 6 | 11 | 준비·인증 → MISRA/Secure/Metric → Excel·메일 |
| 제어설계검증/15_VectorCast | 1 | 3 | 8 | NAS 동기화 → 커버리지 파싱·정제 → 출력·업로드·통보 |
| 제어설계검증/16_Polarion | 1 | 6 | 27 | 준비·인증·프로젝트 → Import → 완료·통보 |
| 판매관리팀/FTA원산지 | 1 | 10 | 38 | CO/Invoice/BL → UNIPASS 개요·공통·품목 → 메일·보관 |
| 판매관리팀/외화입금 | 1 | 7 | 15 | 정제·비교 → 로컬 Excel 반영 → 메일 → NAS 게시·보고 |
| PM팀/GMBKOREA-ERP | 1 | 6 | 26 | 로그인 → 센터별 수집·검증·DB 확정 → 보고·전달 |
| 07_KMpark/02_RPA | 4 | 16 | 44 | 아래 네 Process |
| 합계 | 10 | 54 | 169 | 코드/지도 조사 범위 |

KMpark는 p1 원천 통합(3 Task/7 Unit), p2 정제·매핑·DB 반영(5/17), p3 정산서(4/9), p4 운영보고서(4/11)다. `task/processN/`을 사용하며 단일 Process의 `task/` 배치와 구별한다.

GMB Dashboard에는 추가 운영 과제명이 있다. 이 7개가 고객의 전체 자동화나 운영 목록을 의미하지 않는다. 설계/코드가 없는 과제는 별도 inventory의 미확인 대상으로 남긴다.

## 주요 원본

- `05_GMBKOREA/RPA/standardization/projects.json`: GMB 6개 소스 경로와 선택 이유. 등록된 과거 base와 현재 checkout을 대조해야 한다.
- 각 프로젝트 `rpa-map.yaml`: 주소·구성·중단·부수효과·재실행 선언.
- 각 `rpa-map.md`, `architecture.md`, `README.md`, `process.py`, `run.py`: 업무 표시·설계·현재 코드 비교.
- 각 `task/exceptions.yaml`, `task/verification.yaml`: 확인한 상태는 모두 Task별 draft(각 파일에서 총 54개). 실제 운영 수락으로 해석하지 않는다.
- `standardization/README.md`: 공통 runtime seed 0.2.0과 7개 관리 파일·로그·배포/변경 감지 설명. 이번에 전체 코드 일치나 현재 회귀 실행까지 검증한 것은 아니다.

## 중요한 차이와 위험

1. HelixQAC/VectorCast 일부 architecture 문서는 실행 순서가 run.py에 남았다고 설명하지만, 현재 run.py는 process 함수를 import해 위임한다. 문서를 코드 사실로 그대로 투영하지 않는다.
2. Linux GMB 사본의 map은 Windows 조사 소스와 다르다. 이름만으로 합치지 않고 프로젝트 원본·revision을 고정한다.
3. YAML 선언의 rerun_safe는 true 101, false 25, unknown 43개다. 선언은 실환경 입증이나 자동 실행 승인과 다르다. 외부 쓰기 선언은 총 62개다.
4. KMpark 누적 DB 반영은 재실행 시 금액 중복 위험이 있고 setup과 부분 실행의 의미가 다르다. 업무 순서·저장 시점을 공통화 명목으로 바꾸지 않는다.
5. 외화입금은 로컬 Excel 정본과 NAS 사본을 구별한다. 업무 반영·메일·NAS 게시 결과를 분리해야 한다. README상 dry-run이어도 Excel 반영이 수행되는 경계가 있으므로 이름으로 무부작용을 가정하지 않는다.
6. ERP는 센터별 DB 수집 성공과 Excel/메일 전달 실패를 나눈다. 시험 실행과 공식 DB/메일의 범위를 확인해야 한다.
7. FTA/Polarion은 외부 저장과 Import·메일의 미확인 재실행이 존재한다. 단순 재시도 버튼을 먼저 연결하지 않는다.

## 기존 HTML 프로세스 지도

위치: `/mnt/c/Users/woo/woo/00_project/05_GMBKOREA/RPA/rpa-NODE-MAP/`

| 파일 | 확인 내용 |
|---|---|
| rpa-NODE-MAP.html | 약 1.58 MB, CSS/JS/JSON snapshot 내장, title은 rpa-NODE-MAP · GMBKOREA |
| snapshot.json | 추출한 프로젝트·Task·Unit·소스·근거 데이터 |
| build_map.py | 원본 map/코드를 읽는 생성기. 이번에 실행하지 않음 |
| app.js / app.css / template.html | 탐색·표현 소스 |
| editorial.json | 추가 업무 설명·표시 별칭. 원본 주소/안전값을 덮어쓰지 않는 역할 |
| preview-overview.jpg / preview-detail.jpg | 이번 대화에서 실제 이미지를 열어 전체·Unit 상세 모습을 확인 |
| browser-verification.json / verification.json | 파일 존재 확인. 최신 실행 성공을 이번에 재검증한 것은 아님 |

현재 GMB 6개 프로젝트의 38 Task/125 Unit을 대상으로 한다. Task 카드와 Unit 목록·연결선, 검색·줌·팬·미니맵·목록 보기가 있고 상세는 업무 소개/판단과 근거/코드·이력으로 나뉜다. 파일과 snapshot을 읽고 저장된 미리보기 이미지를 확인했으며, 현재 HTML을 브라우저에서 직접 조작한 검증은 하지 않았다.

이 지도는 runtime trace가 아니다. 지도 선이 실제 반복/분기 전체를 나타낸다고 가정하지 않는다. KMpark와 WWW에 연결할 때 데이터 계약·코드 실행 정책·스냅샷 현재성·키보드/좁은 화면을 별도로 검증한다.

## 기타 참고 자산

- `/home/woo/woo/00_project/99_www/docs/workflows/RPA_WORKFLOW.md`, `RPA_DESCRIPTION_CONTRACT.md`, `RPA_RECEIPT_CONTRACT.md`: 이전 7스킬/Receipt/업무 게시 계약. 더 오래된 계획에는 PASS/PARTIAL/BLOCKED, 후속 계약에는 다른 status 체계가 있어 현행으로 통째 복사하지 않는다.
- GMB Dashboard의 `docs/rpa-dashboard-data-logic.md`: 실행 원본·보정·스케줄과 실적 구분의 참고. 운영 성과 집계를 새 공간으로 자동 승계하지 않는다.
- CHACADA의 `ver3/design-artifacts/rpa-dashboard-principles.md`: 판단·다음 행동 중심 UI의 참고. 샘플 상태를 실제 실적으로 사용하지 않는다.
- KMpark `01_Dashboard`: 입력→정제→검증→전송→증거 기록 템플릿의 참고. README의 비용/시간 절감 주장은 이번 실측으로 수용하지 않는다.
