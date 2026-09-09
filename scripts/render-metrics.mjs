import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HANDLE = 'duongthaitan';
export const FAILURE = 'Metrics update failed; previous asset preserved.';
const invalid = () => { throw new Error(FAILURE); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();
export const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

// ponytail: public snapshot only; add contribution history when requested.
export async function fetchMetrics({ fetchImpl = fetch, timeoutMs = 30_000 } = {}) {
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const headers = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const get = async path => {
      signal.throwIfAborted();
      const response = await fetchImpl(`https://api.github.com/users/${HANDLE}${path}`, { headers, signal, redirect: 'error' });
      if (!response.ok) invalid();
      const data = await response.json();
      signal.throwIfAborted();
      return data;
    };
    const user = await get('');
    if (user?.login?.toLowerCase() !== HANDLE || count(user.id) === 0) invalid();
    const result = { repos: 0, stars: 0, followers: count(user.followers) };
    const seen = new Set();
    for (let page = 1; ; page++) {
      const repos = await get(`/repos?type=owner&per_page=100&page=${page}&sort=full_name`);
      if (!Array.isArray(repos) || repos.length > 100) invalid();
      if (!repos.length) return result;
      for (const repo of repos) {
        if (!repo || count(repo.id) === 0 || seen.has(repo.id) || repo.owner?.id !== user.id || repo.owner?.login?.toLowerCase() !== HANDLE || typeof repo.fork !== 'boolean' || typeof repo.private !== 'boolean') invalid();
        seen.add(repo.id);
        const stars = count(repo.stargazers_count);
        if (!repo.fork && !repo.private) {
          result.repos = count(result.repos + 1);
          result.stars = count(result.stars + stars);
        }
      }
    }
  } catch { throw new Error(FAILURE); }
}

