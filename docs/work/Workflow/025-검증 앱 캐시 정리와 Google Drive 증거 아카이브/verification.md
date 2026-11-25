# 검증 앱 캐시와 증거 아카이브 검증

2026-11-24에 `www-main-sync`의 미커밋 변경을 포함한 소스에서 확인했다. 사용자 후속 요청을 반영해 초기 원장의 보유 기간 문구 대신 동일 범위의 후속 성공 여부로 후보를 판단했다. 기존 판정과 영수증 원본은 유지했다.

- `bun test test/evidence-retention.test.ts`의 3개 검사가 통과했다. 캐시와 프로필 설정 구분, 날짜 제한 없는 후보 선정, 작업 문서와 로컬 영수증 참조 보호, 원격 해시 불일치 시 원본 보존, 검증된 이동과 복원을 확인했다. 전송은 모의 원격으로 실행했다.
- `npm run typecheck`, `npm run check:source`, `npm run build`가 통과했다. BoxBox의 미정렬 그룹이 남아 있다.
- `node scripts/verify-chat.ts --ime-enter-only`와 홈 빈 목록 검증이 통과했다. 종료 뒤 프로필에 정리 대상 캐시가 없고 요약이 남아 있었다. 홈 여러 프로젝트 검증은 640px 칸반 상세 조건에서 실패했다. 실패 기록과 화면은 남았고 해당 프로필의 정리 대상 캐시는 제거됐다.
- 별도의 기존 `www` 저장소에서 `plan`을 읽기 전용으로 실행했다. 21개 검증에서 233개 파일, 20,589,680바이트를 후보로 표시했다. 해당 저장소에서 이동을 실행하지 않았다.
- 실제 Google Drive 전송과 독립 검토는 미실행이다. 이 Mac에서는 rclone 원격 설정이 확인되지 않았다.

## 19개 이슈 후속 검증

홈 640px 검증에서 외부 프로젝트 필수 기준의 실제 미평가 사유와 가로 넘침 여부를 확인하도록 시나리오를 수정했다. 통합 후보에서 빈 프로젝트와 다중 프로젝트가 모두 통과했다. `test/evidence-retention.test.ts`의 로컬·모의 원격 테스트 3개도 통과했다. 로컬 로그는 `.www/evidence/session-19-final/home-final.log`에서 확인할 수 있다.

현재 실행 경로에서 `rclone` 바이너리를 발견하지 못했다. 실제 Google Drive 읽기·업로드·복원은 이 기록에서 확인할 수 없다. 원격 전용 폴더와 자격 설정이 준비돼 실제 읽기와 복사본 검증이 관측되면 다음 단계로 이어간다.

## #71 전용 PR 후보 검증

2026-11-25에 `4b12192`에서 분기한 `codex/handoff-issue-71-evidence`에서 검증했다. 전체 로그는 Git에서 무시하는 `.www/evidence/issue-71-publication/`에 보존했다.

- `bun test test/evidence-retention.test.ts`가 3개 검사와 14개 단언을 통과했다. 격리 프로필의 `Code Cache`만 삭제하고 설정·외부 심볼릭 링크를 보존했으며, 경과 일수가 아닌 동일 범위 후속 성공과 문서·영수증 참조로 후보를 고르고, 주입형 메모리 전송에서 원격 SHA-256/바이트 불일치 시 원본을 유지한 뒤 성공 이동·원래 경로 복원·기존 원본 비덮어쓰기를 확인했다.
- `npm run check:source`, `npm run typecheck`, `npm run check:architecture`, `npm run build`가 통과했다. 이 검사는 현재 PR 후보 소스를 대상으로 실행했다.
- `node scripts/verify-home.ts`는 빈 목록 Electron·CDP 시나리오를 통과했다. 다중 프로젝트 시나리오는 기존 640px 상세 화면 조건에서 실패했다. 실패 뒤 `finally`에서 캐시 정리를 실행한 결과 해당 실행 폴더에 `Cache`, `Code Cache`, `GPUCache`, `DawnGraphiteCache`, `DawnWebGPUCache`, `ShaderCache` 잔여가 없었다. 640px 조건 변경은 #72 범위이므로 이 PR에서 수정하지 않는다.
- `command -v rclone`과 Drive·Google 마운트 조회 결과가 비어 있었다. 따라서 실제 Google Drive 계정, 원격 전용 폴더, 업로드·재읽기·복원은 실행하지 않았고 AC-3의 실제 Drive 검증은 차단 상태다. 로컬 사용자 증거나 자격 증명은 전송·변경하지 않았다.
