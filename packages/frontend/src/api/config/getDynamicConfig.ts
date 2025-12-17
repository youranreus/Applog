import { alovaInstance } from '@/utils/alova';

export const getDynamicConfig = <T>(key: string) => {
  return alovaInstance.Get<T | null>(`https://mdb.exia.xyz/config/get?slug=${key}`, { cacheFor: null });
};
