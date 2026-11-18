# 검증 재사용과 합본 선별 통합

## 요청과 목적

추가 직접 요청 USER-VERIFICATION-REUSE.md를 기존 W021의 통합과 연결한다. 기존 main 55건에는 이 추가 재사용 기능의 접수가 없음을 확인해 공식 open으로 main UUID를 만들며, private 사본 UUID·보고서·PASS를 가져오지 않는다.

1. COMBINED-READY의 base/current 지문을 대조하고 7개 비생성 파일 hunk와 공통 관측 기준 한 문단만 통합한다. 기존 Home4·후속 main 하네스·Native 변경을 보존한다.
2. 남은 독립 저작을 회수한 뒤 기술 입력을 동결하고 같은 프로세스 opt-in API의 집중 회귀, 환경 drift·권한·pending·현재성, 영향받는 공통/GUI 검사를 실행한다. 입력·기준·환경·범위·명령·산출물이 일치한 core 허용 결과만 재사용한다.
3. 실제 실행·재사용·무효화 이유와 횟수·시간을 보존하고 현재 원문 권한에 결속한 독립 Terra, 문서 영향, 저작 보고서와 complete/readback을 회수한다. 커밋·push·외부 쓰기·전역 변경을 하지 않는다. 현재 다음 행동은 build이며 사본 QA는 main 완료가 아니다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `REUSE-CURRENT`, `REUSE-SAFETY`, `INTEGRATE-CURRENT`.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.
