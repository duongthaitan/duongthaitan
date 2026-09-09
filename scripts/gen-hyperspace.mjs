import { writeFile } from 'node:fs/promises';

const numStars = 150;
const width = 900;
const height = 400;
const cx = width / 2;
const cy = height / 2;

let starsSvg = '';

for (let i = 0; i < numStars; i++) {
  const angle = Math.random() * Math.PI * 2;
  const startRadius = 20 + Math.random() * 50; 
  // Reduce endRadius significantly to ensure lines fade out WELL BEFORE hitting the edge of the SVG (900x400)
  // Distance to nearest edge from center (450,200) is 200 (top/bottom)
  const endRadius = startRadius + 100 + Math.random() * 80;
  
  const x1 = cx + Math.cos(angle) * startRadius;
  const y1 = cy + Math.sin(angle) * startRadius;
  const x2 = cx + Math.cos(angle) * endRadius;
  const y2 = cy + Math.sin(angle) * endRadius;
  
  const dur = 0.5 + Math.random() * 1.5;
  const delay = Math.random() * 3;
  // Fade opacity smoothly from 0 -> peak -> 0 to prevent harsh cutoffs
  const opacity = 0.3 + Math.random() * 0.7;
  const thickness = 0.5 + Math.random() * 1.5;
  const color = Math.random() > 0.8 ? '#ffd700' : (Math.random() > 0.5 ? '#ffffff' : '#ff7700');

  starsSvg += `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${thickness}" opacity="0" stroke-linecap="round">
      <animate attributeName="opacity" values="0;${opacity};0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      <animate attributeName="stroke-dasharray" values="0,500; 500,0" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
    </line>
  `;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400" viewBox="0 0 900 400" preserveAspectRatio="xMidYMid meet" role="img" style="max-width:100%;height:auto">
  <title>V6 Hyperspace Jump</title>
  <defs>
    <clipPath id="hero-frame"><rect width="900" height="400" rx="30"/></clipPath>
    <filter id="neon" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <g clip-path="url(#hero-frame)">
    <rect width="900" height="400" fill="#010205"/>
    
    <!-- Hyperspace Lines -->
    <g filter="url(#neon)">
      ${starsSvg}
    </g>
    
    <!-- Center Core Void -->
    <circle cx="450" cy="200" r="15" fill="#ffffff" filter="url(#neon)">
       <animate attributeName="opacity" values="1;0.5;1" dur="0.2s" repeatCount="indefinite"/>
    </circle>
    <circle cx="450" cy="200" r="40" fill="none" stroke="#ff7700" stroke-width="2" filter="url(#neon)">
       <animateTransform attributeName="transform" type="scale" values="1; 1.5; 1" dur="1s" repeatCount="indefinite" transform-origin="450 200"/>
    </circle>
    
    <!-- Heavy Cyber Border -->
    <rect x="2" y="2" width="896" height="396" rx="28" fill="none" stroke="#ffd700" stroke-width="4" opacity="0.5" filter="url(#neon)"/>
    
    <!-- Kinetic Typography -->
    <g transform="translate(50, 0)">
      <g filter="url(#neon)">
        <!-- Animated Badge -->
        <rect x="0" y="60" width="300" height="28" rx="8" fill="#1e180a" stroke="#ffd700" stroke-width="1.5"/>
        <circle cx="15" cy="74" r="5" fill="#ff0000">
           <animate attributeName="opacity" values="1;0;1" dur="0.5s" repeatCount="indefinite" />
        </circle>
        <text x="30" y="79" font-family="monospace" font-size="12" font-weight="700" fill="#ffd700" letter-spacing="1">
          SYS.BOOT(SEKHMET_V10_MAX_OMNIVERSE)
        </text>
      </g>

      <text x="0" y="320" font-family="system-ui" font-size="60" font-weight="900" letter-spacing="-2" fill="#ffffff" filter="url(#neon)">
        DUONG THAI TAN
      </text>

      <text x="0" y="360" font-family="system-ui" font-size="28" font-weight="800" fill="#ff7700" letter-spacing="2">
        V10 MAX OMNIVERSE ARCHITECT
      </text>
    </g>
  </g>
</svg>`;

await writeFile('./assets/hero-banner.svg', svg);
