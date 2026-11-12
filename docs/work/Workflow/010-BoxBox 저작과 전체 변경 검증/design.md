# BoxBox 저작과 전체 변경 검증 설계

## 목표와 범위

사용자의 최신 요청은 BoxBox 스킬·엔진·플러그인을 수정하고 WWW 변경을 실제로 그 흐름에 통과시켜 커밋·푸시하는 것이다. 개별 정렬 규칙 13개 등록은 이 목표의 대체물이 아니다.

- BoxBox 정본: product/plugin/의 스킬과 product/engine/의 언어·안전 모듈. 생성 plugin/과 설치본은 정본에서 만든다.
- WWW: 최종 선택한 변경 전체를 목록화하고 BoxBox 지원 파일을 명시 검사한다. 별도 진행 중인 JavaScript→TypeScript 이관과 Native activity 변경을 보존한다.
- 기존 승인 registry와 호스트 기본 check 모드는 유지한다. 정확한 human-approved rule이 없는 자동 Align/Format을 허용하지 않는다.
- 작업 수용 기준 정의는 work.json이 소유한다. BoxBox 저장소의 소스 지문·실행 원문은 별도 selected-file snapshot과 로컬 scratchpad에 묶으며 WWW inputs만으로 외부 소스를 검증했다고 하지 않는다.

## 책임 분리

명시적 Write/Refactor는 호스트 에이전트가 비교 목적·행·열을 판단하고 로컬 구조와 레이아웃을 저작하는 흐름이다. source Check는 그 결과의 구문·검출 그룹·축을 관찰한다. formatReadiness는 자동 엔진 쓰기의 승인 조건이며 저작 권한을 대체하지 않는다.

유효한 원본의 slash 문맥은 실제 TypeScript AST에서 가져온다. 정규식 본문·주석·토큰과 구조를 보존하고, parser 문맥이 없는 경로의 기존 보수적 거부는 유지한다. 원본 앱의 식을 검사 회피용으로 바꾸지 않는다.

## 플러그인 경계

WWW 파일명 예외, 검사 우회, 임의 reusable approval, 캐시만의 직접 수정은 채택하지 않는다. Node 설치 아티팩트와 영구 launcher를 실제 실행한다. 스킬 동기화·설치 경로 실재·호스트가 실제 받는 검사 결과를 별도로 확인한다. 설치 version만으로 후보 내용의 동일성을 판단하지 않는다.

## 검증과 게시

1. 저작 중에는 소유 파일의 집중 회귀와 타입 검사를 한다.
2. 동시 writer가 최종 파일을 바꾸는 동안은 전체 검사를 완료 근거로 동결하지 않는다.
3. 전체 changed-file inventory에서 지원 코드/JSON, 문서, 외부 원문·vendor, 생성물, 삭제·symlink를 구분한다.
4. 실제 비교 목적과 축을 확인하며 한 파일씩 저작한다. 없는 표를 만들거나 wrapper·재정렬로 검사를 피하지 않는다.
5. 같은 후보를 snapshot으로 고정하고 BoxBox source 검사·프로젝트 타입/테스트/빌드·필수 Opus 읽기 전용 감사를 실행한다.
6. index tree·branch·HEAD·원격/게시될 이력을 대조한 뒤 승인 범위를 commit/push하고 실제 원격 ref를 확인한다.

## 현재 미실행 사항

파서 수정의 설치 아티팩트 검증, WWW 전체 후보 저작·검증, 독립 Opus 감사, 커밋·푸시는 아직 실행 완료가 아니다. 기존 npm check 통과는 이 새 후보의 검증으로 재사용하지 않는다.
