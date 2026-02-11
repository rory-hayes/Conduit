import type { JobPayload, JobStatus, JobType } from '@conduit/shared';

export interface JobRecord {
  id: string;
  workspaceId: string;
  type: JobType;
  status: JobStatus;
  payload: JobPayload;
  attempts: number;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobProcessorContext {
  job: JobRecord;
  clientId: string;
}

export type JobProcessor = (context: JobProcessorContext) => Promise<void>;
