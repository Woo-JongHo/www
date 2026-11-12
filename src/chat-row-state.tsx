// Ovis 채팅 행 상태에서 개작. Copyright (c) 2026 devswha, MIT.
// 원본: devswha/ovis@d505c75e26c54f31573057d1e9aa431ecc56677f/src/lib/chatRowState.tsx
// WWW에서는 명령·diff의 펼침 상태만 보존한다. 출처와 고지는 docs/third-party/ovis.md를 따른다.
import { createContext, useContext, useState, type ComponentProps } from "react";

export type ChatRowMemory = Map<string, boolean>;
export const ChatRowMemoryContext = createContext<ChatRowMemory | null>(null);

export function useChatRowToggle(key: string, initial: boolean) {
  const memory = useContext(ChatRowMemoryContext);
  const [value, setValue] = useState(() => memory?.get(key) ?? initial);
  const update = (next: boolean) => {
    memory?.set(key, next);
    setValue(next);
  };
  return [value, update, memory?.has(key) ?? false] as const;
}

export function ChatDetails({ memoryKey, onToggle, ...props }: ComponentProps<"details"> & { memoryKey: string }) {
  const [open, setOpen] = useChatRowToggle(memoryKey, false);
  return <details {...props} open={open} onToggle={(event) => {
    setOpen(event.currentTarget.open);
    onToggle?.(event);
  }}/>;
}
