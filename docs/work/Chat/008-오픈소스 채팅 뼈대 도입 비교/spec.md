# 오픈소스 채팅 뼈대 도입 비교 — 현재 조사와 역사

UUID `work-029fb7e2-61fa-4014-9362-5e915ab13197`. 기존 AC-1/AC-2/AC-3의 정의·필수 여부·권한은 work.json을 유지한다.

현재 구현·검사·검토의 결과와 적용성은 같은 UUID의 [작업 원장](work.json)과 [검증 기록](verification.md)의 최신 공식 read/status로 판단한다. 새 반례 이후의 소스 교정·집중 검증·문서 영향 검토·고유 독립 감사·저작 보고서·완료 판정은 별도 절차이며, 이 문서 작성으로 통과를 선언하지 않는다. 과거 숫자·모델 판정·미실행 설명은 당시 소스의 이력이다.

## 권장과 조사 여정

권장은 **Ovis에서 필요한 공개 채팅 동작만 개작**하고 WWW Electron·Native JSON-RPC·선택/원장·관측·보고서를 보존하는 것이다. 전체 앱 교체·새 DB·추가 제품 이식을 실행한 것이 아니다. 현재 비교와 고정 revision·라이선스·의존 경계는 [comparison.md](comparison.md), 다음 단계는 [tasks.md](tasks.md)가 소유한다.

| 여정 | 조사 입력·판단 | 기준·검사 |
|---|---|---|
| UC-LOCAL | 현재 소스·실제 실행과 반례를 읽고 구현 존재·합성/GUI/actual Native·미실측을 구분 | AC-1: 현재 UUID 집중 검사와 증거 내용·고유 의미 감사 |
| UC-UPSTREAM | 고정 commit URL 45개와 보충 LICENSE의 bytes/SHA·manifest·실제 연결 코드 | AC-2: 허용된 연구 계약 검사와 원문 대조. 설치/실행/호환 PASS가 아님 |
| UC-DECISION | 전체 앱/부분 개작의 이주 비용과 보존 책임을 비교 | AC-3: 단일 권장·추가 반입 조건·실제 검증 한계의 일관성 |

sameWorkspace는 실행 플랫폼의 Node path.isAbsolute/resolve로 경로를 판정한다. Windows drive·UNC 형태는 실제 소유 함수에 win32 의존성을 주입한 대조가 있지만 실제 Windows OS 실행 증거는 아니다. 경로를 무조건 거부한다는 과거 설명과 실제 Windows·OS 한국어 IME 미실행 한계를 구분한다.

복원은 bounded queue·준비/accept·현재 scope·완료 권위를 구분하고, explicit empty와 omitted/null/malformed의 보존 의미를 대조한다. 혼합 malformed live changes와 종료 뒤 상세 활동 시작, quota null, Subagent wait 귀속·현재 Progress의 새 반례는 수정 계획만으로 해소됐다고 쓰지 않는다. 저장/live reasoning summary의 전체 문자열 배열 검증·잘못된 값 보존·명시 빈 배열 제거를 각각 확인하고, legacy 완료정보 부재·유실/보관 한계도 별도로 남긴다.

과거 Terra8 fail·이후 수정/단위 기록과 v3 고유 fail은 당시 원문으로 보존한다. 최신 소스의 수정·검증·독립 감사가 필요한지는 공식 read/status에서 판단한다. Windows/OS IME·외부 앱 실행·새 제품 이식을 조사 완료 기준으로 추가하지 않으며 제품별 실제 흐름 수용과 이 조사 권장 기록의 완료를 구분한다.

## 과거 문서 원문 — 당시 구현·검사·권한과 다음 행동

<details>
<summary>정정 전 원문 전체</summary>

# 오픈소스 채팅 뼈대 도입 비교

UUID: `work-029fb7e2-61fa-4014-9362-5e915ab13197`. 기존 AC-1/AC-2/AC-3의 정의·필수 여부는 work.json이며 변경하지 않는다.

## 현재 요청·권한·목표

