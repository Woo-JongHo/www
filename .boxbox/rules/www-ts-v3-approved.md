# BoxBox 안정 범위 추가 승인 검토안 v3

검사한 변경·관리 소스 93개에서 안정 범위의 Align 필요 15개 파일을 골랐다. 기존 complete 승인과 중복되지 않는 차이는 76개 정확 key/파일 쌍, 38종이다. 이 문서는 검토안이며 아직 승인·등록·적용되지 않았다.

기존 승인 key의 새 파일 범위: 17종/53쌍. 현재 유효 승인 관측 집합에 없는 key: 21종/23쌍. 이미 사용자 승인·등록된 v1 28종/86쌍은 그대로 보존한다.

범위는 아래 정확 파일과 context/kind/순서 있는 axis key뿐이다. key에는 깊이가 없으므로 같은 파일의 다른 깊이에서 동일 key가 나오면 적용될 수 있다. 다른 key·파일·glob으로 자동 확장하지 않는다.

양성 예시는 가로 공백만 다르고 구문·AST leaf token·AST 종류·주석 포함 printer가 같다. 재사용32종과 이번 공식 검사6종을 구분한다. 여섯 새 예시는 before FIXABLE, after0, 전후 동일 key, 반례 다른 key를 확인했다. 대상 파일 공식 Align/자동 고정점은 아직 실행하지 않았다.

별도 진행 중인 Chat 파일22개와 소유권 불명 관찰13개는 승인 대상에서 제외했다. 미정렬이 있어도 이 제외 범위에 자동 적용하지 않는다. 전체 Stop green을 뜻하지 않는다.

## 대상 소스

- `scripts/generate-architecture.ts` — SHA256 `28b0a9bd75d6c6494236facfbe75e76e615911d4a32eddc45c7bec3b488d971c`, 미정렬 16그룹, 추가 2쌍
- `scripts/verify-reports.ts` — SHA256 `c2255700039e232042eba31115386a94e6d62a1eff0c26262cb6bd86567fb4db`, 미정렬 3그룹, 추가 6쌍
- `scripts/workflow/preflight.ts` — SHA256 `6784f9f483810f95bec97adc2860789433bddc657e7aa375f46270f85cc0cc7c`, 미정렬 1그룹, 추가 8쌍
- `scripts/workflow/reports.ts` — SHA256 `a1548084716d6347ff3ef0307d43591b8b5dbf2fb40a440e0e099c2ddff2d954`, 미정렬 1그룹, 추가 12쌍
- `scripts/workflow/types.ts` — SHA256 `a6bc8155c53698d4c6354aa3bf431f3453ad556afcfd58e551306fe99a2f80a3`, 미정렬 1그룹, 추가 1쌍
- `scripts/workflow/work-json.ts` — SHA256 `d45ca376322ac1be8eddaa07b7a4e78f4d30fcbcb1e7885337ddda3c1931e137`, 미정렬 3그룹, 추가 3쌍
- `scripts/workflow/work.ts` — SHA256 `aec1b8066a66788b224079113dcf4696e38251158c6330a00d91945f12066b9b`, 미정렬 1그룹, 추가 9쌍
- `src/architecture-tree.ts` — SHA256 `f56c965b18334dee7d4a9c5716fd6b1e7cfc748a8744402ba80e0e892554d8ef`, 미정렬 15그룹, 추가 1쌍
- `src/architecture.ts` — SHA256 `2a925c469fb9df4f43d6833418ac342ff971eedf3e5bade33e6964b2fc8daa72`, 미정렬 7그룹, 추가 1쌍
- `src/ecosystem-view.tsx` — SHA256 `be9c3cd428a92eaa60c44c80ff533fe6ab4606cfb075bfc4cc0608e76b9c47e2`, 미정렬 4그룹, 추가 1쌍
- `src/native-reports.ts` — SHA256 `806a2f79e7c514a7f29df47ce5c3a451fa235da318ee504134a2e60a35fa7622`, 미정렬 1그룹, 추가 17쌍
- `test/architecture-contract.test.ts` — SHA256 `77944bed2563fbd0920305ab56d455bbedef1724cbeca561dea27d22cd50fcc7`, 미정렬 6그룹, 추가 1쌍
- `test/architecture-tree.test.ts` — SHA256 `9241bdf56b3637e467b38bd90cca1433dac3ed48c564d076e0008c275605acde`, 미정렬 13그룹, 추가 1쌍
- `test/native-reports.test.ts` — SHA256 `2832d33c8bed309c4c3137d07a93e9be6f614decd2abca0760d0bd75d342b2f9`, 미정렬 2그룹, 추가 8쌍
- `test/work-json.test.ts` — SHA256 `ce3cfd15db76a8c2be6e62bcc34c4f7fe1de22a9b2679344a2ba3573759f161d`, 미정렬 15그룹, 추가 5쌍

