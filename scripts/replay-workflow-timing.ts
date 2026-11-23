/**
 * @architecture arch.development.evidence.verification
 * @implements RESP-DEVELOPMENT-EVIDENCE-VERIFICATION
 */
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

interface Interval {
  start: number;
  end: number;
}

function timestamp(value: unknown): number {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("시간대가 있는 ISO 시각이 필요합니다.");
  }
  return Date.parse(value);
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function covered(intervals: Interval[], start: number, end: number) {
  let total = 0;
  let cursor = start;
  for (const interval of [...intervals].sort((a, b) => a.start - b.start)) {
    const right = Math.min(end, interval.end);
    total += Math.max(0, right - Math.max(cursor, interval.start));
    cursor = Math.max(cursor, right);
  }
  return total;
}

function readTrace(rows: unknown[]) {
  const first = rows[0];
  if (!object(first) || first.version !== 1 || first.event !== "requested" || typeof first.traceId !== "string" ||
    !["verification", "review", "registration"].includes(String(first.operation))) throw new Error("계측 요청 머리 오류");
  let at = timestamp(first.at);
  const startedAt = at;
  let binding: { workId: string; requestHash: string } | undefined;
  let phase = "preparation";
  const processes = new Map<string, string>();
  let terminal = false;
  const spans: (Interval & { phase: string })[] = [];
  const markers: { at: number; event: string; value: string }[] = [];
  for (const row of rows.slice(1)) {
    if (!object(row) || row.version !== 1 || row.traceId !== first.traceId || terminal) throw new Error("계측 실행 경계 오류");
    const next = timestamp(row.at);
    if (next < at) throw new Error("계측 시각 역전");
    if (phase !== "preparation" || !processes.size) spans.push({ start: at, end: next, phase });
    for (const role of new Set(processes.values())) spans.push({ start: at, end: next, phase: role });
    at = next;
    switch (row.event) {
      case "phase":
        if (typeof row.phase !== "string" || !["preparation", "session_queue", "injected_runner", "result_registration", "ledger_lock"].includes(row.phase)) throw new Error("계측 구간 오류");
        phase = row.phase;
        markers.push({ at, event: "phase", value: phase });
        break;
      case "process_start": case "process_exit":
        if (typeof row.processId !== "string" || (row.role !== "verification_process" && row.role !== "review_process")) throw new Error("프로세스 식별 오류");
        if (row.event === "process_start") {
          if (processes.has(row.processId)) throw new Error("프로세스 시작 중복");
          processes.set(row.processId, row.role);

        } else {
          if (processes.get(row.processId) !== row.role) throw new Error("프로세스 종료 불일치");
          processes.delete(row.processId);
        }
        markers.push({ at, event: row.event, value: row.processId });
        break;
      case "attempt": case "reused": case "registered": case "registration_pending":
        if (typeof row.attemptId !== "string") throw new Error("시도 ID 누락");
        markers.push({ at, event: row.event, value: row.attemptId });
        break;
      case "provider_failure": case "dispatch_reason":
        if (typeof row.reason !== "string") throw new Error("제공자 실패 원인 누락");
        markers.push({ at, event: row.event, value: row.reason });
        break;
      case "bound":
        if (typeof row.workId !== "string" || typeof row.requestHash !== "string") throw new Error("작업 바인딩 오류");
        binding = { workId: row.workId, requestHash: row.requestHash };
        break;
      case "returned": case "threw": terminal = true; break;
      default: throw new Error("알 수 없는 계측 사건");
    }
  }
  return { id: first.traceId, operation: first.operation, binding, startedAt, endedAt: at, terminal, spans, markers };
}

