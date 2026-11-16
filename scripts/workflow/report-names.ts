/**
 * @architecture arch.development.reporting.storage
 * @implements RESP-DEVELOPMENT-REPORTING-STORAGE
 */
import { createHash } from "node:crypto";

interface ReportName {
  id        : string                  ;
  title     : string                  ;
  createdAt : string                  ;
  kind      : "authored" | "snapshot" ;
}

/** 저장·내보내기가 공유하는 제목 기반 이름. UUID 원본은 보고서 안에 유지한다. */
export function reportRevisionFileStem(report: ReportName): string {
  if (!/^report-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(report.id)) throw new Error("유효한 보고서 UUID가 필요합니다.");
  const date = new Date(report.createdAt);
  if (!Number.isFinite(date.getTime()) || !["authored", "snapshot"].includes(report.kind)) throw new Error("보고서 이름의 시각·종류가 올바르지 않습니다.");
  const timestamp = date.toISOString().replace(/[-:.]/g, "");
  const shortId = report.id.slice(7).replaceAll("-", "").slice(0, 16);
  const suffix = `-${timestamp}-${report.kind}-${shortId}`;
  const clean = report.title.normalize("NFC").replace(/[<>:"/\\|?*\p{Cc}\p{Cf}\p{Cs}]/gu, "-").replace(/\s+/gu, " ").replace(/^[. ]+|[. ]+$/g, "");
  let title = "";
  for (const character of clean || "제목 없음") {
    if (Buffer.byteLength(`report-${title}${character}${suffix}.json`.normalize("NFD")) > 220) break;
    title += character;
  }
  return `report-${title.trimEnd() || "제목 없음"}${suffix}`;
}

/** 동일한 NFC 제목은 사건·시각과 무관하게 같은 묶음 이름을 사용한다. */
export function reportFileStem(report: { title: string }): string {
  const normalized = report.title.normalize("NFC");
  if (!normalized.trim() || normalized.length > 4000) throw new Error("보고서 제목이 올바르지 않습니다.");
  const suffix = createHash("sha256").update(normalized).digest("hex").slice(0, 16);
  const clean = normalized.replace(/[<>:"/\\|?*\p{Cc}\p{Cf}\p{Cs}]/gu, "-").replace(/\s+/gu, " ").replace(/^[. ]+|[. ]+$/g, "");
  let title = "";
  for (const character of clean || "제목 없음") {
    if (Buffer.byteLength(`report-${title}${character}-${suffix}.json`.normalize("NFD")) > 220) break;
    title += character;
  }
  return `report-${title.trimEnd() || "제목 없음"}-${suffix}`;
}
