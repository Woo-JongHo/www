/**
 * @architecture arch.development.records.serialization
 * @implements RESP-DEVELOPMENT-RECORDS-SERIALIZATION
 */
import type { WorkRecord } from "./types.ts";
import type { WorkReport, ReportBundle } from "./reports.ts";

function scalar(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function keyWidth(key: string): number {
  let width = 0;
  for (const character of key) {
    width += /[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(character) ? 2 : 1;
  }
  return width;
}

function emit(value: unknown, depth: number): string {
  if (scalar(value)) return JSON.stringify(value);
  const indent = "  ".repeat(depth) ;
  const child  = `${indent}  `      ;
  if (Array.isArray(value)) {
    return value.length === 0 ? "[]" : `[\n${value.map((item: unknown) => `${child}${emit(item, depth + 1)}`).join(",\n")}\n${indent}]`;
  }
  if (typeof value !== "object" || value === null) throw new Error("새 JSON 의미 값이 필요합니다.");
  const entries : [string, unknown][] = Object.entries(value) ;
  const rows    : string[]            = []                    ;
  for (let index = 0; index < entries.length;) {
    const first = entries[index];
    if (!first) break;
    let end = index;
    while (end < entries.length && scalar(entries[end]?.[1])) end++;
    if (end - index >= 3) {
      const run   = entries.slice(index, end                                          ) ;
      const width = Math   .max  (...run.map(([key]) => keyWidth(JSON.stringify(key)))) ;
      for (const [key, item] of run) {
        const encoded = JSON.stringify(key);
        rows.push(`${child}${encoded}${" ".repeat(width - keyWidth(encoded))}: ${emit(item, depth + 1)}`);
      }
      index = end;
    } else {
      rows.push(`${child}${JSON.stringify(first[0])}: ${emit(first[1], depth + 1)}`);
      index++;
    }
  }
  return rows.length === 0 ? "{}" : `{\n${rows.join(",\n")}\n${indent}}`;
}

function serialize(value: WorkRecord | WorkReport | ReportBundle, columns: boolean): string {
  // 새 의미 객체를 한 번만 관찰해 getter/toJSON과 native 오류 의미를 보존한다.
  const fresh = JSON.stringify(value, null, 2);
  if (!columns || fresh === undefined) return `${fresh}\n`;
  const normalized: unknown = JSON.parse(fresh);
  return `${emit(normalized, 0)}\n`;
}

export function serializeWorkRecord(record: WorkRecord, columns: boolean): string {
  return serialize(record, columns);
}

export function serializeWorkReport(report: WorkReport | ReportBundle, columns: boolean): string {
  return serialize(report, columns);
}
