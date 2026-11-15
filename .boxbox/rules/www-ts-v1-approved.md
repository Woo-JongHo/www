# WWW TypeScript 재사용 정렬 규칙 승인 제안 v1

이 문서는 **승인 전 고정 검토자료**다. 아래 28개 exact lookup key와 각 key에 열거한 정확한 파일 경로만 승인 대상으로 고정한다. 기존 JSON 승인은 포함하지 않는다. 새 key·새 파일 scope는 자동 추가하지 않는다.

28개 합성 양성 before/after는 같은 exact key 검출, before FIXABLE>0, after FIXABLE/REFUSE0, 문법·토큰·AST·물리 줄·들여쓰기 보존을 확인했다. **automatic Align/Format과 자동 pipeline fixed point는 아직 미검증**이다. 승인 후 공식 dry-run/apply의 parser·preservation·fixed point·atomic 검사를 모두 통과해야 실제 원본을 쓸 수 있다.

현행 key는 language/context/kind/normalized axes이며 depth나 전체 AST shape는 포함하지 않는다. **같은 파일의 같은 Block key는 다른 nesting depth에서도 같은 승인 영향범위다.** 다른 context/kind/axes와 배열 필드수는 별도 key이며 자동으로 포함하지 않는다. depth를 별도로 제한하려면 엔진 승인 identity가 먼저 바뀌어야 한다.

각 scope는 정확한 파일경로들의 개별 목록이다. 디렉터리 전체 glob 승인이 아니다. scripts/verify-architecture.ts의 실제9그룹 검사와 필요5개 key(scope포함)를 대조했다. 최종 제품 source는 아직 저작 중이므로 최종 source SHA 동결 증거가 아니다. 동결 뒤 이 key/scope 안인지 다시 확인하고 새 범위는 이 문서에 덧붙이지 않는다.

예시 version은 lookupKey/conventionSchema/exampleSchema/decisionSchema 모두1, source는 synthetic/UNLICENSED다. 이 문서는 승인 registry나 인간 승인기록이 아니다.

## 01. interface-members

정확 key: `v1|typescript|InterfaceDeclaration|interface-members|colon>semicolon`

context: `InterfaceDeclaration` · axes: `colon`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/workflow.ts`

before:
```typescript
interface Result {
  code: number;
  stdout: string;
  outputTruncated: boolean;
}
```

after:
```typescript
interface Result {
  code            : number  ;
  stdout          : string  ;
  outputTruncated : boolean ;
}
```

contentHash(before+NUL+after): `sha256:26ce2ccb90e422e4059f45a7cc4f2dcfbc5c6adf70976628e09b1fbaf460cbeb`

## 02. declaration-call-envelope

정확 key: `v1|typescript|Block|declaration-call-envelope|colon>equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`

context: `Block` · axes: `colon`, `equals`, `call-member-dot`, `call-envelope-open`, `call-envelope-close`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`

before:
```typescript
function sample() {
  const raw = read(root, "structure.json");
  const value: unknown = JSON.parse(raw);
  const contract = object(value);
}
```

after:
```typescript
function sample() {
  const raw             = read      (root, "structure.json") ;
  const value : unknown = JSON.parse(raw                   ) ;
  const contract        = object    (value                 ) ;
}
```

contentHash(before+NUL+after): `sha256:3c72e0d09963a94f0abf6b462ebe174d6c5992b576e8a1b1dea026679f9729db`

## 03. declaration-extended-equals

정확 key: `v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon`

context: `Block` · axes: `colon`, `equals`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/generate-architecture.ts`
- `src/architecture-tree.ts`

before:
```typescript
function sample() {
  const visited = new Set<string>();
  let current: Node | undefined = node;
}
```

after:
```typescript
function sample() {
  const visited                  = new Set<string>() ;
  let current : Node | undefined = node              ;
}
```

contentHash(before+NUL+after): `sha256:381e8142f35e1f5c38514de0c4bdd7c7870bbbc7f8486fa4a0c0266ac29e5ed6`

## 04. declaration-equals

정확 key: `v1|typescript|Block|declaration-equals|colon>equals>semicolon`

context: `Block` · axes: `colon`, `equals`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/generate-architecture.ts`
- `scripts/workflow.ts`
- `test/command-preview.test.ts`
- `test/native-activity.test.ts`

