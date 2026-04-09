import { HomeShell } from '@/components/home/home-shell';
import { getPoolAppData } from '@/data/providers';
import { getSingleParam, parseHomeTab, resolveSearchParams } from '@/lib/query';

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const appData = await getPoolAppData();
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const activeTab = parseHomeTab(getSingleParam(resolvedSearchParams.tab));

  return <HomeShell appData={appData} activeTab={activeTab} />;
}
