'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  ArrowLeftRight,
  Briefcase,
  Car,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  LayoutDashboard,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from './cn';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Grouped by what a person is doing, not by tax form: tracking money,
 * claiming tax breaks, reading the result. Old paths (/deductions, /student,
 * /export) redirect in next.config.ts.
 */
export const NAV_GROUPS: { heading?: string; items: NavItem[] }[] = [
  { items: [{ href: '/', label: 'Overview', icon: LayoutDashboard }] },
  {
    heading: 'Your money',
    items: [
      { href: '/transactions', label: 'Income & expenses', icon: ArrowLeftRight },
      { href: '/mileage', label: 'Mileage', icon: Car },
      { href: '/jobs', label: 'W-2 jobs', icon: Briefcase },
      { href: '/payments', label: 'Tax payments', icon: Landmark },
    ],
  },
  {
    heading: 'Tax breaks',
    items: [
      { href: '/office', label: 'Home office', icon: Home },
      { href: '/education', label: 'Education', icon: GraduationCap },
    ],
  },
  {
    heading: 'Your estimate',
    items: [
      { href: '/report', label: 'Tax report', icon: FileText },
      { href: '/profile', label: 'Tax profile', icon: UserRound },
    ],
  },
];

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  // The dev-only /preview/<page> renders real pages; highlight them as such.
  const pathname = usePathname().replace(/^\/preview(?=\/|$)/, '').replace(/^\/overview$/, '') || '/';
  const searchParams = useSearchParams();
  const taxYear = searchParams.get('taxYear');

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.heading ?? i} className="flex flex-col gap-0.5">
          {group.heading && <p className="px-3 pb-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-fg-faint">{group.heading}</p>}
          {group.items.map(({ href, label, icon: Icon }) => {
            const isActive = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
            // The year travels with every link, so moving between pages never changes it.
            const targetHref = taxYear ? `${href}?taxYear=${encodeURIComponent(taxYear)}` : href;
            return (
              <Link
                key={href}
                href={targetHref}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-[0.925rem] transition-colors duration-150',
                  isActive ? 'bg-accent/10 font-semibold text-accent' : 'text-fg-muted hover:bg-surface hover:text-fg',
                )}
              >
                <Icon size={18} aria-hidden className={cn('shrink-0', isActive ? 'text-accent' : 'text-fg-faint group-hover:text-fg-muted')} />
                {label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
