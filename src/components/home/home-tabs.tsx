import Link from 'next/link';
import { HOME_TABS } from '@/lib/constants';
import { homeHref } from '@/lib/routes';
import type { HomeTab } from '@/types/domain';

interface HomeTabsProps {
  activeTab: HomeTab;
}

export function HomeTabs({ activeTab }: HomeTabsProps) {
  return (
    <nav className="subnav" aria-label="Subpantallas de Home">
      {HOME_TABS.map((tab) => (
        <Link key={tab.key} href={homeHref(tab.key)} className={`subnavLink ${tab.key === activeTab ? 'isActive' : ''}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
