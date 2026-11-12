> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 접근성 체크리스트

WCAG 2.1 AA 준수를 위한 빠른 참조 자료입니다. `frontend-ui-engineering` 스킬과 함께 사용하세요.

## 목차

- [필수 검사](#필수-검사)
- [일반적인 HTML 패턴](#일반적인-html-패턴)
- [테스트 도구](#테스트-도구)
- [빠른 참조: ARIA 라이브 영역](#빠른-참조-aria-라이브-영역)
- [일반적인 안티패턴](#일반적인-안티패턴)

## 필수 검사

### 키보드 탐색
- [ ] 모든 상호작용 요소에 Tab 키로 포커스 가능
- [ ] 포커스 순서가 시각적·논리적 순서를 따름
- [ ] 포커스가 보임(포커스된 요소의 윤곽선·링)
- [ ] 사용자 정의 위젯이 키보드를 지원함(Enter로 활성화, Escape로 닫기)
- [ ] 키보드 트랩이 없음(사용자가 언제든 Tab으로 컴포넌트에서 벗어날 수 있음)
- [ ] 페이지 상단에 본문 바로가기 링크가 있고 키보드 포커스 시에는 적어도 보임
- [ ] 모달이 열린 동안 포커스를 가두고 닫힐 때 포커스를 돌려줌

### 스크린 리더
- [ ] 모든 이미지에 `alt` 텍스트가 있음(장식용 이미지는 `alt=""`)
- [ ] 모든 양식 입력에 연결된 레이블이 있음(`<label>` 또는 `aria-label`)
- [ ] 버튼과 링크에 설명적인 텍스트가 있음("Click here"가 아님)
- [ ] 아이콘만 있는 버튼에 `aria-label`이 있음
- [ ] 페이지에 `<h1>`이 하나 있고 제목 수준을 건너뛰지 않음
- [ ] 동적 콘텐츠 변경이 알려짐(`aria-live` 영역)
- [ ] 표에 scope가 지정된 `<th>` 머리글이 있음

### 시각
- [ ] 일반 텍스트의 명암비가 4.5:1 이상이거나 큰 텍스트는 3:1 이상(18pt / 24 CSS px 이상, 또는 굵은 글씨일 때 14pt / 약 18.67 CSS px). 기준에 미달하는 명암비를 반올림해 기준을 충족한 것으로 처리하지 않음.
- [ ] UI 컴포넌트와 배경의 명암비가 3:1 이상
- [ ] 색상만으로 정보를 전달하지 않음
- [ ] 레이아웃을 깨뜨리지 않고 텍스트를 200%까지 확대 가능
- [ ] 초당 3회를 초과해 깜박이는 콘텐츠가 없음

### 양식
- [ ] 모든 입력에 보이는 레이블이 있음
- [ ] 필수 필드를 표시함(색상만으로 표시하지 않음)
- [ ] 오류 메시지가 구체적이고 해당 필드와 연결됨
- [ ] 오류 상태가 색상 외의 방식으로도 보임(아이콘, 텍스트, 테두리)
- [ ] 양식 제출 오류가 요약되고 포커스 가능함
- [ ] 알려진 필드에 autocomplete를 사용함(예: `type="email" autocomplete="email"`)

### 콘텐츠
- [ ] 언어가 선언됨(`<html lang="en">`)
- [ ] 페이지에 설명적인 `<title>`이 있음
- [ ] 링크가 주변 텍스트와 구별됨(색상만으로 구별하지 않음)
- [ ] 모바일의 터치 대상이 44x44px 이상
- [ ] 빈 상태가 의미 있음(빈 화면이 아님)

## 일반적인 HTML 패턴

### 버튼과 링크

```html
<!-- Use <button> for actions -->
<button onClick={handleDelete}>Delete Task</button>

<!-- Use <a> for navigation -->
<a href="/tasks/123">View Task</a>

<!-- NEVER use div/span as buttons -->
<div onClick={handleDelete}>Delete</div>  <!-- BAD -->
```

### 양식 레이블

```html
<!-- Explicit label association -->
<label for="email">Email address</label>
<input id="email" type="email" required />

<!-- Implicit wrapping -->
<label>
  Email address
  <input type="email" required />
</label>

<!-- Hidden label (visible label preferred) -->
<input type="search" aria-label="Search tasks" />
```

### ARIA 역할

```html
<!-- Navigation -->
<nav aria-label="Main navigation">...</nav>
<nav aria-label="Footer links">...</nav>

<!-- Status messages -->
<div role="status" aria-live="polite">Task saved</div>

<!-- Alert messages -->
<div role="alert">Error: Title is required</div>

<!-- Modal dialogs -->
<dialog aria-modal="true" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Delete</h2>
  ...
</dialog>

<!-- Loading states -->
<div role="status" aria-busy="true" aria-label="Loading tasks">
  <Spinner />
</div>
```

### 접근 가능한 목록

```html
<ul role="list" aria-label="Tasks">
  <li>
    <input type="checkbox" id="task-1" aria-label="Complete: Buy groceries" />
    <label for="task-1">Buy groceries</label>
  </li>
</ul>
```

## 테스트 도구

```bash
# Automated audit
npx --package=@axe-core/cli axe http://localhost:3000
npx pa11y             # CLI accessibility checker

# In browser
# Chrome DevTools → Lighthouse → Accessibility
# Chrome DevTools → Elements → Accessibility tree

# Screen reader testing
# macOS: VoiceOver (Cmd + F5)
# Windows: NVDA (free) or JAWS
# Linux: Orca
```

## 빠른 참조: ARIA 라이브 영역

| 값 | 동작 | 용도 |
|-------|----------|---------|
| `aria-live="polite"` | 다음 일시 정지 시 알림 | 상태 업데이트, 저장 확인 |
| `aria-live="assertive"` | 즉시 알림 | 오류, 시간에 민감한 경고 |
| `role="status"` | `polite`와 동일 | 상태 메시지 |
| `role="alert"` | `assertive`와 동일 | 오류 메시지 |

## 일반적인 안티패턴

| 안티패턴 | 문제 | 수정 |
|---|---|---|
| 버튼으로 사용한 `div` | 포커스할 수 없고 키보드를 지원하지 않음 | `<button>` 사용 |
| 누락된 `alt` 텍스트 | 스크린 리더에 이미지가 보이지 않음 | 설명적인 `alt` 추가 |
| 색상만 사용하는 상태 | 색맹 사용자에게 보이지 않음 | 아이콘, 텍스트 또는 패턴 추가 |
| 자동 재생 미디어 | 혼란을 주며 중지할 수 없음 | 컨트롤을 추가하고 자동 재생하지 않음 |
| ARIA가 없는 사용자 정의 드롭다운 | 키보드·스크린 리더로 사용할 수 없음 | 네이티브 `<select>` 또는 적절한 ARIA listbox 사용 |
| 포커스 윤곽선 제거 | 사용자가 현재 위치를 볼 수 없음 | 윤곽선 스타일을 지정하되 제거하지 않음 |
| 빈 링크·버튼 | 설명 없이 "Link"라고 읽힘 | 텍스트 또는 `aria-label` 추가 |
| `tabindex > 0` | 자연스러운 탭 순서를 깨뜨림 | `tabindex="0"` 또는 `-1`만 사용 |
