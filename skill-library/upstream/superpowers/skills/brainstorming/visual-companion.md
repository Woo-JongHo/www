> 한국어 번역본: 고정 커밋 `22f0b463e7a5e579904dd6211a520321035526f7`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 시각적 동반자 가이드

목업, 다이어그램, 옵션을 보여 주기 위한 브라우저 기반 시각 브레인스토밍 동반자입니다.

## 사용 시점

세션별이 아니라 질문별로 결정하세요. 기준은 다음입니다. **사용자가 읽는 것보다 보는 것으로 이를 더 잘 이해할 수 있는가?**

콘텐츠 자체가 시각적일 때는 **브라우저를 사용하세요**.

- **UI 목업** — 와이어프레임, 레이아웃, 탐색 구조, 컴포넌트 설계
- **아키텍처 다이어그램** — 시스템 컴포넌트, 데이터 흐름, 관계 지도
- **나란히 비교하는 시각적 비교** — 두 레이아웃, 두 색 구성표, 두 설계 방향 비교
- **디자인 다듬기** — 질문이 외관과 느낌, 간격, 시각적 위계에 관한 경우
- **공간 관계** — 다이어그램으로 렌더링한 상태 머신, 순서도, 엔터티 관계

콘텐츠가 텍스트 또는 표 형식일 때는 **터미널을 사용하세요**.

- **요구사항 및 범위 질문** — "X는 무엇을 의미하나요?", "어떤 기능이 범위에 포함되나요?"
- **개념적 A/B/C 선택** — 말로 설명한 접근법 중 선택
- **절충점 목록** — 장단점, 비교표
- **기술적 결정** — API 설계, 데이터 모델링, 아키텍처 접근법 선택
- **명확화 질문** — 답이 시각적 선호가 아니라 말인 모든 경우

UI 주제에 *관한* 질문이 자동으로 시각적 질문이 되는 것은 아닙니다. "어떤 종류의 단계별 안내 UI를 원하나요?"는 개념적이므로 터미널을 사용하세요. "이 단계별 안내 UI 레이아웃 중 어느 것이 적절하게 느껴지나요?"는 시각적이므로 브라우저를 사용하세요.

## 작동 방식

서버는 HTML 파일 디렉터리를 감시하고 가장 새 파일을 브라우저에 제공합니다. `screen_dir`에 HTML 콘텐츠를 작성하면 사용자가 브라우저에서 이를 보고 클릭해 옵션을 선택할 수 있습니다. 선택은 다음 턴에 읽을 `state_dir/events`에 기록됩니다.

**콘텐츠 조각과 완전한 문서:** HTML 파일이 `<!DOCTYPE` 또는 `<html`로 시작하면 서버는 그대로 제공합니다(도우미 스크립트만 주입). 그렇지 않으면 서버가 콘텐츠를 프레임 템플릿으로 자동 감쌉니다. 헤더, CSS 테마, 연결 상태, 모든 상호작용 인프라를 추가합니다. **기본적으로 콘텐츠 조각을 작성하세요.** 페이지를 완전히 제어해야 할 때만 완전한 문서를 작성하세요.

## 세션 시작

```bash
# Start AFTER the user approves the companion. --open auto-opens their browser on
# the first screen; --project-dir persists mockups and enables same-port restart.
bash scripts/start-server.sh --project-dir /path/to/project --open

# Returns: {"type":"server-started","port":52341,
#           "url":"http://localhost:52341/?key=ab12…",
#           "screen_dir":"/path/to/project/.superpowers/brainstorm/12345-1706000000/content",
#           "state_dir":"/path/to/project/.superpowers/brainstorm/12345-1706000000/state"}
```

응답에서 `screen_dir`와 `state_dir`를 저장하세요. `--open`을 사용하면 첫 화면을 푸시할 때 브라우저가 자동으로 열립니다. 사용자에게 브라우저를 열라고 요청할 필요는 없지만, 대체 수단으로 URL은 계속 공유하세요(headless/remote 설정은 자동으로 열리지 않습니다).

