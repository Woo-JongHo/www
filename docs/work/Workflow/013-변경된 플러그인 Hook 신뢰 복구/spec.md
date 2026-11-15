# 변경된 플러그인 Hook 신뢰 복구

## 요청과 목적

BoxBox·Vercel의 동일 Hook 정의와 변경된 플러그인 내용 지문을 대조하고 정식 호스트 검토 경로로 신뢰를 복구한 뒤 실제 Native 수용을 확인한다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `HOOK-1`, `HOOK-2`, `HOOK-3`.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.
