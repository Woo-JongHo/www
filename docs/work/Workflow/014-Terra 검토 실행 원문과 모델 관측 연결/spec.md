# Terra 검토 실행 원문과 모델 관측 연결

## 요청과 목적

CLI 검토가 소스를 읽고 실제 실행 메타데이터를 보존해 공유 게이트에서 검증할 수 있게 한다.

사용자의 직접 요청으로 접수했다. 요청 식별값은 work.json의 workflow.requestHash에 보존한다.

## 범위

변경 경로·표면·검증 명령과 커밋·게시 권한은 work.json의 workflow.authorization을 따른다. 범위 확대는 기존 권한으로 간주하지 않는다.

## 수용 기준

정의와 필수 여부의 정본은 work.json이다. 관련 기준: `TERRA-READ`, `TERRA-MODEL`, `TERRA-RECEIPT`, `TERRA-LIVE`.

## 결정과 열린 질문

작업 접수는 구현 완료가 아니다. 재개 시 같은 UUID와 현재 증거를 확인한다.
