# 数据迁移模块

本模块实现了从其他博客系统迁移数据到 AppLog 系统的功能，采用适配器模式设计，方便扩展支持更多的数据源。

## 功能特点

- 🔌 **适配器模式**：易于扩展新的数据源类型
- 🔒 **事务保护**：使用数据库事务确保数据一致性
- 📊 **迁移统计**：提供详细的迁移结果统计
- ⚡ **关系映射**：自动处理用户、文章、评论等数据的关联关系
- 🎯 **类型安全**：完整的 TypeScript 类型定义

## 目前支持的数据源

- ✅ **Typecho**：开源博客系统

## 架构设计

### 核心组件

1. **IMigrationAdapter** - 迁移适配器接口
2. **BaseMigrationAdapter** - 适配器抽象基类
3. **TypechoMigrationAdapter** - Typecho 适配器实现
4. **MigrationAdapterFactory** - 适配器工厂

### 目录结构

```
migration/
├── types.ts                          # 类型定义
├── adapters/
│   ├── base-migration.adapter.ts    # 适配器基类
│   ├── typecho-migration.adapter.ts # Typecho 适配器
│   ├── adapter-factory.ts           # 适配器工厂
│   └── index.ts
├── index.ts
└── README.md
```

## API 使用说明

### 接口地址

```
POST /config/migrate
```

### 请求权限

需要管理员权限（`@AuthRoles('admin')`）

### 请求参数

| 参数名       | 类型   | 必填 | 说明                              |
| ------------ | ------ | ---- | --------------------------------- |
| sourceType   | string | 是   | 迁移源类型，目前仅支持 `typecho`  |
| host         | string | 是   | 源数据库主机地址                  |
| port         | number | 是   | 源数据库端口                      |
| username     | string | 是   | 源数据库用户名                    |
| password     | string | 是   | 源数据库密码                      |
| database     | string | 是   | 源数据库名称                      |
| tablePrefix  | string | 否   | 表前缀（默认：`typecho_`）        |

### 请求示例

```json
{
  "sourceType": "typecho",
  "host": "localhost",
  "port": 3306,
  "username": "root",
  "password": "password",
  "database": "typecho_db",
  "tablePrefix": "typecho_"
}
```

### 响应参数

| 参数名        | 类型    | 说明                           |
| ------------- | ------- | ------------------------------ |
| success       | boolean | 迁移是否成功                   |
| message       | string  | 提示消息                       |
| usersCount    | number  | 迁移的用户数量                 |
| postsCount    | number  | 迁移的文章数量                 |
| pagesCount    | number  | 迁移的页面数量                 |
| commentsCount | number  | 迁移的评论数量                 |
| duration      | number  | 迁移耗时（毫秒）               |
| error         | string  | 错误信息（仅在失败时返回）     |

### 成功响应示例

```json
{
  "success": true,
  "message": "数据迁移成功完成",
  "usersCount": 5,
  "postsCount": 120,
  "pagesCount": 8,
  "commentsCount": 356,
  "duration": 12500
}
```

### 失败响应示例

```json
{
  "success": false,
  "message": "数据迁移失败",
  "usersCount": 0,
  "postsCount": 0,
  "pagesCount": 0,
  "commentsCount": 0,
  "duration": 1200,
  "error": "源数据库连接失败或表结构不正确"
}
```

## Typecho 迁移说明

### 数据映射关系

#### 用户映射

| Typecho 字段 | AppLog 字段 | 说明                        |
| ------------ | ----------- | --------------------------- |
| uid          | ssoId       | 使用原 uid 作为 ssoId       |
| screenName   | name        | 显示名称                    |
| mail         | email       | 邮箱地址                    |
| group        | role        | administrator -> admin      |
| created      | createdAt   | 时间戳转换为 Date 对象      |

#### 文章/页面映射

| Typecho 字段  | AppLog 字段 | 说明                                |
| ------------- | ----------- | ----------------------------------- |
| cid           | -           | 保存在 extra.typechoId              |
| title         | title       | 标题                                |
| text          | content     | 内容                                |
| slug          | -           | 保存在 extra.slug                   |
| status        | status      | publish->published, draft->draft    |
| allowComment  | -           | 保存在 extra.allowComment           |
| created       | createdAt   | 时间戳转换                          |
| modified      | updatedAt   | 时间戳转换                          |

