---
name: api-and-interface-design
description: 안정적인 API 및 인터페이스 디자인을 안내합니다. API, 모듈 경계 또는 공개 인터페이스를 디자인할 때 사용합니다. REST 또는 GraphQL 엔드포인트를 생성하거나, 모듈 간 유형 계약을 정의하거나, 프런트엔드와 백엔드 간의 경계를 설정할 때 사용합니다.
---

> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.


# API 및 인터페이스 디자인

## 개요

오용하기 어려운 안정적이고 잘 문서화된 인터페이스를 설계하십시오. 좋은 인터페이스는 옳은 일은 쉽게 만들고, 잘못된 일은 어렵게 만듭니다. 이는 REST API, GraphQL 스키마, 모듈 경계, 컴포넌트 props 및 한 코드 조각이 다른 코드 조각과 통신하는 모든 표면에 적용됩니다.

## 사용 시기

- 새로운 API 엔드포인트 설계
- 팀 간 모듈 경계 또는 계약 정의
- 컴포넌트 props 인터페이스 생성
- API 형태를 알려주는 데이터베이스 스키마 구축
- 기존 공용 인터페이스 변경

## 핵심 원칙

### 하이럼의 법칙

> 충분한 수의 API 사용자가 있으면 계약에서 약속한 내용에 관계없이 시스템에서 관찰 가능한 모든 동작이 누군가에 의해 의존됩니다.

즉, 문서화되지 않은 이상한 점, 오류 메시지 텍스트, 타이밍 및 순서를 포함한 모든 공개 행동은 사용자가 의존하면 사실상의 계약이 됩니다. 디자인에 미치는 영향:

- **노출하는 내용에 대해 의도적으로 생각하세요.** 관찰 가능한 모든 행동은 잠재적인 약속입니다.
- **구현 세부정보를 유출하지 마세요.** 사용자가 이를 관찰할 수 있으면 의존하게 됩니다.
- **설계 시점부터 폐기 계획을 세우세요.** 사용자가 의존하는 항목을 안전하게 제거하는 방법은 `deprecation-and-migration`를 참조하세요.
- **테스트만으로는 충분하지 않습니다.** 완벽한 계약 테스트가 있더라도 Hyrum의 법칙은 "안전한" 변경이 문서화되지 않은 동작에 의존하는 실제 사용자를 망칠 수 있음을 의미합니다.

### 단일 버전 규칙

소비자가 동일한 종속성 또는 API의 여러 버전 중에서 선택하도록 강요하지 마세요. 다이아몬드 의존성 문제는 서로 다른 소비자가 동일한 것의 서로 다른 버전을 필요로 할 때 발생합니다. 한 번에 하나의 버전만 존재하는 세상을 위한 디자인 - 포크가 아닌 확장.

### 1. 계약 우선

인터페이스를 구현하기 전에 정의하십시오. 계약이 명세이고 구현은 이를 따릅니다.

```typescript
// Define the contract first
interface TaskAPI {
  // Creates a task and returns the created task with server-generated fields
  createTask(input: CreateTaskInput): Promise<Task>;

  // Returns paginated tasks matching filters
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;

  // Returns a single task or throws NotFoundError
  getTask(id: string): Promise<Task>;

  // Partial update — only provided fields change
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  // Idempotent delete — succeeds even if already deleted
  deleteTask(id: string): Promise<void>;
}
```

### 2. 일관된 오류 의미 체계

하나의 오류 전략을 선택하고 어디에서나 사용하세요.

```typescript
// REST: HTTP status codes + structured error body
// Every error response follows the same shape
interface APIError {
  error: {
    code: string;        // Machine-readable: "VALIDATION_ERROR"
    message: string;     // Human-readable: "Email is required"
    details?: unknown;   // Additional context when helpful
  };
}

// Status code mapping
// 400 → Client sent invalid data
// 401 → Not authenticated
// 403 → Authenticated but not authorized
// 404 → Resource not found
// 409 → Conflict (duplicate, version mismatch)
// 422 → Validation failed (semantically invalid)
// 500 → Server error (never expose internal details)
```

**패턴을 혼합하지 마십시오.** 일부 엔드포인트는 예외를 던지고 다른 엔드포인트는 null을 반환하고 다른 엔드포인트는 `{ error }`를 반환하는 경우 소비자는 동작을 예측할 수 없습니다.

