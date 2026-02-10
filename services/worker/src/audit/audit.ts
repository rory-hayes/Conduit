import { withClient } from '../db.js';

export const writeAuditEvent = async (eventType: string, payload: Record<string, unknown>) => {
  await withClient(async (client) => {
    await client.query(
      `INSERT INTO audit_events (event_type, payload)
       VALUES ($1, $2)`,
      [eventType, payload]
    );
  });
};
