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
