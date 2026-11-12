> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- qa-patterns.md.tmpl에서 AUTO-GENERATED됨 — 직접 편집하지 마세요 -->
<!-- 재생성: bun run gen:skill-docs -->
# 브라우저 QA 방법론

선택한 브라우저 표면에서만 실행하세요. 프로브 전에 소스로 diff를 매핑하세요. 탐색은 블랙박스로 유지하며, 진단은 호출자가 담당합니다.

공용 탐색 루프는 실행 순서를 담당하며 이 기법 단계는 담당하지 않습니다. 해당 체크포인트 규칙은 기준선 이후의 모든 프로브(방향 파악, 링크, 정확한 재현 및 추가 근거 포함)에 적용됩니다. 체크포인트를 건너뛰어 일괄 처리하지 마세요.

## 모드

/qa 및 /qa-only에서는 Full, Quick 또는 Regression을 선택하세요. 깊이 플래그가 충돌하면 프로브 전에 질문하세요. /review와 /ship은 호출자의 smoke 및 계획 한도를 유지합니다. Diff-aware는 다른 실행이 아니라 범위를 선택합니다. 시간 한도에는 체크포인트와 근거가 포함됩니다. 소진되면 프로브를 중지하고 미완료 범위를 보고하며, 체크포인트를 건너뛰지 마세요.

### Diff-aware(URL 없이 기능 브랜치에 있으면 자동)

감지한 base를 `main` 대신 사용하세요:

```bash
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

변경된 controller/route/view/component/model/service/style을 페이지에 매핑하세요. commit/PR 의도를 확인하고 관련 TODO 버그를 테스트 계획에 추가하세요. 정적 페이지는 직접 여세요. 브라우저 표면 API 프로브:

```bash
aside repl '
const pg = await openTab("<base-url>");
const r = await fetch("<base-url>/api/...", { method: "GET" });
console.log("API_STATUS=" + r.status);
console.log("API_BODY_START"); console.log((await r.text()).slice(0, 4000)); console.log("API_BODY_END");
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

브라우저 표면을 선택하고 격리한 뒤 URL이 없으면 로컬 앱을 찾으세요:

```bash
for p in 3000 4000 8080; do curl -sI --max-time 3 "http://localhost:$p" >/dev/null 2>&1 && echo "Found app on :$p"; done
```

제공된 URL 또는 첫 응답자/staging/preview를 사용하세요. 없으면 질문하세요. 변경/인접 페이지와 흐름을 테스트합니다. TODOS.md에 없는 새 버그는 Phase 6 보고서에 표시하세요.

**식별 가능한 페이지 없음:** backend/config/infrastructure 변경이어도 Quick과 발견한 상호작용을 사용하세요.

### Full(URL이 있으면 기본)
도달 가능한 모든 페이지를 방문합니다(5-15분). 상태를 점수화하고 근거 있는 문제 5-10개를 문서화하되 지어내지 마세요.

### Quick(`--quick`)
3분: 홈페이지 + 상위 탐색 대상 5개. 로드/console/깨진 링크를 확인하고 Health Score Rubric으로 점수화하세요. 상세 문제/체크리스트는 건너뛰되 공용 루프의 게이트는 건너뛰지 마세요.

### Regression(`--regression <baseline>`)
Full을 실행하고 수정/신규 문제와 점수 변화를 추가하세요. 제공된 이전 baseline을 보존하세요. baseline이 없거나 읽을 수 없으면 비교만 막는 누락 전제조건이며 Full 실행은 막지 않습니다.

## 워크플로

### Phase 1: 초기화

호출자의 BROWSER SETUP 및 소유 아티팩트 경로를 재사용하세요. Aside READY, 아니면 `$B`(`NEEDS_ASIDE`/`ASIDE_NOT_RUNNING`)를 사용합니다. 호출자 권한 안에서 누락된 설정만 완료하세요. 공용 루프의 deadline guard를 호출자의 실행 중 deadline으로 제한하세요.

### Phase 2: 인증(필요한 경우)

BROWSER SETUP의 **Browser access decision**을 따라 /setup-browser-cookies 또는 `$B handoff`/`$B resume`를 사용하세요. 사용자 sign-in/2FA/OTP/CAPTCHA 뒤에 다시 실행하세요. 자격 증명을 처리하거나 cookie/token/localStorage를 노출하지 마세요.

### Phase 3: 방향 파악

도전 전에 성공한 기준선을 수립하세요. 단순 성공 로드가 아니라 페이지 또는 상호작용의 기대 결과/상태를 관찰하세요.

