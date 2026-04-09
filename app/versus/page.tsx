import { VersusPage } from '@/components/versus/versus-page';
import { getPoolAppData } from '@/data/providers';
import { getSingleParam, parseVersusMode, resolveSearchParams } from '@/lib/query';

interface VersusRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VersusRoute({ searchParams }: VersusRouteProps) {
  const appData = await getPoolAppData();
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const mode = parseVersusMode(getSingleParam(resolvedSearchParams.mode));

  const fallbackLeft = appData.participants[0] ?? null;
  const fallbackRight = appData.participants.find((item) => item.participantId !== fallbackLeft?.participantId) ?? fallbackLeft;

  const leftSlug = getSingleParam(resolvedSearchParams.a) ?? fallbackLeft?.participantSlug;
  const rightSlug = getSingleParam(resolvedSearchParams.b) ?? fallbackRight?.participantSlug;

  const left = appData.participants.find((item) => item.participantSlug === leftSlug) ?? fallbackLeft;
  const right = appData.participants.find((item) => item.participantSlug === rightSlug && item.participantId !== left?.participantId)
    ?? fallbackRight;

  return <VersusPage appData={appData} left={left} right={right} mode={mode} />;
}
