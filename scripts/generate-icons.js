// scripts/generate-icons.js
// Run: node scripts/generate-icons.js
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { join } from 'path';

const outDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outDir, { recursive: true });

async function generateIcon(size) {
  const padding = Math.round(size * 0.08);
  const cornerRadius = Math.round(size * 0.195);

  // Create the icon as a green rounded square with "A" letter
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a6b3c"/>
      <stop offset="100%" style="stop-color:#0f4a25"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)"/>
  <text x="${size/2}" y="${size * 0.58}" font-family="Arial,Helvetica,sans-serif" font-size="${size * 0.45}" font-weight="bold" fill="white" text-anchor="middle">A</text>
  <text x="${size/2}" y="${size * 0.82}" font-family="Arial,Helvetica,sans-serif" font-size="${size * 0.1}" font-weight="bold" fill="#a8e6cf" text-anchor="middle">GRILUX</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, `icon-${size}x${size}.png`));

  console.log(`Generated icon-${size}x${size}.png`);
}

// Also generate the base icon.svg as PNG for apple-touch-icon
async function generateAppleTouchIcon() {
  const size = 180;
  const cornerRadius = Math.round(size * 0.195);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a6b3c"/>
      <stop offset="100%" style="stop-color:#0f4a25"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="url(#bg)"/>
  <text x="${size/2}" y="${size * 0.58}" font-family="Arial,Helvetica,sans-serif" font-size="${size * 0.45}" font-weight="bold" fill="white" text-anchor="middle">A</text>
  <text x="${size/2}" y="${size * 0.82}" font-family="Arial,Helvetica,sans-serif" font-size="${size * 0.1}" font-weight="bold" fill="#a8e6cf" text-anchor="middle">GRILUX</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(join(outDir, 'apple-touch-icon.png'));

  console.log('Generated apple-touch-icon.png');
}

await Promise.all([
  generateIcon(192),
  generateIcon(512),
  generateAppleTouchIcon(),
]);

console.log('All icons generated!');
