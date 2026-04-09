import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { AppShell } from '@/components/shell/app-shell';
import { MainNav } from '@/components/shell/main-nav';

export const metadata: Metadata = {
  title: 'Porra Mundial 2026',
  description: 'App de la porra del Mundial 2026 con Home, Participante y Versus.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <MainNav />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
