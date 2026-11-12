> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from budget-handoff.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<a id="budget-and-context-handoff-read-when-a-cap-is-set-or-verdictdelegate-prints"></a>
## 예산 및 컨텍스트 인계(cap이 설정되었거나 `verdict=delegate`가 출력될 때 읽기)

cap은 **승인 cap**이다. `gstack-ship-budget check`는 사용량 + 열린 reservation + unknown + 예상량 + tail과
중지 reserve가 모두 들어맞을 때만 다음 단계나 dispatch를 승인한다. 이미 승인된 작업은 예상량을 초과할 수 있다.
필드별 참조: docs/ship-budget.md. 종료 코드 0은 계속 또는 delegate, 3은 중지,
2는 usage이며, 0이 아닌 종료 코드는 다음 단계가 시작되지 않음을 뜻한다. `ship/DRIVER.md` 실행은 대신
`--mode observe`로 시작한다. check, reservation, handoff가 없고 각 프로그램은 `note`로 끝나며 cap을 넘긴
note만 중지시킨다.

**Meter.** 명령마다 하나를 읽는다.
- Capy: `gstack-ship-budget` 명령과 같은 프로그램에서 `(await tools.thread.get({ thread_id: "<your own jam id>" })).cost`를 읽는다(자신의 jam과 그
  subagent 포함. root thread는 `"this"`이고, `GSTACK_SHIP_TASK_TITLE`이 있는 subagent는 읽을 때마다
  root thread의 `tasks`에서 자기 행을 읽음). 별도 호출로 읽어서는 안 된다: `--reading <cost.tokens> --credits <cost.credits>`.
  `--prior-reading <n>`(호출당 비용. 세 개가 실행 자체의 median으로 단계 가격을 산정)은
  이전 호출에서 이미 얻은 reading이다. meter만 읽으려고 호출을 소비해서는 안 된다. 실행의 마지막 reading보다 오래된 값은 무시된다.
- Claude Code: `start --session <id>`, 또는 거부 메시지가 한 번 출력한 nonce를 echo하고
  `start --nonce <value>`로 다시 실행한다. helper가 journal을 직접 읽는다(`--reading` 금지).
- 그 밖의 환경: 소유자가 수락한 경우에만 `--meter estimate`(출력: `meter=estimate`).

**모든 경계.** `gstack-ship-budget check --run <id> --step <done> --next <step> --reading <n>`.
각 dispatch batch 전에 batch를 하나의 합계로 reserve하고 `DISPATCH:` 줄마다 역할 하나를 둔 다음 출력된 id를 한 번 전달한다
(`READING`은 현재 counter reading이고, `RESERVATION_ID`는 check의 `RESERVATION_ID:` 줄 전체를 복사한 값이다).

```bash
~/.claude/skills/gstack/bin/gstack-ship-budget check --run <id> --step 9 --next dispatch:specialist,red-team --reading "$READING"
~/.claude/skills/gstack/bin/gstack-review-log --start review --reservation "$RESERVATION_ID"
```

`ADMIT: k of n (remaining=<roles>)`이면 그 k개만 dispatch하고 완료된 뒤 남은 역할을 다시 check한다.
다시 check하지 않은 역할은 `close`가 표시한다. `--finish`는 reservation과 해당 pass의 다른 dispatch reservation을 정산한다.

**review pass마다 프로그램 하나.** Capy에서는 execute 프로그램 하나가 전체 pass를 다음 순서로 실행한다(다른 환경도
같은 순서): `gstack-review-plan`(그 `DISPATCH:` 줄), `check --step <n> --next dispatch:<roles>`,
단계가 기록하는 행마다 한 번씩 `gstack-review-log --start <skill> --reservation <id>`,
`BEFORE` reading, 단계가 dispatch한 그대로의 reader(프롬프트 변경 없음), 마지막 reader가 완료될 때까지 대기
(`done`, `failed` 또는 최종 summary. 새 `idle`은 실행되지 않은 상태), `AFTER` reading,
`gstack-ship-budget settle`. 같은 pass의 후속 batch(Red Team 또는 ADMIT 나머지)는 start 없이
나머지를 반복한다(`--finish`가 정산). 마지막으로 collect하여 reader의 최종 출력만 반환한다. 11단계의
voice와 14.5단계의 audit(`dispatch:docs`, start 없음)는 각각 프로그램 하나다.
각 batch는 자신을 dispatch한 프로그램에서 정산한다. reader 시작 직전과 마지막 reader 완료 직후 counter를 읽고
`gstack-ship-budget settle --run <id> --reservation <id>
--dispatched-at <before> --reading <after> --readers <n>`을 실행한다(meter가 볼 수 없으면 `--unknown`).
실행되지 않은 것은 `release`한다. 이 쌍만 측정된다. `check --returned`, 후속 프로그램에서의 settle
(`--dispatched-at` 없음), `--finish` 또는 단계 변경은 측정 없이 정산한다.

