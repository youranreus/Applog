# AppLog 数据迁移功能

## 概述

AppLog 提供了完整的数据迁移功能，可以从其他博客系统（如 Typecho）迁移数据。该功能采用适配器模式设计，便于扩展支持更多的数据源。

## 功能特性

✅ **支持的数据源**
- Typecho 博客系统

🏗️ **架构特点**
- 适配器模式：易于扩展新的数据源
- 事务保护：确保数据一致性
- 关系映射：自动处理数据关联
- 类型安全：完整的 TypeScript 类型定义

📊 **迁移数据**
- 用户数据（角色映射）
- 文章数据（包括标签）
- 页面数据
- 评论数据（包括回复关系）

## 快速开始

### 1. API 接口

**接口地址**: `POST /config/migrate`

**权限要求**: 管理员权限

### 2. 请求示例

```bash
curl -X POST http://localhost:3000/config/migrate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "sourceType": "typecho",
    "host": "localhost",
    "port": 3306,
    "username": "root",
    "password": "password",
    "database": "typecho_db",
    "tablePrefix": "typecho_"
  }'
```

### 3. 响应示例

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

## 代码结构

```
packages/backend/src/module/system-config/
├── migration/                                    # 迁移模块
│   ├── types.ts                                 # 类型定义
│   ├── adapters/                                # 适配器实现
│   │   ├── base-migration.adapter.ts           # 适配器基类
│   │   ├── typecho-migration.adapter.ts        # Typecho 适配器
│   │   ├── adapter-factory.ts                  # 适配器工厂
│   │   └── index.ts
│   ├── index.ts
│   └── README.md                                # 详细文档
├── dto/
│   ├── migrate-data.dto.ts                      # 迁移请求 DTO
│   └── migration-result.dto.ts                  # 迁移结果 DTO
├── system-config.controller.ts                  # 迁移接口
└── system-config.service.ts                     # 迁移业务逻辑
```

## 核心组件

### 1. 适配器接口 (IMigrationAdapter)

定义了所有迁移适配器必须实现的方法：

```typescript
interface IMigrationAdapter {
  getType(): MigrationSourceType;
  validateSource(config: IDatabaseConfig): Promise<boolean>;
  migrate(
    sourceConfig: IDatabaseConfig,
    targetDataSource: DataSource,
    logger: HLogger,
  ): Promise<IMigrationResult>;
}
```

### 2. 适配器基类 (BaseMigrationAdapter)

提供通用的日志记录和错误处理功能：

```typescript
abstract class BaseMigrationAdapter implements IMigrationAdapter {
  protected log(message: string): void;
  protected warn(message: string): void;
  protected error(message: string): void;
  protected createFailureResult(error: string, duration: number): IMigrationResult;
  protected createSuccessResult(counts: {...}, duration: number): IMigrationResult;
}
```

### 3. Typecho 适配器 (TypechoMigrationAdapter)

实现 Typecho 博客系统的数据迁移逻辑：

- ✅ 用户迁移（角色映射）
- ✅ 文章迁移（包括标签）
- ✅ 页面迁移
- ✅ 评论迁移（包括回复关系）
- ✅ 数据关系映射

### 4. 适配器工厂 (MigrationAdapterFactory)

根据迁移源类型创建对应的适配器实例：

```typescript
const adapter = MigrationAdapterFactory.create('typecho');
```

## Typecho 迁移详情

### 数据库表映射

| Typecho 表          | AppLog 表      | 说明           |
| ------------------- | -------------- | -------------- |
| typecho_users       | users          | 用户数据       |
| typecho_contents    | posts / pages  | 文章和页面     |
| typecho_comments    | comments       | 评论数据       |
| typecho_metas       | -              | 标签/分类元数据|
| typecho_relationships| -             | 内容与标签关系 |

### 字段映射规则

详细的字段映射规则请参考：[migration/README.md](./src/module/system-config/migration/README.md)

### 迁移流程

```
1. 验证源数据库连接和表结构
   ↓
2. 开启数据库事务
   ↓
3. 迁移用户数据（记录 ID 映射）
   ↓
4. 加载元数据（标签、分类）
   ↓
5. 迁移文章和页面（关联标签）
   ↓
6. 迁移评论（处理回复关系）
   ↓
7. 提交事务（失败则回滚）
```

## 使用注意事项

### ⚠️ 重要提示

1. **数据备份**: 迁移前请务必备份目标数据库
2. **权限要求**: 仅管理员可执行迁移操作
3. **网络连接**: 确保应用服务器可以访问源数据库
4. **时间估计**: 大量数据迁移可能需要较长时间
5. **事务保护**: 迁移失败会自动回滚，不会产生脏数据
6. **数据重复**: 重复执行迁移会导致数据重复

### 性能建议

- 在低峰期执行迁移
- 监控服务器资源使用情况
- 对于超大数据量，考虑分批迁移

## 扩展支持新的数据源

### 步骤

1. **创建适配器类**
   ```typescript
   export class NewSystemAdapter extends BaseMigrationAdapter {
     getType() { return 'newsystem' as const; }
     async validateSource(config) { ... }
     async migrate(config, dataSource, logger) { ... }
   }
   ```

2. **更新类型定义**
   ```typescript
   export type MigrationSourceType = 'typecho' | 'newsystem';
   ```

3. **注册到工厂**
   ```typescript
   case 'newsystem':
     return new NewSystemAdapter();
   ```

4. **添加文档和测试**

详细的扩展指南请参考：[migration/README.md](./src/module/system-config/migration/README.md)

## 测试

### 单元测试

```bash
# 运行迁移模块测试
pnpm test:migration
```

### 集成测试

1. 准备测试数据库
2. 配置测试环境变量
3. 执行迁移测试脚本

## 常见问题

### Q: 迁移失败后数据会残留吗？

A: 不会。迁移使用数据库事务保护，失败时会自动回滚所有操作。

### Q: 支持增量迁移吗？

A: 目前不支持。每次迁移都是全量迁移，建议在空数据库上执行。

### Q: 迁移过程可以中断吗？

A: 不建议中断。如果必须中断，事务会回滚，需要重新执行完整迁移。

### Q: 如何处理迁移中的错误数据？

A: 适配器会记录详细的警告日志，跳过无法迁移的数据。检查日志可以了解具体情况。

### Q: 迁移后原系统的 ID 会保留吗？

A: 不会。系统会分配新的 ID，但原 ID 会保存在 extra 字段中供参考。

## 技术栈

- **NestJS**: 后端框架
- **TypeORM**: ORM 框架
- **TypeScript**: 开发语言
- **MySQL**: 数据库

## 相关文档

- [迁移模块详细文档](./src/module/system-config/migration/README.md)
- [API 文档](./docs/api.md)
- [开发指南](./docs/development.md)

## 贡献

欢迎提交新的数据源适配器！请遵循项目的代码规范和提交规范。

## 许可证

MIT License
