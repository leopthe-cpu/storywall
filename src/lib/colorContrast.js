// Picks a readable text color for whatever a new text box lands on.
//
// Neutral backgrounds (white, greys, black) get plain near-black or white.
// Coloured backgrounds get a very dark or very light shade of the SAME hue
// (e.g. deep maroon on red, pale cream on navy) so the text looks like it
// belongs to the card rather than generic black/white — but only if that
// shade still clears WCAG AA contrast (4.5:1); otherwise it falls back to
// whichever of black/white reads better.

export function hexToRgb(hex) {
  const h = String(hex || '#ffffff').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function luminance({ r, g, b }) {
  const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(hexA, hexB) {
  const a = luminance(hexToRgb(hexA));
  const b = luminance(hexToRgb(hexB));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex({ r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 });
}

const DARK = '#111111';
const LIGHT = '#FFFFFF';

export function pickReadableTextColor(bgHex) {
  const bg = hexToRgb(bgHex);
  const { h, s } = rgbToHsl(bg);
  const bw = contrastRatio(DARK, bgHex) >= contrastRatio(LIGHT, bgHex) ? DARK : LIGHT;
  if (s < 0.12) return bw;
  const dark = hslToHex(h, Math.min(s, 0.6), 0.08);
  const light = hslToHex(h, Math.min(s, 0.45), 0.96);
  const tinted = contrastRatio(dark, bgHex) >= contrastRatio(light, bgHex) ? dark : light;
  return contrastRatio(tinted, bgHex) >= 4.5 ? tinted : bw;
}

// Average colour of a region of an image, as a hex string — or null if the
// image can't be read (e.g. its server doesn't allow cross-origin pixel
// access, which makes the canvas "tainted"). `region` is in 0..1 fractions
// of the image's natural size.
export function sampleImageColor(url, region) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const nw = img.naturalWidth, nh = img.naturalHeight;
        const clamp01 = (v) => Math.max(0, Math.min(1, v));
        const x0 = clamp01(region.x0), x1 = clamp01(region.x1), y0 = clamp01(region.y0), y1 = clamp01(region.y1);
        const sw = Math.max(1, (x1 - x0) * nw), sh = Math.max(1, (y1 - y0) * nh);
        const canvas = document.createElement('canvas');
        canvas.width = 24; canvas.height = 8;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, x0 * nw, y0 * nh, sw, sh, 0, 0, 24, 8);
        const { data } = ctx.getImageData(0, 0, 24, 8);
        let r = 0, g = 0, b = 0, n = 0;
        for (let i = 0; i < data.length; i += 4) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
        resolve(rgbToHex({ r: r / n, g: g / n, b: b / n }));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}