**verdict=stop.** 마지막 출력으로 STOP, RECOVER, GSTACK_RESULT 줄을 출력하고
status=incomplete로 끝낸다. cap 증가는 소유자의 결정이다: `/ship --resume <record>
--token-cap <n>`은 `gstack-ship-budget resume --record <record> --token-cap <n>
--approved-by <who> --words "<their words>" --reading <n>`을 실행한다. 머신이 바뀐 뒤에는
`resume --run <id>`가 Drive checkpoint에서 ledger와 record를 복원한다. 손상된 ledger에는
`--rebuild-from-record`를 사용한다.

**verdict=delegate.** 다음 구간(9~11.5단계, 12~22단계 또는 시작 시 1~22단계)은 새로운
child에서 실행한다. parent는 reconcile한 뒤에만 기다림을 끝내고 진행한다. 7~8단계는 parent에 남는다.
9~11.5단계 child는 review-army.md와 adversarial.md를 읽고 record에서 결과를 가져온다.
1. `gstack-ship-budget handoff --run <id> --from 9 --to 11.5 --base origin/<base> --reading <n>`
   (`--reviewed-tree <t>`, `--trail <file> --trail-run <id>` 추가). `HANDOFF:`와 `RETURN_FILE:`을 출력한다.
   brief는 child의 `READ:` 줄 범위를 나열하고 마지막 단계로 `--to`를 지정한다.
2. 실행: Capy에서는 공유 머신의 subagent에 "gstack을 읽고 GSTACK_LAUNCH_FILE을 source한 뒤 /ship --continue <HANDOFF file>을 실행하라"는 지시를 준다. Claude Code에서는
   `gstack-ship-budget launch --in <HANDOFF file>`(background, 명시적 권한)을 사용한다.
3. child는 먼저 `verify-handoff --in <file>`을 실행한다. Capy에서는 `--reading`을 쓰지 않는다(subagent는
   자신의 jam id를 읽을 수 없음. `METER: parent`: parent의 handoff와 reconcile reading이 이를 측정).
   `HANDOFF_PIN_MOVED` 거부는 status=refused를 반환한다. child는 자신의 sub-cap에 맞춰 승인하며
   context 규칙 때문에 중지하지 않는다. 한 단계 완료 후 `verdict=delegate`이면 이 네 단계를 통해
   남은 단계를 grandchild에 넘긴다(최대 깊이 3). `CONTEXT_HIGH:` note는 계속하라는 뜻이다.
   grandchild를 reconcile한 다음 `gstack-ship-budget return --run <child> --to <the brief's last step> --changed <sections>`로 끝낸다(최대 40줄).
4. `gstack-ship-budget reconcile --run <id> --return <RETURN_FILE> --reading <n>`은 반환 파일 자체 counter의 `used=`를 청구한다.
   child transcript가 아니라 record를 읽는다. 종료 코드 3(refused, incomplete 또는 interrupted)이면
   handoff를 다시 생성하거나 중지한다. 다시 생성한 child가 complete로 reconcile되거나 소유자가 resume할 때까지 모든 check가 거부된다.

**--resume <record>**와 **--continue <handoff>**(자신이 child인 경우)는 새로운 1단계 대신 기존
record와 ledger에 연결한다. attempt count와 시작 token을 유지하고, `--continue`에서는 trail write보다 먼저 verify-handoff를 실행한다.