#### 评论映射

| Typecho 字段 | AppLog 字段  | 说明                                  |
| ------------ | ------------ | ------------------------------------- |
| coid         | -            | 保存在 extra.typechoId                |
| text         | content      | 评论内容                              |
| author       | guestName    | 游客名称（authorId=0 时）             |
| mail         | guestEmail   | 游客邮箱                              |
| url          | guestSite    | 游客网站                              |
| ip           | ip           | IP 地址                               |
| status       | status       | approved->approved, waiting->pending  |
| created      | createdAt    | 时间戳转换                            |
| parent       | parentId     | 父评论 ID                             |

### 迁移流程

1. **验证源数据库**
   - 检查数据库连接
   - 验证必需表是否存在

2. **迁移用户数据**
   - 读取 `typecho_users` 表
   - 创建用户并记录 ID 映射关系

3. **加载元数据**
   - 读取 `typecho_metas` 表（标签、分类）
   - 存储到内存 Map 供后续使用

4. **迁移内容数据**
   - 读取 `typecho_contents` 表
   - 根据 type 字段区分文章和页面
   - 关联标签信息
   - 创建文章/页面实体

5. **迁移评论数据**
   - 读取 `typecho_comments` 表
   - 第一轮：创建所有评论
   - 第二轮：更新父评论关系

6. **提交事务**
   - 所有操作成功后提交事务
   - 失败时自动回滚

### 注意事项

⚠️ **重要提示**

1. **数据备份**：迁移前请先备份目标数据库
2. **权限要求**：需要管理员权限才能执行迁移
3. **网络连接**：确保应用服务器能够访问源数据库
4. **时间估计**：大量数据迁移可能需要较长时间
5. **事务保护**：迁移失败会自动回滚，不会产生脏数据

## 扩展新的数据源

### 1. 创建适配器类

```typescript
// migration/adapters/wordpress-migration.adapter.ts
import { BaseMigrationAdapter } from './base-migration.adapter';

export class WordPressMigrationAdapter extends BaseMigrationAdapter {
  getType() {
    return 'wordpress' as const;
  }

  async validateSource(sourceConfig: IDatabaseConfig): Promise<boolean> {
    // 实现验证逻辑
  }

  async migrate(
    sourceConfig: IDatabaseConfig,
    targetDataSource: DataSource,
    logger: HLogger,
  ): Promise<IMigrationResult> {
    // 实现迁移逻辑
  }
}
```

### 2. 更新类型定义

```typescript
// migration/types.ts
export type MigrationSourceType = 'typecho' | 'wordpress';
```

### 3. 注册到工厂

```typescript
// migration/adapters/adapter-factory.ts
static create(type: MigrationSourceType): IMigrationAdapter {
  switch (type) {
    case 'typecho':
      return new TypechoMigrationAdapter();
    case 'wordpress':
      return new WordPressMigrationAdapter();
    default:
      throw new Error(`不支持的迁移类型: ${type}`);
  }
}
```

## 开发调试

### 本地测试

1. 准备 Typecho 测试数据库
2. 使用 Postman 或 curl 发送请求
3. 查看日志输出和迁移结果

### 日志记录

适配器会记录详细的迁移日志：

- ✅ 各阶段的进度信息
- ⚠️ 跳过的数据和原因
- ❌ 错误信息和堆栈

## 性能优化建议

1. **批量操作**：使用批量插入减少数据库交互次数
2. **索引优化**：确保关联字段有合适的索引
3. **分批迁移**：对于超大数据量，可以考虑分批次迁移
4. **连接池**：合理配置数据库连接池大小

## 常见问题

### Q: 迁移失败后数据会残留吗？

A: 不会。迁移使用事务保护，失败时会自动回滚。

### Q: 可以重复执行迁移吗？

A: 可以，但会导致数据重复。建议先清空目标表再执行。

### Q: 迁移过程中可以中断吗？

A: 不建议。如果必须中断，事务会回滚，需要重新执行。

### Q: 如何处理大量数据？

A: 对于数据量特别大的场景，建议在低峰期执行，并监控服务器资源。

## 贡献指南

欢迎提交新的数据源适配器！请遵循以下步骤：

1. Fork 项目
2. 创建适配器类并实现接口
3. 添加单元测试
4. 更新文档
5. 提交 Pull Request
