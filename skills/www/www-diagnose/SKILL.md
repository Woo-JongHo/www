---
name: www-diagnose
description: WWW 버그의 관찰된 증상과 입증된 원인을 분리해 재현·가설 검사를 기록한다. 명시적으로 호출할 때만 사용한다.
---

# WWW 진단

## 호출 조건

사용자가 `www-diagnose`를 명시적으로 호출한 버그 조사에만 사용한다.

## 입력

증상, 재현 맥락, 관련 작업 ID, 로그·테스트·코드 사실.

## 진입 조건

안전하게 조사할 범위가 있고 증상을 원인으로 단정하지 않았다.

## 절차

1. [공통 계약](../../../docs/skills/WORKFLOW.md), [모델·추론 노력 권고](../../../docs/skills/MODEL_POLICY.md), [데스크톱 프로필](../../../docs/skills/profiles/desktop.md)을 읽는다.
2. 새 버그면 적절한 기능 영역의 다음 번호와 읽기 좋은 제목, 새 UUID로 별도 `kind: bug` 작업 폴더를 만들고 원작업에 `fixes` 또는 `relates_to` 관계를 건다. 기존 작업은 UUID로 스캔해 실제 경로를 찾으며 폴더를 UUID로 이어붙이지 않는다.
3. 관찰 증상, 영향, 재현 조건을 `diagnosis.md`에 기록한다.
4. 경쟁 가설마다 판별 검사를 정하고 직접 검사한다. 가설은 결과 전까지 사실로 쓰지 않는다.
5. 민감 원본은 `.www/evidence/<work-id>/`에 두고 Git에는 정제한 요약만 남긴다.
6. 입증된 원인과 아직 모르는 부분, 최소 수정·회귀 기준을 분리한다.

## 출력 경로

`docs/work/<영역>/<번호>-<버그 작업명>/work.json`, 같은 폴더의 `spec.md`, `diagnosis.md`, 실제 검사 시 `verification.md`; 로컬 원본은 `.www/evidence/<bug-work-id>/`.

## 허용 변경

버그 기록과 안전한 재현·진단 테스트만 변경한다. 제품 수정은 별도 승인된 `www-build`로 넘기며 자동 commit·push를 하지 않는다.

## 완료 조건

증상과 원인이 분리되고 각 원인 주장은 검사 증거가 있거나 명시적으로 미확인이다. 수정 범위와 회귀 기준이 구체적이다.

## 인계

[진단 템플릿](../../../docs/skills/templates/diagnosis.md)의 결과를 승인된 수정의 `www-build`와 결과 판정의 `www-verify`에 전달한다. 이전 검증 기록은 지우거나 과거 실패로 바꾸지 않는다.