**Read/flow:** 상호작용에는 `flow = true`로 설정하고 action/wait를 교체하세요. 스크립트는 하나만 유지하며 탭은 끝에서 닫습니다.

```bash
aside repl '
const flow = false;
const HOOK = `(() => { window.__gstackErrs = window.__gstackErrs || []; const oe = console.error; console.error = (...a) => { window.__gstackErrs.push(a.map(String).join(" ")); oe.apply(console, a); }; window.addEventListener("error", e => window.__gstackErrs.push("uncaught: " + e.message)); window.addEventListener("unhandledrejection", e => window.__gstackErrs.push("unhandledrejection: " + (e.reason && e.reason.message || e.reason))); })()`;
const pg = await openTab("about:blank");
await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
await pg.goto("<target-url>");
console.log((await snapshot(pg, { interactive: true })).tree);
await pg.screenshot({ path: flow ? "issue-001-step-1.jpg" : "initial.jpg", type: "jpeg", quality: 60, fullPage: !flow });
if (flow) {
  await pg.locator("e12").click();
  await sleep(500);
  console.log("DIFF_START"); console.log((await snapshot(pg)).diff); console.log("DIFF_END");
  await pg.screenshot({ path: "issue-001-result.jpg", type: "jpeg", quality: 60 });
}
console.log("URL=" + pg.url());
console.log("CONSOLE_ERRORS=" + JSON.stringify(await pg.evaluate(() => window.__gstackErrs)));
console.log("TEXT_START"); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 20000)); console.log("TEXT_END");
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

**모든** screenshot: `cp "<ASIDE_DIR>/initial.jpg" "$REPORT_DIR/screenshots/initial.jpg"`(이름 교체)을 실행한 뒤 Read하세요. report/screenshot을 삭제하지 마세요.

**Links:** same-origin 안전 경로, HEAD는 로컬에서만 사용합니다(request가 cookie를 전달함).

```bash
aside repl '
const pg = await openTab("<target-url>");
const links = await pg.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map(a => a.href))].filter(h => new URL(h).origin === location.origin && !/logout|signout|delete|remove|cancel|unsubscribe/i.test(h)));
const local = await pg.evaluate(() => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$|\.(localhost|test)$/.test(location.hostname));
for (const l of links) { if (!local) { console.log("LINK ?", l); continue; } const r = await fetch(l, { method: "HEAD" }).catch(e => ({ status: "ERR " + e.message })); console.log("LINK", r.status, l); }
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

`LINK` 4xx/5xx 또는 `ERR`은 깨진 것이며 `LINK ?`는 미검증입니다. link에 없는 SPA button/menu는 snapshot하세요.

Framework: `__next`/`_next/data` = Next.js; `csrf-token` = Rails; `wp-content` = WordPress; no-reload navigation = SPA.

### Phase 4: 탐색

이전 결과에서 다음 후보를 선택하세요. 각 페이지에 read script를 `page-<name>.jpg`로 사용합니다. `qa/references/issue-taxonomy.md`에 따라 layout, control, empty/invalid/edge-case form, navigation 및 empty/loading/error/overflow 상태를 점검하세요. 보조 페이지보다 핵심 흐름을 우선합니다. Quick은 이 체크리스트를 건너뜁니다. 모바일:

```bash
aside repl '
const pg = await openTab("<page-url>");
await pg._sendToTarget("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await sleep(300);
await pg.screenshot({ path: "page-mobile.jpg", type: "jpeg", quality: 60, fullPage: true });
await pg._sendToTarget("Emulation.clearDeviceMetricsOverride", {});
console.log("ASIDE_DIR=" + pwd); await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

### Phase 5: 문서화

공용 루프의 정확한 재현 규칙으로 각 문제를 한 번 재시도해 확인한 뒤, 즉시 screenshot 근거를 최소화하고 보고하세요. 재현이 끝나기 전 timeout은 확인을 미완료로 남깁니다. 이후 timeout은 확인된 결함은 유지하되 근거나 최소화는 미완료입니다.

**Interactive:** Phase 3에서 `flow = true`. 대안: `pg.fill("#email", "qa@example.com")`, `pg.getByRole("button", { name: "Save" }).click()`, `pg.waitForSelector("#done")`, `pg.waitForURL(/dashboard/)`. 재현 단계에 전/후 screenshot을 연결하세요.

**Static**(copy/layout/image): 주석 단 screenshot 하나와 설명입니다.

```bash
aside repl '
const pg = await openTab("<page-url>");
const a = await annotatedScreenshot(pg);
await fs.writeFile(path.join(pwd, "issue-002.png"), Buffer.from(a.base64Image, "base64"));
console.log("ASIDE_DIR=" + pwd); await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

