> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 상태 머신 왕복 전문가 검토 체크리스트

범위: SCOPE_STATE_MACHINE=true일 때(`gstack-state-matrix detect`: diff가 제안, 보류 또는 승인 상태 머신을 추가하거나 변경함)
출력: 상태 머신마다 행렬 레코드 하나를 출력한 다음, 공백마다 발견 사항 하나를 각각 한 줄의 JSON 객체로 출력한다.

행렬 레코드(발견 사항이 아님. 부모가 `gstack-state-matrix check`로 검사함):
{"specialist":"state-machines","matrix":{"machine":"name (path)","kinds":["kind",...],"actions":["accept","drop",...],"cells":[{"kind":"kind","action":"accept","row":"the resulting rows after the action","test":"path/to/test:LINE"}]}}
테스트가 다루지 않는 셀에는 `"test":null`을 사용한다.

발견 사항 스키마:
{"severity":"CRITICAL","confidence":N,"path":"file","line":N,"category":"state-matrix","summary":"untested cell: <kind> × <action> → <row>","fix":"...","fingerprint":"path:state-matrix:<kind>:<action>","specialist":"state-machines","cell":{"kind":"<kind>","action":"<action>"}}
선택: test_stub, evidence.
diff가 제안, 보류 또는 승인 상태 머신을 추가하거나 변경하지 않으면 `NO FINDINGS`만 출력하고 다른 것은 아무것도 출력하지 않는다.

---

## 이 전문가가 존재하는 이유

전체 게이트를 통과한 변경이 사용자 데이터를 삭제한 적이 있다. "deactivate" 또는
동일 클레임 "replace" 제안을 수락했는데, remove만 테스트되어 있었기 때문에
"remove" 경로로 내려갔다. 분기를 공유하는 종류들은 그중 하나만 다뤄도 모두 다룬 것처럼
보인다. 이 검토는 모든 종류 × 소유자 행동, 각 행동이 남겨야 하는 행, 이를 입증하는 테스트를
기록하여 테스트되지 않은 셀을 병합 전에 명시한다.

## 행렬 작성

1. **머신을 찾는다.** 종류(type, enum, tag)와 소유자 행동으로 확정되는 보류
   상태를 가진 레코드: 제안, 보류, 승인, 조정 또는 검토 대기열, 초대. 헝크뿐 아니라
   diff 적용 후 코드도 읽는다.
2. **모든 종류를 나열한다.** diff 적용 후 확정 경로가 처리하는 type 또는 enum,
   각 `case`, 각 디스패치 테이블 키를 나열한다. 형제 분기로 이어지는 `case`도
   독립된 종류다. diff가 공유 경로를 변경했다면 diff에서 추가하지 않은 종류도 포함한다.
3. **모든 소유자 행동을 나열한다.** 보류 레코드를 확정하는 accept 또는 approve,
   drop 또는 reject, 그 밖의 모든 행동(expire, withdraw, release, hold)을 나열한다.
4. **각 종류 × 행동의 결과 행을 작성한다.** 코드가 수행하는 내용이 아니라 종류의 의미와
   소유자가 기대하는 바를 기준으로 대상 레코드(deleted, kept, deactivated, rewritten)와
   제안 자체의 상태를 작성한다. Deactivate는 플래그를 끈 채 레코드를 유지하고,
   동일 클레임 replace도 레코드를 유지한다. remove만 삭제하며, drop은 대상을 건드리지 않는다.
5. **각 셀을 테스트에 연결한다.** 해당 종류와 행동을 정확히 실행하고 결과 행을 단언하는
   이 체크아웃의 테스트를 `path:line`으로 연결한다. 형제 종류의 테스트, 상태 필드만 검사하는
   테스트, 저장소를 모의 처리하는 테스트는 해당 셀을 다루지 않는다. 아무것도 다루지 않으면
   `null`을 사용한다. 경로를 절대 지어내지 않는다.

## 발견 사항

- **테스트되지 않은 셀(CRITICAL; 이 규칙의 High 등급).** `"test":null`인 셀마다
  발견 사항 하나를 작성한다. `cell`, `summary`의 예상 행, 해당 종류의 보류 레코드를
  확정하고 행을 단언하는 `test_stub`를 포함한다.
- **잘못된 행(CRITICAL).** 코드가 4단계와 다른 행을 남길 때(예: deactivate가 삭제함),
  같은 `cell`과 잘못된 경로를 택하는 줄을 포함한 별도 발견 사항으로 보고한다.
- **합쳐진 종류(CRITICAL).** 여러 종류를 하나의 파괴적인 경로로 보내는 분기는,
  테스트가 한 종류를 다루더라도 해당 줄에서 발견 사항이다.

## 절대 하지 말아야 할 것

- 형제 종류의 테스트가 같은 함수를 통과한다는 이유로 셀이 다뤄졌다고 표시하지 않는다.
- 행렬을 줄이려고 목록에서 종류나 행동을 빼지 않는다.
- 산문을 출력하지 않는다. 부모는 JSON 줄만 파싱한다.