export function replayTiming(from: string, until: string, records: unknown[]) {
  const start = timestamp(from);
  const end = timestamp(until);
  if (end <= start) throw new Error("종료 시각은 시작 이후여야 합니다.");
  const intervals = new Map<string, Interval>();
  const rejectedInputs: string[] = [];
  const traces = new Map<string, ReturnType<typeof readTrace>>();
  const traceInputs = new Map<string, unknown[]>();
  const conflicts = new Set<string>();
  for (const record of records) {
    if (object(record) && typeof record.timingInputError === "string") {
      rejectedInputs.push(record.timingInputError);
      continue;
    }
    if (Array.isArray(record)) {
      let trace: ReturnType<typeof readTrace>;
      try { trace = readTrace(record); }
      catch (error) {
        rejectedInputs.push(error instanceof Error ? error.message : "계측 기록 오류");
        continue;
      }
      if (conflicts.has(trace.id)) continue;
      const prior = traceInputs.get(trace.id);
      if (prior) {
        const common = Math.min(prior.length, record.length);
        if (prior.slice(0, common).some((row, index) => JSON.stringify(row) !== JSON.stringify(record[index]))) {
          rejectedInputs.push(trace.id + " — 같은 계측 실행의 기록 충돌");
          conflicts.add(trace.id);
          traces.delete(trace.id);
          continue;
        }
        if (prior.length >= record.length) continue;
      }
      traceInputs.set(trace.id, record);
      traces.set(trace.id, trace);
      continue;
    }
    if (!object(record) || !object(record.workflow)) throw new Error("workflow 원장이 필요합니다.");
    for (const field of ["verifications", "reviews"]) {
      const attempts = record.workflow[field];
      if (!Array.isArray(attempts)) throw new Error(`실행 배열 누락: ${field}`);
      for (const attempt of attempts) {
        if (!object(attempt) || typeof attempt.id !== "string" || !attempt.id) throw new Error("실행 ID 누락");
        const left = timestamp(attempt.startedAt);
        const right = timestamp(attempt.completedAt);
        if (right < left) throw new Error(`실행 시각 역전: ${attempt.id}`);
        const key = field + "/" + attempt.id;
        const previous = intervals.get(key);
        if (previous && (left !== previous.start || right !== previous.end)) throw new Error(`같은 실행의 시각 충돌: ${key}`);
        intervals.set(key, { start: left, end: right });
      }
    }
  }
  const all: Interval[] = [];
  const byPhase = new Map<string, Interval[]>();
  const reached = new Set<string>();
  const detailed = new Set<string>();
  const outcomes: Record<string, number> = {};
  const requests = [];
  let processStarts = 0;
  let unfinishedRequests = 0;
  for (const trace of traces.values()) {
    if (trace.startedAt < end && trace.endedAt >= start) {
      requests.push({ traceId: trace.id, operation: trace.operation, ...trace.binding,
        requestedAt: new Date(trace.startedAt).toISOString(), lastObservedAt: new Date(trace.endedAt).toISOString(),
        terminal: trace.terminal, events: trace.markers.map(marker => ({ ...marker, at: new Date(marker.at).toISOString() })) });
    }
    for (const marker of trace.markers) {
      if (marker.event === "attempt") detailed.add(marker.value);
      if (marker.at < start || marker.at >= end) continue;
      if (marker.event === "attempt") reached.add(marker.value);
      if (marker.event === "process_start") processStarts++;
      if (marker.event === "phase") continue;
      const name = marker.event === "provider_failure" || marker.event === "dispatch_reason" ? marker.event + "/" + marker.value : marker.event;
      outcomes[name] = (outcomes[name] ?? 0) + 1;
    }
    if (!trace.terminal && trace.startedAt < end && trace.endedAt >= start) unfinishedRequests++;
    for (const span of trace.spans) {
      const group = byPhase.get(span.phase) ?? [];
      group.push(span);
      byPhase.set(span.phase, group);
      all.push(span);
    }
  }
  for (const [key, interval] of intervals) {
    if (interval.start >= end || interval.end <= start) continue;
    const id = key.slice(key.indexOf("/") + 1);
    reached.add(id);
    if (!detailed.has(id)) {
      const group = byPhase.get("legacy_attempt") ?? [];
      group.push(interval);
      byPhase.set("legacy_attempt", group);
      all.push(interval);
    } else all.push(interval);
  }
  const coveredMs = covered(all, start, end);
  const phaseMs = Object.fromEntries([...byPhase].map(([name, spans]) => [name, covered(spans, start, end)]));
  return { from, until, executionCount: reached.size, elapsedMs: end - start, coveredMs, unmeasuredMs: end - start - coveredMs, phaseMs, processStarts, outcomes, unfinishedRequests, requests, rejectedInputs };
}

export async function loadTimingInputs(files: string[]): Promise<unknown[]> {
  const records: unknown[] = [];
  for (const file of files) {
    if ((await stat(file)).isDirectory()) {
      const entries = await readdir(file, { withFileTypes: true });
      const names = entries.filter(entry => entry.isFile() && entry.name.endsWith(".ndjson"));
      records.push(...await loadTimingInputs(names.map(entry => path.join(file, entry.name))));
      continue;
    }
    const raw = await readFile(file, "utf8");
    if (file.endsWith(".ndjson")) {
      // 작성 중이거나 강제 종료된 마지막 불완전한 줄의 이후 시간은 미계측이다.
      const completeLines = raw.split("\n").slice(0, -1);
      if (completeLines.length) {
        try { records.push(completeLines.map(line => JSON.parse(line) as unknown)); }
        catch { records.push({ timingInputError: path.basename(file) + " — 손상된 계측 줄" }); }
      }
    } else records.push(JSON.parse(raw) as unknown);
  }
  return records;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [from, until, ...paths] = process.argv.slice(2);
  if (!from || !until || !paths.length) throw new Error("사용법: node scripts/replay-workflow-timing.ts 시작시각 종료시각 work.json 또는 workflow-timing 디렉터리 [...]");
  const records = await loadTimingInputs(paths);
  console.log(JSON.stringify(replayTiming(from, until, records), null, 2));
}