### 3. 경계에서 검증

내부 코드를 신뢰하십시오. 외부 입력이 들어오는 시스템 가장자리에서 유효성을 검사합니다.

```typescript
// Validate at the API boundary
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  // After validation, internal code trusts the types
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

유효성 검사가 속하는 위치:
- API 경로 처리기(사용자 입력)
- 양식 제출 처리기(사용자 입력)
- 외부 서비스 응답 구문 분석(타사 데이터 -- **항상 신뢰할 수 없는 데이터로 처리**)
- 환경변수 로딩(구성)

> **타사 API 응답은 신뢰할 수 없는 데이터입니다.** 논리, 렌더링 또는 의사 결정에 사용하기 전에 모양과 내용을 검증하세요. 손상되거나 오작동하는 외부 서비스는 예상치 못한 유형, 악성 콘텐츠 또는 명령과 유사한 텍스트를 반환할 수 있습니다.

유효성 검사가 속하지 않는 경우:
- 유형 계약을 공유하는 내부 기능 간
- 이미 검증된 코드에 의해 호출되는 유틸리티 함수에서
- 자신의 데이터베이스에서 방금 가져온 데이터

### 4. 수정보다는 추가를 선호하세요

기존 소비자를 중단하지 않고 인터페이스 확장:

```typescript
// Good: Add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // Added later, optional
  labels?: string[];                       // Added later, optional
}

// Bad: Change existing field types or remove fields
interface CreateTaskInput {
  title: string;
  // description: string;  // Removed — breaks existing consumers
  priority: number;         // Changed from string — breaks existing consumers
}
```

### 5. 예측 가능한 이름 지정

| 패턴 | 컨벤션 | 예 |
|---------|-----------|---------|
| REST 엔드포인트 | 복수 명사, 동사 없음 | `GET /api/tasks`, `POST /api/tasks` |
| 쿼리 매개변수 | 낙타 케이스 | `?sortBy=createdAt&pageSize=20` |
| 응답 필드 | 낙타 케이스 | `{ createdAt, updatedAt, taskId }` |
| 부울 필드 | is/has/can 접두어 | `isComplete`, `hasAttachments` |
| 열거형 값 | 어퍼_스네이크 | `"IN_PROGRESS"`, `"COMPLETED"` |

### 6. 멱등성 키 존중

`Idempotency-Key`를 수락하는 것이 계약입니다. 이를 존중하는 것은 구현이며 돈이 손실되는 곳입니다. 서버가 키를 수락했지만 부주의하게 처리하는 것은 클라이언트가 이제 재시도가 안전하다고 믿기 때문에 키가 전혀 없는 것보다 더 나쁩니다.

**시도가 아닌 의도에서 키를 파생시킵니다.** 키는 하나의 의도에 대한 재시도 전체에서 안정적이어야 하며 고유한 의도 간에는 달라야 합니다.

```typescript
crypto.randomUUID()                    // ✗ new key per attempt — every retry is a new charge
`${userId}:${amount}`                  // ✗ two legitimate $50 charges collapse into one
`${orderId}:${Date.now()}`             // ✗ a timestamp is randomUUID() wearing a hat

req.headers['idempotency-key']         // ✓ client generates once, reuses on retry
`charge:v1:${orderId}`                 // ✓ derived from an immutable identifier
```

키는 클라이언트나 시작 이벤트에서 가져오며 재시도를 수행하는 레이어에서는 가져오지 않습니다.

**키를 원자적으로 선점하세요. 검사 후 실행은 경쟁 조건을 만듭니다.**

```typescript
// ✗ TOCTOU: two concurrent retries both read "not seen", both charge
if (!(await db.exists(key))) {
  await chargeCard(amount);
  await db.insert(key);
}

