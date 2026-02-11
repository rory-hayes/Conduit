export type JobType =
  | 'extract_thread'
  | 'associate_thread'
  | 'sync_hubspot'
  | 'sync_salesforce'
  | 'weekly_digest'
  | 'weekly_rollup'
  | 'ocr_textract';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface JobPayload {
  thread_id?: string;
  message_id?: string;
  workspace_id?: string;
  schema_version?: string;
  [key: string]: unknown;
}

export interface InboundEmail {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  message_id: string;
  in_reply_to?: string | null;
  references?: string[];
  received_at: string;
  attachments?: Array<{
    filename: string;
    content_type: string;
    size: number;
    source: string;
  }>;
}
