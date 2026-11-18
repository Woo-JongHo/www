/**
 * @architecture arch.chat.messages.preview
 * @implements RESP-CHAT-MESSAGES-PREVIEW
 */
export function commandPreview(output: string, running: boolean): { text: string; hiddenLines: number } {
  if (!output) return { text: "", hiddenLines: 0 };
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
