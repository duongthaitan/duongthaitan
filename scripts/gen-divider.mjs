import { writeFile } from 'node:fs/promises';

const width = 900;
const height = 40;
let sparks = '';

for(let i=0; i<30; i++) {
  const color = Math.random() > 0.5 ? '#00ffcc' : '#00ff00';
  const size = Math.random() * 2 + 1;
  const x = Math.random() * width;
  const y = 5 + Math.random() * 10;
  const dur = 1 + Math.random() * 2;
  const delay = Math.random() * 2;
  
  sparks += `
    <circle cx="${x}" cy="${y}" r="${size}" fill="${color}" opacity="0">
      <animate attributeName="opacity" values="0; 0.8; 0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      <animate attributeName="cx" values="${x}; ${x + (Math.random() > 0.5 ? 20 : -20)}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </circle>
  `;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="presentation">
  <defs>
    <filter id="glow-divider" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Core Laser Line -->
  <rect x="0" y="9" width="${width}" height="2" fill="#00ff00" filter="url(#glow-divider)">
    <animate attributeName="opacity" values="0.4; 1; 0.4" dur="2s" repeatCount="indefinite" />
  </rect>

  <!-- Scanning Bright Spot -->
  <rect x="0" y="8" width="100" height="4" fill="#00ffcc" filter="url(#glow-divider)">
    <animate attributeName="x" values="-100; ${width}" dur="3s" repeatCount="indefinite" />
  </rect>

  <g filter="url(#glow-divider)">
    ${sparks}
  </g>
</svg>`;

await writeFile('./assets/divider.svg', svg);
