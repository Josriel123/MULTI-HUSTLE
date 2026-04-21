import type { Metadata } from "next";
import { Lock, Shield, TrendingUp } from 'lucide-react';
import SidebarNav from './components/SidebarNav';
import Link from 'next/link';
import { ClerkProvider, UserButton, Show, SignInButton } from '@clerk/nextjs';
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Hustle | Tax & Financial OS",
  description: "Real-time net-income tracking and tax optimization for multi-earners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
      <body>
        <div className="app-container">
          {/* Sidebar */}
          <aside className="sidebar">
            <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ height: '32px', width: '32px', borderRadius: '8px', background: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} color="#000" strokeWidth={3} />
              </div>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Multi-Hustle</h2>
            </div>
            
            <SidebarNav />

            <div style={{ padding: '2rem 1.5rem', borderTop: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                <Shield size={16} color="var(--accent-green)" />
                <span style={{ fontWeight: 500 }}>Bank-Level Security</span>
              </div>
              <p>Your financial data is secured with 256-bit encryption.</p>
            </div>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            <header className="header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                <Lock size={16} />
                <span>Encrypted Connection Active</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Show when="signed-out">
                  <SignInButton mode="modal">
                     <button style={{ padding: '0.5rem 1rem', background: 'var(--accent-green)', color: '#000', borderRadius: '8px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Sign In</button>
                  </SignInButton>
                </Show>
                
                <Show when="signed-in">
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Logged In</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--accent-green)' }}>Pro Plan</div>
                  </div>
                  <UserButton afterSignOutUrl="/" />
                </Show>
              </div>
            </header>
            
            <div className="content-area">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
    </ClerkProvider>
  );
}
