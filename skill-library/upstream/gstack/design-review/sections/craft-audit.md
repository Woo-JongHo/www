> 한국어 번역본: 고정 커밋 `f0cd9f8c4b453c1eadd714e4149174ee01179eae`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

<!-- AUTO-GENERATED from craft-audit.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## 크래프트 감사: 설득 페이지와 재설계

페이지가 Persuade(Design Hard Rules의 분류기)이거나 사용자가 재설계 또는 크래프트 감사를 요청했을 때, 모든 감사 대상 페이지에서 1~6단계에 걸쳐 이를 실행한다.

### 1. 각 페이지에서 디자인 lint 실행

URL이 있으면 페이지를 여는 스크립트에서 페이지를 저장한다. Aside: `await fs.writeFile(path.join(pwd, ".{page}.html"), await pg.evaluate(() => document.documentElement.outerHTML));`를 추가한다. 대체 엔진: `_CR=$(mktemp -d "${TMPDIR:-/tmp}/gstack-craft.XXXXXX"); $B js 'document.documentElement.outerHTML' --out "$_CR/{page}.page.html" --raw`. 저장된 페이지에는 세션 데이터가 들어 있다. 종료 코드와 관계없이 점검하는 블록에서 이를 `rm -rf`(또는 `${_CR:?}`)하고 보고서 디렉터리로 절대 복사하지 않는다. 실행 중인 앱이 없으면 저장소의 페이지 HTML 파일을 사용한다.

```bash
~/.claude/skills/gstack/bin/gstack-design-lint <path-to-page.html>
```

각 `blocks` 또는 `ask` 줄은 규칙 ID와 줄별 category 9 finding 하나다. `polish` 줄은 메모다. `waived` 줄은 페이지가 기록상 답변한 항목이다. 사유와 함께 나열하되 filing하지 않는다. 단, 라이브 페이지가 담을 수 없는 `needs-proof`와 `lorem`은 예외다. `LINT_SUMMARY` 줄이 없으면 해당 페이지에서 lint를 사용할 수 없었다고 말하고, 아래 신호는 눈으로 판단한다. `empty-mount-node`(스크립트가 페이지를 렌더링함)이면 저장된 DOM을 lint하고 저장소 파일을 lint하지 않는다. 저장된 페이지가 연결된 CSS를 잃어 `skipped … not found`가 나오면 `craft` gate 줄(`--rules`)만 filing하고 CSS는 눈으로 판단한다. 실제 사용자 콘텐츠의 hit가 설명되는 경우(고객 이름이 Nexus 등)는 메모만 하고 filing하지 않는다. 규칙이나 수정이 요구한다고 해서 claim을 표시하거나 삭제하지 않는다. 보류하고 증거를 요청한다.

### 2. lint가 볼 수 없는 것

**Claim은 사용자에게서만 온다. 절대 당신에게서 오지 않는다.** 추천사, 고객 이름과 로고, 결과, 가동 시간, 가격, 보증은 제공된 경우에만 나타난다. 증거가 없으면 슬롯을 빼거나 실수로 출하되지 않도록 경고 색상으로 `[Needs proof: …]`를 표시한다. 그럴듯하게 지어낸 claim은 명백한 placeholder보다 더 나쁘다.

**예시 콘텐츠는 실제처럼 보여야 한다.** 제품 샷과 UI의 샘플 데이터(테이블 행, 차트 값, 데모 받은편지함의 사람):
- placeholder 인물이나 브랜드 금지(John Doe, Jane Doe, Acme, Nexus, SmartFlow). 아바타는 서로 달라야 하며 날짜도 다양해야 한다.
- 둥근 샘플 숫자 금지(99.99%, 50%, 1,000+ customers, 10x). claim에서 둥근 숫자는 지어냈다는 신호다. 제공된 수치를 쓰거나 제거한다.
- buzzword 금지: elevate, seamless, effortless, supercharge, streamline, revolutionize, unlock, empower, unleash, next-gen, game-changer, delve, tapestry, "in the world of".
- 제목은 sentence case. 오류는 무슨 일이 일어났고 무엇을 해야 하는지 말하며, 절대 "Oops!"라고 하지 않는다. 성공 메시지에 느낌표를 쓰지 않는다.

**출하 기준선.** head 태그는 컴포넌트나 fragment가 아니라 완전한 HTML 문서에 적용된다. 모든 완전한 문서에는 `<title>`, meta description, favicon(파일이 제공되지 않으면 brand mark의 인라인 SVG data URI), 공유 목적 페이지에는 `og:title`와 `og:description`이 있어야 한다. `og:image`는 제공된 URL에서만 사용한다. "Skip to content" 링크는 첫 번째 포커스 가능 요소이며 포커스될 때까지 숨기고 `<main>`의 `id`를 대상으로 한다. landmark(`<header>`, `<nav>`, `<main>`, `<footer>`), 의미 있는 이미지에는 alt text, 장식 이미지에는 `alt=""`을 사용한다. 마케팅 footer는 제공된 URL에서 privacy와 terms를 연결한다. 필수 필드와 이메일 형식은 `aria-invalid`, `aria-describedby`로 연결된 인라인 검증을 한다. 모든 링크는 실제 대상으로 향한다. `href="#"`나 지어낸 경로는 안 되며, 대상이 없는 control은 disabled로 렌더링한다. 다른 페이지로의 navigation은 현재 페이지에 `aria-current="page"`를 표시하고, 페이지 내 section 링크에는 표시하지 않는다.

