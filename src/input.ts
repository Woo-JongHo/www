interface PromptKeyEvent {
  key      : string  ;
  shiftKey : boolean ;
  nativeEvent: {
    isComposing? : boolean ;
    keyCode?     : number  ;
    timeStamp?   : number
  };
}

export function normalizeCompositionEnd(timestamp: number | null | undefined): number | null {
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
}

export function shouldSubmitPrompt(event: PromptKeyEvent, composing = false, lastCompositionEnd: number | null = null): boolean {
  if (event.key !== "Enter" || event.shiftKey || composing
    || event.nativeEvent.isComposing === true || event.nativeEvent.keyCode === 229) return false;
  const boundary = normalizeCompositionEnd(lastCompositionEnd);
  if (boundary === null) return true;
  const timestamp = event.nativeEvent.timeStamp;
  return typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > boundary;
}


export function handlePromptKeyDown(event: PromptKeyEvent & { preventDefault(): void }, submit: () => void, composing = false, lastCompositionEnd: number | null = null): void {
  const timestamp = event.nativeEvent.timeStamp                 ;
  const boundary  = normalizeCompositionEnd(lastCompositionEnd) ;
  const replayedEnter = event.key === "Enter" && !event.shiftKey && !composing
    && event.nativeEvent.isComposing !== true && event.nativeEvent.keyCode !== 229
    && boundary !== null
    && typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp <= boundary;
  if (replayedEnter) {
    event.preventDefault();
    return;
  }
  if (shouldSubmitPrompt(event, composing, lastCompositionEnd)) {
    event.preventDefault();
    submit();
  }
}