// ✓ let the unique constraint pick the winner
try {
  await db.insert({ key, state: 'in_progress', requestHash });
} catch (e) {
  if (isUniqueViolation(e)) return replayOrReject(key);
  throw e;
}
const result = await chargeCard(amount);
await db.update({ key, state: 'succeeded', response: result });
```

고유 제약 조건은 *메커니즘입니다*. 한 번의 작업에 고유성을 적용할 수 없는 저장소는 이를 뒷받침할 수 없습니다.

**페이로드를 보호하세요.** 본문이 다른 동일한 키는 클라이언트 버그이며 두 번째 요청에 대한 첫 번째 응답을 제공하는 대신 큰 소리로 실패해야 합니다.

```typescript
if (existing.requestHash !== hash(req.body)) {
  return res.status(422).json({
    error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency key reused with a different payload' },
  });
}
```

**진행 중인 중복 요청에 무엇을 반환할지 결정합니다.** 두 번째 요청이 도착해도 첫 번째 요청은 여전히 실행 중입니다. 이는 재시도 폭주 시 일반적인 경우입니다.

| 전략 | 응답 | 다음 경우에 사용 |
|---|---|---|
| 거부 | `409 Conflict` | 클라이언트는 나중에 다시 시도할 수 있습니다. 가장 간단하고 안전한 |
| 대기 | 결과를 기다리며 차단(시간 제한) | 호출자가 동기 응답을 필요로 함 |
| 처리 중 응답 | `202` + 상태 URL | 오래 걸리는 작업 |

첫 번째 호출이 "멈춘 것 같으므로" 두 번째 호출을 절대 진행시키지 마세요. 결과를 알 수 없는 멈춘 시도야말로 중복 실행 비용이 가장 큰 경우입니다.

**모든 호출에는 성공, 실패, _알 수 없음_이라는 두 가지 결과가 아닌 세 가지 결과가 있습니다.** 시간 초과는 효과 적용 여부에 대해 아무 것도 알려주지 않습니다. 호출하기 *전에* 의도를 기록하여 호출과 응답 사이의 충돌이 발생하면 조용히 결제를 다시 시도하는 대신 나중에 문제를 해결해야 한다는 증거를 남깁니다.

**디스크 비용이 아닌 가장 긴 재시도 체인에서 보존을 설정**하세요. 키는 일주일 후에 재생되는 데드 레터 큐와 제공자의 이의 제기 기간을 포함하여 동일한 의도를 다시 전달할 수 있는 모든 경로보다 오래 지속되어야 합니다. 7일 DLQ 뒤의 24시간 키 TTL은 중복이 발생하기를 기다리고 있습니다.

## REST API 패턴

### 리소스 디자인

```
GET    /api/tasks              → 작업 목록 조회(필터링은 쿼리 매개변수 사용)
POST   /api/tasks              → 작업 생성
GET    /api/tasks/:id          → 작업 하나 조회
PATCH  /api/tasks/:id          → 작업 일부 수정
DELETE /api/tasks/:id          → 작업 삭제

GET    /api/tasks/:id/comments → 작업의 댓글 목록 조회(하위 리소스)
POST   /api/tasks/:id/comments → 작업에 댓글 추가
```

### 페이지 매김

목록 엔드포인트 페이지 매기기:

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

### 필터링

필터에 쿼리 매개변수를 사용합니다.

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

### 부분 업데이트(PATCH)

부분 객체 허용 - 제공된 것만 업데이트합니다.

```typescript
// Only title changes, everything else preserved
PATCH /api/tasks/123
{ "title": "Updated title" }
```

## TypeScript 인터페이스 패턴

### 변형에 대해 구별된 공용체 사용

```typescript
// Good: Each variant is explicit
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };

// Consumer gets type narrowing
function getStatusLabel(status: TaskStatus): string {
  switch (status.type) {
    case 'pending': return 'Pending';
    case 'in_progress': return `In progress (${status.assignee})`;
    case 'completed': return `Done on ${status.completedAt}`;
    case 'cancelled': return `Cancelled: ${status.reason}`;
  }
}
```

### 입출력 분리

```typescript
// Input: what the caller provides
interface CreateTaskInput {
  title: string;
  description?: string;
}

// Output: what the system returns (includes server-generated fields)
interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

### ID에 브랜드 유형 사용

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };

