# 최소 설계

schema2 rebind는 구현하지 않는다. 기존 verify-current.mts가 이미 등록돼 있으므로 내부 제품 검사를 BoxBox 통합과 분리하는 최소 경로를 우선한다. 기존 work-json.test.ts의 앞부분 제품 검사는 유지하고 뒤쪽4개 외부도구 검사를 test/boxbox/work-json.test.ts로 이동한다. 별도 파일의 sourceRoot는 저장소 루트를 가리키도록 조정한다. 테스트 본문/assertion·승인자료는 보존한다.

scripts/test.ts는 product(default)와 boxbox(explicit) suite를 분리한다. 제품 suite는 BoxBox 설치/설정에 의존하지 않는다. 명시 boxbox suite만 공식 launcher mode를 확인하고 off이면 disabled 반환/비성공 종료, 알 수 없는 응답·도구오류는 fail closed한다. 테스트 선택과 mode판정은 모델 없이 집중 단위 검사한다. default Bun 자동발견과 npm test의 차이는 문서에 명시한다.

최종 코드는 부모 한 하네스의 writes에 선언한다. 별도 worker는 scripts/test.ts, 두 work-json 파일, test-runner 테스트, package만 소유한다. 부모는 docs/DEVELOPMENT와 원격 선택 적용/등록/감사를 소유한다. 공유 소스 최종 검사 전 동결. 커밋·push 없음.

## 사전 Sonnet 지적 보완

등록 명령은 node .www/evidence/resume-20261116/reports-closeout/verify-current.mts reports001(002/003)이며 테스트 파일경로를 argv로 받지 않는다. 래퍼 내부는 기존 scripts/verify-reports.ts→Chrome이므로 앞부분 제품 파일경로 유지 시 외부 이동과 충돌하지 않는다. 실제 원장과 정확 일치하는 경우만 실행하고 불일치는 중단/미등록으로 보고한다.

기본 suite는 test/boxbox/ 경로만 제외하고 기존 나머지 전체 제품 검사를 유지한다. work-json 내부 제품12+외부4=16의 이름과 본문/assertion을 원문 대조하며 공통helper를 임의 완화하지 않는다. scripts/test.ts가 import시 전체테스트를 실행하지 않도록 main경계를 두고 선택/off/unknown 모드/오류의 집중검사를 둔다. 명시 BoxBox off는 disabled문구+비0종료+실제suite0회로 검증한다. test.skip/only 없음.

하네스 writes는 전체 저작의 허용 envelope이며 worker소유와 겹침 자체가 다중writer를 뜻하지 않는다. 각 파일의 실제 저자는 한명뿐이다. 부모는 worker 소유를 편집하지 않는다. 원격 기존파일은 모든 소유파일별 사전SHA CAS를 확인한다. 불일치면 전체파일복사 대신 보존한 원문과 변경hunk를 읽고 수동최소patch 또는 중단하며 타인변경을 덮지 않는다. 공유코어/기준/권한은 변경하지 않는다. GUI미실행 또는 실패는 REGISTER미충족으로 보고하며 과거결과를 재사용PASS로 만들지 않는다.
