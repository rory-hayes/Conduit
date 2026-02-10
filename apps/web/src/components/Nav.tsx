import Link from 'next/link';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/today', label: 'Today' },
  { href: '/review-queue', label: 'Review Queue' },
  { href: '/threads', label: 'Threads' },
  { href: '/reports', label: 'Reports' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/settings', label: 'Settings' }
];

export const Nav = () => {
  return (
    <nav className="flex flex-wrap gap-3 text-sm text-slate-300">
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-white">
          {link.label}
        </Link>
      ))}
    </nav>
  );
};
