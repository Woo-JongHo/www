> 한국어 번역본: 고정 커밋 `f29319d550d1f05404f7184b92e995600ca2293f`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 구현 계획: [FEATURE]

**브랜치**: `[###-feature-name]` | **날짜**: [DATE] | **명세**: [link]

**입력**: `/specs/[###-feature-name]/spec.md`의 기능 명세

**참고**: 이 템플릿은 `__SPECKIT_COMMAND_PLAN__` 명령으로 작성되며, 해당 명령의 정의가 실행 워크플로를 설명한다.

## 요약

[기능 명세에서 추출: 주요 요구사항 + 연구에서 도출한 기술적 접근 방식]

## 기술 맥락

<!--
  조치 필요: 이 섹션의 내용을 프로젝트의 기술 세부사항으로 교체한다.
  여기에 제시된 구조는 반복 개선 과정을 안내하기 위한 참고 사항이다.
-->

**언어/버전**: [예: Python 3.11, Swift 5.9, Rust 1.75 또는 NEEDS CLARIFICATION]

**주요 의존성**: [예: FastAPI, UIKit, LLVM 또는 NEEDS CLARIFICATION]

**저장소**: [해당하는 경우, 예: PostgreSQL, CoreData, 파일 또는 해당 없음]

**테스트**: [예: pytest, XCTest, cargo test 또는 NEEDS CLARIFICATION]

**대상 플랫폼**: [예: Linux 서버, iOS 15+, WASM 또는 NEEDS CLARIFICATION]

**프로젝트 유형**: [예: library/cli/web-service/mobile-app/compiler/desktop-app 또는 NEEDS CLARIFICATION]

**성능 목표**: [도메인별, 예: 1000 req/s, 10k lines/sec, 60 fps 또는 NEEDS CLARIFICATION]

**제약 조건**: [도메인별, 예: <200ms p95, <100MB 메모리, 오프라인 지원 또는 NEEDS CLARIFICATION]

**규모/범위**: [도메인별, 예: 사용자 10k명, 1M LOC, 화면 50개 또는 NEEDS CLARIFICATION]

## 헌법 확인

*게이트: 0단계 연구 전에 통과해야 한다. 1단계 설계 후 다시 확인한다.*

[헌법 파일을 기반으로 결정된 게이트]

## 프로젝트 구조

### 문서(이 기능)

```text
specs/[###-feature]/
├── plan.md              # 이 파일(__SPECKIT_COMMAND_PLAN__ 명령 출력)
├── research.md          # 0단계 출력(__SPECKIT_COMMAND_PLAN__ 명령)
├── data-model.md        # 1단계 출력(__SPECKIT_COMMAND_PLAN__ 명령)
├── quickstart.md        # 1단계 출력(__SPECKIT_COMMAND_PLAN__ 명령)
├── contracts/           # 1단계 출력(__SPECKIT_COMMAND_PLAN__ 명령)
└── tasks.md             # 2단계 출력(__SPECKIT_COMMAND_TASKS__ 명령 - __SPECKIT_COMMAND_PLAN__으로 생성되지 않음)
```

### 소스 코드(저장소 루트)
<!--
  조치 필요: 아래 자리표시자 트리를 이 기능의 구체적인 레이아웃으로 교체한다.
  사용하지 않는 옵션을 삭제하고 선택한 구조를 실제 경로(예: apps/admin,
  packages/something)로 확장한다. 제공되는 계획에는 옵션 레이블이 없어야 한다.
-->

```text
# [REMOVE IF UNUSED] 옵션 1: 단일 프로젝트(기본값)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] 옵션 2: 웹 애플리케이션("frontend" + "backend"가 감지된 경우)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] 옵션 3: 모바일 + API("iOS/Android"가 감지된 경우)
api/
└── [위의 backend와 동일]

ios/ 또는 android/
└── [플랫폼별 구조: 기능 모듈, UI 흐름, 플랫폼 테스트]
```

**구조 결정**: [선택한 구조를 문서화하고 위에 기록된 실제
디렉터리를 참조한다]

## 복잡성 추적

> **헌법 확인에서 정당화해야 하는 위반 사항이 있을 때만 작성한다**

| 위반 사항 | 필요한 이유 | 더 단순한 대안을 거부한 이유 |
|-----------|------------|-------------------------------------|
| [예: 네 번째 프로젝트] | [현재 필요] | [프로젝트 3개로 충분하지 않은 이유] |
| [예: Repository 패턴] | [구체적인 문제] | [직접 DB 접근으로 충분하지 않은 이유] |
