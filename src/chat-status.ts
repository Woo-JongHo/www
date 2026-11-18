/**
 * @architecture arch.chat.workspace
 * @implements RESP-CHAT-WORKSPACE
 */
import type { InterruptState, TransportState, TurnState } from './shared';

export interface ChatStatusInput {
  sending: boolean;
  switching: boolean;
  working: boolean;
  turn: TurnState;
  turnId: string | null;
  transport: TransportState;
  interrupt: InterruptState;
  approvals: number;
}

export function chatStatus(input: ChatStatusInput) {
  if (input.switching) return { label: '대화 준비 중', tone: 'waiting', steer: false, reason: '대화를 준비하고 있습니다.' };
  if (input.approvals) return { label: '승인 대기', tone: 'waiting', steer: false, reason: '승인·거절을 처리한 뒤 추가 지시를 보낼 수 있습니다.' };
  if (input.interrupt === 'requested' || input.interrupt === 'accepted') return { label: '중단 확인 중', tone: 'waiting', steer: false, reason: '중단 결과를 확인하고 있습니다.' };
  if (input.working && input.transport !== 'connected') return { label: '연결 미확인', tone: 'waiting', steer: false, reason: '연결을 확인한 뒤 추가 지시를 보낼 수 있습니다.' };
  if (input.working && (!input.turnId || input.turn === 'starting')) return { label: '시작 대기', tone: 'waiting', steer: false, reason: '시작 확인 후 추가 지시 가능' };
  if (input.working) return { label: 'Working · 작업 중', tone: 'working', steer: true, reason: '현재 작업에 추가 지시' };
  if (input.sending) return { label: '전송 중', tone: 'waiting', steer: false, reason: '요청을 전달하고 있습니다.' };
  if (input.turn === 'failed') return { label: '실행 실패', tone: 'failed', steer: false, reason: '' };
  if (input.turn === 'unknown' || input.transport === 'closed' || input.transport === 'error') return { label: '연결 미확인 · 결과 확인 필요', tone: 'waiting', steer: false, reason: '' };
  if (input.turn === 'completed') return { label: '응답 종료 · 업무 완료와 별개', tone: 'idle', steer: false, reason: '' };
  if (input.turn === 'interrupted') return { label: '중단됨', tone: 'idle', steer: false, reason: '' };
  return { label: '요청 대기', tone: 'idle', steer: false, reason: '' };
}

/** 셸 해석 없이 식별 가능한 단일 검사 명령만 집계한다. */
export function isVerificationCommand(command: string): boolean {
  const value = command.trim();
  // 셸 조합·치환·인용 문자열은 실제 실행 위치를 확정할 수 없다.
  if (!value || /[;&|<>`$\\\n\r'"()]/.test(value)) return false;
  const words = value.split(/\s+/);
  if (words.some(word => ["--help", "-h", "--version", "-v", "--init", "--showConfig", "--listFilesOnly", "--dry-run", "--dry", "--if-present"].includes(word))) return false;
  const executable = words[0]?.split("/").at(-1);
  const action = words[1];
  if (executable === "tsc") return words.length === 1 || action?.startsWith("-") === true;
  if (executable === "bun") return action === "test";
  if (executable === "cargo") return action === "test" || action === "check";
  if (executable === "node") return action === "--test";
  if (executable === "npm") return /^(?:check(?::[\w-]+)?|test(?::[\w-]+)?|typecheck|build)$/.test(action === "run" ? words[2] ?? "" : action ?? "");
  return false;
}
