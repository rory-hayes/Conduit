const emailPattern = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const phonePattern = /\b(?:\+?\d{1,2}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

export const redactSnippet = (value: string): string => {
  return value
    .replace(emailPattern, (_match, _local, domain: string) => `***@${domain.toLowerCase()}`)
    .replace(phonePattern, '[redacted-phone]');
};

export const truncateSnippet = (value: string, limit = 240): string => {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
};
