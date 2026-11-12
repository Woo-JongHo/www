> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from measure.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<a id="measure-then-fix-loop-a-red-paid-eval-or-a-failed-free-suite-shard"></a>
## 측정 후 수정 루프(유료 평가 실패 또는 무료 테스트 묶음의 샤드 실패)

여기의 모든 재실행은 **판정이 아니라 진단**이다. 실패한 실행에 기록된 판정을 바꾸지 않는다. 산출물은 평가 이력이 아닌 `.context/ship-measure/` 아래에 `diagnostic`으로 표시한다. 레인의 판정은 마지막 전체 게이트 실행 한 번에서만 나온다. 통과를 위해 예산을 올리거나 기준을 낮추거나 판정 재시도를 추가하거나 사례를 건너뛰지 않는다.
아래의 `ship-measure`는 `bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/scripts/ship-measure.ts`를 뜻한다.

**실패한 무료 테스트 샤드(5단계).** 실패를 기존 문제라고 부르거나 푸시하기 전에 그 샤드의 정확한 파일 목록을 실행 순서대로 `ship-measure free --files <f1,f2,...>`로 재실행한다(gstack 로컬 실행: `--shard <i>`). 10번 재실행하며 첫 번째는 단독 기준선, 나머지는 병렬로 표시한다. 각 실행에 별도 HOME과 상태 루트를 사용하고 불안정 테스트 자동 재시도는 끄며 10분 상한을 둔다. `UBICLOUD_API_KEY`를 설정한 `ship_rerun_backend=ubicloud`는 Ubicloud VM 하나에서 실행한다. 실행기가 파일 목록을 받지 못하면 실패한 전체 명령을 10번 실행한다. 통과율, 완료 횟수(예: 상한 시점에 10번 중 6번 완료), 실패 캡처 하나를 보고하고 분류를 계속한다.

**실패한 유료 평가(6단계).** 실패 사례마다 다음을 수행한다.

1. **분류.** 실패 줄의 원인·증거·Expected/Received를 읽는다(`failure_cause`, `failure_detail`; gstack: `bun run eval:pass-rates --run <run> --case <id>`). 이번 브랜치의 제품 변경, 탐지기 또는 행위자 결함, 픽스처 결함, 제공자 사건, 모델 실패 중 하나로 명시한다. 탐지기 수정에는 유료 시행 전에 무료 재생 테스트를 수행한다. 인프라 실패(제공자 중단·실행기 손실)는 측정을 생략할 수 있다. `ship-measure skip --case <id> --reason "<why>"`는 PR 본문에 `unmeasured`로 표시하며 통과로 세지 않는다.
2. **계획 표시.** `ship-measure table`로 종류별 시행 횟수·기준·예산(`ship_measure_*` gstack 설정 키)을 출력하고 예상 비용을 제시한다. 통과율 이력의 시행당 비용에 시행 횟수를 곱하거나 예상 비용을 알 수 없다고 밝힌다.
3. **측정.** `ship-measure measure --case <id> --round baseline [--cost-per-trial <usd>]`는 현재 head에서 해당 사례만 종류별 횟수만큼 병렬 실행한다. 프로젝트에 문서화된 단일 사례 평가 명령 `--command '<command> {case}'`를 사용한다(4단계에서 테스트 명령을 찾는 방식으로 탐색; gstack은 필요 없으며 판정자 ID를 받음). 문서화된 명령이 없으면 한 번 질문하고 답을 보고서에 기록한다. 종료 코드 2는 승인이 필요하다는 뜻이다. 이유와 함께 한 번 질문한 뒤 `--approved`로 재실행한다.
4. **종료 코드로 결정**(MEETS 9/10, 모든 실패가 적격인 MEETS-qualified 8/10, EXTEND 7/10; 행동 평가는 11/12, 10/12, 9/12):
   - 0: MEETS 또는 MEETS-qualified, 완료.
   - 5: needs-classify. 나열된 실패를 각 캡처에서 확인해 기록한다. `ship-measure classify --case <id> --round <r> --trials <2,5> --class <class> --evidence "<path:line>"`. 적격 분류는 `provider`(그 시행 자체의 제공자 오류일 때만), `judge-noise`, `model-miss`(줄 인용)다. 수정 라운드 대상은 `timeout`, `hang`, `regression`, `fixable`이다. `unclassified`는 검토했지만 증거가 없다는 뜻이다.
   - 6: EXTEND. 변경되지 않은 트리에서 `ship-measure extend --case <id> --round <r>`를 한 번 실행한다. 세 번째 묶음은 허용하지 않는다.
   - 1: BELOW, 수정 라운드다.
5. **원인 수정.** `.context/ship-measure/<case>/<round>/tNN/` 캡처에서 실패 시행의 근본 원인을 찾아 원인을 바꾼다.
6. **재측정.** `ship-measure measure --case <id> --round round-<n> --fix "<cause and change>"` 후 항목 4를 따른다. 원인에 작용한 구체적인 변경을 명시하고 마지막 측정의 모든 실패를 설명할 때만 수정했다고 말한다. 입증된 확률이 아니라 "<cause> 수정 후 k/n 관측"으로 보고한다.
7. **중단.** 종료 코드 3은 명시된 실패(라운드 한도·예산·무효 묶음 두 번)다. 중단하고 푸시하지 않으며 모든 시행을 담은 `ship-measure report`를 보고한다.

**게이트는 한 번.** 모든 실패 사례의 측정값이 목표 이상이면 전체 게이트를 한 번 실행한다(6단계 항목 2). 프로젝트 CI가 푸시 시 게이트를 실행한다면(gstack: PR의 `evals` 작업 흐름) 푸시가 곧 게이트 실행이다. 푸시하고 해당 실행을 읽으며 게이트 명령도 별도로 시작하지 않는다(gstack의 `bun run eval:bg:pr`는 푸시한 head에서 두 번째 유료 실행을 시작함). 사례별 예상·실제 비용을 담은 `ship-measure report` 표를 PR 본문에 넣는다.
