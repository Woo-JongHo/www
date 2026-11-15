// 명시 실행 전용: 실제 Native의 답변 작성과 재개 지침 수용을 검증한다.
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JsonRpcClient } from '../src/rpc.ts';
import { resolveNativeCodex } from '../src/native-command.ts';
import { nativeThreadStartParams, nativeThreadResumeParams, nativeTurnStartParams } from '../src/native-chat.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await fs.mkdir(path.join(root, '.www/evidence'), { recursive: true });
const directory = await fs.mkdtemp(path.join(root, '.www/evidence/final-answer-live-'));
const workspace = path.join(directory, 'workspace');
await fs.mkdir(workspace);
const guard = '이 대화는 제공된 사실의 최종 답변 표현 검사다. 도구·명령·파일·네트워크를 사용하지 말고 제공된 사실만 답하라.';
const answers = new Map<string, string>();
const ended = new Map<string, string>();
const responses: { scenario: string; text: string; turnStatus: string }[] = [];
let child: ChildProcessWithoutNullStreams | undefined;
let rpc: JsonRpcClient | undefined;
let failure: Error | undefined;
let configuredModel: unknown = null;
let toolAttempts = 0;

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function start() {
  const process = spawn(resolveNativeCodex(), ['app-server'], { cwd: workspace, stdio: ['pipe', 'pipe', 'pipe'] });
  const client = new JsonRpcClient(process);
  process.stderr.on('data', () => {});
  child = process;
  rpc = client;
  failure = undefined;
  client.on('message', message => {
    const params = object(message.params);
    const item = object(params.item);
    const turn = object(params.turn);
    const id = String(params.turnId ?? turn.id ?? '');
    if (message.id != null || (message.method === 'item/started' && ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'webSearch'].includes(String(item.type)))) {
      toolAttempts++;
      failure = Error('검증에서 허용하지 않은 도구 또는 승인 요청');
      process.kill('SIGTERM');
    }
    if (message.method === 'item/completed' && item.type === 'agentMessage' && item.phase !== 'analysis' && typeof item.text === 'string') answers.set(id, item.text);
    if (message.method === 'turn/completed') ended.set(id, String(turn.status));
  });
  client.on('protocolError', () => { failure = Error('Native 프로토콜 오류'); });
  return client;
}
async function stop() {
  const process = child;
  if (!process || process.exitCode !== null) return;
  process.stdin.end();
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => { process.kill('SIGTERM'); resolve(); }, 3000);
    process.once('close', () => { clearTimeout(timer); resolve(); });
  });
}
async function initialize(client: JsonRpcClient) {
  await client.request('initialize', { clientInfo: { name: 'www-final-answer-verification', version: '0.1.0' } });
  client.notify('initialized', {});
}
async function ask(threadId: string, scenario: string, text: string) {
  if (!rpc) throw Error('Native 미연결');
  const response = object(await rpc.request('turn/start', nativeTurnStartParams(threadId, text)));
  const id = String(object(response.turn).id ?? '');
  if (!id) throw Error('턴 식별자 미제공');
  const deadline = Date.now() + 90_000;
  while (!ended.has(id)) {
    if (failure) throw failure;
    if (child?.exitCode !== null || Date.now() > deadline) throw Error('Native 응답 종료 또는 제한 시간 초과');
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  const answer = answers.get(id) ?? '';
  responses.push({ scenario, text: answer, turnStatus: ended.get(id) ?? '' });
  await fs.writeFile(path.join(directory, 'responses.json'), JSON.stringify(responses, null, 2));
  if (!answer.trim() || ended.get(id) !== 'completed') throw Error('정상 최종 답변 미제공');
  return answer;
}
const timeout = setTimeout(() => { failure = Error('전체 검증 제한 시간'); child?.kill('SIGTERM'); }, 240_000);
try {
  const first = start();
  await initialize(first);
  const started = object(await first.request('thread/start', { ...nativeThreadStartParams(workspace), approvalPolicy: 'never', sandbox: 'read-only', developerInstructions: nativeThreadStartParams(workspace).developerInstructions + ' ' + guard }));
  configuredModel = started.model ?? null;
  const threadId = String(object(started.thread).id ?? '');
  if (!threadId) throw Error('스레드 식별자 미제공');
  const feature = await ask(threadId, '기능 결과', '아래는 이미 확인된 작업 사실입니다. 사용자에게 최종 결과를 설명해 주세요. 중앙 지도를 넓히고 목록을 기본 접힘으로 변경했습니다. 노드를 선택하면 역할과 하위 구성 요약이 보이며 자세히 보기로 상세를 엽니다. 탐색 패널을 여닫아도 배율과 위치를 보존합니다. 관련 테스트 22개와 Mac 화면 검사는 통과했고 Windows는 검사하지 않았습니다. 커밋·push는 하지 않았습니다.');
  if ((feature.match(/^\s*\d+\.\s+\*\*.+\*\*/gm) ?? []).length < 2 || !/Windows/i.test(feature)) throw Error('번호별 기능 결과 또는 미검증 범위 누락');
  await stop();
  const second = start();
  await initialize(second);
  await second.request('thread/resume', { ...nativeThreadResumeParams(threadId), developerInstructions: nativeThreadResumeParams(threadId).developerInstructions + ' ' + guard });
  const partial = await ask(threadId, '재개 후 부분 실패', '다음 작업의 최종 결과를 정리해 주세요. 인증 요청이 HTTP 503으로 실패한 것을 확인했습니다. 원인은 아직 확인하지 못했고 코드 수정과 테스트도 하지 못했습니다. 로그 확인 방법만 안내했습니다. 이 사실 외에 완료·검증·수정 사실을 추가하지 마세요.');
  if (!partial.includes('503') || /(?:전체|모든)\s*테스트.{0,5}통과/.test(partial)) throw Error('부분 실패의 사실 또는 검증 경계 위반');
  const simple = await ask(threadId, '명시 형식의 단순 질문', '7+5는? 다른 설명 없이 답만 숫자로 적어 주세요.');
  if (simple.trim() !== '12') throw Error('짧은 질문의 명시 형식 위반');
  await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify({ result: 'passed', configuredModel, sameThreadResumed: true, toolAttempts, responses, limitations: ['제공된 사실을 정리하는 실제 모델 검사다. 제품 기능 자체의 수행 증거를 만들어내지 않는다.', 'configuredModel은 Native 설정 응답이며 서버 내부 모델 라우팅의 독립 증명이 아니다.'] }, null, 2));
  console.log(JSON.stringify({ result: 'passed', evidence: path.relative(root, directory), configuredModel, scenarios: responses.map(x => x.scenario), toolAttempts }));
} catch (error) {
  const result = { result: 'failed', evidence: path.relative(root, directory), configuredModel, error: String(error), toolAttempts, responses };
  await fs.writeFile(path.join(directory, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally { clearTimeout(timeout); await stop(); }