## D01. 현재 승인 관측 집합에 없는 key

`v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

정확 파일: `test/native-reports.test.ts`

양성 before:
```typescript
const rows = [
  { id: "a", count: 1 },
  { id: "longer", count: 22 },
  { id: "b", count: 333 },
];
```
양성 after:
```typescript
const rows = [
  { id : "a"      , count : 1   },
  { id : "longer" , count : 22  },
  { id : "b"      , count : 333 },
];
```
반례 — 이 코드는 해당 문맥/shape에서 별도 key로 검출된다. 양성 key의 재사용 승인만으로 이 다른 key의 자동 정렬을 승인하지 않는다.
반례 before:
```typescript
const rows = [
  { id: "a", text: "first", active: false },
  { id: "longer", text: "x", active: true },
  { id: "b", text: "mid", active: true },
];
```
반례 after:
```typescript
const rows = [
  { id : "a"      , text : "first" , active : false },
  { id : "longer" , text : "x"     , active : true  },
  { id : "b"      , text : "mid"   , active : true  },
];
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D02. 현재 승인 관측 집합에 없는 key

`v1|typescript|BinaryExpression|logical-chains|logical-operator>logical-not>logical-operand`

정확 파일: `scripts/workflow/preflight.ts`

양성 before:
```typescript
function sample() {
  return valid(value)
        && ready(value)
        && !blocked(value);
}
```
양성 after:
```typescript
function sample() {
  return    valid(value)
        &&  ready(value)
        && !blocked(value);
}
```
반례 — 별도 context/kind/axes의 예시는 다른 exact key로 검출된다. 이 key의 승인을 다른 key로 자동 확장하지 않는다. out-of-key는 제안 메타이며 공식 ExampleVerdict가 아니다.
반례 before:
```typescript
function sample() {
  return value !== null
        && typeof value.name === "string"
        && !blocked(value);
}
```
반례 after:
```typescript
function sample() {
  return    value             !== null
        &&  typeof value.name === "string"
        && !blocked(value);
}
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D03. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|assignments|equals>semicolon`

정확 파일: `scripts/workflow/work.ts`, `src/native-reports.ts`

양성 before:
```typescript
function sample() {
  value.a = 1;
  enabled = true;
  result = false;
}
```
양성 after:
```typescript
function sample() {
  value.a = 1     ;
  enabled = true  ;
  result  = false ;
}
```
반례 — 별도 context/kind/axes의 예시는 다른 exact key로 검출된다. 이 key의 승인을 다른 key로 자동 확장하지 않는다. out-of-key는 제안 메타이며 공식 ExampleVerdict가 아니다.
반례 before:
```typescript
value.a = 1;
enabled = true;
result = false;
```
반례 after:
```typescript
value.a = 1     ;
enabled = true  ;
result  = false ;
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D04. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|call-statements|call-open-paren>call-close-paren>subject-close-paren>matcher-dot>matcher-open-paren>matcher-close-paren>semicolon`

정확 파일: `test/work-json.test.ts`

양성 before:
```typescript
function inspect() {
  expect(output({ a: 1, longer: 2, mid: 3 })).toContain("first");
  expect(output({ a: 1, longer: 2 })).toContain("second");
  expect(output({ a: 1, bb: 2, ccc: 3, d: null })).toContain("third");
}
```
양성 after:
```typescript
function inspect() {
  expect(output({ a: 1, longer: 2, mid: 3 }     )).toContain("first" ) ;
  expect(output({ a: 1, longer: 2 }             )).toContain("second") ;
  expect(output({ a: 1, bb: 2, ccc: 3, d: null })).toContain("third" ) ;
}
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D05. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|call-statements|subject-close-paren>matcher-dot>matcher-open-paren>matcher-close-paren>semicolon`