**URL에는 세션 키(`?key=…`)가 포함됩니다.** 서버는 키가 없는 모든 요청을 거부하므로, 항상 `url` 필드의 **전체** URL을 사용자에게 제공하세요. 쿼리 문자열을 절대 제거하거나 `http://host:port`만 제공하지 마세요. 키는 HTTP 및 WebSocket 접근을 제한하여 네트워크의 엉뚱한 브라우저 탭이나 다른 컴퓨터가 화면을 읽거나 이벤트를 주입하지 못하게 합니다. 첫 로드 후 브라우저는 쿠키를 통해 키를 기억하므로, 이를 반복하지 않아도 새로고침과 `/files/*` 자산이 동작합니다.

**연결 정보 찾기:** 서버는 시작 JSON을 `$STATE_DIR/server-info`에 작성합니다. 서버를 백그라운드에서 시작하고 stdout을 캡처하지 못했다면, 해당 파일을 읽어 URL과 포트를 얻으세요. `--project-dir`을 사용할 때는 `<project>/.superpowers/brainstorm/`에서 세션 디렉터리를 확인하세요.

**참고:** 목업이 `.superpowers/brainstorm/`에 보존되고 서버 재시작 후에도 남도록 프로젝트 루트를 `--project-dir`로 전달하세요. 이를 사용하지 않으면 파일은 `/tmp`에 가며 정리됩니다. 아직 없다면 `.superpowers/`를 `.gitignore`에 추가하도록 사용자에게 알리세요.

**플랫폼별 서버 시작:**

**Claude Code:**
```bash
# Default mode works — the script backgrounds the server itself.
bash scripts/start-server.sh --project-dir /path/to/project --open
```

Windows에서는 스크립트가 자동으로 감지하여 포그라운드 모드(도구 호출을 차단함)로 전환합니다. 서버가 대화 턴 사이에도 유지되도록 Bash 도구 호출에 `run_in_background: true`를 사용한 뒤, 다음 턴에 `$STATE_DIR/server-info`를 읽어 URL과 포트를 얻으세요.

**Codex:**
```bash
# Codex reaps background processes. The script auto-detects CODEX_CI and
# switches to foreground mode. Run it normally — no extra flags needed.
bash scripts/start-server.sh --project-dir /path/to/project --open
```

**Gemini CLI:**
```bash
# Use --foreground and set is_background: true on your shell tool call
# so the process survives across turns
bash scripts/start-server.sh --project-dir /path/to/project --open --foreground
```

**Copilot CLI:**
```bash
# Start it with Copilot CLI's non-blocking/background shell mechanism so the
# server survives across turns. Keep --foreground so the harness, not the
# script, owns backgrounding. The launcher is a .sh, so invoke it via bash
# (on Windows, call Git Bash's bash.exe from the PowerShell tool).
bash scripts/start-server.sh --project-dir /path/to/project --open --foreground
```

**기타 환경:** 서버는 대화 턴 사이에 백그라운드에서 계속 실행되어야 합니다. 환경이 분리된 프로세스를 정리한다면 `--foreground`를 사용하고 플랫폼의 백그라운드 실행 메커니즘으로 명령을 실행하세요.

브라우저에서 URL에 접근할 수 없다면(원격/컨테이너 설정에서 흔함), 루프백이 아닌 호스트에 바인딩하세요.

```bash
bash scripts/start-server.sh \
  --project-dir /path/to/project \
  --host 0.0.0.0 \
  --url-host localhost
```

`--url-host`를 사용해 반환된 URL JSON에 출력되는 호스트 이름을 제어하세요.

## 반복 흐름

1. **서버가 살아 있는지 확인**한 다음, `screen_dir`의 새 파일에 **HTML을 작성**하세요.
   - **필수: URL을 언급하거나 화면을 푸시하기 전에 서버가 살아 있는지 확인하세요.** `$STATE_DIR/server-info`가 존재하고 `$STATE_DIR/server-stopped`가 존재하지 않는지 확인하세요. 종료되었다면 **같은 `--project-dir`**을 사용해 `start-server.sh`로 재시작하세요. 같은 포트를 재사용하므로 사용자가 열어 둔 탭이 자동으로 다시 연결됩니다(서버가 중단된 동안 "paused" 오버레이가 표시됨). 새 URL을 보낼 필요가 없습니다. 서버는 유휴 상태가 4시간 지나면 자동으로 종료됩니다(`--idle-timeout-minutes`로 설정 가능).
   - 의미 있는 파일명을 사용하세요: `platform.html`, `visual-style.html`, `layout.html`
   - **파일명을 절대 재사용하지 마세요.** 각 화면은 새 파일을 가져야 합니다.
   - 파일 생성 도구를 사용하세요. **cat/heredoc은 절대 사용하지 마세요**(터미널에 불필요한 노이즈를 출력함).
   - 서버는 가장 새 파일을 자동으로 제공합니다.

