/**
 * 用户角色类型
 */
export type UserRole = 'admin' | 'user';

/**
 * 用户角色常量
 */
export const USER_ROLES = {
  ADMIN: 'admin' as const,
  USER: 'user' as const,
} as const;

/**
 * 将系统角色（字符串）转换为 JWT 角色（数字）
 * 符合 @reus-able/types 中 UserRole 枚举定义：ADMIN = 0, USER = 1
 * @param role 系统角色（'admin' 或 'user'）
 * @returns JWT 角色数字（0 = admin, 1 = user）
 */
export function mapUserRoleToJwtRole(role: UserRole): number {
  return role === USER_ROLES.ADMIN ? 0 : 1;
}
