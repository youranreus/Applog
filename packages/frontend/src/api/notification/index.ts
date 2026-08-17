import type { INotificationConfig } from '@applog/common';
import { alovaInstance } from '@/utils/alova';

export const getNotificationConfig = () =>
  alovaInstance.Get<INotificationConfig>('/notification/config');

export const setNotificationConfig = (payload: INotificationConfig) =>
  alovaInstance.Put<INotificationConfig>('/notification/config', payload);
