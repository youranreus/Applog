import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { UserEntity } from '../src/entities/User';

describe('UserEntity OIDC public identity', () => {
  it('优先公开 opaque OIDC subject', () => {
    const user = new UserEntity();
    user.id = 7;
    user.ssoId = 42;
    user.oidcSubject = 'subject-with-letters';

    assert.equal(user.getPublicId(), 'subject-with-letters');
  });

  it('旧用户在绑定前继续公开 ssoId', () => {
    const user = new UserEntity();
    user.id = 7;
    user.ssoId = 42;
    user.oidcSubject = null;

    assert.equal(user.getPublicId(), 42);
  });
});
