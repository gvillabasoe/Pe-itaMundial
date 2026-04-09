import type { PoolDataProvider } from '@/data/providers/types';
import { demoAppData } from '@/data/demo/app-data';

export const demoProvider: PoolDataProvider = {
  async getAppData() {
    return demoAppData;
  },
};
