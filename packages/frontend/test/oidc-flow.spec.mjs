import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { normalizeReturnPath } = await jiti.import('../src/utils/normalize-return-path.ts')

describe('frontend OIDC flow', () => {
  it('accepts only application-local return paths', () => {
    assert.equal(normalizeReturnPath('/archives/post.html?tab=comments'), '/archives/post.html?tab=comments')
    assert.equal(normalizeReturnPath('//evil.example'), '/')
    assert.equal(normalizeReturnPath('https://evil.example'), '/')
    assert.equal(normalizeReturnPath('/\\evil.example'), '/')
  })

  it('keeps the callback free of provider authorization parameters and browser-stored redirects', async () => {
    const [login, callback] = await Promise.all([
      readFile(new URL('../src/pages/user/Login.vue', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/user/Callback.vue', import.meta.url), 'utf8'),
    ])

    assert.doesNotMatch(login, /sessionStorage/)
    assert.doesNotMatch(callback, /sessionStorage|query\.code|query\.state/)
    assert.match(callback, /query\.returnPath/)
  })
})
