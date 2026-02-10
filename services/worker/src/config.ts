export const config = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  openAiApiKey: process.env.OPENAI_API_KEY ?? '',
  openAiModel: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  awsRegion: process.env.AWS_REGION ?? '',
  awsTextractBucket: process.env.AWS_TEXTRACT_BUCKET ?? '',
  hubspotClientId: process.env.HUBSPOT_CLIENT_ID ?? '',
  hubspotClientSecret: process.env.HUBSPOT_CLIENT_SECRET ?? '',
  salesforceClientId: process.env.SALESFORCE_CLIENT_ID ?? '',
  salesforceClientSecret: process.env.SALESFORCE_CLIENT_SECRET ?? ''
};
