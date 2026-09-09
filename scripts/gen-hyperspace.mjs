import fs from 'fs';
import path from 'path';

// V12 Cybernetic Git / Digital Rain Header
const width = 900;
const height = 400;

let digitalRain = '';
const numRain = 80;

for (let i = 0; i < numRain; i++) {
  const x = Math.random() * width;
  const y = -Math.random() * 200;
  const dur = 2 + Math.random() * 3;
  const delay = Math.random() * 5;
  const opacity = 0.3 + Math.random() * 0.7;
  const color = Math.random() > 0.8 ? '#00ffcc' : '#00ff00';
  
  digitalRain += `
    <g transform="translate(${x}, ${y})">
      <animateTransform attributeName="transform" type="translate" values="${x},${y}; ${x},${y + height + 200}" dur="${dur}s" begin="${delay}s" repeatCount="indefinite" />
      <text fill="${color}" font-family="monospace" font-size="${10 + Math.random()*14}" opacity="${opacity}" filter="url(#glow)">${Math.random().toString(36).substring(2, 3)}</text>
    </g>
  `;
}

// Draw Git Tree
let gitTree = `
  <path d="M 0,200 C 150,200 300,100 450,200 C 600,300 750,200 900,200" fill="none" stroke="#00ffcc" stroke-width="2" filter="url(#glow)"/>
  <path d="M 300,100 C 450,100 600,150 750,200" fill="none" stroke="#00ff00" stroke-width="2" filter="url(#glow)"/>
`;

for(let i=0; i<5; i++) {
    gitTree += `<circle cx="${150 + i*150}" cy="${i%2===0 ? 200 : 100}" r="8" fill="#0d1117" stroke="#00ffcc" stroke-width="2" filter="url(#glow)">
        <animate attributeName="r" values="6;8;6" dur="2s" begin="${i*0.5}s" repeatCount="indefinite" />
    </circle>`;
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="V12 Cyber Matrix" style="max-width:100%;height:auto; background-color:#010409;">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Digital Rain -->
  ${digitalRain}

  <!-- Git Tree -->
  <g opacity="0.6">
    ${gitTree}
  </g>

  <!-- Cinematic Text Overlay -->
  <g transform="translate(0, 0)">
    <rect width="${width}" height="${height}" fill="url(#gradient)" opacity="0.3" />
    <defs>
      <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#010409" stop-opacity="0" />
        <stop offset="100%" stop-color="#010409" stop-opacity="1" />
      </linearGradient>
    </defs>
    
    <g transform="translate(450, 200)" text-anchor="middle">
      <g filter="url(#glow)">
        <circle cx="0" cy="-60" r="10" fill="none" stroke="#00ffcc" stroke-width="2">
           <animate attributeName="r" values="5;15;5" dur="2s" repeatCount="indefinite" />
           <animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="0" y="-60" font-family="monospace" font-size="12" font-weight="700" fill="#00ff00" letter-spacing="2">
          SYS.BOOT(V12_CORE_ONLINE)
        </text>
      </g>

      <text x="0" y="0" font-family="monospace" font-size="60" font-weight="900" letter-spacing="-2" fill="#ffffff" filter="url(#glow)">
        DUONG THAI TAN
      </text>

      <text x="0" y="40" font-family="monospace" font-size="24" font-weight="800" fill="#00ffcc" letter-spacing="4">
        &gt; SENIOR SOFTWARE ENGINEER_
      </text>
    </g>
  </g>
</svg>`;

const dir = path.join(process.cwd(), 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'hero-banner.svg'), svg);
console.log('V12 hero-banner.svg generated.');