2. **무엇을 기대할지 사용자에게 알리고 턴을 종료하세요.**
   - URL을 상기시키세요(첫 단계뿐 아니라 매번).
   - 화면에 있는 내용을 짧은 텍스트로 요약하세요(예: "홈페이지의 레이아웃 옵션 3개를 보여 줍니다").
   - 터미널에서 응답하도록 요청하세요. "살펴보고 어떻게 생각하는지 알려 주세요. 원한다면 클릭하여 옵션을 선택하세요."

3. **다음 턴에** — 사용자가 터미널에서 응답한 뒤:
   - `$STATE_DIR/events`가 존재한다면 읽으세요. 사용자의 브라우저 상호작용이 JSON 줄 형식으로 담겨 있습니다.
   - 사용자의 터미널 텍스트와 병합하여 전체 상황을 파악하세요.
   - 터미널 메시지가 주요 피드백이며, `state_dir/events`는 구조화된 상호작용 데이터를 제공합니다.

4. **반복하거나 진행하세요.** 피드백이 현재 화면을 바꾼다면 새 파일(예: `layout-v2.html`)을 작성하세요. 현재 단계가 검증될 때까지 다음 질문으로 넘어가지 마세요.

5. **터미널로 돌아올 때 언로드하세요.** 다음 단계에 브라우저가 필요하지 않다면(예: 명확화 질문, 절충점 논의), 대기 화면을 푸시하여 오래된 콘텐츠를 지우세요.

   ```html
   <!-- filename: waiting.html (or waiting-2.html, etc.) -->
   <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
     <p class="subtitle">Continuing in terminal...</p>
   </div>
   ```

   이렇게 하면 대화가 이미 해결된 선택에서 벗어났을 때 사용자가 이를 계속 바라보는 일을 막습니다. 다음 시각적 질문이 생기면 평소처럼 새 콘텐츠 파일을 푸시하세요.

6. 완료될 때까지 반복하세요.

## 콘텐츠 조각 작성

페이지 안에 들어갈 콘텐츠만 작성하세요. 서버가 프레임 템플릿(헤더, 테마 CSS, 연결 상태, 모든 상호작용 인프라)으로 자동 감쌉니다.

**최소 예시:**

```html
<h2>Which layout works better?</h2>
<p class="subtitle">Consider readability and visual hierarchy</p>

<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Single Column</h3>
      <p>Clean, focused reading experience</p>
    </div>
  </div>
  <div class="option" data-choice="b" onclick="toggleSelect(this)">
    <div class="letter">B</div>
    <div class="content">
      <h3>Two Column</h3>
      <p>Sidebar navigation with main content</p>
    </div>
  </div>
</div>
```

그것으로 충분합니다. `<html>`, CSS, `<script>` 태그는 필요하지 않습니다. 서버가 모두 제공합니다.

## 사용 가능한 CSS 클래스

프레임 템플릿은 콘텐츠에 다음 CSS 클래스를 제공합니다.

### 옵션(A/B/C 선택)

```html
<div class="options">
  <div class="option" data-choice="a" onclick="toggleSelect(this)">
    <div class="letter">A</div>
    <div class="content">
      <h3>Title</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

**다중 선택:** 컨테이너에 `data-multiselect`를 추가하면 사용자가 여러 옵션을 선택할 수 있습니다. 클릭할 때마다 항목의 선택 스타일이 전환됩니다.

```html
<div class="options" data-multiselect>
  <!-- same option markup — users can select/deselect multiple -->
</div>
```

### 카드(시각적 설계)

```html
<div class="cards">
  <div class="card" data-choice="design1" onclick="toggleSelect(this)">
    <div class="card-image"><!-- mockup content --></div>
    <div class="card-body">
      <h3>Name</h3>
      <p>Description</p>
    </div>
  </div>
