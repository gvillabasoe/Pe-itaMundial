import { ClassificationView } from '@/components/home/classification-view';
import { HomeHeader } from '@/components/home/home-header';
import { HomeTabs } from '@/components/home/home-tabs';
import { ResultsView } from '@/components/home/results-view';
import { StatsView } from '@/components/home/stats-view';
import type { HomeTab, PoolAppData } from '@/types/domain';

interface HomeShellProps {
  appData: PoolAppData;
  activeTab: HomeTab;
}

export function HomeShell({ appData, activeTab }: HomeShellProps) {
  return (
    <div className="pageStack">
      <HomeHeader appData={appData} />
      <HomeTabs activeTab={activeTab} />

      {activeTab === 'clasificacion' ? (
        <ClassificationView standings={appData.standings} stats={appData.homeStats} teams={appData.teams} />
      ) : null}
      {activeTab === 'resultados' ? <ResultsView matches={appData.matches} teams={appData.teams} /> : null}
      {activeTab === 'estadisticas' ? <StatsView stats={appData.homeStats} teams={appData.teams} matches={appData.matches} /> : null}
    </div>
  );
}
