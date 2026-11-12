> 한국어 번역본: 고정 커밋 `f29319d550d1f05404f7184b92e995600ca2293f`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# [PROJECT_NAME] 헌법
<!-- 예: Spec 헌법, TaskFlow 헌법 등 -->

## 핵심 원칙

### [PRINCIPLE_1_NAME]
<!-- 예: I. 라이브러리 우선 -->
[PRINCIPLE_1_DESCRIPTION]
<!-- 예: 모든 기능은 독립형 라이브러리로 시작한다. 라이브러리는 자체 완결적이고 독립적으로 테스트할 수 있으며 문서화되어야 한다. 명확한 목적이 필요하며, 구성만을 위한 라이브러리는 허용하지 않는다 -->

### [PRINCIPLE_2_NAME]
<!-- 예: II. CLI 인터페이스 -->
[PRINCIPLE_2_DESCRIPTION]
<!-- 예: 모든 라이브러리는 CLI를 통해 기능을 제공한다. 텍스트 입출력 프로토콜: stdin/args → stdout, 오류 → stderr. JSON 및 사람이 읽을 수 있는 형식을 지원한다 -->

### [PRINCIPLE_3_NAME]
<!-- 예: III. 테스트 우선(절대 양보 불가) -->
[PRINCIPLE_3_DESCRIPTION]
<!-- 예: TDD는 필수다. 테스트 작성 → 사용자 승인 → 테스트 실패 → 그다음 구현. Red-Green-Refactor 주기를 엄격히 적용한다 -->

### [PRINCIPLE_4_NAME]
<!-- 예: IV. 통합 테스트 -->
[PRINCIPLE_4_DESCRIPTION]
<!-- 예: 통합 테스트가 필요한 중점 영역: 새 라이브러리 계약 테스트, 계약 변경, 서비스 간 통신, 공유 스키마 -->

### [PRINCIPLE_5_NAME]
<!-- 예: V. 관찰 가능성, VI. 버전 관리 및 호환성을 깨는 변경, VII. 단순성 -->
[PRINCIPLE_5_DESCRIPTION]
<!-- 예: 텍스트 I/O는 디버깅 가능성을 보장한다. 구조화된 로깅이 필요하다. 또는 MAJOR.MINOR.BUILD 형식. 또는 단순하게 시작하고 YAGNI 원칙을 따른다 -->

## [SECTION_2_NAME]
<!-- 예: 추가 제약 조건, 보안 요구사항, 성능 표준 등 -->

[SECTION_2_CONTENT]
<!-- 예: 기술 스택 요구사항, 규정 준수 표준, 배포 정책 등 -->

## [SECTION_3_NAME]
<!-- 예: 개발 워크플로, 검토 프로세스, 품질 게이트 등 -->

[SECTION_3_CONTENT]
<!-- 예: 코드 검토 요구사항, 테스트 게이트, 배포 승인 프로세스 등 -->

## 거버넌스
<!-- 예: 헌법은 다른 모든 관행에 우선한다. 개정에는 문서화, 승인, 마이그레이션 계획이 필요하다 -->

[GOVERNANCE_RULES]
<!-- 예: 모든 PR/검토는 준수 여부를 확인해야 한다. 복잡성에는 정당한 근거가 있어야 한다. 런타임 개발 지침은 [GUIDANCE_FILE]을 사용한다 -->

**버전**: [CONSTITUTION_VERSION] | **비준일**: [RATIFICATION_DATE] | **최종 개정일**: [LAST_AMENDED_DATE]
<!-- 예: 버전: 2.1.1 | 비준일: 2025-06-13 | 최종 개정일: 2025-07-16 -->
