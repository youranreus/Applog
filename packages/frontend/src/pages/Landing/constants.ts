/**
 * 兼容旧系统配置缺少 Landing 字段时使用的稳定默认内容。
 * 管理后台显式保存空字符串后，对应内容会隐藏。
 */
export const LANDING_DEFAULTS = {
  bio: '生活在深圳的软件工程师。这里记录日常生活里的观察，也留下阅读、旅行和持续探索过程中产生的想法。',
  slogan: '更新得不算快，但希望每一篇都值得安静地读一会儿。',
  personalHomepageUrl: '/about.html',
  githubUrl: 'https://github.com/youranreus',
} as const;
