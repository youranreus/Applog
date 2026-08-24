const { get } = require('https');
const { createWriteStream } = require('fs');
const { mkdtemp, rm } = require('fs/promises');
const { tmpdir } = require('os');
const { join } = require('path');
const sharp = require('sharp');
const convertHeic = require('heic-convert');

const OFFICIAL_FIXTURE = 'https://github.com/strukturag/libheif/raw/gh-pages/example.heic';

function download(url, target, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = get(url, { timeout: 15000, headers: { 'user-agent': 'applog-gallery-doctor' } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location && redirects < 5) {
        response.resume();
        download(response.headers.location, target, redirects + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`fixture HTTP ${response.statusCode}`));
        return;
      }
      const output = createWriteStream(target, { flags: 'wx' });
      response.pipe(output);
      output.on('finish', () => output.close(resolve));
      output.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('fixture download timeout')));
    request.on('error', reject);
  });
}

(async () => {
  const directory = await mkdtemp(join(tmpdir(), 'applog-gallery-doctor-'));
  const downloaded = !process.env.GALLERY_HEIC_FIXTURE;
  const fixture = process.env.GALLERY_HEIC_FIXTURE || join(directory, 'example.heic');
  try {
    if (downloaded) await download(OFFICIAL_FIXTURE, fixture);
    const output = join(directory, 'decoded.jpg');
    let mode = 'native libvips';
    let metadata;
    try {
      metadata = await sharp(fixture).rotate().jpeg({ quality: 85 }).toFile(output);
    } catch {
      mode = 'WASM fallback';
      const source = require('fs').readFileSync(fixture);
      const jpeg = await convertHeic({ buffer: source, format: 'JPEG', quality: 0.85 });
      require('fs').writeFileSync(output, jpeg);
      metadata = await sharp(output).metadata();
    }
    if (!metadata.width || !metadata.height || metadata.format !== 'jpeg') throw new Error('decoded output is invalid');
    console.log(`Sharp ${sharp.versions.sharp}; libvips ${sharp.versions.vips}; real HEIC decode: available via ${mode} (${metadata.width}x${metadata.height})`);
  } catch (error) {
    console.error(`HEIC capability check failed: ${error instanceof Error ? error.message : error}`);
    console.error('To test without network, set GALLERY_HEIC_FIXTURE=/path/to/photo.heic.');
    process.exitCode = 1;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
})();
