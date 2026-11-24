/**
 * @architecture arch.chat.messages.preview
 * @implements RESP-CHAT-MESSAGES-PREVIEW
 */
export function commandPreview(output: string, running: boolean, preserveLineEndings = false): { text: string; hiddenLines: number } {
  if (!output) return { text: "", hiddenLines: 0 };
  if (preserveLineEndings) {
    const lines = output.match(/[^\n]*\n|[^\n]+$/g) ?? [];
    return { text: (running ? lines.slice(-10) : lines.slice(0, 10)).join(""), hiddenLines: Math.max(0, lines.length - 10) };
  }
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return {
    text: (running ? lines.slice(-10) : lines.slice(0, 10)).join("\n"),
    hiddenLines: Math.max(0, lines.length - 10)
  };
}

export interface SyntaxToken {
  text: string;
  kind: 'key' | 'string' | 'number' | 'literal' | 'option' | 'plain';
}

export function jsonTokens(text: string): SyntaxToken[] {
  return (text.match(/"(?:\\[\s\S]|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|\s+|./g) ?? []).map((token, index, tokens) => ({
    text: token,
    kind: token.startsWith('"') ? ((tokens[index + 1] === ':' || (tokens[index + 1]?.trim() === '' && tokens[index + 2] === ':')) ? 'key' : 'string')
      : /^-?\d/.test(token) ? 'number' : /^(true|false|null)$/.test(token) ? 'literal' : 'plain',
  }));
}

export function shellTokens(text: string): SyntaxToken[] {
  return (text.match(/'(?:[^']*)'|"(?:\\[\s\S]|[^"\\])*"|\s+|[^\s'"]+|./g) ?? []).map(token => ({
    text: token,
    kind: /^["']/.test(token) ? 'string' : /^--?[a-zA-Z]/.test(token) ? 'option' : 'plain',
  }));
}

function addLogText(tokens: SyntaxToken[], line: string): void {
  const trace = /^([ \t]*)(at[ \t]+\S[^\r\n]*|File[ \t]+"[^"\r\n]+", line \d+[^\r\n]*)/.exec(line);
  if (trace) {
    const [prefix, indent, frame] = trace;
    if (indent) tokens.push({ text: indent, kind: "plain" });
    if (frame) tokens.push({ text: frame, kind: "option" });
    if (line.length > prefix.length) tokens.push({ text: line.slice(prefix.length), kind: "plain" });
    return;
  }

  let start = 0;
  for (const marker of line.matchAll(/<\/?[A-Z][^<>\r\n]*>|<!DOCTYPE[ \t]+html[^<>\r\n]*>|\b(?:ERROR|WARN(?:ING)?|INFO|DEBUG|FATAL|[A-Z][A-Z0-9_]{0,64}(?:Error|Exception))(?=[\s:\]])/gi)) {
    const index = marker.index!;
    if (index > start) tokens.push({ text: line.slice(start, index), kind: "plain" });
    tokens.push({ text: marker[0], kind: marker[0].startsWith("<") ? "key" : "literal" });
    start = index + marker[0].length;
  }
  if (start < line.length) tokens.push({ text: line.slice(start), kind: "plain" });
}

/** 렌더러에 텍스트 토큰만 전달하고, 혼합 출력의 공백과 구분자를 보존한다. */
export function commandLogTokens(text: string): SyntaxToken[] {
  const tokens: SyntaxToken[] = [];
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    const start = line.search(/[\[{](?=[ \t]*(?:["{[}\]\d-]|true|false|null))/);
    if (start >= 0 && line.length - start <= 32768) {
      const fragment = line.slice(start);
      try {
        JSON.parse(fragment);
        addLogText(tokens, line.slice(0, start));
        tokens.push(...jsonTokens(fragment));
        continue;
      } catch { /* 불완전한 조각은 로그 텍스트로 보존한다. */ }
    }
    addLogText(tokens, line);
  }
  return tokens;
}

export function commandOutput(output: string, running: boolean, truncated: boolean): {
  text: string;
  json: boolean;
  review: 'pass' | 'fail' | 'not_run' | null;
} {
  const raw = { text: output, json: false, review: null } as const;
  if (running || truncated || output.length > 32768 || !/^[\s]*[\[{]/.test(output)) return raw;
  let value: unknown;
  try { value = JSON.parse(output); } catch { return raw; }
  const tokens = jsonTokens(output).filter(token => token.text.trim()).map(token => token.text);
  let depth = 0;
  let formatted = '';
  const newline = () => '\n' + '  '.repeat(depth);
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token === '{' || token === '[') {
      if (++depth > 24) return raw;
      formatted += token;
      if (tokens[index + 1] !== '}' && tokens[index + 1] !== ']') formatted += newline();
    } else if (token === '}' || token === ']') {
      depth--;
      if (tokens[index - 1] !== '{' && tokens[index - 1] !== '[') formatted += newline();
      formatted += token;
    } else formatted += token === ',' ? ',' + newline() : token === ':' ? ': ' : token;
    if (formatted.length > 32768) return raw;
  }
  let review: 'pass' | 'fail' | 'not_run' | null = null;
  if (value && typeof value === 'object' && !Array.isArray(value)
    && 'id' in value && typeof value.id === 'string' && value.id.startsWith('review-')
    && 'provider' in value && typeof value.provider === 'string'
    && 'model' in value && typeof value.model === 'string' && 'verdict' in value
    && (value.verdict === 'pass' || value.verdict === 'fail' || value.verdict === 'not_run')) review = value.verdict;
  return { text: formatted, json: true, review };
}
