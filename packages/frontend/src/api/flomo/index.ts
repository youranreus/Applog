import type {
  IFlomoAdminConfig,
  IFlomoAdminStatus,
  IFlomoConfig,
  IFlomoPublicMemoPage,
  IFlomoSyncTriggerResult,
} from '@applog/common'
import { alovaInstance } from '@/utils/alova'

/** Public database-only notes page. */
export const getFlomoNotes = (cursor?: string) =>
  alovaInstance.Get<IFlomoPublicMemoPage>('/flomo/notes', {
    params: cursor ? { cursor } : undefined,
  })

/** Admin-only masked Flomo configuration. */
export const getFlomoConfig = () => alovaInstance.Get<IFlomoAdminConfig>('/flomo/config')

/** Admin-only Flomo publication policy update. */
export const setFlomoConfig = (payload: IFlomoConfig) =>
  alovaInstance.Put<IFlomoAdminConfig>('/flomo/config', payload)

/** Admin-only credential-free polling status. */
export const getFlomoStatus = () => alovaInstance.Get<IFlomoAdminStatus>('/flomo/status')

/** Bodyless JSON POSTs must still send a valid empty object to Fastify. */
export const syncFlomoNow = () =>
  alovaInstance.Post<IFlomoSyncTriggerResult>('/flomo/sync', {})
