import Link from 'next/link';

export interface DriftAlertBannerProps {
  openAlerts: number;
}

export const DriftAlertBanner = ({ openAlerts }: DriftAlertBannerProps) => {
  if (openAlerts <= 0) {
    return null;
  }

  return (
    <div className="rounded border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-200">
      <p className="font-medium">Drift alerts open: {openAlerts}</p>
      <p className="mt-1">
        CRM writes may be paused for affected sources.{' '}
        <Link href="/review-queue" className="underline">
          Review queue
        </Link>{' '}
        ·{' '}
        <Link href="/settings" className="underline">
          Settings
        </Link>
      </p>
    </div>
  );
};