export function renderSvg(metrics = null, now = new Date()) {
  const labels = ['Public original repos', 'Stars on original repos', 'Followers'];
  const values = metrics === null ? null : [count(metrics.repos), count(metrics.stars), count(metrics.followers)];
  const updated = values ? now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'AWAITING_TELEMETRY';
  
  const tiles = labels.map((label, i) => {
    const value = values ? values[i].toLocaleString('en-US') : '000';
    const yOffset = 150 + i * 160;
    return `
    <g class="interactive-panel" transform="translate(60 ${yOffset})">
      <animateTransform attributeName="transform" type="translate" values="60,${yOffset}; 65,${yOffset}; 60,${yOffset}" dur="${3 + i}s" repeatCount="indefinite" />
      <!-- Cyber Frame -->
      <path class="panel-bg" d="M 0 30 L 20 0 L 320 0 L 340 30 L 320 60 L 20 60 Z" fill="#010205" stroke="#ff7700" stroke-width="1.5" opacity="0.9" filter="url(#glow)"/>
      <path d="M 5 30 L 20 5 L 315 5" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.6">
         <animate attributeName="opacity" values="0.1; 1; 0.1" dur="1.5s" begin="${i}s" repeatCount="indefinite" />
      </path>
      <!-- Tech Bar Graph Simulator -->
      <g opacity="0.6" stroke="#ffd700" stroke-width="2" fill="none">
        <animateTransform attributeName="transform" type="translate" values="0,0; -40,0" dur="1s" repeatCount="indefinite" />
        <path d="M 20 40 L 30 30 L 40 45 L 50 20 L 60 40 L 70 35 L 80 50 L 90 25 L 100 45 L 110 30 L 120 45 L 130 20 L 140 40 L 150 35 L 160 50 L 170 25 L 180 45 L 190 30 L 200 45 L 210 20 L 220 40 L 230 35 L 240 50 L 250 25 L 260 45 L 270 30 L 280 45 L 290 20 L 300 40 L 310 35 L 320 50 L 330 25 L 340 45 L 350 30"/>
      </g>
      <text class="hud-label" x="40" y="22" filter="url(#glow)">${escapeXml(label).toUpperCase()}</text>
      <text class="hud-value" x="40" y="50" font-size="32" font-weight="900" filter="url(#glow)">${escapeXml(value)}</text>
    </g>`;
  }).join('\n  ');

  // V11 REALITY: 3D Solar System
  const solarSystem = [];
  
  // The Sun (Sekhmet Core)
  solarSystem.push(`
    <circle cx="0" cy="0" r="40" fill="url(#sun-glow)" filter="url(#glow)">
      <animate attributeName="r" values="38;42;38" dur="3s" repeatCount="indefinite" />
    </circle>
    <circle cx="0" cy="0" r="50" fill="none" stroke="#ff7700" stroke-width="2" stroke-dasharray="4 8" opacity="0.8">
      <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="10s" repeatCount="indefinite" />
    </circle>
  `);

  // Planets (3D Depth faked using scale/opacity across elliptical paths)
  const orbits = [
    { rx: 120, ry: 40, dur: 8, r: 8, color: '#3178C6', delay: 0 },
    { rx: 180, ry: 60, dur: 12, r: 12, color: '#4FC08D', delay: -4 },
    { rx: 250, ry: 80, dur: 20, r: 10, color: '#ffd700', delay: -10 }
  ];

  orbits.forEach(o => {
    solarSystem.push(`
      <!-- Orbit Ring -->
      <ellipse cx="0" cy="0" rx="${o.rx}" ry="${o.ry}" fill="none" stroke="${o.color}" stroke-width="1" opacity="0.3"/>
      
      <!-- Planet -->
      <g>
        <animateMotion dur="${o.dur}s" repeatCount="indefinite" begin="${o.delay}s">
          <mpath href="#orbit-path-${o.rx}"/>
        </animateMotion>
        <circle cx="0" cy="0" r="${o.r}" fill="${o.color}" filter="url(#glow)">
           <!-- Z-axis depth illusion: scale down and fade opacity when going 'behind' (t=0.5) -->
           <animate attributeName="r" values="${o.r}; ${o.r * 0.4}; ${o.r}" dur="${o.dur}s" keyTimes="0; 0.5; 1" repeatCount="indefinite" />
           <animate attributeName="opacity" values="1; 0.2; 1" dur="${o.dur}s" keyTimes="0; 0.5; 1" repeatCount="indefinite" />
        </circle>
      </g>
    `);
  });

  const globeSvg = solarSystem.join('\n');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="740" viewBox="0 0 900 740" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:100%;height:auto">
  <title id="metrics-title">Sekhmet Solar 3D HUD V11 REALITY</title>
  <desc id="metrics-desc">V11 Realistic Solar System Engine</desc>
  <defs>
    <!-- Orbit Paths for animateMotion -->
    <path id="orbit-path-120" d="M 0,40 A 120,40 0 1,1 0,-40 A 120,40 0 1,1 0,40" />
    <path id="orbit-path-180" d="M 0,60 A 180,60 0 1,1 0,-60 A 180,60 0 1,1 0,60" />
    <path id="orbit-path-250" d="M 0,80 A 250,80 0 1,1 0,-80 A 250,80 0 1,1 0,80" />
    
    <clipPath id="metrics-frame"><rect width="900" height="740" rx="40"/></clipPath>
    <radialGradient id="nebula">
      <stop stop-color="#ff7700" stop-opacity=".4"/><stop offset=".4" stop-color="#d4a017" stop-opacity=".2"/><stop offset="1" stop-color="#010205" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sun-glow">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="50%" stop-color="#ffdd00" />
      <stop offset="100%" stop-color="#ff3300" />
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3" result="blur1" />
      <feGaussianBlur stdDeviation="12" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .panel{fill:#010205}.hud-label{fill:#c2b280;font-family:ui-monospace,monospace;font-size:13px;letter-spacing:3px}
    .hud-value{fill:#ffffff;font-family:system-ui,-apple-system,sans-serif; transition: fill 0.3s;}
    .hud-title{fill:#ffd700;font-family:system-ui,-apple-system,sans-serif;letter-spacing:5px}
    .glitch{animation:glitch-anim 3s infinite}
    
    /* V6 Hover Mechanics */
    .interactive-panel:hover .panel-bg { fill: #1a0a00; stroke: #ffffff; cursor: crosshair; }
    .interactive-panel:hover .hud-value { fill: #ff7700; text-shadow: 0 0 10px #ffd700; }
    
    .planet-core { transition: all 0.5s ease; cursor: crosshair; }
    .planet-core:hover .core-circle { fill: #ff0000; transform: scale(1.5); }
    .planet-core:hover .radar-sweep { stroke: #ff0000; fill: #ff0000; }
    .planet-core:hover .radar-group { animation-duration: 0.5s !important; }

    @keyframes glitch-anim { 0%,95%{transform:translate(0,0)} 96%{transform:translate(3px,-2px)} 97%{transform:translate(-3px,2px)} 98%{transform:translate(3px,2px)} 99%{transform:translate(-3px,-2px)} 100%{transform:translate(0,0)} }
    @media(prefers-reduced-motion: reduce){ * { animation: none !important; } }
  </style>
  
  <rect class="panel" width="900" height="740" rx="40"/>
  
  <g clip-path="url(#metrics-frame)">
    <!-- 3D Tech Grid - Hexagon Pattern V6 -->
    <g stroke="#ff7700" stroke-width="0.5" opacity="0.15" filter="url(#glow)">
      <pattern id="hexgrid" width="34.64" height="60" patternUnits="userSpaceOnUse" patternTransform="scale(0.5)">
        <path d="M17.32 0 L34.64 10 L34.64 30 L17.32 40 L0 30 L0 10 Z" fill="none"/>
        <path d="M17.32 60 L34.64 50 L34.64 30 L17.32 40 L0 30 L0 50 Z" fill="none"/>
      </pattern>
      <rect width="900" height="740" fill="url(#hexgrid)"/>
    </g>

    <ellipse cx="650" cy="370" rx="500" ry="400" fill="url(#nebula)">
      <animate attributeName="opacity" values="0.3;0.7;0.3" dur="4s" repeatCount="indefinite" />
    </ellipse>

    <!-- 3D Wireframe Globe Core (Interactive V6/V10) -->
    <g transform="translate(650, 370)" filter="url(#glow)" class="planet-core">
      <!-- V10 Matrix Backing -->
      <g opacity="0.3">
        <polygon points="0,-250 216,-125 216,125 0,250 -216,125 -216,-125" fill="none" stroke="#ff7700" stroke-width="1" stroke-dasharray="10 20">
          <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="20s" repeatCount="indefinite"/>
        </polygon>
        <polygon points="0,-270 233,-135 233,135 0,270 -233,135 -233,-135" fill="none" stroke="#ffd700" stroke-width="0.5" stroke-dasharray="5 15">
          <animateTransform attributeName="transform" type="rotate" values="360; 0" dur="15s" repeatCount="indefinite"/>
        </polygon>
      </g>

      <!-- Outer Latitude/Longitude Static Rings -->
      <circle r="200" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 8" opacity="0.6"/>
      <ellipse rx="200" ry="60" fill="none" stroke="#ffd700" stroke-width="2" opacity="0.8">
         <animateTransform attributeName="transform" type="rotate" values="-15; 15; -15" dur="10s" repeatCount="indefinite"/>
      </ellipse>
      
      <!-- Faked 3D Rotating Sphere -->
      <g style="pointer-events: none;">
        ${globeSvg}
      </g>
      
      <!-- Planet Core (Hover Target) -->
      <circle r="60" fill="#ffffff" class="core-circle" filter="url(#glow)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </circle>

      <!-- Sweeping Radar Line -->
      <g class="radar-group" style="animation: rotate 4s linear infinite;">
        <style>
           @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        </style>
        <path d="M 0 0 L 0 -240" stroke="#ff7700" stroke-width="3" class="radar-sweep"/>
        <path d="M 0 0 L 0 -240 A 240 240 0 0 1 120 -207 Z" fill="#ff7700" opacity="0.15" class="radar-sweep"/>
      </g>
    </g>
    
    <!-- Heavy Scanline -->
    <rect width="900" height="4" fill="#ffffff" opacity="0.4" filter="url(#glow)" style="pointer-events: none;">
      <animate attributeName="y" values="-10; 750" dur="3s" repeatCount="indefinite" />
    </rect>
  </g>

  <!-- HUD Overlay -->
  <g transform="translate(60, 50)" class="glitch">
    <rect x="-15" y="-15" width="20" height="20" fill="#ff7700" filter="url(#glow)">
      <animate attributeName="opacity" values="1; 0; 1" dur="1s" repeatCount="indefinite" step="end"/>
    </rect>
    <text class="hud-title" x="20" y="2" font-size="24" font-weight="900" filter="url(#glow)">SEKHMET KINETIC V10 MAX</text>
    <text class="hud-label" x="20" y="26">TARGET: ${HANDLE} // OMNIVERSE_ONLINE</text>
  </g>

  ${tiles}
  
  <g transform="translate(60, 690)">
    <text class="hud-label" x="0" y="0">LAST_SYNC: ${escapeXml(values ? updated : updated)}</text>
    <text class="hud-label" x="0" y="24">ENCRYPTION: LEVEL_10_MAXIMUM_OVERDRIVE</text>
  </g>
  
  <!-- Outer Frame Border -->
  <rect width="894" height="734" x="3" y="3" rx="37" fill="none" stroke="#ffd700" stroke-width="4" opacity="0.5" filter="url(#glow)" style="pointer-events: none;"/>
  <path d="M 0 100 L 20 100 L 20 200 L 0 200" fill="none" stroke="#ffffff" stroke-width="6" filter="url(#glow)"/>
  <path d="M 900 500 L 880 500 L 880 600 L 900 600" fill="none" stroke="#ffffff" stroke-width="6" filter="url(#glow)"/>
</svg>
`;
}

export async function updateMetrics({ output = new URL('../assets/github-metrics.svg', import.meta.url), ...options } = {}) {
  let temp;
  try {
    const svg = renderSvg(await fetchMetrics(options));
    temp = `${output instanceof URL ? fileURLToPath(output) : output}.${randomUUID()}.tmp`;
    await writeFile(temp, svg, { flag: 'wx' });
    await rename(temp, output);
  } catch {
    if (temp) await rm(temp, { force: true }).catch(() => {});
    throw new Error(FAILURE);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateMetrics().catch(() => { console.error(FAILURE); process.exitCode = 1; });
}