정확 파일: `test/work-json.test.ts`

양성 before:
```typescript
function sample() {
  expect(a).toBe(true);
  expect(longer).toBe(false);
  expect(mid).toBe(true);
}
```
양성 after:
```typescript
function sample() {
  expect(a     ).toBe(true ) ;
  expect(longer).toBe(false) ;
  expect(mid   ).toBe(true ) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D06. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-call-envelope|colon>equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`

정확 파일: `src/native-reports.ts`, `test/native-reports.test.ts`

양성 before:
```typescript
function sample() {
  const raw = read(root, "structure.json");
  const value: unknown = JSON.parse(raw);
  const contract = object(value);
}
```
양성 after:
```typescript
function sample() {
  const raw             = read      (root, "structure.json") ;
  const value : unknown = JSON.parse(raw                   ) ;
  const contract        = object    (value                 ) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D07. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-call-envelope|equals>call-envelope-open>call-envelope-close>semicolon`

정확 파일: `scripts/workflow/reports.ts`, `src/native-reports.ts`

양성 before:
```typescript
function sample() {
  const first = read(1, "a");
  const result = parse(value);
}
```
양성 after:
```typescript
function sample() {
  const first  = read (1, "a") ;
  const result = parse(value ) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D08. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-call-envelope|equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`

정확 파일: `scripts/workflow/preflight.ts`, `scripts/workflow/reports.ts`, `scripts/workflow/work-json.ts`, `src/ecosystem-view.tsx`, `src/native-reports.ts`

양성 before:
```typescript
function sample() {
  const filler = Array.from([1, 2]);
  const result = project(filler);
}
```
양성 after:
```typescript
function sample() {
  const filler = Array.from([1, 2]) ;
  const result = project   (filler) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D09. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-equals|colon>equals>semicolon`

정확 파일: `scripts/workflow/work-json.ts`, `test/native-reports.test.ts`

양성 before:
```typescript
function sample() {
  const request: Event = { kind: "request" };
  const waiting = project(request);
}
```
양성 after:
```typescript
function sample() {
  const request : Event = { kind: "request" } ;
  const waiting         = project(request)    ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D10. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`

정확 파일: `scripts/generate-architecture.ts`

양성 before:
```typescript
function sample() {
  const pre = record(record(value).before);
  const post = record(record(value).after);
}
```
양성 after:
```typescript
function sample() {
  const pre  = record(record(value).before) ;
  const post = record(record(value).after ) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D11. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>semicolon`

정확 파일: `src/native-reports.ts`

양성 before:
```typescript
function sample() {
  const outgoing = contains(id, from);
  const incoming = contains(id, to);
}
```
양성 after:
```typescript
function sample() {
  const outgoing = contains(id, from) ;
  const incoming = contains(id, to  ) ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D12. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-equals|equals>semicolon`

정확 파일: `scripts/verify-reports.ts`, `scripts/workflow/reports.ts`, `scripts/workflow/work-json.ts`, `scripts/workflow/work.ts`, `src/native-reports.ts`, `test/native-reports.test.ts`, `test/work-json.test.ts`

양성 before:
```typescript
function sample() {
  const id = randomUUID();
  let prompt = "";
}
```
양성 after:
```typescript
function sample() {
  const id   = randomUUID() ;
  let prompt = ""           ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D13. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|declaration-equals|equals>subscript-close>semicolon`

정확 파일: `test/architecture-tree.test.ts`

양성 before:
```typescript
function sample() {
  const a = points[i - 1]!;
  const b = points[i]!;
}
```
양성 after:
```typescript
function sample() {
  const a = points[i - 1]! ;
  const b = points[i    ]! ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D14. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon`

정확 파일: `scripts/workflow/reports.ts`, `scripts/workflow/work.ts`, `src/native-reports.ts`, `test/native-reports.test.ts`

양성 before:
```typescript
function sample() {
  const visited = new Set<string>();
  let current: Node | undefined = node;
}
```
양성 after:
```typescript
function sample() {
  const visited                  = new Set<string>() ;
  let current : Node | undefined = node              ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D15. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|declaration-extended-equals|equals>call-open-paren>call-close-paren>semicolon`

정확 파일: `test/native-reports.test.ts`

