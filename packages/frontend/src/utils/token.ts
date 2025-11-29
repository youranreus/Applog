import localforage from 'localforage';

/**
 * Token 存储 key
 */
const TOKEN_KEY = 'user_token';

/**
 * 内存缓存 token
 */
let cachedToken: string | null = null;

/**
 * 初始化：尝试从 storage 读取 token 到缓存
 * 注意：这个过程是异步的，通常不需要显式调用，getToken 会自动处理
 */
async function initTokenCache(): Promise<void> {
  try {
    cachedToken = await localforage.getItem<string>(TOKEN_KEY);
  } catch (error) {
    console.error('初始化 token 缓存失败:', error);
  }
}

/**
 * 获取存储的 token
 * 优先从内存缓存获取，如果没有则从 storage 获取
 * @returns Promise<string | null> token 字符串或 null
 */
export async function getToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }
  try {
    cachedToken = await localforage.getItem<string>(TOKEN_KEY);
    return cachedToken;
  } catch (error) {
    console.error('获取 token 失败:', error);
    return null;
  }
}

/**
 * 保存 token 到本地存储
 * 同时更新内存缓存
 * @param token - 要保存的 token
 * @returns Promise<void>
 */
export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  try {
    await localforage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('保存 token 失败:', error);
    throw error;
  }
}

/**
 * 清除存储的 token
 * 同时清除内存缓存
 * @returns Promise<void>
 */
export async function clearToken(): Promise<void> {
  cachedToken = null;
  try {
    await localforage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('清除 token 失败:', error);
  }
}

