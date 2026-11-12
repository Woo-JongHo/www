# Ovis 코드 사용 고지

## 출처와 반입 범위

- 프로젝트: https://github.com/devswha/ovis
- 고정 revision: d505c75e26c54f31573057d1e9aa431ecc56677f
- 원본: src/lib/chatRowState.tsx, src/lib/composerLength.ts, src/lib/chatQuote.ts.
- 목적: logical message row의 펼침 상태 소유, 입력 한도·붙여넣기 초과 계산, 답변 인용을 초안에 추가하는 채팅 동작.
- WWW 연결: terminal/pane/PTY 전송과 전역 Ovis store는 도입하지 않는다. 실제 반입은 src/chat-row-state.tsx의 Map/Context/useChatRowToggle/ChatDetails, src/chat-state.ts의 composerFull/pasteOverflow/draftWithQuote다. Ovis의 출력·run·focus·pane store는 제외하고 WWW의 명령·diff 펼침과 100,000자 입력 한도, thread/cwd 초안에 연결했다.
- Ovis 전체 앱의 안정성·기능을 WWW가 그대로 제공한다고 주장하지 않는다.

## 원본 라이선스

MIT License

Copyright (c) 2026 devswha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
