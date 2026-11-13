export function commandPreview(output: string, running: boolean): { text: string; hiddenLines: number } {
  if (!output) return { text: "", hiddenLines: 0 };
  const lines = output.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return {
    text: (running ? lines.slice(-10) : lines.slice(0, 10)).join("\n"),
    hiddenLines: Math.max(0, lines.length - 10)
  };
}
