# 입력·답변·실시간 표시 진단

## 관측과 원인

- 사용자가 보고한 Enter 누락은 실제 OS 한국어 IME에서 재현하지 않았다. 기존 `input.ts`는 조합 중 Enter/229와 조합 종료 timestamp 이하 사건을 전송에서 제외하며 별도 새 Enter는 허용한다. 원인 근거 없이 시간 경계를 변경하지 않았다.
- 답변 누적 뒤 늦은 `item/started`가 들어오면 시작 snapshot으로 본문이 줄어드는 투영 버그를 회귀 테스트로 재현했다. 기존 본문을 유지하도록 수정했다. 완료 뒤 delta가 다시 붙는 경계도 차단했다. 사용자가 보고한 모든 잘림의 단일 원인으로 확정하지 않는다.
- 본문·입력·안내·새 내용 버튼을 고정된 두 행 grid에 섞던 구조를 본문만 늘어나는 flex로 변경했다. `min-height:0`·`min-width:0`과 내부 스크롤을 적용하고 크기 변경 시 최신 따라가기를 연결했다. 긴 내용과 마지막 문장 접근은 Electron QA에서 별도 확인한다.
- 기존 명령 details는 닫히면 출력이 사라졌다. 10줄 미리보기와 보관 출력 펼침을 분리하고 들여쓰기·긴 줄 내부 스크롤을 적용했다.
- 활동 Electron probe 첫 실행은 두 번째 요청이 거부됐다. 합성 fake-app-server의 중단 완료 사건에 threadId가 없어서 main이 실제 활성 턴을 지우지 못한 것이 원인이었다. fixture에 실제 schema 필드를 추가한 재실행은 통과했다. 제품의 main 검증을 느슨하게 하지 않았다.

## 범위와 미확인

답변은 40,000자 회귀 입력에서도 보존됐고 명령/공개 요약의 보관 제한과 구별했다. 입력의 실제 OS 한국어 IME와 Windows는 미실행이다. 합성 composition·CDP 키 결과를 OS 실기로 승격하지 않는다. 실제 Native 읽기 관측은 공개 답변·Skill 문서 읽기·Hook·사용량을 확인했으며 제품 전체 흐름이나 모든 모델의 동작을 보증하지 않는다.

## 근거

로컬 상세: `.www/evidence/work-eed41da3-f22e-4fb9-b9df-9a1a7d76c44f/input-projection.md`, `activity.md`, `activity-gui.log`, `activity-gui-retry.log`, `native-live.log`. 현재 수용 기준·검증 결과의 정본은 `work.json`과 `verification.md`다.

## 사용자 피드백: WWW 전용 흐름과 Hook 실패

11:12~11:13 사용자 화면은 설치 플러그인의 일반 sessionStart/postToolUse/stop 사건으로 가득했다. HookRunStatus 매핑은 실제 스키마와 일치했다. 현재 hooks/list의 BoxBox 0.2.8·Vercel 0.50.0 정의 8개가 모두 enabled/modified였고, 현재 환경의 별도 읽기 전용 실제 1턴에서 sessionStart4·stop1이 모두 `plugin contents changed; hook approval required`로 failed였다. 도구 사용은 0회이며 모델 답변과 턴은 정상 완료, 설정 SHA도 불변이었다. postToolUse의 현재 원문은 도구 금지 probe에서 재현하지 않았고 원래 사용자 턴의 error entries도 로그에 없어 같은 실행으로 단정하지 않는다.

따라서 실제 원인은 플러그인 변경 후 신뢰 검토가 미완료인 실행 전 차단이다. 일반 Hook의 실패를 WWW 전용 에이전트·스킬의 실패로 보여주는 정보 배치도 요구와 어긋났다. Hook 승인·신뢰값·전역 설정은 임의 변경하지 않고 원문 실패와 원인을 상세에 보존한다.

실제 다중 파일 cat의 parsed_cmd는 unknown이어서 구조화 read만 보는 기존 감지가 www-dev 문서 참조를 놓쳤다. 현재 선택 저장소의 정본과 정확히 맞는 구조화 read를 우선하고, 확장·연쇄·리디렉션 없는 리터럴 cat만 별도 '읽기 명령 관측'으로 구분한다. 이 근거를 개별 파일 읽기 성공이나 실제 역할 적용으로 승격하지 않는다. shell문자열 이름 언급·echo·grep·치환·타 저장소 경로는 제외한다.

원문 근거는 작업별 로컬 `hook-diagnosis-20261113.md`, `www-projection.md`이며 문서 읽기 관측과 일반 Native Hook을 분리한 UI·합성 사건은 별도 검증한다.
