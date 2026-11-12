> 한국어 번역본: 고정 커밋 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 모킹할 때

**시스템 경계**에서만 모킹하세요.

- 외부 API(결제, 이메일 등)
- 데이터베이스(경우에 따라 사용하되 테스트 DB를 우선)
- 시간/무작위성
- 파일 시스템(경우에 따라)

다음은 모킹하지 마세요.

- 자체 클래스/모듈
- 내부 협력자
- 직접 제어하는 모든 것

## 모킹 가능성을 고려한 설계

시스템 경계에서는 모킹하기 쉬운 인터페이스를 설계하세요.

**1. 의존성 주입 사용**

외부 의존성을 내부에서 생성하지 말고 전달하세요.

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. 범용 fetcher보다 SDK 스타일 인터페이스 우선**

조건부 로직이 있는 범용 함수 하나 대신 외부 작업마다 구체적인 함수를 만드세요.

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

SDK 접근 방식의 의미는 다음과 같습니다.
- 각 mock은 하나의 구체적인 형태를 반환함
- 테스트 설정에 조건부 로직이 없음
- 테스트가 어떤 엔드포인트를 실행하는지 더 쉽게 파악할 수 있음
- 엔드포인트별 타입 안전성
