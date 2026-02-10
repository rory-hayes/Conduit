import { z } from 'zod';

export const inboundEmailSchema = z.object({
  workspaceId: z.string().uuid(),
  externalId: z.string().min(1),
  subject: z.string().min(1),
  from: z.string().email(),
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  bodyText: z.string().optional(),
  receivedAt: z.string(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        sizeBytes: z.number().int().nonnegative(),
        storagePath: z.string().optional()
      })
    )
    .optional()
});
