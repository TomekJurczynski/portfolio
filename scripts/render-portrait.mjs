// Square-crops the hero portrait around the face and writes WebP variants:
//   ../portfolio-spec/tomek.jpg  ->  public/images/profile/tomasz-360.webp, tomasz-720.webp
// The source is 1365x2048 after EXIF rotation; the crop box was picked by eye (face centered).
// Re-run: node scripts/render-portrait.mjs
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';

const SRC = '../portfolio-spec/tomek.jpg';
const OUT = 'public/images/profile';
await mkdir(OUT, { recursive: true });

const square = await sharp(SRC)
  .rotate()
  .extract({ left: 38, top: 60, width: 1250, height: 1250 })
  .toBuffer();

for (const width of [360, 720]) {
  const out = `${OUT}/tomasz-${width}.webp`;
  await sharp(square).resize({ width }).webp({ quality: 80 }).toFile(out);
  console.log(out, `${((await stat(out)).size / 1024).toFixed(0)} KB`);
}
