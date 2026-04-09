import { demoProvider } from '@/data/providers/demo-provider';

export async function getPoolAppData() {
  return demoProvider.getAppData();
}
