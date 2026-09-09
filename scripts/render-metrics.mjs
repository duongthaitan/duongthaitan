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
  const updated = values ? now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'Awaiting first successful update';
  const summary = values ? labels.map((label, i) => `${label}: ${values[i]}`).join('; ') : 'Awaiting first successful update. Metrics not yet available.';
  
  // Create 3D Isometric Cards
  const tiles = labels.map((label, i) => {
    const value = values ? values[i].toLocaleString('en-US') : 'Pending';
    // Offset for isometric stacking
    const yOffset = 180 + i * 160;
    return `
    <g transform="translate(100 ${yOffset})">
      <!-- 3D Card Base with Floating Animation -->
      <g>
        <animateTransform attributeName="transform" type="translate" values="0,0; 0,-8; 0,0" dur="4s" begin="${i * 1.5}s" repeatCount="indefinite" />
        
        <!-- Bottom Shadow -->
        <path d="M 0 40 L 360 40 L 400 0 L 40 -0" fill="#000000" opacity="0.6" filter="url(#glow)"/>
        
        <!-- Left Side (3D Depth) -->
        <path d="M -20 20 L 0 40 L 0 140 L -20 120 Z" fill="#1e180a" stroke="#ffd700" stroke-width="1" opacity="0.9" />
        
        <!-- Top Side (3D Depth) -->
        <path d="M -20 20 L 340 20 L 360 40 L 0 40 Z" fill="#2d2210" stroke="#ffd700" stroke-width="1" opacity="0.9" />
        
        <!-- Front Face -->
        <rect x="0" y="40" width="360" height="100" fill="#0a0d14" stroke="url(#card-sweep)" stroke-width="2"/>
        
        <!-- Glassmorphism overlay -->
        <rect x="0" y="40" width="360" height="100" fill="url(#glass-grad)" opacity="0.5"/>
        
        <text class="secondary" x="25" y="75" font-size="22" filter="url(#glow)">${escapeXml(label)}</text>
        <text class="primary" x="25" y="125" font-size="${Math.min(48, 840 / value.length)}" font-weight="800" filter="url(#glow)">${escapeXml(value)}</text>
      </g>
    </g>`;
  }).join('\n  ');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="740" viewBox="0 0 600 740" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:900px;width:100%;height:auto">
  <title id="metrics-title">${escapeXml(`GitHub public snapshot — ${summary}. ${values ? 'Updated ' : ''}${updated}.`)}</title>
  <desc id="metrics-desc">${escapeXml(`${HANDLE}. ${summary}. Public, owned, non-fork repositories including archived repositories; stars on those repositories; public follower count. ${values ? 'Updated ' : ''}${updated}.`)}</desc>
  <defs>
    <clipPath id="metrics-frame"><rect width="600" height="740" rx="24"/></clipPath>
    <radialGradient id="metrics-nebula">
      <stop stop-color="#d4a017" stop-opacity=".3"/><stop offset=".5" stop-color="#c4762b" stop-opacity=".15"/><stop offset="1" stop-color="#d4a017" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-halo">
      <stop stop-color="#ffd700" stop-opacity=".4"/><stop offset="1" stop-color="#ffd700" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-planet" cx="32%" cy="24%" r="76%">
      <stop stop-color="#fff8e1"/><stop offset=".3" stop-color="#ffd700"/><stop offset=".6" stop-color="#8b6914"/><stop offset="1" stop-color="#10140a"/>
    </radialGradient>
    <linearGradient id="card-sweep" x1="0%" y1="0%" x2="200%" y2="0%">
      <stop offset="0%" stop-color="#ffd700" />
      <stop offset="50%" stop-color="#ff7700" />
      <stop offset="100%" stop-color="#ffd700" />
      <animate attributeName="x1" values="-100%;100%" dur="3s" repeatCount="indefinite" />
      <animate attributeName="x2" values="0%;200%" dur="3s" repeatCount="indefinite" />
    </linearGradient>
    <linearGradient id="glass-grad" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .panel{fill:#050712}.primary{fill:#e6edf3}.secondary{fill:#ffd700}
    .decoration{color:#c9a455}.orbit{fill:none;stroke:currentColor;stroke-width:1.5}.stars{fill:currentColor}
    text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    @media(prefers-color-scheme:light){.panel{fill:#fffdf6}.primary{fill:#1f2328}.secondary{fill:#d4a017}.decoration{color:#8b7d3e;opacity:.4}}
    @media(prefers-reduced-motion: reduce){ * { animation: none !important; } }
  </style>
  
  <!-- Outer Frame -->
  <rect class="panel" width="600" height="740" rx="24"/>
  <rect width="596" height="736" x="2" y="2" rx="22" fill="none" stroke="url(#card-sweep)" stroke-width="2" opacity="0.6"/>
  
  <!-- Animated 3D Background Elements -->
  <g class="decoration" aria-hidden="true" clip-path="url(#metrics-frame)">
    <g>
      <animateTransform attributeName="transform" type="translate" values="0,0; -15,-15; 0,0" dur="15s" repeatCount="indefinite" />
      <ellipse cx="490" cy="132" rx="350" ry="250" fill="url(#metrics-nebula)"/>
      <ellipse cx="46" cy="540" rx="300" ry="280" fill="url(#metrics-nebula)" opacity=".7"/>
    </g>

    <!-- Pulsing Halo -->
    <g>
      <animateTransform attributeName="transform" type="scale" values="1; 1.1; 1" dur="5s" repeatCount="indefinite" transform-origin="580 24" />
      <ellipse cx="580" cy="24" rx="200" ry="180" fill="url(#metrics-halo)"/>
    </g>

    <!-- Floating 3D Planet & Orbits -->
    <g>
      <animateTransform attributeName="transform" type="translate" values="0,0; 0,-15; 0,0" dur="8s" repeatCount="indefinite" />
      <circle cx="574" cy="30" r="90" fill="url(#metrics-planet)" stroke="#d4a017" stroke-opacity=".5" filter="url(#glow)"/>
      
      <!-- Multi-axis 3D Orbits -->
      <g>
         <animateTransform attributeName="transform" type="rotate" values="-28 574 30; 332 574 30" dur="25s" repeatCount="indefinite" />
         <ellipse class="orbit" cx="574" cy="30" rx="140" ry="30" opacity=".7"/>
      </g>
      <g>
         <animateTransform attributeName="transform" type="rotate" values="45 574 30; -315 574 30" dur="35s" repeatCount="indefinite" />
         <ellipse class="orbit" cx="574" cy="30" rx="160" ry="40" opacity=".4"/>
      </g>
    </g>

    <!-- Deep Space Parallax Stars -->
    <g class="stars" opacity=".9">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite" />
      <circle cx="362" cy="23" r="2"/><circle cx="432" cy="42" r="2.5"/><circle cx="473" cy="112" r="2"/><circle cx="550" cy="126" r="2.5"/>
      <circle cx="18" cy="122" r="2"/><circle cx="206" cy="127" r="1.5"/><circle cx="582" cy="223" r="2"/><circle cx="14" cy="286" r="2.5"/>
    </g>
  </g>

  <g transform="translate(10, 0)">
    <text class="secondary" x="28" y="45" font-size="18" font-weight="700" letter-spacing="3" filter="url(#glow)">3D SOLAR METRICS ENGINE</text>
    <text class="primary" x="28" y="90" font-size="36" font-weight="800" filter="url(#glow)">GitHub Live Telemetry</text>
    <text class="secondary" x="28" y="125" font-size="24" fill="#ff7700">${HANDLE}</text>
  </g>

  ${tiles}
  
  <text class="secondary" x="28" y="685" font-size="18" fill="#aeb8c5">${escapeXml(values ? `Updated ${updated}` : updated)}</text>
  <text class="secondary" x="28" y="715" font-size="18" fill="#aeb8c5">Public only · Archived included</text>
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
