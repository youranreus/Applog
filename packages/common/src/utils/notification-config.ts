import { NOTIFICATION_MAIL_TOKEN_MASK } from '../constants/system-config.js';
import type { INotificationConfig } from '../types/system-config.js';

export function normalizeNotificationConfig(
  config: Partial<INotificationConfig> | null | undefined,
): INotificationConfig {
  return {
    mailToken: typeof config?.mailToken === 'string' ? config.mailToken.trim() : '',
    enabled: config?.enabled === true,
  };
}

export function maskNotificationMailToken(
  config: INotificationConfig,
): INotificationConfig {
  const normalized = normalizeNotificationConfig(config);
  return {
    ...normalized,
    mailToken: normalized.mailToken ? NOTIFICATION_MAIL_TOKEN_MASK : '',
  };
}

export function shouldKeepExistingNotificationMailToken(
  mailToken: string | undefined,
): boolean {
  const value = (mailToken || '').trim();
  return value === '' || value === NOTIFICATION_MAIL_TOKEN_MASK;
}
