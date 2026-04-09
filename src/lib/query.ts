import type { HomeTab } from '@/types/domain';
import { DEFAULT_HOME_TAB, HOME_TABS } from '@/lib/constants';

export type SearchParamInput =
  | Promise<Record<string, string | string[] | undefined>>
  | Record<string, string | string[] | undefined>
  | undefined;

export async function resolveSearchParams(input: SearchParamInput): Promise<Record<string, string | string[] | undefined>> {
  if (!input) return {};
  return input instanceof Promise ? await input : input;
}

export function getSingleParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseHomeTab(value: string | undefined): HomeTab {
  const candidate = value?.toLowerCase();
  return HOME_TABS.some((tab) => tab.key === candidate)
    ? (candidate as HomeTab)
    : DEFAULT_HOME_TAB;
}

export function parseVersusMode(value: string | undefined): 'participant' | 'general' {
  return value === 'general' ? 'general' : 'participant';
}
