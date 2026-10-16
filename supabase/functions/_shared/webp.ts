import decodePng, { init as initPng } from 'npm:@jsquash/png@3.1.1/decode.js';
import encodeWebp, { init as initWebp } from 'npm:@jsquash/webp@1.5.0/encode.js';
import { simd } from 'npm:wasm-feature-detect@1.9.0';

// AI pictures come back as PNG, about 0.9–1.4 MB each. Stored as WebP they
// are roughly 8–25× smaller (quality 90), which saves storage and makes cards
// load faster, with no difference visible at card size. Quality 90 rather
// than 85: at 85 faint blocks showed in flat backgrounds when zoomed in.
//
// Measured locally on 1024×1024 pictures: ~60 ms to decode, ~150 ms to
// encode, well inside an Edge Function's 2 s of CPU.
//
// Best effort: anything that isn't a PNG, or any failure (the encoder can't
// load, a bad file), returns the picture unchanged, so a picture is never
// lost to the conversion.

const QUALITY = 90;

// The encoder and decoder are WebAssembly files inside their npm packages.
// Deploying a function doesn't include them (tested in Supabase's edge
// runtime: the libraries' own loading fails), so they are read from the
// packages' official npm tarballs, once per instance. Each tarball is checked
// against npm's published integrity hash before anything in it is run.
const PACKAGES = {
  png: {
    url: 'https://registry.npmjs.org/@jsquash/png/-/png-3.1.1.tgz',
    integrity: 'sha512-C10pc+0H6j0h8fENOfnGOvkXCmvpSQTDGlfGd0sHphZhPSGTyLjIrHba0FaZZdsKqA/wlmhYicUHb92vfZphaw==',
  },
  webp: {
    url: 'https://registry.npmjs.org/@jsquash/webp/-/webp-1.5.0.tgz',
    integrity: 'sha512-KggLoj2MnRSfIqTeKe1EmbljTX2vuV7mh79k89PCL1pyqiDULcPM1L47twxXt0hkb68F70bXiL31MxsuoZtKFw==',
  },
};

async function wasmFromPackage(pkg: { url: string; integrity: string }, file: string) {
  const res = await fetch(pkg.url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const tgz = new Uint8Array(await res.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-512', tgz));
  if (`sha512-${btoa(String.fromCharCode(...digest))}` !== pkg.integrity) {
    throw new Error(`integrity check failed for ${pkg.url}`);
  }
  const tar = new Uint8Array(
    await new Response(new Blob([tgz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),
  );
  return await WebAssembly.compile(readTarFile(tar, `package/${file}`));
}

// Finds one file in a tar archive (512-byte headers: name at 0, size in
// octal at 124, ustar name prefix at 345).
export function readTarFile(tar: Uint8Array<ArrayBuffer>, name: string): Uint8Array<ArrayBuffer> {
  const field = (from: number, to: number) =>
    new TextDecoder().decode(tar.subarray(from, to)).replace(/\0.*$/s, '');
  for (let offset = 0; offset + 512 <= tar.length;) {
    const fileName = field(offset, offset + 100);
    if (!fileName) break;
    const prefix = field(offset + 345, offset + 500);
    const size = parseInt(field(offset + 124, offset + 136).trim(), 8) || 0;
    offset += 512;
    if ((prefix ? `${prefix}/${fileName}` : fileName) === name) return tar.slice(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
  }
  throw new Error(`${name} not found in the package`);
}

let ready: Promise<void> | null = null;
function loadCodecs() {
  ready ??= (async () => {
    // The WebP library picks its SIMD build when the runtime supports it;
    // the WebAssembly file has to match that build.
    const webpFile = (await simd()) ? 'codec/enc/webp_enc_simd.wasm' : 'codec/enc/webp_enc.wasm';
    const [png, webp] = await Promise.all([
      wasmFromPackage(PACKAGES.png, 'codec/pkg/squoosh_png_bg.wasm'),
      wasmFromPackage(PACKAGES.webp, webpFile),
    ]);
    await initPng(png);
    await initWebp(webp);
  })();
  // A failed load (e.g. the download) is tried again on the next picture.
  ready.catch(() => { ready = null; });
  return ready;
}

export async function toWebp(
  bytes: Uint8Array,
  mediaType: string,
): Promise<{ bytes: Uint8Array; mediaType: string }> {
  if (mediaType !== 'image/png') return { bytes, mediaType };
  try {
    await loadCodecs();
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const image = await decodePng(buffer);
    const webp = new Uint8Array(await encodeWebp(image, { quality: QUALITY }));
    // Never "compress" into something bigger.
    if (!webp.byteLength || webp.byteLength >= bytes.byteLength) return { bytes, mediaType };
    return { bytes: webp, mediaType: 'image/webp' };
  } catch (error) {
    console.log(`[webp] conversion failed, keeping the PNG: ${(error as Error)?.message || error}`);
    return { bytes, mediaType };
  }
}