양성 before:
```typescript
async function sample() {
  const linked = await repository(t);
  const outside = await repository(t);
}
```
양성 after:
```typescript
async function sample() {
  const linked  = await repository(t) ;
  const outside = await repository(t) ;
}
```
반례 — 이 코드는 해당 문맥/shape에서 별도 key로 검출된다. 양성 key의 재사용 승인만으로 이 다른 key의 자동 정렬을 승인하지 않는다.
반례 before:
```typescript
export {};

const linked = await repository(t);
const outside = await repository(t);
```
반례 after:
```typescript
export {};

const linked  = await repository(t) ;
const outside = await repository(t) ;
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D16. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|declaration-extended-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>semicolon`

정확 파일: `scripts/workflow/preflight.ts`

양성 before:
```typescript
async function read() {
  const canonicalRoot = await resolveInside(repo         , "skills/www"       );
  const file          = await resolveInside(canonicalRoot, `${skill}/SKILL.md`) ;
}
```
양성 after:
```typescript
async function read() {
  const canonicalRoot = await resolveInside(repo         , "skills/www"       ) ;
  const file          = await resolveInside(canonicalRoot, `${skill}/SKILL.md`) ;
}
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D17. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|declaration-extended-equals|equals>call-open-paren>list-arg{i}-open>list-arg{i}-comma{i}>list-arg{i}-el{i}>list-arg{i}-close>call-close-paren>semicolon`

정확 파일: `test/native-reports.test.ts`

양성 before:
```typescript
async function sample() {
  const one = await harness.enqueue({ repository: first, input: input() });
  const two = await harness.enqueue({ repository: second, input: input() });
}
```
양성 after:
```typescript
async function sample() {
  const one = await harness.enqueue({ repository: first , input: input()}) ;
  const two = await harness.enqueue({ repository: second, input: input()}) ;
}
```
반례 — 이 코드는 해당 문맥/shape에서 별도 key로 검출된다. 양성 key의 재사용 승인만으로 이 다른 key의 자동 정렬을 승인하지 않는다.
반례 before:
```typescript
function sample() {
  const one = harness.enqueue({ repository: first, input: input() });
  const two = harness.enqueue({ repository: second, input: input() });
}
```
반례 after:
```typescript
function sample() {
  const one = harness.enqueue({ repository: first , input: input()}) ;
  const two = harness.enqueue({ repository: second, input: input()}) ;
}
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D18. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-extended-equals|equals>semicolon`

정확 파일: `scripts/verify-reports.ts`, `scripts/workflow/preflight.ts`, `scripts/workflow/reports.ts`, `scripts/workflow/work.ts`, `src/native-reports.ts`, `test/native-reports.test.ts`, `test/work-json.test.ts`

양성 before:
```typescript
function sample() {
  const boundary = new Boundary();
  const bootstrap = boundary.begin();
}
```
양성 after:
```typescript
function sample() {
  const boundary  = new Boundary()   ;
  const bootstrap = boundary.begin() ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D19. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|if-headers-return|if-close-paren>if-return`

정확 파일: `scripts/workflow/reports.ts`

