# WWW BoxBox 인터페이스 필드 파일럿 승인

## 인터페이스 필드 정렬 승인

- 대상 파일 `src/shared.ts`
- 규칙 키 `v1|typescript|InterfaceDeclaration|interface-members|colon>semicolon`
- 승인 근거는 이 대화에서 위 파일의 인터페이스 필드 정렬 제안에 사용자가 답한 “응 승인이야 이거”다.
- BoxBox 진단과 파일럿은 [이슈 #68](https://github.com/Woo-JongHo/boxbox/issues/68)에 연결한다. 승인 요청 표시와 적용 연결은 [이슈 #69](https://github.com/Woo-JongHo/boxbox/issues/69)에서 추적한다.
- 인터페이스 필드의 `:`와 `;`를 맞추는 가로 공백 변경만 승인한다. 문자열 내부 공백은 그대로 보존한다.

### 양성 예시

정렬 전

```ts
export interface NativeTimingEvent {
  traceId: string;
  threadId: string | null;
  phase: NativeTimingPhase;
  status: NativeTimingStatus;
  elapsedMs: number;
  source: "www" | "native";
}
```

정렬 후

```ts
export interface NativeTimingEvent {
  traceId   : string             ;
  threadId  : string | null      ;
  phase     : NativeTimingPhase  ;
  status    : NativeTimingStatus ;
  elapsedMs : number             ;
  source    : "www" | "native"   ;
}
```

### 반례

문자열의 두 공백을 한 공백으로 바꾸는 편집은 허용하지 않는다.

```ts
const value = "keep  inner spaces";
const value = "keep inner spaces";
```