현재 Chat의 제공 기능·구현 공백·검증 한계를 확인하고 Herdr 같은 완성 앱의 고정 소스/라이선스/의존 경계를 비교해 단일 권장안을 남긴다. 권장은 **Ovis에서 필요한 공개 채팅 동작만 개작**하고 Electron·Native 전송·원장·관측·보고서를 보존하는 것이다. 전체 앱 교체나 추가 제품 이식을 실행한 것이 아니다.

최신 TASK-RESUME 전체의 requestHash와 문서/승인 exact 검증권한을 같은UUID에 사전 연결했다. 직접 Terra 원문은 direct-user-original.txt의 정확 bytes를 쓰고 ReviewAuthority/directRequest를 current source/criteria/policy와 결속한다. 일반 fallback 정책을 바꾸거나 과거 Opus/Terra fail을 덮지 않는다. 제품 source/generated/공유정본/전역/인증/commit/publish 쓰기는 이 문서 패스에 없다.

## 기준별 조사 여정

| 여정 | 입력·행동 | 기대 결과 | 기준·검사 |
|---|---|---|---|
| UC-LOCAL | 현재 source·변경 diff와 실제 실행 원문을 읽고 정상·복원·오류 경계를 대조 | 기능의 존재/실제 stdio·순수 회귀/actual Native·Electron/미실측을 구분 | AC-1: 현재 공식 집중·source SHA·별도 부모270개 및 과거표본의 출처 대조 |
| UC-UPSTREAM | 기존comparison의45개 fixed commit URL과 보충LICENSE 원문을 다시 읽고 bytes/SHA·manifest·실행 코드를 대조 | Herdr runtime/desktop/core, Ovis 제한daemon, T3 private workspace·라이선스/DB 경계가 추적됨 | AC-2: 공식 연구검사와 고정 원문 manifest. 링크 존재·설치 호환 성공으로 쓰지 않음 |
| UC-DECISION | 보존할 책임과 전체/부분 비용을 나란히 비교 | Ovis 부분 개작 권장과 추가 반입 조건·남은 검증이 일관됨 | AC-3: comparison의 단일 권장·이주 비용·현재 source와 고유 읽기 전용 의미 감사 |

## 현재 복원 경계와 완료 범위

명시적 open은 read/resume/history 준비와 최종 accept를 분리하고 main의 queue/예약/snapshot 수용 뒤에만 ready/interrupted를 확정한다. 자동/명시 복원은 terminal snapshot 필터를 사용한다. completedAtMs의 유효 안전정수0은 완료 권위이고, 누락/null/invalid를0으로 만들지 않는다. 알려진 완료 item과 terminal fileChange declined는 닫힘을 유지하고 완료정보 없는 잠정 item만 현재 같은 scope의 실제 시작에서 재개한다. 늦은 file started는 상태/diff를 덮지 않으며 정식 새 완료는 반영한다. 이 사실은 pure/stdio 검사 범위이고 실제 모델·GUI race를 새 측정한 것이 아니다.

legacy 완료정보 부재·이미 유실된 사건·2000건/4MiB 초과·Windows drive/UNC 제한은 남는다. Windows/OS IME·외부 앱 실행·새 제품 이식을 이 조사의 새 필수 완료 조건으로 늘리지 않는다. 제품별 실제 GUI/Native 수용은006 등 별도UUID가 회수한다.

현재 입력의 새 공식 집중/연구검사→문서 영향 검토→고유 actual Terra→저작 보고서/앱read→공식complete/read/status 순서로 수행한다. 모든 현재 기준/검토/보고서가 수용된 경우에만 done이다. 과거 summary는 현재status를 대신하지 않는다. 이전 전문은 [이력](history/before-final-closure-spec.md.txt)에 보존했고 실행 원문은 verification.md와 chat008 증거에서 찾는다.

현재 Terra8는 fail이며 A→B 복원 실패의 현재 사건 유실과 turn 종료 뒤 running file 잔류를 Root에 전달했다. 수정·새 검증·고유 독립 감사가 남아 있다. changes의 혼합 형식은 유효 항목만 투영할 수 있고 저장 reasoning.summary는 문자열만 걸러 복원하므로 live의 배열 전체 검증과 동등하지 않다. 이 정규화 한계를 comparison에 기록하며 지원 확대나 전체 malformed 보존을 수용 계약으로 주장하지 않는다.

</details>
