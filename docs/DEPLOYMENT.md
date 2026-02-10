# Deployment

## Supabase
- Deploy migrations: `supabase db push`.
- Deploy edge functions: `supabase functions deploy`.
- Configure cron for `admin-cron`.

## Worker Service
- Run on container platform (Fly.io, ECS, or Render).
- Requires access to Postgres via `DATABASE_URL`.

## AWS Textract
- Create an S3 bucket for OCR assets.
- IAM user scoped to Textract and S3.

## Secrets
- Store secrets in deployment platform.
- Never commit secrets to the repo.