문서 외에도 지어낸 경로는 돌아갈 방법이 있는 디자인된 404를 반환하고, 모든 페이지에는 나가는 방법이 있으며, 관할권에서 요구하는 곳에는 cookie consent가 표시된다.

**모션.** 다음은 작성된 하나의 모션 순간과 상태 전환을 규율하며, 더 많은 모션을 허가하지 않는다.
- 콘텐츠는 기본적으로 보인다. 스크립트는 observer를 설정한 뒤에만 숨겨진 시작 상태를 추가한다(`<html>`의 `.motion-ready`). 따라서 스크립트 실패나 crawler에서도 모두 보이며 CTA가 애니메이션을 기다리지 않는다.
- `IntersectionObserver`로 reveal한다(`threshold: 0`, 아래 `rootMargin` 약 −20%, 한 번). throttle 없는 `window.addEventListener('scroll')`은 절대 사용하지 않는다. scroll-linked 효과는 `requestAnimationFrame` 내부에서 scroll을 읽는다.
- `transform`, `opacity`, `filter`, `clip-path`만 애니메이션한다. blur는 14px 이하.
- 어떤 객체도 `scale(0)`에서 커지지 않는다(0.85 이상에서 시작). 선과 bar만 0에서 자란다. 데이터 bar는 0.7–1.1초의 왼쪽에서 오른쪽 `clip-path` wipe로 채운다.
- 한 section 안에서 읽기 순서로 stagger한다(30–80ms). 페이지 전체에 걸쳐서는 하지 않는다.
- 곡선은 이름 붙인 token이다. DESIGN.md의 것을 사용하고, 없으면 entrance에는 `cubic-bezier(0.16, 1, 0.3, 1)`, wipe에는 `cubic-bezier(0.65, 0, 0.35, 1)`을 사용한다. `linear`는 일정한 모션에만 사용한다.
- loop는 화면 밖에서 멈춘다. `prefers-reduced-motion: reduce`는 최종 상태를 보여 준다. 전체 높이 section에는 `100vh`가 아닌 `min-height: 100dvh`를 사용한다.

### 3. 설득 페이지

실패한 점검은 deferred High로 filing한다.

1. **이름이 있는 하나의 primary action**. fold 위에서 아무것도 경쟁하지 않고, 끝맺는 CTA가 이를 반복한다.
2. **이름이 있는 이의 제기**: 방문자의 주요 이의 제기를 각각 발생 지점에서 답한다(실제 질문 FAQ, 비교, 보증).
3. **각 claim 옆의 증거**: 뒷받침하는 claim 옆에 제공된 고객, 인용문 또는 수치를 둔다. metric row에는 두지 않는다. 뒷받침되지 않는 claim은 삭제하거나 `[Needs proof: …]`로 표시한다.
4. **비즈니스가 실제 제공하는 risk reversal**(무료 플랜, 체험, 카드 불필요, 언제든 취소, 환불). 절대 지어내지 않는다.
5. **index/noindex 결정**: 광고 전용 또는 기간 한정 페이지는 `noindex`다. index되는 페이지에는 실제 title과 description이 있고 FAQ를 FAQPage JSON-LD로 출하한다.

**전환 규칙.**
- 광고 뒤의 페이지는 hero에서 광고의 약속과 tone을 반복한다.
- primary CTA는 하나이며 fold 위에서 아무것도 경쟁하지 않는다.
- 이점을 먼저 구체적으로 제시한다. "시간 절약"이 아니라 "주간 보고를 4시간에서 15분으로 단축".
- 비즈니스가 제공하는 risk reversal(무료 플랜, 체험, 카드 불필요, 언제든 취소)을 보여 준다. 절대 지어내지 않는다.
- 증거는 뒷받침하는 claim 옆에 둔다. 마찰이 큰 offer는 FAQ를 위로 올린다.

### 4. 수정 순서와 스택(8단계)

같은 impact 수준 안에서는 위험이 가장 적으면서 가장 큰 가시적 이득을 먼저 취한다. type, color, hover/active/focus 상태, layout과 spacing, motion, components, loading/empty/error 상태, copy, type-scale polish 순서다.

기존 스택 안에서 작업한다. framework나 styling migration은 하지 않는다. 라이브러리를 import하기 전에 dependency 파일을 확인한다. Tailwind에서는 설치된 major(`package.json` 또는 lockfile의 `tailwindcss`)에 맞춰 작성한다. v3는 `tailwind.config.*`로 구성하고, v4는 CSS(`@import "tailwindcss"`, `@theme`)로 구성한다.

Elaya의 [redesign-skill](https://github.com/elayadesign/redesign-skill)과 [ai-design-skills](https://github.com/elayadesign/ai-design-skills)에서 각색함(MIT, © 2026 Elaya), gstack용으로 다시 작성. NOTICE.md 참조.
