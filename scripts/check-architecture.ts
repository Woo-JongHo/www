/**
 * @architecture arch.tooling.map-validation
 * @implements RESP-TOOLING-MAP-VALIDATION
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeArchitecture } from "./generate-architecture.ts";

export function checkArchitecture(root: string) { return writeArchitecture(root, true); }

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkArchitecture(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
  console.log(`구조 계약과 지도 현재성 확인: ${result.digest}`);
}
