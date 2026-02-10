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
