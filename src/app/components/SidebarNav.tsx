"use client"

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Backpack, Home, Printer } from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/deductions', label: 'Deductions', icon: Receipt },
  { href: '/student', label: 'Student Credits', icon: Backpack },
  { href: '/office', label: 'Space & Assets', icon: Home },
  { href: '/export', label: 'CPA Exporter', icon: Printer },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--accent-green)' : 'var(--text-secondary)',
              fontWeight: isActive ? 500 : 400,
              transition: 'var(--transition-smooth)',
            }}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
