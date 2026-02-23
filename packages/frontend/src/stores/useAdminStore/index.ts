import { defineStore } from 'pinia';
import { useAdminPostListService } from './useAdminPostListService';

/**
 * 后台管理 Store
 * 采用分模块设计，组合各业务子模块，便于扩展（如后续添加页面管理等）
 */
export const useAdminStore = defineStore('admin', () => {
  const postListService = useAdminPostListService();

  return { postListService };
});