before:
```typescript
function sample() {
  const request: Event = { kind: "request" };
  const waiting = project(request);
}
```

after:
```typescript
function sample() {
  const request : Event = { kind: "request" } ;
  const waiting         = project(request)    ;
}
```

contentHash(before+NUL+after): `sha256:b883a0b8588c26d4385d50baa0fd76af772bb9d1a5983635f41cdcf6dcf64d3e`

## 05. declaration-call-envelope

정확 key: `v1|typescript|Block|declaration-call-envelope|equals>call-member-dot>call-envelope-open>call-envelope-close>semicolon`

context: `Block` · axes: `equals`, `call-member-dot`, `call-envelope-open`, `call-envelope-close`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/generate-architecture.ts`
- `scripts/workflow.ts`
- `src/architecture.ts`
- `test/architecture-tree.test.ts`
- `test/native-activity.test.ts`
- `scripts/verify-architecture.ts`

before:
```typescript
function sample() {
  const filler = Array.from([1, 2]);
  const result = project(filler);
}
```

after:
```typescript
function sample() {
  const filler = Array.from([1, 2]) ;
  const result = project   (filler) ;
}
```

contentHash(before+NUL+after): `sha256:f031ca7d17dee75f1b006462a5834cc2f2a72133f47f23aafcd78e2f0dcb3737`

## 06. declaration-equals

정확 key: `v1|typescript|Block|declaration-equals|equals>semicolon`

context: `Block` · axes: `equals`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/generate-architecture.ts`
- `scripts/workflow.ts`
- `src/architecture-tree.ts`
- `src/architecture.ts`
- `src/ecosystem-view.tsx`
- `test/activity-sidebar.test.ts`
- `test/architecture-contract.test.ts`
- `test/architecture-harness.test.ts`
- `test/architecture.test.ts`
- `test/conversations.test.ts`
- `test/native-activity.test.ts`
- `test/projection.test.ts`
- `test/www-activity-view.test.ts`
- `scripts/verify-architecture.ts`

before:
```typescript
function sample() {
  const id = randomUUID();
  let prompt = "";
}
```

after:
```typescript
function sample() {
  const id   = randomUUID() ;
  let prompt = ""           ;
}
```

contentHash(before+NUL+after): `sha256:2d848a0d06e51d4c2f05711435def01d7be6a33515b42056290dce1f67631a50`

## 07. declaration-equals

정확 key: `v1|typescript|Block|declaration-equals|equals>call-open-paren>call-close-paren>semicolon`

context: `Block` · axes: `equals`, `call-open-paren`, `call-close-paren`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `src/architecture-tree.ts`
- `test/architecture-harness.test.ts`

before:
```typescript
function sample() {
  const pre = record(record(value).before);
  const post = record(record(value).after);
}
```

after:
```typescript
function sample() {
  const pre  = record(record(value).before) ;
  const post = record(record(value).after ) ;
}
```

contentHash(before+NUL+after): `sha256:aafa479eefa77dc77354cbcdc348bef99ffccaa0113e41f830fffdc46ac0e01d`

## 08. declaration-extended-equals

정확 key: `v1|typescript|Block|declaration-extended-equals|equals>semicolon`

context: `Block` · axes: `equals`, `semicolon`

파일 scope:
- `scripts/architecture-contract.ts`
- `scripts/workflow.ts`
- `src/architecture-tree.ts`
- `src/ecosystem-view.tsx`
- `test/activity-sidebar.test.ts`
- `test/conversations.test.ts`
- `scripts/verify-architecture.ts`

before:
```typescript
function sample() {
  const boundary = new Boundary();
  const bootstrap = boundary.begin();
}
```

after:
```typescript
function sample() {
  const boundary  = new Boundary()   ;
  const bootstrap = boundary.begin() ;
}
```

contentHash(before+NUL+after): `sha256:b93f4007b3d5aca137c8b124efd479540bbaf119501517ab793b15fcf15ddbeb`

## 09. object-rows