### Phase 6: 마무리

새 프로브 없이 보존된 근거를 이 호스트에 설치된 QA 디렉터리의 `templates/qa-report-template.md` 및 호출자의 artifact/mixed-report 규칙으로 형식화하세요.

점수, 심각도별 Top 3 Things to Fix, console 상태, 심각도 수, 날짜, 기간, page/screenshot 수 및 framework를 보고하세요. `baseline.json`을 저장하세요: `date`(YYYY-MM-DD), `url`, `healthScore`, `issues`(`id`, `title`, `severity`, `category`), `categoryScores`. Regression: fixed = 이전에만 존재, new = 현재에만 존재.

## Health Score Rubric

각 category 점수(0-100)를 계산한 뒤 가중 평균을 구하세요.

### 집계
- 페이지 전체에서 같은 root cause를 중복 제거합니다. 첫 적용 category 하나를 사용합니다: Links(navigation), Accessibility(access barrier), Functional(behavior), Performance(speed), Visual(layout), Content(copy), UX(friction), Console(remaining error). 이중 감점하지 마세요.
- **미검증** category는 제외합니다. 부분 점수에는 coverage와 함께 **provisional**을 표기하세요. 아무것도 테스트하지 않았으면 "not scored"입니다. 동일 coverage끼리만 비교하세요.

### Console(weight: 15%)
페이지 전체에서 재현 가능한 error/exception을 message+source로 중복 제거하세요. warning, info 및 다른 곳에서 점수화한 결함은 제외하세요.
- 0 errors → 100
- 1-3 errors → 70
- 4-10 errors → 40
- 11+ errors → 10

### Links(weight: 10%)
client-side route를 포함해 고유 broken destination을 셉니다: 반복 가능한 4xx/5xx, 누락 route/anchor 또는 timeout. 예상 auth redirect와 resource/API request는 제외합니다.
- 0 broken → 100
- 각 broken link → -15(최소 0)

### Category별 점수(Visual, Functional, UX, Content, Performance, Accessibility)
100에서 시작하고 finding마다 감점합니다:
- Critical issue → -25
- High issue → -15
- Medium issue → -8
- Low issue → -3
최저값은 0입니다.

가장 높은 적용 severity를 사용하고 impact/workaround를 기록하세요:
- **Critical:** data loss, security/privacy exposure 또는 모든 사용자가 core app을 사용할 수 없음.
- **High:** workaround 없이 core/major task가 막힘.
- **Medium:** task가 저해되지만 workaround가 있음.
- **Low:** task completion 손실 없는 cosmetic/copy/friction issue.
Console/Links는 count를 대신 사용합니다.

### 가중치
| Category | Weight |
|----------|--------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### 최종 점수
소수 가중치(15% = 0.15)를 사용하세요: `score = Σ (category_score × weight) / Σ tested weights`. 최종 점수만 가장 가까운 정수로 반올림합니다(0.5는 올림).

---

## Framework별 지침

- **Next.js:** hydration error(`Hydration failed`, `Text content did not match`), `_next/data` 404, link-click routing(`goto`만 아님), dynamic-content CLS.
- **Rails:** dev N+1 warning, form CSRF, Turbo/Stimulus transition, flash 표시/닫기.
- **WordPress:** plugin JS conflict, signed-in admin bar, `/wp-json/`, mixed content.
- **SPA:** snapshot navigation, 복귀 시 stale state, back/forward history, 장시간 사용 후 leak의 console 징후.

## 중요 규칙

**브라우저 탐색 중 source code를 절대 읽지 마세요.** 현실적인 end-to-end flow를 사용하고 모든 상호작용 뒤 console을 확인하세요. 누락 click target에는 annotated label을 사용한 뒤 ref/CSS click을 사용하세요.

자격 증명에는 `[REDACTED]`를 사용하세요. BROWSER SETUP safety/sentinel rule을 따르세요. 실행 전 run마다 non-LOCAL mutation을 하나의 AskUserQuestion으로 나열합니다. LOOK은 ACT가 아닙니다.

**선택한 브라우저 표면에서 브라우저 사용을 절대 거부하지 마세요.** backend-only app 변경에도 적용됩니다. test/curl은 대체할 수 없습니다. API/CLI/job/worker/webhook 대상은 이를 선택하지 않습니다.
