import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';

describe('notification frontend and template contract', () => {
  it('keeps notification form administrator-only and token draft separate', async () => {
    const settings = await readFile(
      new URL('../src/pages/user/Dashboard/components/SystemSettings.vue', import.meta.url),
      'utf8',
    );
    const component = await readFile(
      new URL('../src/pages/user/Dashboard/components/NotificationSettings.vue', import.meta.url),
      'utf8',
    );
    assert.match(settings, /<NotificationSettings v-if="isAdmin"/);
    assert.match(component, /tokenDraft/);
    assert.match(component, /autocomplete="new-password"/);
    assert.match(component, /mailToken: tokenDraft\.value/);
  });

  it('templates interpolate only their declared variables', async () => {
    const root = new URL('../../../docs/notification-templates/', import.meta.url);
    const status = await readFile(new URL('applog-comment-status.html', root), 'utf8');
    const fresh = await readFile(new URL('applog-new-comment.html', root), 'utf8');
    const reply = await readFile(new URL('applog-comment-reply.html', root), 'utf8');
    const variables = (html) => [...html.matchAll(/{{(\w+)}}/g)].map((match) => match[1]);
    assert.deepEqual([...new Set(variables(status))].sort(), [
      'commentExcerpt', 'commenterName', 'statusLabel', 'targetTitle', 'targetType', 'viewUrl',
    ]);
    assert.deepEqual([...new Set(variables(fresh))].sort(), [
      'adminUrl', 'commentExcerpt', 'commenterName', 'siteName', 'targetTitle', 'targetType',
    ]);
    assert.deepEqual([...new Set(variables(reply))].sort(), [
      'parentCommentExcerpt', 'parentCommenterName', 'replierName', 'replyExcerpt',
      'targetTitle', 'targetType', 'viewUrl',
    ]);
  });
});
