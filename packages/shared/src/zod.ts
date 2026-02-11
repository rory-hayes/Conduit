import { z } from 'zod';

export const inboundEmailSchema = z.object({
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  message_id: z.string().min(1),
  in_reply_to: z.string().nullable().optional(),
  references: z.array(z.string().min(1)).optional(),
  received_at: z.string().datetime(),
  attachments: z
    .array(
      z.object({
        filename: z.string().min(1),
        content_type: z.string().min(1),
        size: z.number().int().nonnegative(),
        source: z.string().min(1)
      })
    )
    .optional()
});

export const workspaceAliasSchema = z.object({
  workspaceId: z.string().uuid(),
  aliasToken: z.string().min(1)
});
