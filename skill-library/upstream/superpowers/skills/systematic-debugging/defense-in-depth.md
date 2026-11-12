> 한국어 번역본: 고정 커밋 `22f0b463e7a5e579904dd6211a520321035526f7`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 심층 방어 검증

## 개요

잘못된 데이터로 발생한 버그를 수정할 때 한 곳에 검증을 추가하면 충분해 보입니다. 하지만 그 단일 검사는 다른 코드 경로, 리팩터링 또는 목으로 우회될 수 있습니다.

**핵심 원칙:** 데이터가 통과하는 모든 계층에서 검증하세요. 버그가 구조적으로 불가능하도록 만드세요.

## 여러 계층이 필요한 이유

단일 검증: "버그를 수정했다"
여러 계층: "버그를 불가능하게 만들었다"

서로 다른 계층은 서로 다른 경우를 포착합니다:
- 진입점 검증은 대부분의 버그를 포착합니다
- 비즈니스 로직은 경계 사례를 포착합니다
- 환경 가드는 컨텍스트별 위험을 방지합니다
- 다른 계층이 실패할 때 디버그 로깅이 도움이 됩니다

## 네 가지 계층

### 계층 1: 진입점 검증
**목적:** API 경계에서 명백히 잘못된 입력을 거부합니다

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### 계층 2: 비즈니스 로직 검증
**목적:** 이 작업에 데이터가 적합한지 확인합니다

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### 계층 3: 환경 가드
**목적:** 특정 컨텍스트에서 위험한 작업을 방지합니다

```typescript
async function gitInit(directory: string) {
  // In tests, refuse git init outside temp directories
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... proceed
}
```

### 계층 4: 디버그 계측
**목적:** 포렌식 분석을 위한 컨텍스트를 수집합니다

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... proceed
}
```

## 패턴 적용

버그를 발견했을 때:

1. **데이터 흐름을 추적합니다** - 잘못된 값은 어디에서 발생했나요? 어디에서 사용되나요?
2. **모든 검사 지점을 매핑합니다** - 데이터가 통과하는 모든 지점을 나열합니다
3. **각 계층에 검증을 추가합니다** - 진입점, 비즈니스, 환경, 디버그
4. **각 계층을 테스트합니다** - 계층 1을 우회해 보고 계층 2가 이를 포착하는지 확인합니다

## 세션의 예시

버그: 비어 있는 `projectDir`가 소스 코드에서 `git init`를 유발했습니다

**데이터 흐름:**
1. 테스트 설정 → 빈 문자열
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init`가 `process.cwd()`에서 실행됨

**추가된 네 가지 계층:**
- 계층 1: `Project.create()`가 비어 있지 않음/존재함/쓰기 가능함을 검증
- 계층 2: `WorkspaceManager`가 projectDir가 비어 있지 않음을 검증
- 계층 3: `WorktreeManager`가 테스트에서 tmpdir 외부의 git init을 거부
- 계층 4: git init 이전의 스택 추적 로깅

**결과:** 1847개의 모든 테스트가 통과했고, 버그를 재현할 수 없게 되었습니다

## 핵심 통찰

네 계층 모두 필요했습니다. 테스트 중 각 계층은 다른 계층이 놓친 버그를 포착했습니다:
- 서로 다른 코드 경로가 진입점 검증을 우회했습니다
- 목이 비즈니스 로직 검사를 우회했습니다
- 서로 다른 플랫폼의 경계 사례에는 환경 가드가 필요했습니다
- 디버그 로깅이 구조적 오용을 식별했습니다

**한 검증 지점에서 멈추지 마세요.** 모든 계층에 검사를 추가하세요.
