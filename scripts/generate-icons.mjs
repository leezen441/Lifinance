/**
 * Generates every app icon from one SVG source.
 *
 *   npm run icons
 *
 * The outputs are committed, so a normal build/deploy needs neither sharp nor
 * this script. Re-run it only when the mark changes.
 *
 * Two variants exist because Android and iOS mask icons differently:
 *   - "rounded"  — the app draws its own squircle. Used for iOS (which then
 *                  applies its own mask on top) and for `any` purpose.
 *   - "maskable" — full-bleed background with the mark shrunk into the centre
 *                  safe zone, so Android can crop it to a circle, a squircle,
 *                  or a teardrop without clipping the glyph.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ICONS = resolve(ROOT, "public/icons");
const APP_DIR = resolve(ROOT, "src/app");

const NEON = "#39FF14";
const BG = "#070A07";

/**
 * The mark: a rising line with a glowing node at the peak — the same polyline
 * as the in-app logo, so the home-screen icon and the header agree.
 *
 * @param size      canvas edge in px
 * @param inset     0–1, how much of the canvas the mark occupies
 * @param radius    corner radius in px (0 = full bleed, for maskable)
 */
function markSVG(size, inset, radius) {
  const s = size;
  // Mark is authored on a 512 grid, then scaled and centred.
  const scale = (s / 512) * inset;
  const offset = (s - 512 * scale) / 2;
  const stroke = 44;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0E1A0E"/>
      <stop offset="100%" stop-color="${BG}"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${s * 0.022}" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="${s}" height="${s}" rx="${radius}" ry="${radius}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" filter="url(#glow)">
    <path d="M84 372 L206 236 L296 310 L428 150"
          fill="none" stroke="${NEON}" stroke-width="${stroke}"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="428" cy="150" r="34" fill="${NEON}"/>
  </g>
</svg>`;
}

/** Flat SVG for the browser tab — no filters, crisp at 16px. */
function faviconSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  <path d="M108 366 L212 244 L294 312 L410 166"
        fill="none" stroke="${NEON}" stroke-width="56"
        stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="410" cy="166" r="36" fill="${NEON}"/>
</svg>`;
}

async function png(svg, size, outPath) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(outPath);
  return outPath;
}

async function main() {
  await mkdir(PUBLIC_ICONS, { recursive: true });

  const written = [];

  // --- Android / PWA, purpose "any" -------------------------------------
  for (const size of [192, 512]) {
    // ~22% corner radius reads as a squircle at every size.
    const svg = markSVG(size, 0.78, size * 0.22);
    written.push(await png(svg, size, resolve(PUBLIC_ICONS, `icon-${size}.png`)));
  }

  // --- Android, purpose "maskable" --------------------------------------
  // Full bleed, mark inside the 80% safe zone so no mask shape clips it.
  for (const size of [192, 512]) {
    const svg = markSVG(size, 0.56, 0);
    written.push(await png(svg, size, resolve(PUBLIC_ICONS, `icon-maskable-${size}.png`)));
  }

  // --- iOS home screen ---------------------------------------------------
  // iOS applies its own rounding and does NOT support transparency, so this
  // is drawn square and full-bleed.
  written.push(
    await png(markSVG(180, 0.72, 0), 180, resolve(APP_DIR, "apple-icon.png")),
  );

  // --- Browser tab -------------------------------------------------------
  await writeFile(resolve(APP_DIR, "icon.svg"), faviconSVG(), "utf8");
  written.push(resolve(APP_DIR, "icon.svg"));
  written.push(await png(faviconSVG(), 32, resolve(PUBLIC_ICONS, "favicon-32.png")));

  // --- Social preview ----------------------------------------------------
  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <circle cx="1010" cy="120" r="300" fill="${NEON}" opacity="0.07"/>
  <g transform="translate(88 175) scale(0.55)">
    <path d="M84 372 L206 236 L296 310 L428 150" fill="none" stroke="${NEON}"
          stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="428" cy="150" r="34" fill="${NEON}"/>
  </g>
  <text x="88" y="420" font-family="Segoe UI, Inter, sans-serif" font-size="86"
        font-weight="700" fill="#EEF2EC">Lifinance</text>
  <text x="88" y="480" font-family="Segoe UI, Inter, sans-serif" font-size="34"
        fill="#8B968C">Clear the debt. Keep the life.</text>
  <text x="88" y="530" font-family="Segoe UI, Inter, sans-serif" font-size="34"
        fill="${NEON}">ปิดหนี้ให้ไว แต่ยังใช้ชีวิตได้</text>
</svg>`;
  const ogPath = resolve(PUBLIC_ICONS, "og.png");
  await sharp(Buffer.from(og)).png({ compressionLevel: 9 }).toFile(ogPath);
  written.push(ogPath);

  for (const p of written) console.log("  ✓", p.replace(ROOT + "\\", "").replace(ROOT + "/", ""));
  console.log(`\n${written.length} icons generated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
