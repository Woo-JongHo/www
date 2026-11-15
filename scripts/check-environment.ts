import { checkDevelopmentEnvironment, checkEnvironment } from "./workflow/environment.ts";

let input: unknown;
try {
  if (process.argv.length !== 3) throw new Error("JSON 설정 하나가 필요합니다.");
  input = JSON.parse(process.argv[2] ?? "");
} catch {
  input = null;
}
const report = process.argv.length === 2 ? await checkDevelopmentEnvironment() : checkEnvironment(input);
process.stdout.write(`${JSON.stringify(report)}\n`);
if (!report.ok) process.exitCode = 1;
