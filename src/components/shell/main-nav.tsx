'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { homeHref, versusHref } from '@/lib/routes';

export function MainNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const isParticipant = pathname.startsWith('/participante');
  const isVersus = pathname.startsWith('/versus');

  return (
    <nav className="mainNav" aria-label="Principal">
      <div className="mainNavInner">
        <Link className={`mainNavLink ${isHome ? 'isActive' : ''}`} href={homeHref()}>
          Home
        </Link>
        <Link className={`mainNavLink ${isParticipant ? 'isActive' : ''}`} href="/participante/txapeldun">
          Participante
        </Link>
        <Link className={`mainNavLink ${isVersus ? 'isActive' : ''}`} href={versusHref('txapeldun', 'varmaster')}>
          Versus
        </Link>
      </div>
    </nav>
  );
}
