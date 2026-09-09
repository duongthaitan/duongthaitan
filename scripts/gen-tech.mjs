import fs from 'fs';
import path from 'path';

// V12 Pure Developer Tech Stack (Massive 24-icon array)
const techStack = [
  // Frontend
  { name: 'JavaScript', color: '#F7DF1E', stroke: '#000000' },
  { name: 'TypeScript', color: '#3178C6', stroke: '#000000' },
  { name: 'React', color: '#61DAFB', stroke: '#000000' },
  { name: 'Vue.js', color: '#4FC08D', stroke: '#000000' },
  { name: 'Next.js', color: '#FFFFFF', stroke: '#000000' },
  { name: 'Tailwind', color: '#06B6D4', stroke: '#000000' },
  { name: 'Three.js', color: '#FFFFFF', stroke: '#000000' },
  { name: 'WebGL', color: '#990000', stroke: '#ffffff' },
  // Backend
  { name: 'Node.js', color: '#339933', stroke: '#000000' },
  { name: 'Python', color: '#3776AB', stroke: '#000000' },
  { name: 'Go', color: '#00ADD8', stroke: '#000000' },
  { name: 'Rust', color: '#000000', stroke: '#FFFFFF' },
  { name: 'GraphQL', color: '#E10098', stroke: '#000000' },
  { name: 'NestJS', color: '#E0234E', stroke: '#000000' },
  // Database / Cloud
  { name: 'MongoDB', color: '#47A248', stroke: '#000000' },
  { name: 'PostgreSQL', color: '#4169E1', stroke: '#000000' },
  { name: 'Redis', color: '#DC382D', stroke: '#000000' },
  { name: 'Firebase', color: '#FFCA28', stroke: '#000000' },
  // DevOps / Tools
  { name: 'Docker', color: '#2496ED', stroke: '#000000' },
  { name: 'Kubernetes', color: '#326CE5', stroke: '#000000' },
  { name: 'AWS', color: '#232F3E', stroke: '#FFFFFF' },
  { name: 'Linux', color: '#FCC624', stroke: '#000000' },
  { name: 'Git', color: '#F05032', stroke: '#000000' },
  { name: 'Actions', color: '#2088FF', stroke: '#000000' },
];

const width = 900;
const height = 400; // Increased height for 24 items
const cols = 6;
const cellW = width / cols;
const cellH = height / 4;
const w = 120;
const h = 70;

let items = '';
techStack.forEach((t, i) => {
  const row = Math.floor(i / cols);
  const col = i % cols;
  const x = col * cellW + (cellW - w) / 2;
  const y = row * cellH + (cellH - h) / 2;
  const delay = i * 0.15; // Cascading delay

  items += `
    <g class="tech-item" transform="translate(${x}, ${y})">
      <!-- Glow Ripple -->
      <rect x="5" y="5" width="${w-10}" height="${h-10}" rx="10" fill="none" stroke="#00ff00" stroke-width="2" opacity="0">
        <animate attributeName="opacity" values="0; 0.8; 0" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="scale" values="1; 1.15; 1" dur="2s" begin="${delay}s" repeatCount="indefinite" transform-origin="${w/2} ${h/2}"/>
      </rect>
      
      <!-- Tech Badge Core (Neon Green theme) -->
      <rect class="core-box" x="10" y="10" width="${w-20}" height="${h-20}" rx="6" fill="#0d1117" stroke="#00ff00" stroke-width="1" filter="url(#glow)"/>
      
      <!-- V12 Laser Scanner -->
      <line x1="12" y1="12" x2="12" y2="${h-12}" stroke="#00ffcc" stroke-width="2" opacity="0.8">
        <animate attributeName="x1" values="12; ${w-12}; 12" dur="3s" begin="${delay}s" repeatCount="indefinite" />
        <animate attributeName="x2" values="12; ${w-12}; 12" dur="3s" begin="${delay}s" repeatCount="indefinite" />
      </line>

      <rect class="core-fill" x="10" y="10" width="${w-20}" height="${h-20}" rx="6" fill="${t.color}" opacity="0.15"/>
      
      <!-- Tech Label -->
      <text x="${w/2}" y="${h/2 + 5}" fill="${t.color}" text-anchor="middle" font-family="monospace" font-size="12" font-weight="800" filter="url(#glow)">${t.name}</text>
    </g>
  `;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Massive Tech Stack" style="max-width:100%;height:auto">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <style>
      .core-box { transition: all 0.3s ease; }
      .tech-item:hover .core-box { stroke: #00ffcc; stroke-width: 2px; }
      text { text-shadow: 0 0 5px rgba(0,255,0,0.5); }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="#010409" rx="10" />
  
  <!-- Cyber Grid Background -->
  <g opacity="0.2">
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#00ff00" stroke-width="0.5" />
    </pattern>
    <rect width="${width}" height="${height}" fill="url(#grid)" />
  </g>

  ${items}
</svg>`;

const dir = path.join(process.cwd(), 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'tech-stack.svg'), svg);
console.log('V12 tech-stack.svg generated.');