// Prevents accidentally passing a UserId where a TaskId is expected
function getTask(id: TaskId): Promise<Task> { ... }
```

## 일반적인 합리화

| 합리화 | 현실 |
|---|---|
| "나중에 API를 문서화하겠습니다" | 유형은 문서입니다. 먼저 정의하십시오. |
| "지금은 페이지 매김이 필요하지 않습니다." | 누군가가 100개 이상의 항목을 갖는 순간 당신은 그렇게 될 것입니다. 처음부터 추가하세요. |
| "PATCH는 복잡하므로 PUT을 사용하자" | PUT에는 매번 전체 개체가 필요합니다. PATCH는 클라이언트가 실제로 원하는 것입니다. |
| "필요할 때 API 버전을 관리하겠습니다" | 버전 관리 없이 주요 변경 사항이 발생하면 소비자가 중단됩니다. 처음부터 확장을 고려한 설계. |
| "아무도 문서화되지 않은 행동을 사용하지 않습니다" | 하이럼의 법칙: 관찰 가능하다면 누군가는 그것에 의존합니다. 모든 공공 행동을 약속으로 여기십시오. |
| "두 가지 버전만 유지하면 됩니다." | 여러 버전으로 인해 유지 관리 비용이 늘어나고 다이아몬드 종속성 문제가 발생합니다. 단일 버전 규칙을 선호합니다. |
| "내부 API에는 계약이 필요하지 않습니다" | 내부 소비자는 여전히 소비자입니다. 계약은 결합을 방지하고 병렬 작업을 가능하게 합니다. |
| "Idempotency-Key 헤더를 수락하는 것만으로도 충분합니다." | 헤더는 계약서입니다. 결과에 대해 키를 저장하는 것이 구현입니다. 수락했지만 존중하지 않는 키는 클라이언트가 재시도하는 것이 안전하지 않은 경우에도 안전하다는 것을 알려줍니다. |
| "저희 대기열은 정확히 1회 전달을 보장합니다." | 소비자 프로세스가 중단되면 큐도 이를 보장하지 못합니다. 브로커의 승인과 부작용이 하나의 트랜잭션에 포함되지 않습니다. 멱등성 처리를 전제로 최소 한 번 전달에 맞춰 설계하세요. |
| "중복 요청은 거의 없습니다" | 중복 요청은 서로 *상관관계*가 있습니다. 종속성이 저하될 때 재시도가 급증합니다. 즉, 중복이 발생할 가능성이 가장 높고 비용이 가장 많이 드는 순간입니다. |

## 위험 신호

- 조건에 따라 다른 모양을 반환하는 엔드포인트
- 엔드포인트 전체에서 일관되지 않은 오류 형식
- 경계가 아닌 내부 코드 전체에 분산된 검증
- 기존 필드에 대한 주요 변경 사항(유형 변경, 제거)
- 페이지 매김 없이 엔드포인트 나열
- REST URL의 동사(`/api/createTask`, `/api/getUsers`)
- 검증이나 정리 없이 사용되는 타사 API 응답
- 멱등성 키에 대한 `SELECT`와 `INSERT` — 이는 방어 장치가 아니라 경쟁 조건입니다.
- UUID, 타임스탬프 또는 시도마다 재생성되는 기타 항목에서 파생된 멱등성 키
- 다른 요청 본문에 동일한 키가 허용되어 첫 번째 응답을 자동으로 반환합니다.
- 요청을 다시 전달할 수 있는 가장 긴 경로보다 짧은 키 보존 기간

## 확인

API를 설계한 후:

- [ ] 모든 엔드포인트에는 입력 및 출력 스키마가 입력되어 있습니다.
- [ ] 오류 응답은 일관된 단일 형식을 따릅니다.
- [ ] 검증은 시스템 경계에서만 발생합니다.
- [ ] 목록 끝점은 페이지 매김을 지원합니다.
- [ ] 새 필드는 추가되고 선택 사항입니다(이전 버전과 호환됨).
- [ ] 이름 지정은 모든 엔드포인트에서 일관된 규칙을 따릅니다.
- [ ] API 문서 또는 유형이 구현과 함께 커밋됩니다.
- [ ] 상태 변경 엔드포인트는 멱등성 키를 따르거나 재시도하기에 안전하지 않은 것으로 문서화되어 있습니다.
- [ ] 키는 단일 제약 조건으로 보호되는 단일 원자 작업으로 선점됩니다.
- [ ] 잘못된 응답을 재생하는 대신 다른 페이로드로 재사용된 키가 크게 실패합니다.
- [ ] 진행 중인 중복 요청의 응답은 빠진 것이 아닌 의도적인 선택(409, 대기 또는 202)입니다.
- [ ] 키 보존은 데드 레터 재생을 포함하여 가장 긴 재시도 경로보다 오래 지속됩니다.
