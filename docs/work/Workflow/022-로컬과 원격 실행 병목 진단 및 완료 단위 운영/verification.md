# 운영 개선 검증과 한계

## 로컬

node scripts/check-workflow.ts 실제 exit0. 운영 문서 링크·작업 기록 계약 확인 범위이며 EFF-CAUSE/EFF-APPLY/EFF-VERIFY 전체 통과로 연결하지 않는다. AGENT 기존 바이트/patch를 .www/evidence/efficiency-20261117/agent-before.*에 보존했다. 이번 변경은 docs/skills/EXECUTION_EFFICIENCY.md 신규와 AGENT의 링크 문단뿐이며 제품 TypeScript·공유 하네스는 변경하지 않았다. 기존 dirty를 되돌리지 않았다.

## 원격 전환 실측

09:56:31 old PID6973 SIGINT 후 exit1. 실행중 tool없음, 실제 top-level work/report lock없음, 최근 원장 쓰기2분이상 안정. 오래된 source checkpoint171파일과57개 work.json SHA동일, JSON파싱 정상. code-mode-host7151도 종료. 강제kill/잠금삭제/소스롤백 없음. exit1은 중단의 종료코드이고 제품 테스트 성공/실패가 아니다. 종료 뒤 원문은 remote-stop-result.json이다. 종료 전 tool/lock/원장안정성은 본 세션 도구 출력으로 관측했으나 contemporaneous 원격 사전영수증은 별도 보존하지 않았다. 축자 회수본 safety-observation.txt와 사전 remote-before-processes.txt를 구분한다. 이 한계 때문에 안전 선행조건을 remote-stop-result.json만으로 입증했다고 주장하지 않는다.

09:56:59 remote policy SHA598f0994c69fb29c0d12847dbc5747f6f713f1e605ca9a2cddac1257023a36e3, remote-agent before/afterSHA 보존. 기존 remote AGENT에 링크만 삽입, 로컬 AGENT 전체로 덮어쓰지 않았다. 로컬022와 원격022는 다른 UUID이므로 목차·원장 동기화하지 않았다.

09:58:02 fresh thread01a1e702-cc93-7950-a637-df362bc74027 시작. launch handoff5162bytes, 요청 Sol high, turn_context 설정도 gpt-6.1-sol/high. 이는 세션 설정 관측이며 실제 응답 모델명은 ACK대로 미확인(null)이다. multi_agent/multi_agent_v2는 명시disable 실행. 09:58:33 ACK에서 실제 policySHA/3TaskUUID와 추가agent금지를 수용. ACK 시점 읽기 출력 일부 절단과 remote ~/.codex/coding-guidelines.md 누락을 스스로 기록하고 추가 확인중이다. ACK의 역할 문구는 제품 저작 금지로 읽혀 현재는 증거 연결 조사 단계만 확인됐다. 이후 제품 저작/완료 수용은 이 관측으로 입증하지 않는다.

새 세션 초기 total입력60234/cache23552/output1110, last입력36694. 기존 last356744와 초기 입력 크기 차이만 관측했다. 같은 수용조건 완료 전후 비교가 아니므로 토큰절감률·처리속도·Task완료 향상 미입증. 다중에이전트 flagdisable 설정과 실제 호출 여부는 별도 관측하며 오래된 세션은 종료됐다. 새 실행은 현재진행중으로 전체 종료를 주장하지 않는다.

## 독립 검토

Sonnet plan 실제 claude-sonnet-5-5, 읽기전용 tools없음. 5개 위험 지적과 원문 .www/evidence/efficiency-20261117/sonnet-plan.json. 중단 안전성/인계SHA/core기계판정/예산advisory/dirty별도보존을 설계에 반영했다. 최종 Opus는 이후 공식 core로 실행하며 미실행/실패면 그대로 남긴다.

## 판정 범위

운영 정책 배치와 ACK에 의한 최초 인계 수용만 실제 관측했다. launch.json은 시작 당시 상태로 보존하며 이후 acceptance-readback.json이 ACK 수용을 별도 기록한다. 전체 지침 준수·제품 저작·실행 종료 수용은 아직 미확인이다. EFF 전체를 정적 check-workflow 하나에 연결하지 않았으므로 원장 기준은 unverified 상태를 유지한다. Reports업무완료/장기토큰절감은 별도 미검증이다. 정책은 운영 지침이며 모든 호출을 OS수준으로 제한하는 scheduler가 아니다.

## Opus 지적 보완 후 운영 문서 v2

초기 ACK는 policy-v1.md의 SHA598f0994…에 대한 역사 관측으로 보존한다. Opus 지적 뒤 종료 전 선행조건 원시영수증 보존 문단을 추가한 v2를 로컬·원격에 동일 적용했다. remote-policy-v2-applied.json이 두 버전을 연결한다. 현재 원격 실행이 v2를 다시 읽었다는 관측은 없으며 초기 ACK를 v2의 수용으로 승격하지 않는다. 이미 수행한 종료 전 관측은 사후 회수 도구 결과와 원격 사전 프로세스 목록 범위로 한정한다.

원인 집계의 모델별 위임·Terra감사 원문 필드와 v5/v6 변경 발췌는 .www/evidence/efficiency-20261117/remote-diagnostic-provenance.json에 sourcePath/SHA와 함께 보존했다. 현재 root-session에 대한 집계이며 모든 하위 세션 청구 합산이 아니다.
