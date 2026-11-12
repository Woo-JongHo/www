import { expect, test } from "bun:test";
import { handlePromptKeyDown, normalizeCompositionEnd, shouldSubmitPrompt } from "../src/input";

test("일반 Enter만 요청 전송으로 처리한다", () => {
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: false, nativeEvent: {}})).toBe(true ) ;
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: true , nativeEvent: {}})).toBe(false) ;
  expect(shouldSubmitPrompt({ key: "a"    , shiftKey: false, nativeEvent: {}})).toBe(false) ;
});

test("조합 중 Enter와 조합 키 코드 229는 요청을 보내지 않는다", () => {
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: false, nativeEvent: { isComposing: true } })                     ).toBe(false) ;
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: false, nativeEvent: { isComposing: false, keyCode: 229 } })      ).toBe(false) ;
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: false, nativeEvent: {} }, true)                                  ).toBe(false) ;
  expect(shouldSubmitPrompt({ key: "Enter", shiftKey: false, nativeEvent: { isComposing: false, keyCode: 13 } }, false)).toBe(true ) ;
});


test("실제 Mac 한국어 입력에서 조합 확정 뒤 재도착한 이전 Enter는 전송하지 않는다", () => {
  // user-keyboard.json의 passiveTrace에서 관측한 순서와 timestamp다.
  const composingEnter = {
    key         : "Enter" ,
    shiftKey    : false   ,
    nativeEvent : {
      isComposing : true ,
      keyCode     : 229  ,
      timeStamp   : 136599.80000001192
    }
  };
  const end = 136608;
  const replayedEnter = {
    key         : "Enter" ,
    shiftKey    : false   ,
    nativeEvent : {
      isComposing : false ,
      keyCode     : 13    ,
      timeStamp   : 136599.80000001192
    }
  };
  expect(shouldSubmitPrompt(composingEnter, true)                                                                              ).toBe(false) ;
  expect(shouldSubmitPrompt(replayedEnter, false, end)                                                                         ).toBe(false) ;
  expect(shouldSubmitPrompt({ ...replayedEnter, nativeEvent: { ...replayedEnter.nativeEvent, timeStamp: end } }, false, end)   ).toBe(false) ;
  expect(shouldSubmitPrompt({ ...replayedEnter, nativeEvent: { ...replayedEnter.nativeEvent, timeStamp: 136800 } }, false, end)).toBe(true ) ;
});

test("마우스 또는 blur로 조합을 마친 뒤 새 Enter는 즉시 허용하고 Shift Enter는 줄바꿈으로 둔다", () => {
  const end = 400;
  const enter = {
    key         : "Enter" ,
    shiftKey    : false   ,
    nativeEvent : {
      isComposing : false ,
      keyCode     : 13    ,
      timeStamp   : 400.01
    }
  };
  expect(shouldSubmitPrompt(enter, false, end)).toBe(true);
  expect(shouldSubmitPrompt({ ...enter, shiftKey: true }, false, end)).toBe(false);
});

test("유효한 조합 종료 뒤 키 시간 정보가 없거나 유효하지 않으면 Enter 전송을 보수적으로 거부한다", () => {
  const enter = {
    key         : "Enter" ,
    shiftKey    : false   ,
    nativeEvent : {
      isComposing : false,
      keyCode     : 13
    }
  };
  expect(shouldSubmitPrompt(enter                                                              , false, 400 )).toBe(false) ;
  expect(shouldSubmitPrompt({ ...enter, nativeEvent: { ...enter.nativeEvent, timeStamp: NaN } }, false, 400 )).toBe(false) ;
  expect(shouldSubmitPrompt({ ...enter, nativeEvent: { ...enter.nativeEvent, timeStamp: 500 } }, false, NaN )).toBe(true ) ;
  expect(shouldSubmitPrompt(enter                                                              , false, null)).toBe(true ) ;
});


test("과거 Enter만 기본 줄바꿈을 소비하고 원래 조합 확정 Enter는 Native에 남긴다", () => {
  const actions: string[] = [];
  const event = {
    key            : "Enter" ,
    shiftKey       : false   ,
    nativeEvent    : {
      isComposing : true ,
      keyCode     : 229  ,
      timeStamp   : 136599.80000001192
    },
    preventDefault : () => { actions.push("prevent"); }
  };
  const submit = () => { actions.push("submit"); };
  handlePromptKeyDown(event, submit, true, null);
  expect(actions).toEqual([]);
  handlePromptKeyDown({ ...event, nativeEvent: { ...event.nativeEvent, isComposing: false, keyCode: 13 } }, submit, false, 136608);
  expect(actions).toEqual(["prevent"]);
  handlePromptKeyDown({ ...event, nativeEvent: { isComposing: false, keyCode: 13, timeStamp: 136800 } }, submit, false, 136608);
  expect(actions).toEqual(["prevent", "prevent", "submit"]);
});

test("Shift Enter의 줄바꿈과 조합 참조가 남은 Enter는 기본 동작을 막지 않는다", () => {
  const actions: string[] = [];
  const event = {
    key            : "Enter" ,
    shiftKey       : true    ,
    nativeEvent    : {
      isComposing : false ,
      keyCode     : 13    ,
      timeStamp   : 10
    },
    preventDefault : () => { actions.push("prevent"); }
  };
  const submit = () => { actions.push("submit"); };
  handlePromptKeyDown(event, submit, false, 20);
  handlePromptKeyDown({ ...event, shiftKey: false }, submit, true, 20);
  expect(actions).toEqual([]);
});


for (const invalid of [0, -1, NaN, Infinity, undefined]) {
  test(`유효하지 않은 조합 종료 시각 ${String(invalid)}은 정상 Enter를 영구 차단하지 않는다`, () => {
    let boundary            = normalizeCompositionEnd(invalid) ;
    const actions: string[] = []                               ;
    const event = {
      key            : "Enter" ,
      shiftKey       : false   ,
      nativeEvent    : {
        isComposing : false ,
        keyCode     : 13    ,
        timeStamp   : 500
      },
      preventDefault : () => { actions.push("prevent"); }
    };
    const submit = () => { actions.push("submit"); };
    expect(boundary).toBe(null);
    handlePromptKeyDown(event, submit, false, boundary);
    expect(actions).toEqual(["prevent", "submit"]);
    boundary = normalizeCompositionEnd(600);
    handlePromptKeyDown(event, submit, false, boundary);
    expect(actions).toEqual(["prevent", "submit", "prevent"]);
    handlePromptKeyDown({ ...event, nativeEvent: { ...event.nativeEvent, timeStamp: 700 } }, submit, false, boundary);
    expect(actions).toEqual(["prevent", "submit", "prevent", "prevent", "submit"]);
  });
}
