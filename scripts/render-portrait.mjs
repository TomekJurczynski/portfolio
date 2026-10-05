// Square-crops the hero portrait around the face and writes WebP variants:
//   ../portfolio-spec/Tomasz.jpg  ->  public/images/profile/tomasz-360.webp, tomasz-720.webp
// The source is Tomasz.HEIC converted to JPG (sharp has no HEVC decoder; pillow-heif did it), 3024x4032
// after EXIF rotation; the crop box was picked by eye (head and shoulders, face in the upper third).
// Re-run: node scripts/render-portrait.mjs
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';

const SRC = '../portfolio-spec/Tomasz.jpg';
const OUT = 'public/images/profile';
await mkdir(OUT, { recursive: true });

const square = await sharp(SRC)
  .rotate()
  .extract({ left: 200, top: 50, width: 2620, height: 2620 })
  .toBuffer();

for (const width of [360, 720]) {
  const out = `${OUT}/tomasz-${width}.webp`;
  await sharp(square).resize({ width }).webp({ quality: 80 }).toFile(out);
  console.log(out, `${((await stat(out)).size / 1024).toFixed(0)} KB`);
}
