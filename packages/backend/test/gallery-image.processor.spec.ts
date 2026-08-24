import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GalleryImageProcessor } from '../src/module/gallery/gallery-image.processor';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zr9sAAAAASUVORK5CYII=',
  'base64',
);

describe('GalleryImageProcessor runtime interop', () => {
  it('uses the CommonJS sharp export to inspect a real PNG', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'applog-gallery-test-'));
    const source = join(directory, 'source.png');
    const display = join(directory, 'display.jpg');

    try {
      await writeFile(source, ONE_PIXEL_PNG);
      const result = await new GalleryImageProcessor().inspect(
        source,
        'image/png',
        display,
      );
      assert.equal(result.sourceMime, 'image/png');
      assert.equal(result.width, 1);
      assert.equal(result.height, 1);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
