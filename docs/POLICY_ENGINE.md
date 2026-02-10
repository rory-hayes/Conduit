# Policy Engine

## Confidence Gating
- High-confidence extractions pass directly to CRM writes.
- Low-confidence extractions are routed to the review queue.

## Noise Budget
- Each workspace has a configurable noise budget for low-confidence items.
- If exceeded, Conduit pauses CRM writes and requires review.

## Idempotency
- Every CRM write includes a deterministic idempotency key derived from the source event.
- Replays must be safe and never create duplicate CRM records.

## Task-first Output
- Only publish: tasks + one summary note + limited high-confidence fields.
- Never publish raw emails or attachment content.

## Drift Pause
- If confidence falls below the drift threshold, Conduit pauses CRM writes.
- V1 includes placeholders and audit records for drift pause events.
