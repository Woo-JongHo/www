/**
 * @architecture arch.chat.sessions.requests
 * @implements RESP-CHAT-SESSIONS-REQUESTS
 */
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

/** 새 대화와 저장 대화 재개에 같은 Bypass 정책을 적용한다. */
export const NATIVE_PERMISSIONS = { approvalPolicy: "never", sandbox: "danger-full-access" };

export const WWW_STAGE_TOOL = {
  type: "function",
  name: "www_development_stage",
  description: "현재 WWW 개발 역할의 공개 단계 선택·진행·결과 선언을 읽기 전용으로 관측합니다. 하네스 실행·업무 수용·원장 쓰기를 수행하지 않습니다.",
  inputSchema: {
    type: "object",
    properties: {
      workId: { type: "string", description: "현재 저장소 docs/work에 실재하는 작업 UUID" },
      phase: { type: "string", enum: ["spec", "design", "build", "diagnose", "verify"] },
      status: { type: "string", enum: ["selected", "running", "completed", "failed", "interrupted"] },
      attemptId: { type: "string", description: "현재 단계 시도의 안정 식별자. 재시도는 새 식별자." },
    },
    required: ["workId", "phase", "status", "attemptId"],
    additionalProperties: false,
  },
};

const WWW_STAGE_INSTRUCTIONS = "www_development_stage 도구가 실제 제공된 경우에만, WWW 개발 역할로 현재 작업 UUID를 확인하고 정본 역할·스킬에 따라 단계를 선택·시작·종료할 때 이 도구로 공개 phase/status/workId/attemptId를 선언하세요. 도구가 없으면 호출을 만들어 내지 마세요. 같은 시도는 attemptId를 유지하고 재시도는 새 식별자를 사용하세요. 문서 읽기만으로 단계 적용을 선언하지 마세요. completed는 해당 절차의 저자 선언이며 하네스 실행이나 업무 수용·게시 완료를 뜻하지 않습니다. 비공개 reasoning이나 다른 내부 필드를 전달하지 마세요.";

export function nativeThreadStartParams(cwd: string, developmentStage = false) {
  return {
    cwd,
    ...NATIVE_PERMISSIONS,
    developerInstructions : NATIVE_PROGRESS_INSTRUCTIONS + (developmentStage ? ` ${WWW_STAGE_INSTRUCTIONS}` : ""),
    ...(developmentStage ? { dynamicTools: [WWW_STAGE_TOOL] } : {}),
  };
}

export function nativeTurnStartParams(threadId: string, text: string, model?: string) {
  return {
    threadId                                              ,
    input   : [{ type: "text", text, text_elements: [] }] ,
    summary : "detailed",
    ...(model === undefined ? {} : { model })
  };
}

export function nativeTurnSteerParams(threadId: string, expectedTurnId: string, text: string, clientUserMessageId: string) {
  return { threadId, expectedTurnId, clientUserMessageId, input: [{ type: "text", text, text_elements: [] }] };
}
