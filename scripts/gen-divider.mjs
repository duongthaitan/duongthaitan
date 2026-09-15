import { writeFile } from 'node:fs/promises';

// DevTools-themed gradient divider — subtle blue/teal line
const width = 900;
const height = 40;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="presentation">
  <defs>
    <linearGradient id="div-grad" x1="0%" y1="0%" x2="100%">
      <stop offset="0%" stop-color="#8b949e" stop-opacity="0"/>
      <stop offset="20%" stop-color="#569cd6" stop-opacity="0.2"/>
      <stop offset="50%" stop-color="#0078d4" stop-opacity="0.3"/>
      <stop offset="80%" stop-color="#569cd6" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#8b949e" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <line x1="40" y1="20" x2="${width - 40}" y2="20" stroke="url(#div-grad)" stroke-width="1" stroke-linecap="round"/>
</svg>`;

await writeFile('./assets/divider.svg', svg);
console.log('divider.svg generated.');
