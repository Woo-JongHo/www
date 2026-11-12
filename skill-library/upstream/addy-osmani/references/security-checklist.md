> 한국어 번역본: 고정 커밋 `301b02b12bff98e4688e6984af6556802322bbde`의 원문을 한국어로 번역해 수정했습니다. 출처·원문 해시·라이선스는 `skill-library/sources.json`과 `skill-library/inventory.json`에 기록합니다.

# 보안 체크리스트

웹 애플리케이션 보안에 대한 빠른 참조입니다. `security-and-hardening` 스킬과 함께 사용하세요.

## 목차

- [위협 모델링(여기서 시작)](#위협-모델링여기서-시작)
- [사전 커밋 확인](#커밋-전-확인)
- [인증](#인증)
- [인가](#인가)
- [입력 검증](#입력-유효성-검사)
- [보안 헤더](#보안-헤더)
- [CORS 구성](#cors-구성)
- [데이터 보호](#데이터-보호)
- [종속성 보안](#종속성-보안)
- [AI/LLM 보안](#ai--llm-보안)
- [오류 처리](#오류-처리)
- [OWASP 상위 10개 빠른 참조](#owasp-상위-10개-빠른-참조)
- [LLM용 OWASP 상위 10개 빠른 참조](#llm용-owasp-상위-10개-빠른-참조)

## 위협 모델링(여기서 시작)

코드를 건드리기 전에 5분 동안 공격자처럼 생각하세요.

- [ ] 매핑된 신뢰 경계(요청, 업로드, 웹후크, 타사 API, LLM 출력 및 제어하지 않는 프로세스에 의해 작성된 로컬 값)
- [ ] 명명된 자산(자격증명, PII, 결제 데이터, 관리 작업, 자금 이동)
- [ ] 경계당 STRIDE 실행(스푸핑, 변조, 부인, 정보 공개, DoS, 권한 상승)
- [ ] 사용 사례 옆에 남용 사례가 기록됨("이것을 어떻게 오용할까요?")

## 커밋 전 확인

- [ ] 코드에 비밀이 없습니다(`git diff --cached -i -G'password|secret|api_key|token' --name-only` — 단계적 diff가 일치하는 파일 이름만 나열하고 값 자체는 나열하지 않습니다. 모든 출력은 커밋하기 전에 해당 파일을 검토한다는 의미입니다)
- [ ] `.gitignore` 커버: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example`는 자리 표시자 값을 사용합니다(실제 비밀 아님).

## 인증

- [ ] bcrypt(≥12 라운드), scrypt 또는 argon2로 해시된 비밀번호
- [ ] 세션 쿠키: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] 세션 만료가 구성됨(합리적인 최대 기간)
- [ ] 로그인 엔드포인트의 속도 제한(15분당 10회 이하 시도)
- [ ] 비밀번호 재설정 토큰: 시간 제한(1시간 이하), 일회용
- [ ] 반복적인 실패 후 계정 잠금(선택 사항, 알림 포함)
- [ ] 민감한 작업에 대해 MFA 지원(선택 사항이지만 권장됨)

## 인가

- [ ] 보호된 모든 엔드포인트는 인증을 확인합니다.
- [ ] 모든 리소스 액세스는 소유권/역할을 확인합니다(IDOR 방지).
- [ ] 관리 엔드포인트에는 관리자 역할 확인이 필요합니다.
- [ ] 필요한 최소 권한으로 범위가 지정된 API 키
- [ ] 검증된 JWT 토큰(서명, 만료, 발급자)

## 입력 유효성 검사

- [ ] 시스템 경계에서 검증된 모든 사용자 입력(API 경로, 양식 처리기)
- [ ] 검증에서는 허용 목록(거부 목록 아님)을 사용합니다.
- [ ] 문자열 길이가 제한됨(최소/최대)
- [ ] 검증된 숫자 범위
- [ ] 적절한 라이브러리를 통해 검증된 이메일, URL 및 날짜 형식
- [ ] 파일 업로드: 유형 제한, 크기 제한, 콘텐츠 확인
- [ ] 매개변수화된 SQL 쿼리(문자열 연결 없음)
- [ ] 인코딩된 HTML 출력(프레임워크 자동 이스케이프 사용)
- [ ] 리디렉션 전에 검증된 URL(열린 리디렉션 방지)
- [ ] 서버 측 URL을 허용 목록으로 가져옵니다. 비공개/예약 IP 차단(SSRF 방지)
- [ ] 파괴적인 경로 작업(삭제/이동/덮어쓰기): 심볼릭 링크 확인, 허용 목록 루트, 최소 깊이, 호출 전 소유권 증거 읽기

### 파괴적인 경로 작업

데이터가 지정한 대상이 허용 범위 안에 있는지 확인합니다. 경로를 먼저 해석한 뒤 판단하고,
그 결과를 실행 승인이 아니라 후보로 취급하세요.

```typescript
import { realpath, readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute, join, sep } from 'node:path';

const ALLOWED_ROOTS = ['/var/lib/myapp/sessions']; // an allowlist, not a pattern
const MIN_DEPTH = 1;                               // so a root is never the target

async function resolveDeletable(candidate: string, expectedOwner: string) {
  const target = await realpath(resolve(candidate)); // symlinks resolved BEFORE the check
  const inRoot = ALLOWED_ROOTS.some((root) => {
    const rel = relative(root, target);
    // `rel === '..'` / `'../'` only — a plain `startsWith('..')` would also
    // reject a legitimate child named `..cache`.
    if (rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
    return rel.split(sep).length >= MIN_DEPTH;
  });
  if (!inRoot) throw new Error(`refusing: outside allowed roots (${target})`);

  const owner = await readFile(join(target, '.owner'), 'utf8').catch(() => null);
  if (owner?.trim() !== expectedOwner) throw new Error(`refusing: unproven owner (${target})`);
  return target;
}
```

이 코드가 보장하지 않는 다음 사항을, 코드를 복사한 곳에도 반드시 명시해야 합니다.

- **마커는 자기 진술에 불과합니다.** 루트 내부에 쓸 수 있는 주체는 누구나
  `.owner`도 쓸 수 있습니다. `expectedOwner`는 인증된 상태에서 가져와야 하며, 마커에는
  무결성 보호(제한된 소유권 또는 MAC)가 필요합니다. 그래야 잘못 도출한 대상과의
  일관성 검사에 그치지 않고 실행 권한의 근거가 됩니다.
- **경로를 반환해도 검사/사용 사이의 경쟁 조건은 남습니다.** 신뢰할 수 없는 프로세스가
  검사와 호출 사이에 상위 경로를 바꿀 수 있다면, 심볼릭 링크를 따르지 않고 루트 아래로
  제한하는 의미 체계를 갖춘 파일 디스크립터로 작업하거나 그동안 계층 구조가 바뀌지 않음을 보장하세요.

## 보안 헤더

```
Content-Security-Policy: default-src 'self'; script-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0  (disabled, rely on CSP)
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## CORS 구성

```typescript
// Restrictive (recommended)
cors({
  origin: ['https://yourdomain.com', 'https://app.yourdomain.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

// NEVER use in production:
cors({ origin: '*' })  // Allows any origin
```

## 데이터 보호

- [ ] API 응답에서 제외된 민감한 필드(`passwordHash`, `resetToken` 등)
- [ ] 민감한 데이터가 기록되지 않음(비밀번호, 토큰, 전체 CC 번호)
- [ ] 저장된 PII가 암호화됨(규정에 따라 필요한 경우)
- [ ] 모든 외부 통신을 위한 HTTPS
- [ ] 데이터베이스 백업이 암호화됨
- [ ] 개인정보는 명시된 목적에 맞게 분류, 수집되며 최소화됩니다.
- [ ] 개인 데이터에는 보존 제한 및 작업 삭제 경로가 있습니다(백업, 캐시, 인덱스 포함).
- [ ] 필요한 경우 내보내기/삭제(데이터 주제) 요청이 지원됩니다. 제3자 공유에는 동의 및 데이터 처리 계약이 있습니다.

## 종속성 보안

먼저 **설치 경계**를 찾으세요. 패키지가 상위 `workspaces` 선언과 일치하는 경우 해당 작업공간 루트를 사용하십시오. 그렇지 않으면 매니페스트와 종속성 그래프를 모두 소유한 가장 가까운 프로젝트 루트를 사용하세요. 해당 경계에서 `packageManager`(있는 경우), 잠금 파일 및 CI 명령을 확증합니다. 동의하지 않거나 경쟁 관리자 잠금 파일이 존재하면 중지하십시오. 중첩된 프로젝트는 상위 작업공간 외부에 있는 경우에만 독립적입니다. 독립적인 하위 프로젝트는 합법적으로 다른 관리자를 사용할 수 있습니다.

| 관리자/버전 신호 | 고정/불변 CI 설치 | 알려진 자문 감사 |
|---|---|---|
| npm(`package-lock.json` 또는 `npm-shrinkwrap.json`) | `npm ci` | `npm audit` |
| pnpm | `pnpm install --frozen-lockfile` | `pnpm audit` |
| Yarn 2+ | `yarn install --immutable` | `yarn npm audit -A -R` |
| Yarn 1 | `yarn install --frozen-lockfile` | `yarn audit` |

목록에 없는 관리자 또는 버전의 경우 공식 문서를 참조하세요. 다른 관리자의 명령이나 새로운 기본값을 대체하지 마십시오.

### 설치 스크립트 게이트

기본값이 확인되지 않은 클라이언트에서 먼저 일반 설치를 실행하여 종속성 수명 주기 스크립트를 검색하지 마세요.

1. 종속성 스크립트가 비활성화된 부트스트랩 또는 문서화된 기본 거부 정책과 페일클로즈 시행이 포함된 부트스트랩.
2. 승인 전 정확한 스크립트 소스와 패키지 버전을 확인하세요.
3. 설치 경계에서 가장 좁은 기본 허용/거부 정책을 기록하고 커밋합니다.
4. 해당 정책을 사용하여 완전히 동결/불변 설치를 실행하고 필요한 패키지가 여전히 빌드되는지 확인합니다.

**특정 시점 스냅샷:** 패키지 관리자 기본값과 명령 이름은 빠르게 변경됩니다. 의존하기 전에 고정된 클라이언트의 현재 공식 문서와 비교하여 이 매트릭스를 확인하세요.

| 관리자 버전 | 기본 정책 |
|---|---|
| 검증된 세부 승인이 없는 npm | `npm ci --ignore-scripts`를 사용하여 부트스트랩하거나 프로젝트 전체 차단을 의도한 경우 `ignore-scripts=true`를 유지합니다. 검토된 종속성 스크립트를 허용하기 전에 스크립트를 비활성화 상태로 유지하거나 의도적으로 업그레이드하십시오. |
| npm 11.18.x (11.18.0에서 확인) | 검토되지 않은 종속성 스크립트는 기본적으로 경고와 함께 실행됩니다. 일반 설치 전에 `strict-allow-scripts=true`를 적용한 다음 설치 경계에서 작업 공간을 인식하지 못하는 `npm install-scripts ls`를 사용하십시오. 승인은 버전별로 고정되고 거부는 이름 전체에 걸쳐 유지됩니다. |
| npm 12.x(12.0.1에서 확인됨) | 검토되지 않은 종속성 스크립트는 기본적으로 건너뜁니다. `strict-allow-scripts=true`는 실행 전에 설치에 실패하게 만듭니다. 동일한 `npm install-scripts` 검토 및 승인 흐름을 사용합니다. |
| pnpm 11+ | `pnpm approve-builds`를 사용하고 `allowBuilds` 결정을 커밋합니다. `strictDepBuilds`의 기본값은 `true`이므로 검토되지 않은 빌드는 실패합니다. |
| pnpm 10.26–10.x | `allowBuilds`를 명시적으로 구성하거나 레거시 `onlyBuiltDependencies` / `ignoredBuiltDependencies` 목록과 함께 `pnpm approve-builds`를 사용하세요. `strictDepBuilds: true`를 설정하십시오. v10 기본값은 `false`입니다. |
| pnpm 10.1–10.25 | `pnpm approve-builds`는 레거시 목록을 기록합니다. 지원되는 경우(10.3+) `strictDepBuilds`를 활성화합니다. |
| 오래되었거나 알 수 없는 pnpm | `pnpm install --frozen-lockfile --ignore-scripts`를 사용한 부트스트랩. 고정된 버전이 시행 가능한 정책을 문서화하지 않는 한 스크립트를 비활성화된 상태로 유지하세요. |
| Yarn 4.14+ | 종속성 사후 설치는 기본적으로 비활성화되어 있습니다. 최상위 `dependenciesMeta.<package>.built: true`에 필요한 예외만 부여합니다. |
| Yarn 2–4.13 | `.yarnrc.yml`에 `enableScripts: false`를 설정한 다음 최상위 `dependenciesMeta.<package>.built: true`에 필요한 예외만 부여합니다. 전역적으로 스크립트를 활성화하지 마십시오. |
| Yarn 1 | `yarn install --ignore-scripts`를 사용한 부트스트랩; 고정된 클라이언트의 문서화된 작업 흐름에 따라 각 필수 예외가 검토되지 않는 한 스크립트를 비활성화된 상태로 유지합니다. |

신뢰할 수 있는 검사: [npm install-scripts](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts/), [설치 정책](https://docs.npmjs.com/cli/v11/commands/npm-install/) 및 [CLI releases](https://github.com/npm/cli/releases); [pnpm 승인-빌드](https://pnpm.io/cli/approve-builds) 및 [빌드 설정](https://pnpm.io/settings#allowbuilds); [Yarn 보안](https://yarnpkg.com/features/security) 및 [manifest](https://yarnpkg.com/configuration/manifest#dependenciesMeta).

**공급망 위생**(자문 감사에서는 새로운 악성 패키지를 포착하지 못함):
- [ ] 프로젝트/작업 공간 루트당 정확히 하나의 권한 있는 잠금 파일이 커밋되고 CI는 이를 다시 쓰지 않습니다.
- [ ] 중요/높은 결과는 도달 가능성에 따라 분류됩니다. 연기에는 이유와 검토 날짜가 있습니다.
- [ ] 강제 감사 수정(`npm audit fix --force` 또는 동급)은 자동으로 수행되지 않습니다. 수정 차이점 및 변경 로그가 검토됩니다.
- [ ] 관리자가 지원하는 경우 레지스트리 서명/출처가 확인됩니다.
- [ ] 종속성 수명 주기 스크립트는 첫 번째 실행 전에 차단되고 고정된 관리자의 기본 정책을 통해서만 승인됩니다.
- [ ] 소유권, 유지 관리, 릴리스 기간, 출처, 전이 그래프 및 타이포스쿼팅에 대한 새로운 종속성을 검토합니다.

## AI / LLM 보안

LLM(챗봇, 요약자, 상담원, RAG)을 호출하는 모든 기능의 경우:

- [ ] 모델 출력은 신뢰할 수 없는 것으로 처리되며 `eval`/SQL/shell/`innerHTML`/파일 경로에는 포함되지 않습니다.
- [ ] 프롬프트 주입이 가정됩니다. 시스템 프롬프트가 아닌 코드에 권한이 적용됩니다.
- [ ] 비밀, 테넌트 간 데이터 및 전체 시스템 프롬프트가 컨텍스트 창 외부에 유지됩니다.
- [ ] 도구/에이전트 권한 범위가 지정되었습니다. 파괴적이거나 되돌릴 수 없는 작업에는 확인이 필요합니다.
- [ ] 토큰, 속도 및 재귀/루프 제한 설정(제한된 소비)

## 오류 처리

```typescript
// Production: generic error, no internals
res.status(500).json({
  error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
});

// NEVER in production:
res.status(500).json({
  error: err.message,
  stack: err.stack,         // Exposes internals
  query: err.sql,           // Exposes database details
});
```

## OWASP 상위 10개 빠른 참조

| # | 취약점 | 예방 |
|---|---|---|
| 1 | 손상된 액세스 제어 | 모든 엔드포인트에서 인가 확인, 소유권 확인 |
| 2 | 암호화 실패 | HTTPS, 강력한 해싱, 코드에 비밀 없음 |
| 3 | 주입 | 매개변수화된 쿼리, 입력 유효성 검사 |
| 4 | 안전하지 않은 디자인 | 위협 모델링, 사양 기반 개발 |
| 5 | 보안 구성 오류 | 보안 헤더, 최소 권한, 의존성 감사 |
| 6 | 취약한 구성요소 | 생태계의 종속성 감사(`npm audit`, `pip-audit`, ...), deps 업데이트 유지, 최소 deps |
| 7 | 인증 실패 | 강력한 비밀번호, 속도 제한, 세션 관리 |
| 8 | 데이터 무결성 실패 | 업데이트/종속성, 서명된 아티팩트 확인 |
| 9 | 로깅 실패 | 보안 이벤트를 기록하고 비밀은 기록하지 않음 |
| 10 | SSRF | URL 확인/허용 목록, 아웃바운드 요청 제한 |

## LLM용 OWASP 상위 10개 빠른 참조

LLM 기능이 있는 앱의 경우. [OWASP GenAI 보안 프로젝트](https://genai.owasp.org/llm-top-10/)를 참조하세요.

| 아이디 | 위험 | 예방 |
|---|---|---|
| LLM01 | 프롬프트 주입 | 시스템 프롬프트를 경계로 신뢰하지 마십시오. 코드에서 권한 적용 |
| LLM02 | 민감한 정보 공개 | 프롬프트에 비밀/PII를 넣지 않고 출력을 필터링 |
| LLM03 | 공급망 | 모든 종속성과 같은 모델, 데이터 세트 및 플러그인을 검사합니다 |
| LLM04 | 데이터 및 모델 중독 | 신뢰할 수 있는 모델 소스를 사용하고 무결성을 확인합니다. 미세 조정 및 RAG 데이터를 검토 |
| LLM05 | 부적절한 출력 처리 | 모델 출력을 신뢰할 수 없는 것으로 처리합니다. 검증, 매개변수화, 인코딩 |
| LLM06 | 과도한 자율 권한 | 도구 권한을 제한하고 파괴적인 작업을 확인 |
| LLM07 | 시스템 프롬프트 유출 | 시스템 프롬프트가 누출될 수 있다고 가정합니다. 그 안에 비밀을 두지 마세요 |
| LLM08 | 벡터 및 임베딩 약점 | 테넌트당 파티션 RAG 임베딩; 색인화하기 전에 문서 유효성 검사 |
| LLM09 | 잘못된 정보 | 인용을 통해 답변을 근거로 삼으세요. 중요한 주장을 검증합니다. 사람의 정보를 계속 확인하세요 |
| LLM10 | 무제한 소비 | 토큰, 요청 속도, 루프/재귀 깊이를 제한 |