</div>
```

### 목업 컨테이너

```html
<div class="mockup">
  <div class="mockup-header">Preview: Dashboard Layout</div>
  <div class="mockup-body"><!-- your mockup HTML --></div>
</div>
```

### 분할 보기(나란히)

```html
<div class="split">
  <div class="mockup"><!-- left --></div>
  <div class="mockup"><!-- right --></div>
</div>
```

### 장단점

```html
<div class="pros-cons">
  <div class="pros"><h4>Pros</h4><ul><li>Benefit</li></ul></div>
  <div class="cons"><h4>Cons</h4><ul><li>Drawback</li></ul></div>
</div>
```

### 목업 요소(와이어프레임 구성 요소)

```html
<div class="mock-nav">Logo | Home | About | Contact</div>
<div style="display: flex;">
  <div class="mock-sidebar">Navigation</div>
  <div class="mock-content">Main content area</div>
</div>
<button class="mock-button">Action Button</button>
<input class="mock-input" placeholder="Input field">
<div class="placeholder">Placeholder area</div>
```

### 타이포그래피와 섹션

- `h2` — 페이지 제목
- `h3` — 섹션 제목
- `.subtitle` — 제목 아래의 보조 텍스트
- `.section` — 하단 여백이 있는 콘텐츠 블록
- `.label` — 작은 대문자 레이블 텍스트

## 브라우저 이벤트 형식

사용자가 브라우저에서 옵션을 클릭하면 상호작용이 `$STATE_DIR/events`에 기록됩니다(줄마다 JSON 객체 하나). 새 화면을 푸시하면 파일은 자동으로 비워집니다.

```jsonl
{"type":"click","choice":"a","text":"Option A - Simple Layout","timestamp":1706000101}
{"type":"click","choice":"c","text":"Option C - Complex Grid","timestamp":1706000108}
{"type":"click","choice":"b","text":"Option B - Hybrid","timestamp":1706000115}
```

전체 이벤트 스트림은 사용자의 탐색 경로를 보여 줍니다. 선택을 확정하기 전에 여러 옵션을 클릭할 수 있습니다. 마지막 `choice` 이벤트가 보통 최종 선택이지만, 클릭 패턴은 물어볼 만한 망설임이나 선호를 드러낼 수 있습니다.

`$STATE_DIR/events`가 존재하지 않으면 사용자가 브라우저와 상호작용하지 않은 것입니다. 터미널 텍스트만 사용하세요.

## 디자인 팁

- **질문에 맞춰 충실도를 조절하세요** — 레이아웃에는 와이어프레임, 다듬기 질문에는 완성도를 사용하세요.
- **각 페이지에서 질문을 설명하세요** — "어느 레이아웃이 더 전문적으로 느껴지나요?"라고 하며 단순히 "하나를 고르세요"라고 하지 마세요.
- **진행하기 전에 반복하세요** — 피드백이 현재 화면을 바꾸면 새 버전을 작성하세요.
- 화면당 **옵션은 최대 2~4개**입니다.
- **중요할 때 실제 콘텐츠를 사용하세요** — 사진 포트폴리오에는 실제 이미지(Unsplash)를 사용하세요. 자리 표시 콘텐츠는 설계 문제를 가립니다.
- **목업은 단순하게 유지하세요** — 픽셀 단위의 완벽한 설계가 아니라 레이아웃과 구조에 집중하세요.

## 파일 이름 지정

- 의미 있는 이름을 사용하세요: `platform.html`, `visual-style.html`, `layout.html`
- 파일명을 절대 재사용하지 마세요. 각 화면은 새 파일이어야 합니다.
- 반복에는 `layout-v2.html`, `layout-v3.html`처럼 버전 접미사를 붙이세요.
- 서버는 수정 시간을 기준으로 가장 새 파일을 제공합니다.

## 정리

```bash
bash scripts/stop-server.sh $SESSION_DIR
```

세션에서 `--project-dir`을 사용했다면 목업 파일은 나중에 참고하도록 `.superpowers/brainstorm/`에 남습니다. `/tmp` 세션만 중지 시 삭제됩니다.

## 참고 자료

- 프레임 템플릿(CSS 참고): `scripts/frame-template.html`
- 도우미 스크립트(클라이언트 측): `scripts/helper.js`
