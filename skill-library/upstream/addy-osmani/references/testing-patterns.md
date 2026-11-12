> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 테스트 패턴 참조(JavaScript/TypeScript)

`test-driven-development` 스킬의 보편적인 원리를 설명하는 JavaScript/TypeScript 테스트 패턴(Jest, React Testing Library, Supertest 및 Playwright)에 대한 빠른 참조입니다. 원칙(Arrange-Act-Assert, 명명, 모의 규율, 안티패턴)은 모든 생태계에 적용됩니다. 여기에 표시된 구문과 도구는 JS/TS 전용입니다. 다른 스택에서는 저장소의 자체 테스트 프레임워크 및 명령과 동일한 원칙을 따릅니다.

## 목차

- [테스트 구조(Arrange-Act-Assert)](#테스트-구조arrange-act-assert)
- [테스트 명명 규칙](#테스트-명명-규칙)
- [일반적인 검증문](#일반적인-검증문)
- [모의 패턴](#모의-패턴)
- [React/컴포넌트 테스트](#react컴포넌트-테스트)
- [API / 통합 테스트](#api--통합-테스트)
- [E2E 테스트(Playwright)](#e2e-테스트playwright)
- [테스트 안티패턴](#테스트-안티패턴)

## 테스트 구조(Arrange-Act-Assert)

```typescript
it('describes expected behavior', () => {
  // Arrange: Set up test data and preconditions
  const input = { title: 'Test Task', priority: 'high' };

  // Act: Perform the action being tested
  const result = createTask(input);

  // Assert: Verify the outcome
  expect(result.title).toBe('Test Task');
  expect(result.priority).toBe('high');
  expect(result.status).toBe('pending');
});
```

## 테스트 명명 규칙

```typescript
// Pattern: [unit] [expected behavior] [condition]
describe('TaskService.createTask', () => {
  it('creates a task with default pending status', () => {});
  it('throws ValidationError when title is empty', () => {});
  it('trims whitespace from title', () => {});
  it('generates a unique ID for each task', () => {});
});
```

## 일반적인 검증문

```typescript
// Equality
expect(result).toBe(expected);           // Strict equality (===)
expect(result).toEqual(expected);        // Deep equality (objects/arrays)
expect(result).toStrictEqual(expected);  // Deep equality + type matching

// Truthiness
expect(result).toBeTruthy();
expect(result).toBeFalsy();
expect(result).toBeNull();
expect(result).toBeDefined();
expect(result).toBeUndefined();

// Numbers
expect(result).toBeGreaterThan(5);
expect(result).toBeLessThanOrEqual(10);
expect(result).toBeCloseTo(0.3, 5);      // Floating point

// Strings
expect(result).toMatch(/pattern/);
expect(result).toContain('substring');

// Arrays / Objects
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(object).toHaveProperty('key', 'value');

// Errors
expect(() => fn()).toThrow();
expect(() => fn()).toThrow(ValidationError);
expect(() => fn()).toThrow('specific message');

// Async
await expect(asyncFn()).resolves.toBe(value);
await expect(asyncFn()).rejects.toThrow(Error);
```

## 모의 패턴

### 모의 함수

```typescript
const mockFn = jest.fn();
mockFn.mockReturnValue(42);
mockFn.mockResolvedValue({ data: 'test' });
mockFn.mockImplementation((x) => x * 2);

expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
expect(mockFn).toHaveBeenCalledTimes(3);
```

### 모의 모듈

```typescript
// Mock an entire module
jest.mock('./database', () => ({
  query: jest.fn().mockResolvedValue([{ id: 1, title: 'Test' }]),
}));

// Mock specific exports
jest.mock('./utils', () => ({
  ...jest.requireActual('./utils'),
  generateId: jest.fn().mockReturnValue('test-id'),
}));
```

### 경계에서만 모의

```
모의할 대상:                    모의하지 않을 대상:
├── 데이터베이스 호출           ├── 내부 유틸리티 함수
├── HTTP 요청                   ├── 비즈니스 로직
├── 파일 시스템 작업            ├── 데이터 변환
├── 외부 API 호출               ├── 검증 함수
└── 시간/날짜(필요할 때)         └── 순수 함수
```

## React/컴포넌트 테스트

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('TaskForm', () => {
  it('submits the form with entered data', async () => {
    const onSubmit = jest.fn();
    render(<TaskForm onSubmit={onSubmit} />);

    // Find elements by accessible role/label (not test IDs)
    await screen.findByRole('textbox', { name: /title/i });
    fireEvent.change(screen.getByRole('textbox', { name: /title/i }), {
      target: { value: 'New Task' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ title: 'New Task' });
    });
  });

  it('shows validation error for empty title', async () => {
    render(<TaskForm onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /create/i }));

    expect(await screen.findByText(/title is required/i)).toBeInTheDocument();
  });
});
```

## API / 통합 테스트

```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('POST /api/tasks', () => {
  it('creates a task and returns 201', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: 'Test Task' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      title: 'Test Task',
      status: 'pending',
    });
  });

  it('returns 422 for invalid input', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .send({ title: '' })
      .set('Authorization', `Bearer ${testToken}`)
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without authentication', async () => {
    await request(app)
      .post('/api/tasks')
      .send({ title: 'Test' })
      .expect(401);
  });
});
```

## E2E 테스트(Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can create and complete a task', async ({ page }) => {
  // Navigate and authenticate
  await page.goto('/');
  await page.getByRole('textbox', { name: /email/i }).fill('test@example.com');
  await page.getByLabel(/password/i).fill('testpass123');
  await page.getByRole('button', { name: /log in/i }).click();

  // Create a task
  await page.getByRole('button', { name: /new task/i }).click();
  await page.getByRole('textbox', { name: /title/i }).fill('Buy groceries');
  await page.getByRole('button', { name: /create/i }).click();

  // Verify task appears
  // listitem has no accessible name from its content, so filter by text
  const task = page.getByRole('listitem').filter({ hasText: /buy groceries/i });
  await expect(task).toBeVisible();

  // Complete the task
  await task.getByRole('checkbox', { name: /complete buy groceries/i }).check();
  await expect(task).toHaveCSS('text-decoration-line', 'line-through');
});
```

## 테스트 안티패턴

| 안티 패턴 | 문제 | 더 나은 접근 방식 |
|---|---|---|
| 구현 세부정보 테스트 | 리팩터링 시 테스트가 깨짐 | 입력/출력 테스트 |
| 모든 것을 스냅샷 | 스냅샷 차이점을 검토하는 사람이 없습니다 | 구체적인 값 검증 |
| 공유 변경 가능 상태 | 테스트는 서로를 오염시킨다 | 테스트별 설정/해제 |
| 타사 코드 테스트 | 버그가 아닌 시간 낭비 | 경계에서 모의 |
| CI 통과를 위해 테스트 건너뛰기 | 실제 버그를 숨깁니다 | 테스트 수정 또는 삭제 |
| `test.skip`를 영구적으로 사용 | 데드 코드 | 제거 또는 수정 |
| 지나치게 광범위한 검증문 | 회귀를 포착하지 못함 | 구체적으로 |
| 비동기 오류 처리 없음 | 삼킨 오류, 거짓 통과 | 비동기 테스트에서 항상 `await` 사용 |
