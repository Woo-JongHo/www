> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- shared-code-reuse.md.tmpl에서 자동 생성됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
**완전한 구조적 증거가 있을 때만 건너뛴 공유 코드 조언을 재사용하세요:**

1. **증거를 읽으세요.** 근거가 되는 모든 호출부와 헬퍼 대상을 읽기 전용으로
   읽으세요. `git update-index`는 `--really-refresh`를 사용하더라도 검사기가
   읽는 인덱스 플래그를 지웁니다. 자사 작성 출처인지, 이 추출이 가치 있는지
   확인하세요. 검사기는 이를 판단할 수 없습니다. `evidence_paths`/`helper_target`을 유지하세요.
2. **검사기를 실행하세요.** 저장소 루트에서 현재 발견 사항을 stdin에 리터럴
   JSON으로 전달하세요. REVIEW_START를 이번 패스의 토큰으로 바꾸고 예시
   경로/심볼을 실제 증거로 바꾸세요. 따옴표로 감싼 구분자는 유지하세요.

```bash
"$HOME/.claude/skills/gstack/bin/gstack-review-log" --check-shared-libs REVIEW_START <<'GSTACK_SHARED_LIBS_REUSE_JSON'
{"advisory":true,"severity":"INFORMATIONAL","evidence_paths":["src/caller-a.ts","src/caller-b.ts"],"helper_target":{"path":"src/shared.ts","symbol":"sharedHelper"}}
GSTACK_SHARED_LIBS_REUSE_JSON
```

3. **결과에 따라 조치하세요.** `reusable: true`일 때만 억제가 허용됩니다.
   False, 명령 실패 또는 읽을 수 없는 출력이면 억제하지 말고 소스를 새로 검토해
   새 결정을 내려야 합니다. 자체 스냅샷, 이전 기록 또는 커버리지를 제공하지 마세요.
4. **로거를 통해 영속화하세요.** 로거가 커버리지를 다시 계산하므로 증명을
   제공하지 마세요. 실제 결함에는 일반적인 Fix-First 처리를 유지합니다.

**재사용 가능 결과가 증명하는 것(이 검사를 절대 재구현하지 마세요):**
- 식별성: `sharedLibsFingerprint`와 저장소, 가공하지 않은 브랜치 및 현재 스냅샷.
  검사기는 REVIEW_START를 소비하거나 교체하지 않고 읽습니다. 정제된 브랜치 이름은 식별자가 아닙니다.
- 이전 결정: 완료/수렴된 검토, 검증된 바인딩, 명시적 Skip 및 로거 버전이 지정된
  `snapshot_covered_paths`. 버전 없는 커버리지에는 새로운 결정이 필요합니다.
- 소스: `canReuseSharedLibsAdvisory`는 근거가 되는 모든 경로의 원시 파일이 해당 blob과
  바이트 단위로 일치해야 합니다. assume-unchanged, skip-worktree, sparse index 항목,
  심볼릭 링크/상위 경로, 서브모듈, 무시되거나 외부에 있거나 읽을 수 없는 파일,
  활성/알 수 없는 Git 필터, 인코딩 및 줄 변환은 제외합니다.
- 안전한 검사: fsmonitor와 선택적 잠금을 비활성화하며 외부 diff/textconv를 절대 사용하지 않습니다.
  알 수 없는 증거는 실패로 닫힙니다.
