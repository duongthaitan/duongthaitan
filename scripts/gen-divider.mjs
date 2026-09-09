import { writeFile } from 'node:fs/promises';

const width = 900;
const height = 40;
let sparks = '';

for(let i=0; i<30; i++) {
  const cx = 50 + Math.random() * 800;
  const cy = 20 + (Math.random() - 0.5) * 10;
  const dur = 1 + Math.random() * 2;
  const delay = Math.random() * 2;
  sparks += `
    <circle cx="${cx}" cy="${cy}" r="1" fill="#ffd700" filter="url(#glow)">
      <animate attributeName="opacity" values="0;1;0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      <animateTransform attributeName="transform" type="translate" values="0,0; ${-20 + Math.random()*40}, -20" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </circle>
  `;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" style="max-width:100%;height:auto">
  <defs>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2" result="blur1" />
      <feGaussianBlur stdDeviation="5" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <g filter="url(#glow)">
    <line x1="0" y1="20" x2="900" y2="20" stroke="#ff7700" stroke-width="1" opacity="0.5"/>
    <line x1="450" y1="20" x2="450" y2="20" stroke="#ffffff" stroke-width="2" stroke-linecap="round">
       <animate attributeName="x1" values="450; 0; 450" dur="4s" repeatCount="indefinite"/>
       <animate attributeName="x2" values="450; 900; 450" dur="4s" repeatCount="indefinite"/>
    </line>
    ${sparks}
  </g>
</svg>`;

await writeFile('./assets/divider.svg', svg);
