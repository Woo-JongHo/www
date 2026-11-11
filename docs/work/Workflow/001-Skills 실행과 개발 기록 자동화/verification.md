# 검증 기록

<a id="2026-11-12-opt-in-하네스-구현-검증"></a>
## 2026-11-12 opt-in 하네스 구현 검증

- 소스: `028b4a378885938c43e9172b7534fc4e83e7d57e` 위 dirty 작업 트리
- `node --test test/workflow-harness.test.mjs`: 5개 통과. 직접 요청/인용 분리, 승인 밖 mutation, advisory 한계, traversal, event 멱등·revision·redaction·동시 writer를 확인했다.
- `npm run check`: 통과. 전체 Bun 테스트 37개, TypeScript 검사와 빌드 통과.
- 워크플로/Skill library 검사와 `git diff --check`: 통과.
- 런처는 명시적 `execute: true`에서만 GJC를 argv spawn하고 `--append-system-prompt`로 정본 Skill 컨텍스트를 전달한다. 이는 native Skill invoke, 자동 hook, OS sandbox 또는 mutation hard gate가 아니다.
- `.www/runtime/`은 `.gitignore`에 포함되어 있고 prompt 원문과 비밀 키는 기록하지 않는다.

### 판정

AC-1~8의 최소 프로젝트 opt-in 구현과 집중 테스트를 확보했다. 실제 추가 GJC inference를 통한 host 통합은 수행하지 않았으므로 모델 관측값은 런처가 반환하는 범위에 한정한다. 전역 hook과 자동 활성화는 의도적으로 지원하지 않는다.
