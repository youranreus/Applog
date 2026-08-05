import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useRequest } from 'alova/client'
import localforage from 'localforage'
import type { IUserResponseDto } from '@/types/user'
import { completeOidcLogin, getUserInfo } from '@/api/user'
import { API_BASE_URL } from '@/utils/api-url'
import { getToken, setToken, clearToken } from '@/utils/token'

/**
 * 用户信息存储 key
 */
const USER_INFO_KEY = 'user_info'

/**
 * 用户 Store
 * 管理用户认证状态、用户信息和 token
 * 支持后端托管的 OIDC 登录，使用 localforage 进行本地持久化存储
 */
export const useUserStore = defineStore('user', () => {
  /**
   * 当前用户信息
   */
  const user = ref<IUserResponseDto | null>(null)

  /**
   * JWT token
   */
  const token = ref<string | null>(null)

  /**
   * 加载状态
   */
  const loading = ref<boolean>(false)

  /**
   * 是否已登录
   * 当 user 和 token 都存在时返回 true
   */
  const isAuthenticated = computed<boolean>(() => {
    return !!(user.value && token.value)
  })

  /**
   * 从 localforage 恢复用户信息
   * @returns Promise<void>
   */
  async function restoreUserInfo(): Promise<void> {
    try {
      const storedUser = await localforage.getItem<IUserResponseDto>(USER_INFO_KEY)
      if (storedUser) {
        user.value = storedUser
      }
    } catch (error) {
      console.error('恢复用户信息失败:', error)
    }
  }

  /**
   * 保存用户信息到 localforage
   * @param userInfo - 用户信息
   * @returns Promise<void>
   */
  async function saveUserInfo(userInfo: IUserResponseDto): Promise<void> {
    try {
      await localforage.setItem(USER_INFO_KEY, userInfo)
      user.value = userInfo
    } catch (error) {
      console.error('保存用户信息失败:', error)
      throw error
    }
  }

  /**
   * 清除所有认证信息（内部方法）
   * @returns Promise<void>
   */
  async function clearAuth(): Promise<void> {
    user.value = null
    token.value = null
    try {
      await Promise.all([clearToken(), localforage.removeItem(USER_INFO_KEY)])
    } catch (error) {
      console.error('清除认证信息失败:', error)
    }
  }

  /**
   * 初始化认证状态
   * 从 localforage 恢复 token 和用户信息
   * 如果 token 存在，无论用户信息是否存在，都调用接口验证 token 有效性并获取最新用户信息
   * @returns Promise<void>
   */
  async function initializeAuth(): Promise<void> {
    loading.value = true
    try {
      // 恢复 token
      const storedToken = await getToken()
      if (storedToken) {
        token.value = storedToken
      }

      // 恢复用户信息（仅用于初始显示，后续会通过接口验证）
      await restoreUserInfo()

      // 如果 token 存在，无论用户信息是否存在，都调用接口验证 token 有效性
      if (token.value) {
        await fetchUserInfo()
      }
    } catch (error) {
      console.error('初始化认证状态失败:', error)
      // 如果初始化失败，清除可能存在的无效 token
      await clearAuth()
    } finally {
      loading.value = false
    }
  }

  /**
   * 跳转到后端托管的 OIDC 登录入口
   * 将规范化的站内返回路径绑定到服务端 transaction
   * @returns void
   */
  function login(returnPath = '/'): void {
    const loginUrl = new URL(`${API_BASE_URL}/user/oidc/login`, window.location.origin)
    loginUrl.searchParams.set('returnPath', returnPath)
    window.location.href = loginUrl.toString()
  }

  /**
   * 使用一次性完成会话获取 Applog token
   * 接口路径: POST /user/oidc/complete
   * 响应拦截器会自动提取 data 字段，返回 ILoginResponseDto 类型
   *
   * 逻辑说明：
   * 使用 immediate: false，等待 callback 页面手动消费一次性 completion
   */
  const { send: exchangeToken } = useRequest(() => completeOidcLogin(), {
    immediate: false, // 不立即请求，需要手动触发
  })

  /**
   * 处理 OIDC 完成回调
   * 上游授权码已由后端处理，此处只消费加密完成会话。
   * @returns Promise<void>
   * @throws {Error} 当 OIDC completion 处理失败时抛出异常
   */
  async function handleOidcCallback(): Promise<void> {
    loading.value = true
    try {
      const response = await exchangeToken()

      if (!response) {
        throw new Error('OIDC 登录失败：未获取到有效响应')
      }

      // alova 响应拦截器已经提取了 data 字段，直接使用响应数据
      const { token: newToken, user: userInfo } = response

      if (!newToken || !userInfo) {
        throw new Error('OIDC 登录失败：响应数据不完整')
      }

      // 保存 token 和用户信息
      await Promise.all([setToken(newToken), saveUserInfo(userInfo)])

      token.value = newToken
    } catch (error) {
      console.error('处理 OIDC 回调失败:', error)
      await clearAuth()
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 使用 alova 的 useRequest 获取当前用户信息
   * 接口路径: GET /user/data
   * 响应拦截器会自动提取 data 字段，返回 IUserResponseDto 类型
   *
   * 逻辑说明：
   * 1. 使用函数形式传入请求方法
   * 2. 设置为 immediate: false，需要手动调用 send 触发请求
   * 3. 请求需要携带 JWT token（由请求拦截器自动添加）
   */
  const { send: fetchUserInfoRequest } = useRequest(getUserInfo, {
    immediate: false, // 不立即请求，需要手动触发
  })

  /**
   * 获取当前用户信息
   * 调用后端 API 获取用户信息并更新本地状态
   * @returns Promise<IUserResponseDto>
   * @throws {Error} 当获取用户信息失败时抛出异常
   */
  async function fetchUserInfo(): Promise<IUserResponseDto> {
    if (!token.value) {
      throw new Error('未登录，无法获取用户信息')
    }

    loading.value = true
    try {
      const response = await fetchUserInfoRequest()

      if (!response) {
        throw new Error('获取用户信息失败：未获取到有效响应')
      }

      // alova 响应拦截器已经提取了 data 字段，直接使用响应数据
      const userInfo = response
      await saveUserInfo(userInfo)

      return userInfo
    } catch (error) {
      console.error('获取用户信息失败:', error)
      // 如果获取用户信息失败（可能是 token 过期），清除认证信息
      await clearAuth()
      throw error
    } finally {
      loading.value = false
    }
  }

  /**
   * 用户登出
   * 清除本地认证状态和存储
   * @returns Promise<void>
   */
  async function logout(): Promise<void> {
    loading.value = true
    try {
      // 清除本地认证信息
      await clearAuth()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      loading.value = false
    }
  }

  return {
    // 状态
    user,
    token,
    loading,
    isAuthenticated,
    // 方法
    initializeAuth,
    login,
    handleOidcCallback,
    fetchUserInfo,
    logout,
  }
})
