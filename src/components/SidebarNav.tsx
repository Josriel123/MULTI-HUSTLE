'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Backpack, Home, LayoutDashboard, Printer, Receipt } from 'lucide-react';
import { cn } from './cn';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deductions', label: 'Deductions & Mileage', icon: Receipt },
  { href: '/student', label: 'Student Forms', icon: Backpack },
  { href: '/office', label: 'Home Office', icon: Home },
  { href: '/export', label: 'CPA Export', icon: Printer },
] as const;

export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-4">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex items-center gap-4 rounded-lg px-4 py-3 transition-colors duration-200',
              isActive ? 'bg-card font-medium text-accent' : 'text-fg-muted hover:bg-card/60 hover:text-fg',
            )}
          >
            <Icon size={20} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
