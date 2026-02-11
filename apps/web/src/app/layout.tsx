import '../app/globals.css';
import { Nav } from '../components/Nav';
import { DriftAlertBanner } from '../components/DriftAlertBanner';
import { getOpenDriftAlertCount } from '../lib/queries';

export const metadata = {
  title: 'Conduit',
  description: 'Inbox intelligence for revenue teams'
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const openDriftAlerts = await getOpenDriftAlertCount();

  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-6xl px-6 py-8">
          <header className="flex flex-col gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Conduit</p>
              <h1 className="text-3xl font-semibold text-white">Revenue Inbox Intelligence</h1>
            </div>
            <DriftAlertBanner openAlerts={openDriftAlerts} />
            <Nav />
          </header>
          <main className="mt-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
