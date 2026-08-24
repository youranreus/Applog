import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import {
  buildGalleryObjectKey,
  buildGalleryUrl,
  isGalleryFolder,
  normalizeCdnDomain,
  normalizeGalleryPath,
} from '@applog/common';

describe('gallery shared path contract', () => {
  it('normalizes CDN and joins an encoded public object path', () => {
    assert.equal(
      normalizeCdnDomain('photos.example.com///'),
      'https://photos.example.com',
    );
    assert.equal(normalizeGalleryPath('/gallery/trips/'), 'gallery/trips');
    assert.equal(
      buildGalleryObjectKey('/gallery/', 'spring_2026', 'abc-1.jpg'),
      'gallery/spring_2026/abc-1.jpg',
    );
    assert.equal(
      buildGalleryUrl(
        'https://cdn.example.com/',
        '/gallery/spring_2026/a b.jpg',
      ),
      'https://cdn.example.com/gallery/spring_2026/a%20b.jpg',
    );
  });

  it('accepts conservative immutable album folders only', () => {
    assert.equal(isGalleryFolder('trip-2026_08'), true);
    for (const value of ['../trip', 'trip/a', '.hidden', 'Trip', 'a%2fb'])
      assert.equal(isGalleryFolder(value), false);
  });

  it('rejects insecure CDN schemes and unsafe generated filenames', () => {
    assert.throws(() => normalizeCdnDomain('http://cdn.example.com'));
    assert.throws(() => normalizeCdnDomain('https://user@cdn.example.com'));
    assert.throws(() => normalizeGalleryPath('gallery/%2e%2e/private'));
    assert.throws(() => normalizeGalleryPath('gallery/a%2fb'));
    assert.throws(() => buildGalleryObjectKey('gallery', 'trip', '../a.jpg'));
  });
});
