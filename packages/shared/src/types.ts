export type JobType =
  | 'extract_thread'
  | 'sync_hubspot'
  | 'sync_salesforce'
  | 'weekly_digest'
  | 'ocr_textract';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface JobPayload {
  threadId?: string;
  messageId?: string;
  workspaceId?: string;
  attempt?: number;
  [key: string]: unknown;
}

export interface InboundEmail {
  workspaceId: string;
  externalId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bodyText?: string;
  receivedAt: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    storagePath?: string;
  }>;
}
