import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../src/entities/User';
import { UserService } from '../src/module/user/user.service';

type IdentityWhere = {
  oidcIssuer?: string;
  oidcSubject?: string;
  ssoId?: number;
};

class UserRepositoryDouble {
  constructor(private readonly users: UserEntity[]) {}

  async findOne(options: { where: IdentityWhere }): Promise<UserEntity | null> {
    const where = options.where;
    return (
      this.users.find((user) =>
        Object.entries(where).every(
          ([key, value]) => user[key as keyof UserEntity] === value,
        ),
      ) ?? null
    );
  }

  create(data: Partial<UserEntity>): UserEntity {
    return Object.assign(new UserEntity(), data);
  }

  async save(user: UserEntity): Promise<UserEntity> {
    if (!user.id) user.id = this.users.length + 1;
    if (!this.users.includes(user)) this.users.push(user);
    return user;
  }
}

function createService(users: UserEntity[]): UserService {
  const service = new UserService(new ConfigService({ TOKEN_SECRET: 'test' }));
  Object.assign(service, {
    userRepo: new UserRepositoryDouble(users),
    logger: { log() {}, warn() {}, error() {} },
  });
  return service;
}

describe('UserService OIDC identity mapping', () => {
  it('数字 subject 渐进绑定旧用户并保留本地管理员角色', async () => {
    const existing = Object.assign(new UserEntity(), {
      id: 9,
      ssoId: 42,
      oidcIssuer: null,
      oidcSubject: null,
      name: '旧名称',
      email: 'old@example.com',
      avatar: null,
      role: 'admin' as const,
    });

    const result = await createService([existing]).loginWithOidc({
      iss: 'https://h.exia.xyz/oidc',
      sub: '42',
      email: 'new@example.com',
      email_verified: true,
      nickname: '新名称',
    });

    assert.equal(result.user.id, '42');
    assert.equal(result.user.role, 'admin');
    assert.equal(existing.id, 9);
    assert.equal(existing.oidcSubject, '42');
  });

  it('opaque subject 创建普通用户', async () => {
    const users: UserEntity[] = [];
    const result = await createService(users).loginWithOidc({
      iss: 'https://h.exia.xyz/oidc',
      sub: 'opaque-subject',
      email: 'user@example.com',
      email_verified: true,
      nickname: '新用户',
    });

    assert.equal(result.user.id, 'opaque-subject');
    assert.equal(result.user.role, 'user');
    assert.equal(users[0].ssoId, null);
  });
});
