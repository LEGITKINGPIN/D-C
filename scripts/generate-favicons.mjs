import sharp from 'sharp';
import fs from 'fs';

async function generate() {
  // Balanced viewBox and size so D&C sits comfortably with elegant padding
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#000000"/>
  <text x="256" y="285"
    font-family="'Playfair Display', 'Cormorant Garamond', 'Georgia', serif"
    font-style="italic"
    font-weight="700"
    font-size="185"
    fill="#FFFFFF"
    text-anchor="middle"
    dominant-baseline="central"
    letter-spacing="-2px">D&amp;C</text>
</svg>`;

  fs.writeFileSync('public/favicon.svg', svg);

  const svgBuffer = Buffer.from(svg);

  // 180x180 Apple Touch Icon
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon.png');

  // 32x32 Favicon PNG
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile('public/favicon-32x32.png');

  // 16x16 Favicon PNG
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile('public/favicon-16x16.png');

  // 192x192 Android Chrome Icon
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile('public/icon-192.png');

  // 512x512 Android Chrome Icon
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile('public/icon-512.png');

  // favicon.ico
  await sharp(svgBuffer)
    .resize(32, 32)
    .toFile('public/favicon.ico');

  console.log('Favicons updated!');
}

generate().catch(console.error);
