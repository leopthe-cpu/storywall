import { assert, assertEquals } from 'jsr:@std/assert@1';
import { encode as encodePng } from 'npm:@jsquash/png@3.1.1';
import { toWebp } from './webp.ts';

// A 256×256 gradient PNG, made here so the test needs no files.
async function samplePng(): Promise<Uint8Array> {
  const size = 256;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data.set([i % size, Math.floor(i / size), 128, 255], i * 4);
  }
  return new Uint8Array(await encodePng({ data, width: size, height: size, colorSpace: 'srgb' } as ImageData));
}

Deno.test('toWebp: a PNG becomes a smaller WebP', async () => {
  const png = await samplePng();
  const out = await toWebp(png, 'image/png');
  assertEquals(out.mediaType, 'image/webp');
  assertEquals(new TextDecoder().decode(out.bytes.slice(8, 12)), 'WEBP');
  assert(out.bytes.byteLength < png.byteLength);
});

Deno.test('toWebp: other formats and broken files are kept as they are', async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
  assertEquals(await toWebp(jpeg, 'image/jpeg'), { bytes: jpeg, mediaType: 'image/jpeg' });
  const broken = new Uint8Array([1, 2, 3]);
  assertEquals(await toWebp(broken, 'image/png'), { bytes: broken, mediaType: 'image/png' });
});
