> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 성능 체크리스트

웹 애플리케이션 성능을 위한 빠른 참조 체크리스트다. `performance-optimization` 스킬과 함께 사용한다.

## 목차

- [Core Web Vitals 목표](#core-web-vitals-목표)
- [TTFB 진단](#ttfb-진단)
- [프런트엔드 체크리스트](#프런트엔드-체크리스트)
- [백엔드 체크리스트](#백엔드-체크리스트)
- [캐싱 전략](#캐싱-전략)
- [측정 명령](#측정-명령)
- [흔한 안티패턴](#흔한-안티패턴)

## Core Web Vitals 목표

| 지표 | 양호 | 개선 필요 | 나쁨 |
|--------|------|------------|------|
| LCP (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## TTFB 진단

TTFB가 느릴 때(> 800ms) DevTools Network 워터폴에서 각 구성 요소를 확인한다.

- [ ] **DNS 확인**이 느림 → 알려진 오리진에 `<link rel="dns-prefetch">` 또는 `<link rel="preconnect">` 추가
- [ ] **TCP/TLS 핸드셰이크**가 느림 → HTTP/2 활성화, 엣지 배포 고려, keep-alive 확인
- [ ] **서버 처리**가 느림 → 백엔드 프로파일링, 느린 쿼리 확인, 캐싱 추가

## 프런트엔드 체크리스트

### 이미지
- [ ] 이미지가 최신 형식(WebP, AVIF)을 사용함
- [ ] 이미지 크기가 반응형으로 지정됨(`srcset`과 `sizes`)
- [ ] 이미지와 `<source>` 요소에 명시적인 `width`와 `height`가 있음(아트 디렉션에서 CLS 방지)
- [ ] 화면 아래쪽 이미지는 `loading="lazy"`와 `decoding="async"`를 사용함
- [ ] 히어로/LCP 이미지는 `fetchpriority="high"`를 사용하고 지연 로딩하지 않음

### JavaScript
- [ ] 번들 크기가 gzip 압축 기준 200KB 미만임(초기 로드)
- [ ] 라우트와 무거운 기능에 동적 `import()`를 사용해 코드 분할함
- [ ] 트리 셰이킹을 활성화함(의존성이 ESM을 제공하고 `sideEffects: false`를 표시하는지 확인)
- [ ] `<head>`에 렌더링을 차단하는 JavaScript가 없음(`defer` 또는 `async` 사용)
- [ ] 무거운 연산을 Web Workers로 넘김(해당하는 경우)
- [ ] 같은 props로 다시 렌더링되는 비용이 큰 컴포넌트에 `React.memo()`를 사용함
- [ ] 프로파일링으로 이점이 확인된 곳에만 `useMemo()` / `useCallback()`을 사용함
- [ ] 메인 스레드를 사용 가능하게 유지하도록 긴 작업(> 50ms)을 나눔. INP 개선의 핵심 수단임
- [ ] 오래 실행되는 루프 안에서 `yieldToMain` 패턴을 사용해 청크 사이에 입력 이벤트가 실행될 수 있게 함
- [ ] 사용 가능한 곳에서 최신 스케줄링 API를 사용함. `scheduler.yield()`(권장), 우선순위를 지정한 `scheduler.postTask()`, 필요할 때만 양보하는 `isInputPending()`
- [ ] 미룰 수 있는 긴급하지 않은 작업(분석 데이터 플러시, 프리페치, 워밍업)에 `requestIdleCallback`을 사용함
- [ ] 상호작용 응답이 지연되지 않도록 중요하지 않은 작업(예: 분석, 로깅)을 이벤트 핸들러 밖으로 미룸
- [ ] 서드파티 스크립트를 `async` / `defer`로 로드하고 크기를 감사하며, 무거운 경우 퍼사드 앞에 둠(채팅 위젯, 임베드)

### CSS
- [ ] 핵심 CSS를 인라인하거나 프리로드함
- [ ] 중요하지 않은 스타일에 렌더링 차단 CSS가 없음
- [ ] 프로덕션에 CSS-in-JS 런타임 비용이 없음(추출 사용)

### 글꼴
- [ ] 글꼴 패밀리는 2~3개, 각각 굵기는 2~3개로 제한함(굵기 하나가 추가될 때마다 요청 하나가 추가됨)
- [ ] WOFF2 형식만 사용함(가장 작고 보편적으로 지원됨. WOFF/TTF/EOT는 건너뜀)
- [ ] 가능하면 자체 호스팅함(서드파티 글꼴 CDN은 DNS + TCP + TLS 왕복을 추가함)
- [ ] LCP에 중요한 글꼴을 프리로드함. `<link rel="preload" as="font" type="font/woff2" crossorigin>`
- [ ] FOIT가 렌더링을 차단하지 않도록 `font-display: swap`(중요하지 않은 경우 `optional`)을 사용함
- [ ] `unicode-range`로 서브셋을 만들어 각 페이지에 필요한 글리프만 전송함
- [ ] 여러 굵기/스타일이 필요하면 가변 글꼴을 고려함(파일 하나가 여러 파일을 대체함)
- [ ] 글꼴 교체 시 CLS를 줄이도록 `size-adjust`, `ascent-override`, `descent-override`로 대체 글꼴 메트릭을 조정함
- [ ] 사용자 정의 글꼴보다 먼저 시스템 글꼴 스택을 고려함

### 네트워크
- [ ] 정적 자산을 긴 `max-age`와 콘텐츠 해싱으로 캐시함
- [ ] 적절한 경우 API 응답을 캐시함(`Cache-Control`)
- [ ] HTTP/2 또는 HTTP/3를 활성화함
- [ ] 알려진 오리진의 리소스에 미리 연결함(`<link rel="preconnect">`)
- [ ] 이미지가 아닌 핵심 리소스(예: 주요 `<link rel="preload">`, 화면 위쪽 `<script>`)에도 `fetchpriority`를 사용함. `<img>`에만 사용하지 않음
- [ ] 불필요한 리디렉션이 없음

### 렌더링
- [ ] 레이아웃 스래싱(강제 동기 레이아웃)이 없음
- [ ] 애니메이션이 `transform`과 `opacity`를 사용함(GPU 가속)
- [ ] 긴 목록이 가상화를 사용함(예: `react-window`)
- [ ] 불필요한 전체 페이지 재렌더링이 없음
- [ ] 화면 밖 섹션에 `content-visibility: auto`와 `contain-intrinsic-size`를 사용해 보이지 않는 영역의 레이아웃/페인트를 건너뜀
- [ ] HTML 응답에 `unload` 이벤트 핸들러나 `Cache-Control: no-store`가 없음. 뒤로/앞으로 캐시(bfcache) 적격성을 유지함

## 백엔드 체크리스트

### 데이터베이스
- [ ] N+1 쿼리 패턴이 없음(즉시 로딩/조인 사용)
- [ ] 쿼리에 적절한 인덱스가 있음
- [ ] 목록 엔드포인트가 페이지네이션됨(`SELECT * FROM table`은 절대 사용하지 않음)
- [ ] 연결 풀링이 구성됨
- [ ] 느린 쿼리 로깅이 활성화됨

#### 쿼리 계획
- [ ] 수정 후뿐 아니라 수정 **전**에 `EXPLAIN ANALYZE`를 캡처함. 이것이 기준선임
- [ ] 큰 테이블의 `Seq Scan` 원인을 이해함. 인덱스가 없거나, 사용할 수 없거나, 실제로 쓸 가치가 없음
- [ ] 추정 `rows=`와 실제 값의 차이가 한 자릿수 배수 이내임(그렇지 않으면 인덱스를 건드리기 전에 통계를 갱신함)
- [ ] 복합 인덱스로 흡수할 수 있는 `Sort` 노드가 없음
- [ ] 변경 후 계획을 다시 확인함. 계획을 바꾸지 못한 인덱스는 되돌림

#### 인덱스 전략
- [ ] 복합 인덱스 열 순서가 동등 조건 우선, 범위/정렬 조건 후순임
- [ ] 인덱스가 한 열만 따로가 아니라 쿼리 형태(필터 + 정렬)를 다룸
- [ ] 빈번한 읽기 경로에 커버링 인덱스를 고려함(인덱스 전용 스캔은 힙 조회를 피함)
- [ ] *지배적인 값*을 위한 선택도 낮은 열에는 인덱스를 만들지 않음. 희소 값 쿼리는 부분 인덱스로 계속 지원함(`WHERE status = 'failed'`)
- [ ] 쿼리가 함수(`lower(email)`)를 적용하는 곳에 표현식 인덱스를 사용함
- [ ] 선행 와일드카드 검색에는 B-tree가 아니라 전문 또는 트라이그램 인덱스를 사용함
- [ ] 쓰기가 많은 테이블에서 쓰기 비용을 측정함(모든 인덱스는 모든 `INSERT`/`UPDATE`에 비용을 부과함)
- [ ] 사용하지 않거나 중복된 인덱스를 제거함(쓰기 비용만 들고 이점이 없음)

#### 연결 풀링
- [ ] 요청별이나 모듈별이 아니라 프로세스당 풀 하나를 사용함
- [ ] `instances × pool max`가 데이터베이스의 `max_connections` 미만으로 유지됨
- [ ] 고갈 시 무한정 대기열에 넣지 않고 빠르게 실패하도록 `connectionTimeoutMillis`를 설정함
- [ ] 크기를 조정하기 전에 고갈 원인을 진단함. 연결을 점유하는 것(긴 트랜잭션, 누락된 `await`, 누수된 클라이언트)을 찾음
- [ ] 서버리스/자동 확장 앞에는 더 큰 풀 대신 멀티플렉싱 프록시(pgbouncer, RDS Proxy)를 둠

### API
- [ ] 응답 시간이 200ms 미만임(p95)
- [ ] 요청 핸들러에 동기식 무거운 연산이 없음
- [ ] 개별 호출의 루프 대신 일괄 작업을 사용함
- [ ] 응답 압축(gzip/brotli)
- [ ] 적절한 캐싱(인메모리, Redis, CDN)

### 인프라
- [ ] 정적 자산에 CDN을 사용함
- [ ] 서버가 사용자 가까이에 있음(또는 엣지 배포)
- [ ] 수평 확장을 구성함(필요한 경우)
- [ ] 로드 밸런서용 상태 검사 엔드포인트가 있음

## 캐싱 전략

결정 자료(어떤 계층, 어떤 무효화 전략, 절대 캐시하지 말아야 할 것)는 `performance-optimization` 스킬에 있다. 이 섹션에서는 읽기/쓰기 패턴과 체크리스트를 다룬다.

### 읽기 및 쓰기 패턴

| 패턴 | 작동 방식 | 사용 시점 | 주의할 점 |
|---|---|---|---|
| **Cache-aside** (lazy) | 앱이 캐시를 확인하고, 미스 시 오리진을 읽어 채움 | 기본 선택지. 읽기가 많고 첫 콜드 히트를 허용할 수 있음 | 모든 미스가 오리진에 도달하므로 스탬피드 방지가 필요함 |
| **Read-through** | 캐시 계층 자체가 미스 시 로드함 | 모든 호출 지점이 아니라 한 곳에 로드 경로를 두고 싶음 | 오리진 지연을 숨김. 느린 오리진이 느린 캐시처럼 보임 |
| **Write-through** | 쓰기가 캐시와 오리진에 함께 동기식으로 기록됨 | 쓰기 후 읽기에서 오래된 값을 절대 보면 안 됨 | 모든 쓰기에 캐시 지연을 추가함 |
| **Write-behind** (write-back) | 쓰기가 캐시에 도달하고 오리진은 비동기 갱신됨 | 쓰기가 많고 오리진이 병목임 | 플러시 전에 캐시가 죽으면 데이터 손실 구간이 생김. 방어할 수 있는 내구성이 필요함 |

### 부정 캐싱

결과의 *부재*도 캐시한다. 조회할 때마다 미스가 나는 키(루프에서 조회하는 존재하지 않는 사용자 ID, 404 자산)는 모든 요청을 오리진으로 보내며, 이는 정상 경로만 보호하는 캐시다.

- 명시적인 "not found" 센티널을 긍정 항목보다 **짧은** TTL로 저장함
- 새로 생성된 레코드가 신속히 나타날 만큼 부정 TTL을 짧게 유지함
- 오리진 *오류*가 부정 캐시 항목이 되게 두지 않음. 한 번의 장애가 오래 지속됨

### 요청 병합(스탬피드 방지)

한 번 재계산하고 N명이 기다린다. 핫 키 만료가 전체 동시 부하를 오리진에 전달하지 않도록 한다.

```typescript
const inFlight = new Map<string, Promise<unknown>>();

function loadOnce<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}
```

공유 캐시에서는 같은 개념에 분산 잠금이 필요하며, 아니면 `stale-while-revalidate`를 사용해 대기자가 차단되는 대신 오래된 값을 제공하게 한다.

### 캐시 체크리스트
- [ ] 캐시된 호출이 비싸다는 것을 먼저 측정함(빠른 호출을 캐시하면 홉만 추가되고 이점이 없음)
- [ ] 읽기/쓰기 비율이 캐시를 정당화함(쓰기보다 훨씬 자주 다시 읽음)
- [ ] 캐시 키에 응답이 달라지는 모든 입력을 포함함. 테넌트, 뷰어, 로캘, 권한, 기능 플래그
- [ ] 사용자를 식별하지 않는 키 아래에 사용자별 데이터를 캐시하지 않음
- [ ] 우발적인 혼합이 아니라 하나의 무효화 전략(TTL, 이벤트/태그, 버전 키)을 선택함
- [ ] 허용 가능한 오래됨 구간을 입력한 TTL에서 암시하지 않고 명시함
- [ ] 핫 키에 스탬피드 방지(병합, 잠금, `stale-while-revalidate`)를 적용함
- [ ] 부정 결과는 더 짧은 TTL로 캐시하고 오리진 오류는 절대 캐시하지 않음
- [ ] 퇴거 정책과 메모리 상한을 설정함(무제한 캐시는 메모리 누수임)
- [ ] 적중률을 모니터링함. 측정하지 않는 캐시는 가정이며 낮은 적중률은 순수한 오버헤드임
- [ ] 오래됨이 정확성 버그가 되는 것(잔액, 권한, 결제 시점 재고)은 캐시하지 않음

## 측정 명령

### INP 필드 데이터와 DevTools 워크플로

1. **필드 데이터 우선** — 최적화 전에 [CrUX Vis](https://developer.chrome.com/docs/crux/vis) 또는 RUM 도구에서 실제 사용자 INP를 확인함
2. **느린 상호작용 식별** — DevTools → Performance 패널을 열고 상호작용하며 기록한 뒤, 클릭/키 입력이 유발한 긴 작업을 찾음
3. **중급 Android에서 테스트** — INP 문제는 느린 하드웨어에서만 드러나는 경우가 많음. 실제 기기나 DevTools CPU 스로틀링(4×~6× 감속)을 사용함

```bash
# Lighthouse CLI
npx lighthouse http://localhost:3000 --output json --output-path ./report.json

# Bundle analysis
npx webpack-bundle-analyzer stats.json
# or for Vite:
npx vite-bundle-visualizer

# Check bundle size
npx bundlesize
```

```javascript
// Web Vitals in code
import { onLCP, onINP, onCLS } from 'web-vitals';
onLCP(console.log);
onINP(console.log);
onCLS(console.log);

// INP with interaction-level detail (attribution build). The attribution build
// exports the same names, so alias it when both builds share a module.
import { onINP as onINPWithAttribution } from 'web-vitals/attribution';
onINPWithAttribution(({ value, attribution }) => {
  const { interactionTarget, inputDelay, processingDuration, presentationDelay } = attribution;
  console.log({ value, interactionTarget, inputDelay, processingDuration, presentationDelay });
});
```

## 흔한 안티패턴

| 안티패턴 | 영향 | 수정 |
|---|---|---|
| N+1 쿼리 | 선형 DB 부하 증가 | 조인, include 또는 일괄 로딩 사용 |
| 무제한 쿼리 | 메모리 고갈, 타임아웃 | 항상 페이지네이션하고 LIMIT 추가 |
| 인덱스 누락 | 데이터 증가에 따라 읽기가 느려짐 | 필터/정렬 열에 인덱스 추가 |
| 계획을 읽지 않고 인덱싱 | 쓰기 비용은 지불하지만 읽기 이점은 입증되지 않음 | 전후에 `EXPLAIN ANALYZE`, 계획이 같으면 되돌림 |
| 중복/미사용 인덱스 | 모든 쓰기가 비용을 부담함 | 사용 통계를 감사하고 아무것도 읽지 않는 것은 제거 |
| 요청별 연결 풀 | 부하 시 `max_connections` 고갈 | 프로세스당 풀 하나, 서버리스에는 프록시 사용 |
| 뷰어가 빠진 캐시 키 | 한 사용자의 데이터가 다른 사용자에게 제공됨 | 테넌트, 뷰어, 로캘, 권한을 키에 포함 |
| 무제한 캐시 | 최적화로 위장한 메모리 누수 | 퇴거 정책과 메모리 상한 설정 |
| 핫 키의 캐시 스탬피드 | 만료 시 오리진이 전체 동시 부하를 받음 | 미스를 병합하거나 `stale-while-revalidate` 사용 |
| 레이아웃 스래싱 | 버벅임, 프레임 누락 | DOM 읽기를 일괄 처리한 뒤 쓰기를 일괄 처리 |
| 최적화되지 않은 이미지 | 느린 LCP, 대역폭 낭비 | WebP, 반응형 크기, 지연 로딩 사용 |
| 큰 번들 | 느린 Time to Interactive | 코드 분할, 트리 셰이킹, 의존성 감사 |
| 메인 스레드 차단 | 나쁜 INP, 반응하지 않는 UI | `scheduler.yield()` / `yieldToMain`으로 긴 작업을 나누고 Web Workers로 넘김 |
| 메모리 누수 | 메모리 증가, 결국 충돌 | 리스너, 인터벌, 참조 정리 |
