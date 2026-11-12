> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from browser-verify.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
# 브라우저 수정 검증

이 섹션은 브라우저 결함에만 사용한다. 원래 상호작용과 인접한 정상 경로를 다시 실행한다.
Phase 5 증거는 수정 전이다(대화형 결함은 `issue-NNN-result.jpg`, 정적 결함은 주석이 달린
`issue-NNN.png`). 이제 수정 후를 캡처한다.

상호작용 버그에는 qa-patterns의 Phase 3 read/flow 스크립트를 `flow = true`로 사용하고,
작업과 대기 시간을 원래 재현 절차에 맞춘다. 정적 결함에는 `flow = false`를 사용한다.
오류 hook, snapshot, 콘솔 출력 및 `GSTACK_STEP_OK` 검사를 유지한다. 각 흐름은 영향받은
URL에서 하나의 스크립트로 실행한다. 탭은 스크립트가 끝나면 유지되지 않는다.

새 스크린샷 이름을 사용하고, 결과에는 `issue-NNN-after.jpg`를 사용한다(이미 있으면 접미사를
추가한다). 출력된 `ASIDE_DIR`에서 `$REPORT_DIR/screenshots/`로 복사한 뒤, 복사한
스크린샷을 Read 한다. snapshot tree, `DIFF`, `CONSOLE_ERRORS=`를 수정 전 증거와 비교한다.

fallback에서는 browser-setup의 `$B` 매핑을 같은 검사에 적용한다.
기능 수정에서는 이 섹션을 절대 로드하지 않는다.
