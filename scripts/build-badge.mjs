#!/usr/bin/env node
// Builds the notification badge: the small icon Android shows in the status bar and beside the
// app's name. Android keeps only its transparency (a white shape on nothing), so it is the
// logo's cloud alone, not the full-bleed app icon. Without one, Chrome shows a bell.
//
//   node scripts/build-badge.mjs
//
// Output: public/notification-badge.png (96 × 96, the size Android asks for).
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="94 106 326 326">
  <g fill="#fff">
    <circle cx="180" cy="290" r="76"/>
    <circle cx="272" cy="252" r="100"/>
    <circle cx="350" cy="306" r="62"/>
    <rect x="104" y="290" width="306" height="96" rx="48"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).resize(96, 96).png().toFile('public/notification-badge.png');
console.log('public/notification-badge.png');
