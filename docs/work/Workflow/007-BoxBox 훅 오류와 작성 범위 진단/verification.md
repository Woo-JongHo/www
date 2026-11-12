# 검증 기록

## 실제 실행

- BoxBox source의 session-modes/lifecycle-hook/guarded-run 집중 66개 통과, 401 expect, 272.98초. 원문 .www/scratchpad/boxbox-diagnosis/lifecycle-authoring.md.
- 격리 설치 후보 타입 검사와 pack:installer 빌드 종료 코드 0. candidate-types.log, candidate-package.log에 보존.
- 읽기 전용 실제 Opus review-41bec5dd-3ccc-4543-b668-fb782b3db25f 통과, 관측 모델 claude-opus-5-5. 원문 opus-result.md 및 후보의 review receipt 보존.
- 공식 installer 패키지 실행으로 Codex 로컬 개발본 0.2.8 설치, 종료 코드 0. 설치 경로와 등록 경로 실재, 수정 엔진 포함, version·doctor 확인. install.log 보존.
- 설치 CLI 구버전/수정본 동시 runtime 변경 비교는 installed-proof.md, installed-smoke.log에 보존. 새 상태는 NO_GROUPS이며 전 코드 BoxBox PASS로 확대하지 않는다.
- Node 22.22.3에서 타입 주석 .mts를 별도 빌드 없이 실행해 42 출력 확인. 전체 TypeScript 이관의 호환성 증거로 확대하지 않는다.

## 현재 판정

작업은 verifying이다. 호스트 재시작 후 수용과 실제 소스 가독성의 미해결 범위가 남아 done으로 처리하지 않았다. 기록된 실행은 저장소 바깥 BoxBox 소스와 설치본을 대상으로 하며, WWW workflow의 docs-only 입력에 대한 AC 통과로 옮겨 쓰지 않았다. commit·push·release는 수행하지 않았다.
