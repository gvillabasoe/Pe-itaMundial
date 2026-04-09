import type { HomeTab } from '@/types/domain';
import { DEFAULT_HOME_TAB } from '@/lib/constants';

export function homeHref(tab: HomeTab = DEFAULT_HOME_TAB): string {
  return tab === DEFAULT_HOME_TAB ? '/' : `/?tab=${tab}`;
}

export function participantHref(slug: string): string {
  return `/participante/${slug}`;
}

export function versusHref(leftSlug: string, rightSlug?: string, mode: 'participant' | 'general' = 'participant'): string {
  const query = new URLSearchParams();
  query.set('a', leftSlug);
  if (rightSlug) {
    query.set('b', rightSlug);
  }
  query.set('mode', mode);
  return `/versus?${query.toString()}`;
}
