/**
 * Builds android-icon-foreground.png from icon.png with padding so adaptive
 * launcher icons match the Play Store listing (not over-cropped).
 *
 * Android adaptive icons use a 108dp canvas; keep artwork in the center ~66dp.
 */
const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'assets/images/icon.png');
const OUTPUT = path.join(ROOT, 'assets/images/android-icon-foreground.png');
const CANVAS_SIZE = 1024;
/** Center 66dp of 108dp adaptive icon safe zone. */
const ARTWORK_SCALE = 66 / 108;

async function main() {
  if (!fs.existsSync(INPUT)) {
    throw new Error(`Missing source icon: ${INPUT}`);
  }

  const artworkSize = Math.round(CANVAS_SIZE * ARTWORK_SCALE);
  const resized = await sharp(INPUT)
    .resize(artworkSize, artworkSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toFile(OUTPUT);

  console.log(`Wrote ${path.relative(ROOT, OUTPUT)} (${Math.round(ARTWORK_SCALE * 100)}% artwork)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
