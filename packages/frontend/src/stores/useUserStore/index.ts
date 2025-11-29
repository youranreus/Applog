import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useRequest } from 'alova/client';
import localforage from 'localforage';
import type {
  IUserResponseDto,
  ISsoCallbackParams,
} from '@/types/user';
import { exchangeSsoToken, getUserInfo } from '@/api/user';
import { getToken, setToken, clearToken } from '@/utils/token';

/**
 * 用户信息存储 key
 */
const USER_INFO_KEY = 'user_info';

/**
 * 用户 Store
 * 管理用户认证状态、用户信息和 token
 * 支持 SSO 单点登录，使用 localforage 进行本地持久化存储
 */
export const useUserStore = defineStore('user', () => {
  /**
   * 当前用户信息
   */
  const user = ref<IUserResponseDto | null>(null);

  /**
   * JWT token
   */
  const token = ref<string | null>(null);

  /**
   * 加载状态
   */
  const loading = ref<boolean>(false);

  /**
   * 是否已登录
   * 当 user 和 token 都存在时返回 true
   */
  const isAuthenticated = computed<boolean>(() => {
    return !!(user.value && token.value);
  });

  /**
   * 从 localforage 恢复用户信息
   * @returns Promise<void>
   */
  async function restoreUserInfo(): Promise<void> {
    try {
      const storedUser = await localforage.getItem<IUserResponseDto>(USER_INFO_KEY);
      if (storedUser) {
        user.value = storedUser;
      }
    } catch (error) {
      console.error('恢复用户信息失败:', error);
    }
  }

  /**
   * 保存用户信息到 localforage
   * @param userInfo - 用户信息
   * @returns Promise<void>
   */
  async function saveUserInfo(userInfo: IUserResponseDto): Promise<void> {
    try {
      await localforage.setItem(USER_INFO_KEY, userInfo);
      user.value = userInfo;
    } catch (error) {
      console.error('保存用户信息失败:', error);
      throw error;
    }
  }

  /**
   * 清除所有认证信息（内部方法）
   * @returns Promise<void>
   */
  async function clearAuth(): Promise<void> {
    user.value = null;
    token.value = null;
    try {
      await Promise.all([
        clearToken(),
        localforage.removeItem(USER_INFO_KEY),
      ]);
    } catch (error) {
      console.error('清除认证信息失败:', error);
    }
  }

  /**
   * 初始化认证状态
   * 从 localforage 恢复 token 和用户信息
   * 如果 token 存在但用户信息不存在，尝试获取用户信息
   * @returns Promise<void>
   */
  async function initializeAuth(): Promise<void> {
    loading.value = true;
    try {
      // 恢复 token
      const storedToken = await getToken();
      if (storedToken) {
        token.value = storedToken;
      }

      // 恢复用户信息
      await restoreUserInfo();

      // 如果 token 存在但用户信息不存在，尝试获取用户信息
      if (token.value && !user.value) {
        await fetchUserInfo();
      }
    } catch (error) {
      console.error('初始化认证状态失败:', error);
      // 如果初始化失败，清除可能存在的无效 token
      await clearAuth();
    } finally {
      loading.value = false;
    }
  }

  /**
   * 跳转到 SSO 登录页面
   * 拼接 client_id 和 callback_url 参数
   * @returns void
   */
  function login(): void {
    const ssoLoginUrl = import.meta.env.VITE_SSO_LOGIN_URL;
    const callbackUrl = import.meta.env.VITE_SSO_CALLBACK_URL;
    const clientId = import.meta.env.VITE_SSO_CLIENT_ID;

    if (!ssoLoginUrl || !callbackUrl || !clientId) {
      throw new Error('SSO 配置不完整，请检查环境变量');
    }

    // 构建 SSO 登录 URL，使用字符串拼接所有参数
    const url = new URL(ssoLoginUrl);
    const baseUrl = `${url.origin}${url.pathname}`;
    const existingSearch = url.search; // 保留原有的查询参数（包含 ? 或为空）
    const hash = url.hash; // 保留原有的 hash
    
    // 手动拼接所有查询参数，不进行 URL 编码
    const params = [
      `client_id=${clientId}`,
      `response_type=code`,
      `redirect_uri=${callbackUrl}`,
    ];
    
    // 根据是否已有查询参数决定连接符
    const queryString = existingSearch
      ? `${existingSearch}&${params.join('&')}`
      : `?${params.join('&')}`;
    const finalUrl = `${baseUrl}${queryString}${hash}`;

    // 跳转到 SSO 登录页面
    window.location.href = finalUrl;
  }

  /**
   * SSO ticket（用于交换 token 的请求）
   */
  const ssoTicket = ref<string | null>(null);

  /**
   * 使用 alova 的 useRequest 交换 SSO ticket 为 token
   * 接口路径: GET /user/login
   * 响应拦截器会自动提取 data 字段，返回 ILoginResponseDto 类型
   * 
   * 逻辑说明：
   * 1. 使用函数形式传入请求方法，接受 ticket 参数
   * 2. 设置为 immediate: false，需要手动调用 send 触发请求
   */
  const {
    send: exchangeToken,
  } = useRequest(
    (ticket: string) => {
      return exchangeSsoToken(ticket);
    },
    {
      immediate: false, // 不立即请求，需要手动触发
    },
  );

  /**
   * 处理 SSO 回调
   * 从 URL 参数中获取 ticket，调用后端接口交换 token，然后获取用户信息
   * @param params - SSO 回调参数（包含 ticket）
   * @returns Promise<void>
   * @throws {Error} 当 SSO 回调处理失败时抛出异常
   */
  async function handleSsoCallback(params: ISsoCallbackParams): Promise<void> {
    loading.value = true;
    try {
      // 从 URL 参数中获取 ticket（后端使用 ticket 而不是 code）
      const ticket = params.code; // SSO 返回的 code 就是后端的 ticket

      if (!ticket) {
        throw new Error('缺少 SSO ticket 参数');
      }

      // 设置 ticket 状态
      ssoTicket.value = ticket;
      
      // 手动触发请求，传入 ticket
      const response = await exchangeToken(ticket);

      if (!response) {
        throw new Error('SSO 登录失败：未获取到有效响应');
      }

      // alova 响应拦截器已经提取了 data 字段，直接使用响应数据
      const { token: newToken, user: userInfo } = response;

      if (!newToken || !userInfo) {
        throw new Error('SSO 登录失败：响应数据不完整');
      }

      // 保存 token 和用户信息
      await Promise.all([
        setToken(newToken),
        saveUserInfo(userInfo),
      ]);

      token.value = newToken;
    } catch (error) {
      console.error('处理 SSO 回调失败:', error);
      await clearAuth();
      throw error;
    } finally {
      loading.value = false;
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
  const {
    send: fetchUserInfoRequest,
  } = useRequest(getUserInfo, {
    immediate: false, // 不立即请求，需要手动触发
  });

  /**
   * 获取当前用户信息
   * 调用后端 API 获取用户信息并更新本地状态
   * @returns Promise<IUserResponseDto>
   * @throws {Error} 当获取用户信息失败时抛出异常
   */
  async function fetchUserInfo(): Promise<IUserResponseDto> {
    if (!token.value) {
      throw new Error('未登录，无法获取用户信息');
    }

    loading.value = true;
    try {
      const response = await fetchUserInfoRequest();

      if (!response) {
        throw new Error('获取用户信息失败：未获取到有效响应');
      }

      // alova 响应拦截器已经提取了 data 字段，直接使用响应数据
      const userInfo = response;
      await saveUserInfo(userInfo);

      return userInfo;
    } catch (error) {
      console.error('获取用户信息失败:', error);
      // 如果获取用户信息失败（可能是 token 过期），清除认证信息
      await clearAuth();
      throw error;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 用户登出
   * 清除本地状态和存储，然后跳转到 SSO 登出页面（如果有配置）
   * @returns Promise<void>
   */
  async function logout(): Promise<void> {
    loading.value = true;
    try {
      // 清除本地认证信息
      await clearAuth();

      // 如果配置了 SSO 登出 URL，跳转到 SSO 登出页面
      const ssoLogoutUrl = import.meta.env.VITE_SSO_LOGOUT_URL;
      if (ssoLogoutUrl) {
        window.location.href = ssoLogoutUrl;
      }
    } catch (error) {
      console.error('登出失败:', error);
    } finally {
      loading.value = false;
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
    handleSsoCallback,
    fetchUserInfo,
    logout,
  };
});