정확 key: `v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

context: `ArrayLiteralExpression` · axes: `open-brace`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `close-brace`, `tail`

파일 scope:
- `scripts/generate-architecture.ts`
- `test/architecture-tree.test.ts`

before:
```typescript
const rows = [
  { id: "a", title: "first", role: "x", color: "red" },
  { id: "longer", title: "x", role: "mid", color: "blue" },
  { id: "b", title: "mid", role: "longer", color: "red" },
];
```

after:
```typescript
const rows = [
  { id : "a"      , title : "first" , role : "x"      , color : "red"  },
  { id : "longer" , title : "x"     , role : "mid"    , color : "blue" },
  { id : "b"      , title : "mid"   , role : "longer" , color : "red"  },
];
```

contentHash(before+NUL+after): `sha256:933b9272172fbd4c8408a4f4c4060db6e4d695a8770dd89e49156ac545a7d6ad`

## 10. if-headers-return

정확 key: `v1|typescript|Block|if-headers-return|if-close-paren>if-return`

context: `Block` · axes: `if-close-paren`, `if-return`

파일 scope:
- `scripts/generate-architecture.ts`
- `test/architecture-contract.test.ts`
- `test/conversations.test.ts`

before:
```typescript
function sample() {
  if (!value) return false;
  if (!value.name) return false;
  if (!value.parent) return false;
}
```

after:
```typescript
function sample() {
  if (!value       ) return false;
  if (!value.name  ) return false;
  if (!value.parent) return false;
}
```

contentHash(before+NUL+after): `sha256:61d19434608062f6776460aa8a948138d370b34f32dd5db11bab149d29eb226c`

## 11. declaration-equals

정확 key: `v1|typescript|SourceFile|declaration-equals|equals>semicolon`

context: `SourceFile` · axes: `equals`, `semicolon`

파일 scope:
- `scripts/workflow.ts`
- `test/conversations.test.ts`
- `test/www-activity-view.test.ts`

before:
```typescript
const begin = event(1);
const hookRun = { status: "failed" };
```

after:
```typescript
const begin   = event(1)             ;
const hookRun = { status: "failed" } ;
```

contentHash(before+NUL+after): `sha256:8f1df65ff4d8168d8c265e5c8ec904fc14ab547ac71ae7204f2851e8453fde42`

## 12. object-properties

정확 key: `v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-value{i}>property-comma{i}`

context: `ObjectLiteralExpression` · axes: `property-colon`, `property-colon{i}`, `property-value{i}`, `property-comma{i}`

파일 scope:
- `scripts/workflow.ts`

before:
```typescript
const result = {
  policy:
    "authoring only",
  source: prePolicy,
  typecheck: preTypes,
  boxbox: preBoxbox,
  architecture: preArchitecture
};
```

after:
```typescript
const result = {
  policy:
    "authoring only",
  source       : prePolicy ,
  typecheck    : preTypes  ,
  boxbox       : preBoxbox ,
  architecture : preArchitecture
};
```

contentHash(before+NUL+after): `sha256:68c47bf32a86e217dbdd685cd9af77de0fe353f26f0f2cf40aff7d9d1e6677f4`

## 13. registration

정확 key: `v1|typescript|ObjectLiteralExpression|registration|colon>value>comma`

context: `ObjectLiteralExpression` · axes: `colon`, `value`, `comma`

파일 scope:
- `scripts/workflow.ts`
- `test/activity-sidebar.test.ts`
- `test/projection.test.ts`

before:
```typescript
const record = {
  complete: true,
  generation: index + 1,
  scope: "thread",
};
```

after:
```typescript
const record = {
  complete   : true      ,
  generation : index + 1 ,
  scope      : "thread"  ,
};
```

contentHash(before+NUL+after): `sha256:7804e28256bb2b8e4198faf231cb6fbd0d49446ad72516c9064594fe5a09dc03`

## 14. type-members

정확 key: `v1|typescript|TypeLiteral|type-members|colon>semicolon`

context: `TypeLiteral` · axes: `colon`, `semicolon`

파일 scope:
- `src/architecture-tree.ts`

before:
```typescript
type Data = {
  name: string;
  parent: string | null;
  description: string;
};
```

after:
```typescript
type Data = {
  name        : string        ;
  parent      : string | null ;
  description : string        ;
};
```

contentHash(before+NUL+after): `sha256:4a771025cb042e38b730df5e4742f579594bf392a50baec1726f7c55a50420da`

## 15. object-properties

정확 key: `v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-comma`

context: `ObjectLiteralExpression` · axes: `property-colon`, `property-comma`

파일 scope:
- `src/architecture-tree.ts`
- `test/architecture-harness.test.ts`
- `test/architecture-tree.test.ts`

before:
```typescript
const value = {
  a: { x: 1 },
  longer: { x: 2 },
  keep,
};
```

after:
```typescript
const value = {
  a      : { x: 1 } ,
  longer : { x: 2 } ,
  keep              ,
};
```

contentHash(before+NUL+after): `sha256:25e1de9020b2241d88b9ca78d8dd6d7bb271a333bbbcbc4d12a944f1ac154c42`

## 16. declaration-equals

정확 key: `v1|typescript|Block|declaration-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>semicolon`

context: `Block` · axes: `equals`, `call-open-paren`, `call-comma{i}`, `call-arg{i}`, `call-close-paren`, `semicolon`

파일 scope:
- `src/architecture-tree.ts`

before:
```typescript
function sample() {
  const outgoing = contains(id, from);
  const incoming = contains(id, to);
}
```

after:
```typescript
function sample() {
  const outgoing = contains(id, from) ;
  const incoming = contains(id, to  ) ;
}
```

contentHash(before+NUL+after): `sha256:9104a28b131d722051be7b838cbb2c0ecce72a7047fce9d9fd4c4fe436ede701`

## 17. type-alias

정확 key: `v1|typescript|SourceFile|type-alias|equals>semicolon`

context: `SourceFile` · axes: `equals`, `semicolon`

파일 scope:
- `src/architecture.ts`

before:
```typescript
type Short = string;
type Longer = string | number;
type Mid = boolean;
```

after:
```typescript
type Short  = string          ;
type Longer = string | number ;
type Mid    = boolean         ;
```

contentHash(before+NUL+after): `sha256:fad8f82ecfe7bbfbcb428e89552d1ee36adfd0c00c49309fdd891e0f913d550d`

## 18. declaration-values

정확 key: `v1|typescript|SourceFile|declaration-values|equals>semicolon`

context: `SourceFile` · axes: `equals`, `semicolon`

파일 scope:
- `src/ecosystem-view.tsx`

before:
```typescript
const one = "a";
const longer = 22;
```

after:
```typescript
const one    = "a" ;
const longer = 22  ;
```

contentHash(before+NUL+after): `sha256:490a1d62502539141105035023829911873c97dfc0658d7f8a44aa04cce832df`

## 19. call-statements

정확 key: `v1|typescript|Block|call-statements|subject-close-paren>matcher-dot>matcher-open-paren>matcher-close-paren>semicolon`

context: `Block` · axes: `subject-close-paren`, `matcher-dot`, `matcher-open-paren`, `matcher-close-paren`, `semicolon`

파일 scope:
- `test/activity-sidebar.test.ts`
- `test/architecture-contract.test.ts`
- `test/architecture-harness.test.ts`
- `test/architecture-tree.test.ts`
- `test/architecture.test.ts`
- `test/chat-state.test.ts`
- `test/command-preview.test.ts`
- `test/conversations.test.ts`
- `test/native-activity.test.ts`
- `test/projection.test.ts`
- `test/www-activity-view.test.ts`
- `test/www-activity.test.ts`

before:
```typescript
function sample() {
  expect(a).toBe(true);
  expect(longer).toBe(false);
  expect(mid).toBe(true);
}
```

after:
```typescript
function sample() {
  expect(a     ).toBe(true ) ;
  expect(longer).toBe(false) ;
  expect(mid   ).toBe(true ) ;
}
```

contentHash(before+NUL+after): `sha256:83568232dc9af3113e9c449a36bc7b2d263718f8487a1b1b13c4a9cf5cb43d42`

## 20. declaration-call-envelope

정확 key: `v1|typescript|Block|declaration-call-envelope|equals>call-envelope-open>call-envelope-close>semicolon`

context: `Block` · axes: `equals`, `call-envelope-open`, `call-envelope-close`, `semicolon`

파일 scope:
- `test/activity-sidebar.test.ts`
- `test/native-activity.test.ts`
- `test/projection.test.ts`
- `test/www-activity-view.test.ts`

before:
```typescript
function sample() {
  const first = read(1, "a");
  const result = parse(value);
}
```

after:
```typescript
function sample() {
  const first  = read (1, "a") ;
  const result = parse(value ) ;
}
```

contentHash(before+NUL+after): `sha256:46d99608f18c86d21f4a37eebbd1aab82665a027b5fb106c116f4dd1e55dccaa`

## 21. object-properties

정확 key: `v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-value{i}>property-comma>property-comma{i}`

context: `ObjectLiteralExpression` · axes: `property-colon`, `property-colon{i}`, `property-value{i}`, `property-comma`, `property-comma{i}`

파일 scope:
- `test/architecture-tree.test.ts`

before:
```typescript
const value = {
  rootId: "root",
  nodes: [
    item
  ],
  requirements: [],
  declarations: [],
  tests: []
};
```

after:
```typescript
const value = {
  rootId : "root" ,
  nodes  : [
    item
  ],
  requirements : [] ,
  declarations : [] ,
  tests        : []
};
```

contentHash(before+NUL+after): `sha256:04e8fe7b4fa6fdd760e068288ac3f0175c194c1e3f1d48a0c5beae413a461358`

## 22. object-rows

정확 key: `v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

