import { loadReviewPolicy } from "../scripts/workflow/review.ts";
import { assessReportedWork as assessWork, completeReportedWork as completeWork } from "../scripts/workflow/report-lifecycle.ts";
import type { DevelopmentPolicyInfo, DevelopmentWorkStatus } from "./shared";

const WORK_ID = /^work-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function workId(value: unknown): string {
  if (typeof value !== "string" || !WORK_ID.test(value)) throw new Error("개발 작업 UUID가 올바르지 않습니다.");
  return value.toLowerCase();
}

export function createDevelopmentService({ policyRoot, workspace }: { policyRoot: string; workspace(): string }) {
  async function policy(): Promise<DevelopmentPolicyInfo> {
    const info = await loadReviewPolicy({ root: policyRoot });
    return {
      id            : info.policy.id            ,
      version       : info.policy.version       ,
      hash          : info.hash                 ,
      primaryModel  : info.policy.primary.model ,
      fallbackModel : info.policy.fallback.model
    };
  }

  async function readStatus(id: string, repo: string): Promise<DevelopmentWorkStatus> {
    const assessment = await assessWork({ repo, workId: id, policyRoot });
    if (assessment.legacy || assessment.record.schemaVersion !== 2 || assessment.record.workflow?.role !== "www-dev") throw new Error("WWW 개발 역할로 접수한 schemaVersion 2 작업만 지원합니다.");
    return {
      workId       : assessment.record.id                  ,
      status       : assessment.record.status              ,
      canComplete  : assessment.complete                   ,
      reasons      : assessment.reasons                    ,
      nextAction   : assessment.record.workflow.nextAction ,
      sourceDigest : assessment.source?.digest ?? null     ,
    };
  }

  async function status(value: unknown): Promise<DevelopmentWorkStatus> {
    return readStatus(workId(value), workspace());
  }

  async function complete(value: unknown): Promise<{ workId: string; status: string }> {
    const id      = workId(value)              ;
    const repo    = workspace()                ;
    const current = await readStatus(id, repo) ;
    if (!current.canComplete) throw new Error(`현재 증거로 완료할 수 없습니다: ${current.reasons.join("; ")}`);
    const result = await completeWork({ repo, workId: id, policyRoot });
    return { workId: result.record.id, status: result.record.status };
  }

  return { policy, status, complete };
}
