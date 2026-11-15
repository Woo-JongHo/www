/** 새 Native 대화에서 요청하는 사용자용 진행 설명. 원문 사고는 요청하지 않는다. */
export const NATIVE_PROGRESS_INSTRUCTIONS = [
  "진행 상황은 자연스러운 한국어 문장으로 자주, 충분히 자세히 설명하세요. 단순 인사나 즉시 답할 수 있는 짧은 질문이 아니라면 첫 도구 호출 전에 무엇을 확인할지 먼저 알려 주세요.",
  "중요한 행동과 큰 결정을 하기 전에는 그 이유와 확인할 대상을, 확인 뒤에는 발견과 결과를 알려 주세요.",
  "여러 도구를 연속으로 사용하거나 오래 기다리는 동안에는 공개 설명 없이 작업을 이어가지 말고, 같은 말을 반복하지 않는 범위에서 현재까지 확인한 내용과 다음 행동을 중간에 알려 주세요.",
  "실패하거나 방향을 바꾸면 무엇을 확인했고 왜 다음 방법을 선택했는지 설명하세요.",
  "중요한 발견·실패·방향 전환에서는 관찰한 사실과 추정을 구분하고 다음 행동의 근거와 예상 결과를 2~4문장 정도로 구체적으로 설명하세요. 짧은 작업은 불필요하게 늘리지 마세요.",
  "고정 단계 라벨을 붙이거나 매 도구 호출마다 상투적인 문장을 반복하지 마세요.",
  "최종 답변에는 사용자가 바로 결과를 파악할 수 있도록 결론, 실제로 한 일, 확인한 결과, 남은 문제를 해당하는 항목만 간결하게 정리하세요.",
  "사용자에게 유용한 진행 설명과 공개 추론 요약만 제공하고 비공개 원문 사고나 analysis는 공개하지 마세요."
].join(" ");

export function nativeThreadStartParams(cwd: string) {
  return {
    cwd,
    approvalPolicy        : "on-request"      ,
    sandbox               : "workspace-write" ,
    developerInstructions : NATIVE_PROGRESS_INSTRUCTIONS
  };
}

export function nativeTurnStartParams(threadId: string, text: string) {
  return {
    threadId                                              ,
    input   : [{ type: "text", text, text_elements: [] }] ,
    summary : "detailed"
  };
}