context: `ArrayLiteralExpression` · axes: `open-brace`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `close-brace`, `tail`

파일 scope:
- `test/architecture-tree.test.ts`

before:
```typescript
const rows = [
  { id: "a", from: "one", to: "b", mode: "type", line: 5, endLine: 5, statement: "import type" },
  { id: "longer", from: "b", to: "two", mode: "runtime", line: 10, endLine: 10, statement: "import" },
  { id: "b", from: "two", to: "a", mode: "mixed", line: 7, endLine: 7, statement: "export" },
];
```

after:
```typescript
const rows = [
  { id : "a"      , from : "one" , to : "b"   , mode : "type"    , line : 5  , endLine : 5  , statement : "import type" },
  { id : "longer" , from : "b"   , to : "two" , mode : "runtime" , line : 10 , endLine : 10 , statement : "import"      },
  { id : "b"      , from : "two" , to : "a"   , mode : "mixed"   , line : 7  , endLine : 7  , statement : "export"      },
];
```

contentHash(before+NUL+after): `sha256:a26bd4427ecd3c8851682f0cf054f5fb69456c0839db1d38b30dd36fd54f0215`

## 23. call-statements

정확 key: `v1|typescript|Block|call-statements|call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>subject-close-paren>matcher-dot>matcher-open-paren>matcher-close-paren>semicolon`

