> 한국어 번역본: 고정 커밋 `4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 좋은 테스트와 나쁜 테스트

## 좋은 테스트

**통합 스타일**: 내부 부분의 mock이 아니라 실제 인터페이스를 통해 테스트합니다.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

특징:

- 사용자/호출자가 중요하게 여기는 동작을 테스트함
- 공개 API만 사용함
- 내부 리팩터링 후에도 유지됨
- 방법이 아니라 대상을 설명함
- 테스트마다 논리적 단언이 하나임

## 나쁜 테스트

**구현 세부 사항 테스트**: 내부 구조에 결합됩니다.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

위험 신호:

- 내부 협력자 모킹
- 비공개 메서드 테스트
- 호출 횟수/순서 단언
- 동작 변경 없이 리팩터링할 때 테스트가 깨짐
- 테스트 이름이 대상이 아니라 방법을 설명함
- 인터페이스 대신 외부 수단을 통해 검증함

```typescript
// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**동어 반복 테스트**: 기댓값이 구현을 다시 서술하므로 테스트가 구조상 통과합니다.

```typescript
// BAD: Expected value is recomputed the way the code computes it
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// GOOD: Expected value is an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
