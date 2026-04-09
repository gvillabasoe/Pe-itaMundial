import type { PoolAppData } from '@/types/domain';

export interface PoolDataProvider {
  getAppData(): Promise<PoolAppData>;
}
