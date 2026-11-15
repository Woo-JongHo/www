# Phase13 추가 네 파일쌍 승인 검토안 v1

대상 파일은 `test/work-json.test.ts` 하나다. 기존 v1 승인 key의 새 파일 범위 3쌍과 신규 9-field object-rows key 1쌍만 포함한다. 아직 사용자 승인·등록·적용되지 않았다.

원래 v3의 76쌍은 모두 그대로 유지되며 그 고정 MD를 변경하지 않았다. 이 네 쌍은 원래 질문에 자동으로 추가되지 않는다.

현재 소스 SHA256: `e52e3855987994a9eeacc5d3427a9afeca6d0d6c5ee5a47e3f27730c0d8a312d`. 원래 v3 MD SHA256: `9ba598dac06cadab0e77c50f04b07350ebba8cc7e3fdbe84c77af458d9a0bac3`.

동일 파일의 동일 key는 깊이가 달라도 적용될 수 있다. 다른 key·파일·glob으로 자동 확장하지 않는다. 구문/토큰/AST/주석/줄/indent 보존과 공식 source check 전후 동일 key, before FIXABLE, after0, 반례 다른 key를 4종 모두 확인했다. 자동 Align/실제 pipeline 고정점은 아직 미검증이다.

## E01. 기존 승인 key의 새 파일 범위

`v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

정확 scope: `test/work-json.test.ts`

양성 before:
```typescript
const rows = [
  { id: "a", title: "first", role: "x", color: "red" },
  { id: "longer", title: "x", role: "mid", color: "blue" },
  { id: "b", title: "mid", role: "longer", color: "red" },
];
```
양성 after:
```typescript
const rows = [
  { id : "a"      , title : "first" , role : "x"      , color : "red"  },
  { id : "longer" , title : "x"     , role : "mid"    , color : "blue" },
  { id : "b"      , title : "mid"   , role : "longer" , color : "red"  },
];
```
반례 — 공식 검사에서 별도 registration key로 검출되며 위 규칙의 승인은 이 shape로 확장되지 않는다:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
전후 SHA: `c9934d32fdddd85dfe6c5cfcb16b815bd9f7d3a66ad77c110adec0363c6f5739` → `b6c34888e21d88dfc983ebb71ebabe3b6a496943d36dc4315045bd5b04c55440`.

## E02. 신규 9-field object-rows key

`v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

정확 scope: `test/work-json.test.ts`

양성 before:
```typescript
const rows = [
  { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1, g: 1, h: 1, i: 1 },
  { a: 22, b: 22, c: 22, d: 22, e: 22, f: 22, g: 22, h: 22, i: 22 },
  { a: 333, b: 333, c: 333, d: 333, e: 333, f: 333, g: 333, h: 333, i: 333 },
];
```
양성 after:
```typescript
const rows = [
  { a : 1   , b : 1   , c : 1   , d : 1   , e : 1   , f : 1   , g : 1   , h : 1   , i : 1   },
  { a : 22  , b : 22  , c : 22  , d : 22  , e : 22  , f : 22  , g : 22  , h : 22  , i : 22  },
  { a : 333 , b : 333 , c : 333 , d : 333 , e : 333 , f : 333 , g : 333 , h : 333 , i : 333 },
];
```
반례 — 공식 검사에서 별도 registration key로 검출되며 위 규칙의 승인은 이 shape로 확장되지 않는다:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
전후 SHA: `5fe412314ba9c30b5b530c74f93efd1fbaf0355860ada80818a1a8c68e85b718` → `fdfeeca4504b53c604d6cd669a3a2f392ae31f8cb41f997be3628e40c39db5a5`.

## E03. 기존 승인 key의 새 파일 범위

`v1|typescript|Block|declaration-equals|colon>equals>semicolon`

정확 scope: `test/work-json.test.ts`

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
반례 — 공식 검사에서 별도 registration key로 검출되며 위 규칙의 승인은 이 shape로 확장되지 않는다:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
전후 SHA: `d2171945b46a4b549d02e224ce1c6917fe2add75049c4a1ef0a7b5bea962da32` → `6b3e45cdccd9e47d20622f4f1de04270319cce2bebb63dc7ac60f2363f8e5ec2`.

## E04. 기존 승인 key의 새 파일 범위

`v1|typescript|SourceFile|declaration-equals|equals>semicolon`

정확 scope: `test/work-json.test.ts`

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
반례 — 공식 검사에서 별도 registration key로 검출되며 위 규칙의 승인은 이 shape로 확장되지 않는다:
```typescript
const other = {
  a: 1,
  longer: 22,
  mid: 333
};
```
전후 SHA: `7a94f77a10d59511d11545567d6ea825554f2e750ffe071ef0a1694045d153b5` → `0573455bd746b86e1eb321c3d52da1ce893b60d75058f9f232005508d00cd262`.

## 적용 조건

실제 사용자 답변에서 이 추가안의 identity와 정확 네 쌍을 확인한 뒤에만 등록·적용한다. 소스 SHA 또는 승인·설정이 바뀌면 다시 검사한다. source 검사에서 새 key가 나오면 자동 승인하지 않고 별도 차이를 제시한다. 현재 다른 저자의 소스와 기존 immutable 보고서는 수정하지 않는다.
