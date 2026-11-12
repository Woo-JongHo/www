export interface DevelopmentRecord {
  schemaVersion: number;
  id: string;
  status: string;
  workflow?: {
    role: string;
    nextAction: string;
  };
}

export interface WorkLocation {
  path: string;
  record: DevelopmentRecord;
}

export interface WorkAssessment extends WorkLocation {
  legacy?: boolean;
  complete: boolean;
  reasons: string[];
  source?: { digest: string };
}

export interface WorkOptions {
  repo?: string;
  workId: string;
  policyRoot?: string;
}

export function assessWork(options: WorkOptions): Promise<WorkAssessment>;
export function completeWork(options: WorkOptions): Promise<WorkLocation>;
