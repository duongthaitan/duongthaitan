import { writeFile } from 'node:fs/promises';

const width = 500;
const height = 150;

const tech = [
  { name: 'JavaScript', color: '#F7DF1E' },
  { name: 'TypeScript', color: '#3178C6' },
  { name: 'Three.js', color: '#000000', stroke: '#ffd700' },
  { name: 'React', color: '#61DAFB' },
  { name: 'Vue', color: '#4FC08D' },
  { name: 'WebGL', color: '#990000' },
  { name: 'GSAP', color: '#88CE02' },
  { name: 'Node.js', color: '#339933' }
];

let items = '';
const cols = 4;
const rows = 2;
const w = width / cols;
const h = height / rows;

tech.forEach((t, i) => {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const x = c * w;
  const y = r * h;
  const delay = i * 0.1;
  
  items += `
    <g class="tech-item" transform="translate(${x}, ${y})">
      <!-- Glow Ripple -->
      <rect x="5" y="5" width="${w-10}" height="${h-10}" rx="10" fill="none" stroke="${t.color}" stroke-width="2" opacity="0">
        <animate attributeName="opacity" values="0; 0.5; 0" dur="2s" begin="${delay}s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="scale" values="1; 1.1; 1" dur="2s" begin="${delay}s" repeatCount="indefinite" transform-origin="${w/2} ${h/2}"/>
      </rect>
      
      <!-- Tech Badge Core -->
      <rect class="core-box" x="10" y="10" width="${w-20}" height="${h-20}" rx="6" fill="#0d1117" stroke="${t.stroke || t.color}" stroke-width="1.5" filter="url(#glow)"/>
      <rect class="core-fill" x="10" y="10" width="${w-20}" height="${h-20}" rx="6" fill="${t.color}" opacity="0.1"/>
      
      <!-- Tech Label -->
      <text x="${w/2}" y="${h/2 + 5}" fill="${t.color}" text-anchor="middle" font-family="system-ui" font-size="12" font-weight="800" filter="url(#glow)">${t.name}</text>
    </g>
  `;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img">
  <defs>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <style>
    .tech-item { cursor: pointer; transition: all 0.3s; }
    .tech-item:hover .core-box { stroke: #ffffff; fill: #1a0a00; }
    .tech-item:hover .core-fill { opacity: 0.3; }
    .tech-item:hover text { fill: #ffffff; }
  </style>
  <rect width="${width}" height="${height}" fill="none"/>
  ${items}
</svg>`;

await writeFile('./assets/tech-stack.svg', svg);
