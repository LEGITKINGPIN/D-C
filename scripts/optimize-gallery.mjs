// scripts/optimize-gallery.mjs
// Resizes gallery images to 800px wide (2x retina for 400px display)
// and compresses to quality 70. Run with: node scripts/optimize-gallery.mjs
//
// On Windows, if files are locked by dev server / IDE, run with --output-dir
// to write to a separate directory, then manually replace.

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const GALLERY_DIR = 'public/gallery';
const OUTPUT_DIR = process.argv.includes('--output-dir')
  ? 'public/gallery-optimized'
  : GALLERY_DIR;

async function optimizeGallery() {
  const files = fs.readdirSync(GALLERY_DIR).filter(f => f.endsWith('.webp'));
  
  if (files.length === 0) {
    console.log('No .webp files found in', GALLERY_DIR);
    return;
  }

  // Create output dir if writing to a separate location
  if (OUTPUT_DIR !== GALLERY_DIR && !fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Optimizing ${files.length} gallery images...`);
  if (OUTPUT_DIR !== GALLERY_DIR) {
    console.log(`Writing to: ${OUTPUT_DIR}`);
  }
  console.log('');

  let totalSaved = 0;

  for (const file of files) {
    const inputPath = path.join(GALLERY_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file);
    const originalSize = fs.statSync(inputPath).size;

    // Read file into memory buffer (avoids file locks on Windows)
    const inputBuffer = fs.readFileSync(inputPath);
    const meta = await sharp(inputBuffer).metadata();

    // Skip if already at target width or smaller
    if (meta.width && meta.width <= 800) {
      console.log(`  SKIP  ${file}: already ${meta.width}px wide`);
      // Still copy to output dir if different
      if (OUTPUT_DIR !== GALLERY_DIR) {
        fs.writeFileSync(outputPath, inputBuffer);
      }
      continue;
    }

    // Resize to 800px wide, maintain aspect ratio, compress to q70
    const outputBuffer = await sharp(inputBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    // Write optimized buffer
    fs.writeFileSync(outputPath, outputBuffer);
    const newSize = outputBuffer.length;
    const saved = originalSize - newSize;
    totalSaved += saved;

    console.log(
      `  OK    ${file}: ${meta.width}x${meta.height} → 800px ` +
      `(${(originalSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB, ` +
      `-${(saved / 1024).toFixed(0)}KB)`
    );
  }

  console.log(`\nDone! Total saved: ${(totalSaved / 1024).toFixed(0)}KB (${(totalSaved / 1024 / 1024).toFixed(2)}MB)`);
  
  if (OUTPUT_DIR !== GALLERY_DIR) {
    console.log(`\nOptimized images written to ${OUTPUT_DIR}/`);
    console.log('To apply: close dev server, then copy them over to public/gallery/');
  }
}

optimizeGallery().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
