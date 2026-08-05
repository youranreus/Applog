import { alovaInstance } from '@/utils/alova'
import type { ILoginResponseDto } from '@/types/user'

export const completeOidcLogin = () =>
  alovaInstance.Post<ILoginResponseDto>('/user/oidc/complete', {}, {
    credentials: 'include',
  })