context: `Block` · axes: `call-open-paren`, `call-comma{i}`, `call-arg{i}`, `call-close-paren`, `subject-close-paren`, `matcher-dot`, `matcher-open-paren`, `matcher-close-paren`, `semicolon`

파일 scope:
- `test/chat-state.test.ts`

before:
```typescript
function sample() {
  expect(draft("a", "first")).toBe("a");
  expect(draft("longer", "x")).toBe("longer");
  expect(draft("b", "mid")).toBe("b");
}
```

after:
```typescript
function sample() {
  expect(draft("a"     , "first")).toBe("a"     ) ;
  expect(draft("longer", "x"    )).toBe("longer") ;
  expect(draft("b"     , "mid"  )).toBe("b"     ) ;
}
```

contentHash(before+NUL+after): `sha256:0b346b38b66239c376406dbc484f64ee7bac0d8da5965fe13d4d2c3f94ea74d3`

## 24. object-rows

정확 key: `v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

context: `ArrayLiteralExpression` · axes: `open-brace`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `close-brace`, `tail`

파일 scope:
- `test/conversations.test.ts`

before:
```typescript
const rows = [
  { id: "a", kind: "first", value: 1, text: "x", code: 0, active: false },
  { id: "longer", kind: "x", value: 22, text: "mid", code: 10, active: true },
  { id: "b", kind: "mid", value: 333, text: "longer", code: 2, active: true },
];
```

after:
```typescript
const rows = [
  { id : "a"      , kind : "first" , value : 1   , text : "x"      , code : 0  , active : false },
  { id : "longer" , kind : "x"     , value : 22  , text : "mid"    , code : 10 , active : true  },
  { id : "b"      , kind : "mid"   , value : 333 , text : "longer" , code : 2  , active : true  },
];
```

contentHash(before+NUL+after): `sha256:81020cb71afeb6fae459b71202550ebc5ab69be3a3a7c567108798159e3d1c02`

## 25. object-rows

정확 key: `v1|typescript|ArrayLiteralExpression|object-rows|open-brace>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>comma{i}>property{i}>colon{i}>value{i}>close-brace>tail`

context: `ArrayLiteralExpression` · axes: `open-brace`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `comma{i}`, `property{i}`, `colon{i}`, `value{i}`, `close-brace`, `tail`

파일 scope:
- `test/projection.test.ts`

before:
```typescript
const rows = [
  { id: "a", text: "first", active: false },
  { id: "longer", text: "x", active: true },
  { id: "b", text: "mid", active: true },
];
```

after:
```typescript
const rows = [
  { id : "a"      , text : "first" , active : false },
  { id : "longer" , text : "x"     , active : true  },
  { id : "b"      , text : "mid"   , active : true  },
];
```

contentHash(before+NUL+after): `sha256:390aa4259dccb57623e8ecc4a00d833f738ec09dbc4e1d998a39fa22c8079016`

## 26. object-properties

정확 key: `v1|typescript|ObjectLiteralExpression|object-properties|property-colon>property-colon{i}>property-comma{i}>property-value>property-comma`

context: `ObjectLiteralExpression` · axes: `property-colon`, `property-colon{i}`, `property-comma{i}`, `property-value`, `property-comma`

파일 scope:
- `scripts/workflow.ts`

before:
```typescript
const result = {
  ok           : errors.length === 0                               ,
  errors       : [...new Set(errors)]                             ,
  executor     : dependencies.runHost ? "injected" : "process"    ,
  toolExecutor : dependencies.runCommand ? "injected" : "process" ,
  sourceStable,
  pre  : {
    source       : prePolicy       ,
    typecheck    : preTypes        ,
    architecture : preArchitecture ,
    boxbox       : preBoxbox.observations
  },
  post : {
    source       : finalPolicy      ,
    typecheck    : postTypes        ,
    architecture : postArchitecture ,
    boxbox       : postBoxbox.observations
  }
};
```

after:
```typescript
const result = {
  ok           : errors.length === 0                              ,
  errors       : [...new Set(errors)]                             ,
  executor     : dependencies.runHost ? "injected" : "process"    ,
  toolExecutor : dependencies.runCommand ? "injected" : "process" ,
  sourceStable,
  pre  : {
    source       : prePolicy       ,
    typecheck    : preTypes        ,
    architecture : preArchitecture ,
    boxbox       : preBoxbox.observations
  },
  post : {
    source       : finalPolicy      ,
    typecheck    : postTypes        ,
    architecture : postArchitecture ,
    boxbox       : postBoxbox.observations
  }
};
```

contentHash(before+NUL+after): `sha256:84e77f5f62e9929a9b5901ef818ad3d2c807f1f44f30ea4b74dfdf161c032d2f`

## 27. declaration-extended-equals

정확 key: `v1|typescript|SourceFile|declaration-extended-equals|colon>equals>semicolon`

context: `SourceFile` · axes: `colon`, `equals`, `semicolon`

파일 scope:
- `scripts/verify-architecture.ts`

before:
```typescript
const visited = new Set<string>();
let current: Node | undefined = node;
```

after:
```typescript
const visited                  = new Set<string>() ;
let current : Node | undefined = node              ;
```

contentHash(before+NUL+after): `sha256:592119015c504ccfa19d5df0cf8a29048e3c51770298ae187e37b4c7144b1074`

## 28. declaration-values

정확 key: `v1|typescript|Block|declaration-values|equals>semicolon`

context: `Block` · axes: `equals`, `semicolon`

파일 scope:
- `scripts/verify-architecture.ts`

before:
```typescript
function sample() {
  const a = 1;
  let longer = 22;
}
```

after:
```typescript
function sample() {
  const a    = 1  ;
  let longer = 22 ;
}
```

contentHash(before+NUL+after): `sha256:63d0285acb9d3f6abafab2e869644058fa3929f2dbb802decbc020e9de110015`

## 공통 반례 3개

```json
{
  "id": "counter-single",
  "status": "candidate",
  "verdict": "bad",
  "reason": "단일 속성의 과도한 수평 공백은 비교 대상 열 없이 폭만 늘려 이 규칙의 양성 예시가 아니다.",
  "before": "const value = { only: 1 };\n",
  "after": "const value = { only        : 1 };\n",
  "contentHash": "sha256:8850e67552e47b6de1314542f79d21a9a69e63959a798931cd9c31560dc35932",
  "verification": {
    "name": "counter-single",
    "beforeSyntaxValid": true,
    "afterSyntaxValid": true,
    "tokenPreserved": true,
    "astPreserved": true,
    "linesPreserved": true,
    "indentationPreserved": true,
    "contentHash": "sha256:8850e67552e47b6de1314542f79d21a9a69e63959a798931cd9c31560dc35932"
  },
  "beforeFacts": [],
  "afterFacts": [],
  "beforeSummary": {
    "groups": 0,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  },
  "afterSummary": {
    "groups": 0,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  }
}
```

```json
{
  "id": "counter-literal",
  "status": "candidate",
  "verdict": "bad",
  "reason": "문자열 내부 공백을 바꾸면 token/AST가 달라져 보존검사에서 거부해야 한다.",
  "before": "const value = \"keep  inner spaces\";\n",
  "after": "const value = \"keep inner spaces\";\n",
  "contentHash": "sha256:12e3afb51d9487b77bfbd825dc889ec148105f7a534f0b6d988454f107db45f9",
  "verification": {
    "name": "counter-literal",
    "beforeSyntaxValid": true,
    "afterSyntaxValid": true,
    "tokenPreserved": false,
    "astPreserved": false,
    "linesPreserved": true,
    "indentationPreserved": true,
    "contentHash": "sha256:12e3afb51d9487b77bfbd825dc889ec148105f7a534f0b6d988454f107db45f9"
  },
  "beforeFacts": [],
  "afterFacts": [],
  "beforeSummary": {
    "groups": 0,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  },
  "afterSummary": {
    "groups": 0,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  }
}
```

```json
{
  "id": "counter-context",
  "status": "candidate",
  "verdict": "out-of-key",
  "reason": "Block 양성 예시와 동일한 axes라도 SourceFile context의 key는 별개다. 이 반례의 다른 key를 이번 규칙 승인으로 자동 승인하지 않는다.",
  "before": "const outgoing = contains(id, from);\nconst incoming = contains(id, to);\n",
  "after": "const outgoing = contains(id, from) ;\nconst incoming = contains(id, to  ) ;\n",
  "contentHash": "sha256:21ce4783d1f357f8cc145ae4df5f1d49869a7f3175323765f6ed1e02f66b720d",
  "verification": {
    "name": "counter-context",
    "beforeSyntaxValid": true,
    "afterSyntaxValid": true,
    "tokenPreserved": true,
    "astPreserved": true,
    "linesPreserved": true,
    "indentationPreserved": true,
    "contentHash": "sha256:21ce4783d1f357f8cc145ae4df5f1d49869a7f3175323765f6ed1e02f66b720d"
  },
  "beforeFacts": [
    {
      "key": "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>semicolon",
      "status": "unknown",
      "proofComplete": false,
      "reasons": [
        "no matching convention"
      ]
    }
  ],
  "afterFacts": [
    {
      "key": "v1|typescript|SourceFile|declaration-equals|equals>call-open-paren>call-comma{i}>call-arg{i}>call-close-paren>semicolon",
      "status": "unknown",
      "proofComplete": false,
      "reasons": [
        "no matching convention"
      ]
    }
  ],
  "beforeSummary": {
    "groups": 1,
    "misaligned": 1,
    "edits": 3,
    "refused": 0,
    "suggested": 0
  },
  "afterSummary": {
    "groups": 1,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  }
}
```

```json
{
  "id": "counter-27-context",
  "status": "candidate",
  "verdict": "out-of-key",
  "reason": "양성 예시와 동일한 axes/kind여도 Block/SourceFile context가 다르면 별도 key이다. 다른 key의 범위를 새 승인으로 자동 확장하지 않는다.",
  "before": "function sample() {\n  const visited = new Set<string>();\n  let current: Node | undefined = node;\n}\n",
  "after": "function sample() {\n  const visited                  = new Set<string>() ;\n  let current : Node | undefined = node              ;\n}\n",
  "contentHash": "sha256:381e8142f35e1f5c38514de0c4bdd7c7870bbbc7f8486fa4a0c0266ac29e5ed6",
  "verification": {
    "name": "counter-27-context",
    "beforeSyntaxValid": true,
    "afterSyntaxValid": true,
    "tokenPreserved": true,
    "astPreserved": true,
    "linesPreserved": true,
    "indentationPreserved": true,
    "contentHash": "sha256:381e8142f35e1f5c38514de0c4bdd7c7870bbbc7f8486fa4a0c0266ac29e5ed6"
  },
  "beforeFacts": [
    {
      "key": "v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon",
      "status": "unknown",
      "proofComplete": false,
      "reasons": [
        "no matching convention"
      ]
    }
  ],
  "afterFacts": [
    {
      "key": "v1|typescript|Block|declaration-extended-equals|colon>equals>semicolon",
      "status": "unknown",
      "proofComplete": false,
      "reasons": [
        "no matching convention"
      ]
    }
  ],
  "beforeSummary": {
    "groups": 1,
    "misaligned": 1,
    "edits": 3,
    "refused": 0,
    "suggested": 0
  },
  "afterSummary": {
    "groups": 1,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  }
}
```

```json
{
  "id": "counter-28-context",
  "status": "candidate",
  "verdict": "out-of-key",
  "reason": "양성 예시와 동일한 axes/kind여도 Block/SourceFile context가 다르면 별도 key이다. 다른 key의 범위를 새 승인으로 자동 확장하지 않는다.",
  "before": "const one = \"a\";\nconst longer = 22;\n",
  "after": "const one    = \"a\" ;\nconst longer = 22  ;\n",
  "contentHash": "sha256:490a1d62502539141105035023829911873c97dfc0658d7f8a44aa04cce832df",
  "verification": {
    "name": "counter-28-context",
    "beforeSyntaxValid": true,
    "afterSyntaxValid": true,
    "tokenPreserved": true,
    "astPreserved": true,
    "linesPreserved": true,
    "indentationPreserved": true,
    "contentHash": "sha256:490a1d62502539141105035023829911873c97dfc0658d7f8a44aa04cce832df"
  },
  "beforeFacts": [
    {
      "key": "v1|typescript|SourceFile|declaration-values|equals>semicolon",
      "status": "approved",
      "conventionId": "ts-sourcefile-value-declarations",
      "layer": "preset",
      "proofComplete": true,
      "reasons": []
    }
  ],
  "afterFacts": [
    {
      "key": "v1|typescript|SourceFile|declaration-values|equals>semicolon",
      "status": "approved",
      "conventionId": "ts-sourcefile-value-declarations",
      "layer": "preset",
      "proofComplete": true,
      "reasons": []
    }
  ],
  "beforeSummary": {
    "groups": 1,
    "misaligned": 1,
    "edits": 3,
    "refused": 0,
    "suggested": 0
  },
  "afterSummary": {
    "groups": 1,
    "misaligned": 0,
    "edits": 0,
    "refused": 0,
    "suggested": 0
  }
}
```

## 검증과 알려진 경계

원문: `ts-rule-examples/approval-proposal.v2.bundle.json`, `verification-summary.v2.md`, `check-final.json`, `check-17-before-final.json`, `preservation.json`, `check-v2-additions.json`, `preservation-v2-additions.json`.

17번 복합 속성의 더 넓게 미정렬된 입력에서는 축순서가 바뀌는 관찰이 있다. 채택 예시는 같은 key로 검출되는 부분정렬 before를 사용했다. 그 다른 key·더 넓은 shape를 이 승인으로 포함하지 않는다. 자동 align fixed point는 승인 이후 공식 pipeline에서 별도로 확인한다.

관찰 원문:
```json
"17-key-order-observation.before.txt의 더 넓은 미정렬 형태는 축 집합은 같지만 축 순서가 달라 별도 key로 검출된다. 이 다른 key는 이번 26종 승인에 포함하지 않는다. 양성17은 before/after 정확 key가 같은 부분 미정렬 사례로 한정했다."
```
