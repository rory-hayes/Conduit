# Conduit

Conduit is a SaaS foundation for revenue inbox intelligence. It ingests raw emails into Supabase, runs extraction jobs in a Node.js worker, and publishes curated outcomes to CRM systems.

## Monorepo Structure
- `apps/web`: Next.js dashboard UI
- `services/worker`: background job runner
- `packages/shared`: shared Node utilities and types
- `supabase`: database migrations and edge functions
- `docs`: product and engineering documentation

## Getting Started
1. Install dependencies:
   ```bash
   pnpm -w install
   ```
2. Configure environment:
   - Copy `.env.example` to `.env` and fill values.
   - Copy `apps/web/.env.local.example` to `apps/web/.env.local`.
3. Start Supabase locally:
   ```bash
   supabase start
   ```
4. Run the worker:
   ```bash
   pnpm --filter worker dev
   ```
5. Run the web app:
   ```bash
   pnpm --filter web dev
   ```

## Required Docs
See `/docs` for PRD, architecture, data model, and operational runbooks.

## Testing
- Lint: `pnpm -w lint`
- Typecheck: `pnpm -w typecheck`
- Tests: `pnpm -w test`
