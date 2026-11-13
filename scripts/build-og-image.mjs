#!/usr/bin/env node
// Builds the picture shown when a link to Nuagerie is shared (WhatsApp, iMessage, Slack…): the
// logo and the name on the app's light background, at the 1200 × 630 those previews use.
//
//   node scripts/build-og-image.mjs
//
// Output: public/og.png.
import { readFileSync } from 'node:fs';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;
const LOGO = 360;

const logo = await sharp(readFileSync('public/logo.svg')).resize(LOGO, LOGO).png().toBuffer();
const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="100%" height="100%" fill="#f5f9ff"/>
  <text x="560" y="300" font-family="Nunito, Segoe UI, Arial, sans-serif" font-size="96"
    font-weight="800" fill="#14213d">Nuagerie</text>
  <text x="564" y="370" font-family="Nunito, Segoe UI, Arial, sans-serif" font-size="34"
    font-weight="700" fill="#3d4f6e">Tes photos OneDrive, par album,</text>
  <text x="564" y="418" font-family="Nunito, Segoe UI, Arial, sans-serif" font-size="34"
    font-weight="700" fill="#3d4f6e">date et lieu</text>
</svg>`;

await sharp(Buffer.from(text))
  .composite([{ input: logo, left: 140, top: (HEIGHT - LOGO) / 2 }])
  .png({ compressionLevel: 9 })
  .toFile('public/og.png');
