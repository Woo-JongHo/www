import { Children, isValidElement, memo, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { externalChatUrl } from "./chat-state";

function nodeText(node: ReactNode): string {
  return Children.toArray(node).map((child): string => {
    if (typeof child === "string" || typeof child === "number") return String(child);
    if (isValidElement<{ children?: ReactNode }>(child)) return nodeText(child.props.children);
    return "";
  }).join("");
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("복사됨");
    } catch {
      setStatus("복사 실패");
    }
  };
  return <button type="button" className="chat-copy" onClick={() => { void copy(); }} aria-label={label}><span aria-live="polite">{status || label}</span></button>;
}

interface ChatMessageProps {
  text      : string;
  streaming?: boolean;
  onQuote?  : (quote: string) => void;
  label?    : string;
}

export const ChatMessage = memo(function ChatMessage({ text, streaming = false, onQuote, label = "Codex 답변" }: ChatMessageProps) {
  const [linkError, setLinkError] = useState("");
  return <article className={`chat-message ${streaming ? "is-streaming" : ""}`} aria-label={label}>
    <div className="chat-markdown" onClick={(event) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!anchor) return;
      event.preventDefault();
      const url = externalChatUrl(anchor.getAttribute("href") ?? undefined);
      if (url) void window.www.openExternal(url).catch(() => setLinkError("링크를 열지 못했습니다."));
    }}><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={(url) => externalChatUrl(url) ?? undefined} components={{
      img: ({ alt }) => <span className="chat-image-note">이미지: {alt || "설명 미제공"}</span>,
      pre: ({ children }) => <div className="chat-code"><div className="chat-code-heading"><span>코드</span><CopyButton text={nodeText(children).replace(/\n$/, "")} label="코드 복사"/></div><pre>{children}</pre></div>
    }}>{text || "응답 내용 미제공"}</Markdown></div>
    {linkError && <div role="status" className="muted">{linkError}</div>}
    {!streaming && text && onQuote && <div className="chat-message-actions"><CopyButton text={text} label="답변 복사"/><button type="button" onClick={() => onQuote(text)}>인용하여 질문</button></div>}
  </article>;
});
