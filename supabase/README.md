# Supabase

## Local Development

1. Install the Supabase CLI.
2. Copy `.env.example` values to your local environment.
3. Run `supabase start` from the repository root.

## Edge Functions
- `health` for basic health checks.
- `inbound-email` accepts normalized inbound email payloads and enqueues jobs.
- `admin-cron` enqueues a weekly digest job.

## Cron
Create a weekly digest schedule once deployed:

```bash
supabase functions deploy admin-cron
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... 
```

Then configure a cron schedule in the Supabase dashboard or using `supabase functions schedule`.
