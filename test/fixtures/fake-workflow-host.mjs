#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const [mode, ...args] = process.argv.slice(2);
if (mode === "host") {
  if (process.env.WORKFLOW_MARKER) {
    await writeFile(process.env.WORKFLOW_MARKER, `${JSON.stringify({ args })}\n`);
  }
  process.exit(Number(process.env.WORKFLOW_HOST_EXIT ?? 0));
}
if (mode === "verifier") {
  process.exit(Number(args[0] ?? 0));
}
process.exit(64);