양성 before:
```typescript
function sample() {
  if (!value) return false;
  if (!value.name) return false;
  if (!value.parent) return false;
}
```
양성 after:
```typescript
function sample() {
  if (!value       ) return false;
  if (!value.name  ) return false;
  if (!value.parent) return false;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D20. 현재 승인 관측 집합에 없는 key

`v1|typescript|Block|return-guards|guard-return`

정확 파일: `scripts/workflow/preflight.ts`, `src/native-reports.ts`

양성 before:
```typescript
function state(item: Item) {
  if (item.status === "declined") return "declined";
  const exitCode = item.exitCode;
  if (typeof exitCode === "number") return "completed";
  const status = item.status;
  if (status === "failed") return "failed";
  if (status === "completed") return "completed";
}
```
양성 after:
```typescript
function state(item: Item) {
  if (item.status === "declined")   return "declined";
  const exitCode = item.exitCode;
  if (typeof exitCode === "number") return "completed";
  const status = item.status;
  if (status === "failed")          return "failed";
  if (status === "completed")       return "completed";
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D21. 현재 승인 관측 집합에 없는 key

`v1|typescript|CallExpression|vertical-call-arguments|vertical-call-comma`

정확 파일: `test/architecture-contract.test.ts`

양성 before:
```typescript
function sample() {
  registrations.push(
    ["a", true],
    ["longer", false],
    ["mid", true],
  );
}
```
양성 after:
```typescript
function sample() {
  registrations.push(
    ["a", true]      ,
    ["longer", false],
    ["mid", true]    ,
  );
}
```
반례 — 기존 한줄 호출은 이미 수직배치된 인자의비교표가 아니다. 이규칙으로한줄인자에패딩을확장하지않는다.
반례 before:
```typescript
function sample() { registrations.push(["a", true], ["longer", false], ["mid", true]); }
```
반례 after:
```typescript
function sample() { registrations.push(["a", true]      , ["longer", false], ["mid", true]    ); }
```
예시 근거: `seven-pair-partial-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D22. 기존 승인 key의 새 파일 범위

`v1|typescript|InterfaceDeclaration|interface-members|colon>semicolon`

정확 파일: `scripts/generate-architecture.ts`, `scripts/workflow/preflight.ts`, `scripts/workflow/reports.ts`, `scripts/workflow/types.ts`, `src/architecture-tree.ts`, `src/architecture.ts`, `src/native-reports.ts`

양성 before:
```typescript
interface Result {
  code: number;
  stdout: string;
  outputTruncated: boolean;
}
```
양성 after:
```typescript
interface Result {
  code            : number  ;
  stdout          : string  ;
  outputTruncated : boolean ;
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D23. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-comma>property-value{i}>property-comma{i}`

정확 파일: `scripts/workflow/work.ts`

양성 before:
```typescript
const item = {
  id    : read()  ,
  title : "a"    ,
  preview        ,
  cwd       : "x"    ,
  updatedAt : 0      ,
  status    : "idle" ,
};
```
양성 after:
```typescript
const item = {
  id    : read() ,
  title : "a"    ,
  preview        ,
  cwd       : "x"    ,
  updatedAt : 0      ,
  status    : "idle" ,
};
```
반례 — 별도 context/kind/axes의 예시는 다른 exact key로 검출된다. 이 key의 승인을 다른 key로 자동 확장하지 않는다. out-of-key는 제안 메타이며 공식 ExampleVerdict가 아니다.
반례 before:
```typescript
const item = {
  key,
  name: "a",
  path: "longer",
  enabled: true,
};
```
반례 after:
```typescript
const item = {
  key,
  name    : "a"      ,
  path    : "longer" ,
  enabled : true     ,
};
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D24. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-comma{i}>property-value{i}>property-value>property-comma>property-comma{i}`

정확 파일: `scripts/workflow/preflight.ts`

양성 before:
```typescript
function build() {
  return Object.freeze({
    schemaVersion : 1    ,
    workId        : id   ,
    requestHash   : hash ,
    approval,
    workPath   : work.path   ,
    workStatus : work.status,
    createdAt  : clock()
  });
}
```
양성 after:
```typescript
function build() {
  return Object.freeze({
    schemaVersion : 1    ,
    workId        : id   ,
    requestHash   : hash ,
    approval,
    workPath   : work.path   ,
    workStatus : work.status ,
    createdAt  : clock()
  });
}
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D25. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-value>property-comma`

정확 파일: `scripts/workflow/work.ts`

양성 before:
```typescript
const api = {
  open                    : (id) => invoke("open", id),
  completeDevelopmentWork : () => invoke("complete"),
  read                    : () => invoke("read"),
  onEvent: (listener) => {
    const handler = (event: Event) => listener(event);
    subscribe("event", handler);
    return handler;
  }
};
```
양성 after:
```typescript
const api = {
  open                    : (id) => invoke("open", id) ,
  completeDevelopmentWork : () => invoke("complete")   ,
  read                    : () => invoke("read")       ,
  onEvent: (listener) => {
    const handler = (event: Event) => listener(event);
    subscribe("event", handler);
    return handler;
  }
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D26. 기존 승인 key의 새 파일 범위

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-comma`

정확 파일: `scripts/verify-reports.ts`, `scripts/workflow/reports.ts`, `src/native-reports.ts`

양성 before:
```typescript
const value = {
  a: { x: 1 },
  longer: { x: 2 },
  keep,
};
```
양성 after:
```typescript
const value = {
  a      : { x: 1 } ,
  longer : { x: 2 } ,
  keep              ,
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D27. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-comma>property-colon{i}>property-value{i}>property-comma{i}`

정확 파일: `scripts/workflow/work.ts`

양성 before:
```typescript
const item = {
  id,
  label,
  description: null,
  status: "running",
  at,
  endedAt: null,
  durationMs: null,
  source: "native"
};
```
양성 after:
```typescript
const item = {
  id                      ,
  label                   ,
  description : null      ,
  status      : "running" ,
  at                      ,
  endedAt    : null ,
  durationMs : null ,
  source     : "native"
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D28. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-value>property-colon{i}>property-comma`

정확 파일: `scripts/verify-reports.ts`

양성 before:
```typescript
const record = {
  ready  : true,
  reason : "검사" ,
  title  : "결과" ,
  longDetails: {
    summary     : "짧음" ,
    description : "설명" ,
    next        : []
  }
};
```
양성 after:
```typescript
const record = {
  ready  : true   ,
  reason : "검사" ,
  title  : "결과" ,
  longDetails: {
    summary     : "짧음" ,
    description : "설명" ,
    next        : []
  }
};
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D29. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon{i}>property-colon>property-comma>property-value{i}>property-comma{i}`

정확 파일: `src/native-reports.ts`

양성 before:
```typescript
const record = {
  schemaVersion : 1 ,
  id                ,
  title             ,
  kind          : "maintenance",
  areas         : ["dev"]       ,
  owner         : "dev"         ,
  status        : "verifying"   ,
  blockedReason : "limit"       ,
  relations     : []            ,
  criteria      : [{
    id          : "AC"   ,
    description : "검사" ,
    required    : true   ,
    result      : "open" ,
    evidence    : []
  }],
  native        : {
    key       : entry.key      ,
    threadId  : entry.threadId ,
    turnId    : entry.turnId   ,
    commands  : entry.commands ,
    files     : entry.files    ,
    truncated : entry.truncated
  },
};
```
양성 after:
```typescript
const record = {
  schemaVersion : 1 ,
  id                ,
  title             ,
  kind          : "maintenance" ,
  areas         : ["dev"]       ,
  owner         : "dev"         ,
  status        : "verifying"   ,
  blockedReason : "limit"       ,
  relations     : []            ,
  criteria      : [{
    id          : "AC"   ,
    description : "검사" ,
    required    : true   ,
    result      : "open" ,
    evidence    : []
  }],
  native        : {
    key       : entry.key      ,
    threadId  : entry.threadId ,
    turnId    : entry.turnId   ,
    commands  : entry.commands ,
    files     : entry.files    ,
    truncated : entry.truncated
  },
};
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D30. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-colon{i}>property-comma>property-value{i}>property-comma{i}`

정확 파일: `scripts/verify-reports.ts`

양성 before:
```typescript
const sample = {
  threadId  ,
  model    : read(model)   ,
  provider : read(value) ,
  box      : read(other)  ,
  events   : read(final)
};
```
양성 after:
```typescript
const sample = {
  threadId ,
  model    : read(model) ,
  provider : read(value) ,
  box      : read(other) ,
  events   : read(final)
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D31. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-comma>property-colon`

정확 파일: `src/native-reports.ts`

양성 before:
```typescript
const normalized = {
  threadId,
  turnId,
  prompt,
  truncated: input.truncated
};
```
양성 after:
```typescript
const normalized = {
  threadId ,
  turnId   ,
  prompt   ,
  truncated: input.truncated
};
```
반례 — 공식 source-check에서 별도 registration key로 검출됨. 양성 exact key 적용 범위 밖이다.
반례 before:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
반례 after:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
예시 근거: `fresh-six-scratch-fixtures`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D32. 현재 승인 관측 집합에 없는 key

`v1|typescript|ObjectLiteralExpression|object-properties|property-comma>property-colon{i}>property-value{i}>property-comma{i}`

정확 파일: `src/native-reports.ts`

양성 before:
```typescript
const item = {
  key,
  name: "a",
  path: "longer",
  enabled: true,
};
```
양성 after:
```typescript
const item = {
  key,
  name    : "a"      ,
  path    : "longer" ,
  enabled : true     ,
};
```
반례 — 별도 context/kind/axes의 예시는 다른 exact key로 검출된다. 이 key의 승인을 다른 key로 자동 확장하지 않는다. out-of-key는 제안 메타이며 공식 ExampleVerdict가 아니다.
반례 before:
```typescript
const item = {
  id    : read()  ,
  title : "a"    ,
  preview        ,
  cwd       : "x"    ,
  updatedAt : 0      ,
  status    : "idle" ,
};
```
반례 after:
```typescript
const item = {
  id    : read() ,
  title : "a"    ,
  preview        ,
  cwd       : "x"    ,
  updatedAt : 0      ,
  status    : "idle" ,
};
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D33. 기존 승인 key의 새 파일 범위

`v1|typescript|ObjectLiteralExpression|registration|colon>value>comma`

정확 파일: `scripts/verify-reports.ts`, `scripts/workflow/reports.ts`, `scripts/workflow/work.ts`, `src/native-reports.ts`, `test/work-json.test.ts`

양성 before:
```typescript
const record = {
  complete: true,
  generation: index + 1,
  scope: "thread",
};
```
양성 after:
```typescript
const record = {
  complete   : true      ,
  generation : index + 1 ,
  scope      : "thread"  ,
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D34. 기존 승인 key의 새 파일 범위

`v1|typescript|SourceFile|declaration-equals|equals>semicolon`

정확 파일: `scripts/workflow/preflight.ts`, `scripts/workflow/reports.ts`, `src/native-reports.ts`

양성 before:
```typescript
const begin = event(1);
const hookRun = { status: "failed" };
```
양성 after:
```typescript
const begin   = event(1)             ;
const hookRun = { status: "failed" } ;
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D35. 현재 승인 관측 집합에 없는 key

`v1|typescript|SourceFile|declaration-extended-equals|equals>semicolon`

정확 파일: `scripts/workflow/work.ts`

양성 before:
```typescript
let enabled = !probe || flag === true;
const abort = new AbortController();
const collector = new Collector();
```
양성 after:
```typescript
let enabled     = !probe || flag === true ;
const abort     = new AbortController()   ;
const collector = new Collector()         ;
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D36. 기존 승인 key의 새 파일 범위

`v1|typescript|SourceFile|type-alias|equals>semicolon`

정확 파일: `scripts/workflow/reports.ts`

양성 before:
```typescript
type Short = string;
type Longer = string | number;
type Mid = boolean;
```
양성 after:
```typescript
type Short  = string          ;
type Longer = string | number ;
type Mid    = boolean         ;
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D37. 현재 승인 관측 집합에 없는 key

`v1|typescript|SwitchStatement|case-clause|case-colon`

정확 파일: `src/native-reports.ts`

양성 before:
```typescript
function sample(value: string) {
  switch (value) {
    case "a": return "A";
    case "longer": return "B";
    case "c": return "C";
  }
}
```
양성 after:
```typescript
function sample(value: string) {
  switch (value) {
    case "a"     : return "A";
    case "longer": return "B";
    case "c"     : return "C";
  }
}
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## D38. 기존 승인 key의 새 파일 범위

`v1|typescript|TypeLiteral|type-members|colon>semicolon`

정확 파일: `scripts/workflow/reports.ts`

양성 before:
```typescript
type Data = {
  name: string;
  parent: string | null;
  description: string;
};
```
양성 after:
```typescript
type Data = {
  name        : string        ;
  parent      : string | null ;
  description : string        ;
};
```
반례 — 문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.
반례 before:
```typescript
const value = "keep  inner spaces";
```
반례 after:
```typescript
const value = "keep inner spaces";
```
예시 근거: `v2-proposal-not-user-approved`; 내용/출처 해시는 JSON에 보존. 자동 Align 고정점 미검증.

## 적용 전 조건

실제 사용자 답변의 범위를 고정한 뒤에만 공식 레지스트리 절차를 진행한다. 그 시점의 소스·규칙·proof·config SHA가 같아야 하며, 바뀐 파일은 재검사한다. 공식 dry-run/Align이 거부하거나 새 key가 나타나면 범위를 자동 확장하지 않고 새 관측과 정확한 차이를 제시한다. 기존 보고서·작업 원문은 덮지 않는다.
