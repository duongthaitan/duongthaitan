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
    const yOffset = 180 + i * 170;
    return `
    <g transform="translate(40 ${yOffset})">
      <animateTransform attributeName="transform" type="translate" values="40,${yOffset}; 45,${yOffset}; 40,${yOffset}" dur="${3 + i}s" repeatCount="indefinite" />
      
      <!-- Tech HUD Frame -->
      <path d="M 0 30 L 20 0 L 320 0 L 340 30 L 320 60 L 20 60 Z" fill="#070a13" stroke="#ffd700" stroke-width="1.5" opacity="0.85" filter="url(#glow)"/>
      <path d="M 2 30 L 20 3 L 318 3" fill="none" stroke="#ff7700" stroke-width="1.5" opacity="0.5">
         <animate attributeName="opacity" values="0.2; 1; 0.2" dur="2s" begin="${i}s" repeatCount="indefinite" />
      </path>

      <!-- Sine Wave Animation inside the card -->
      <g opacity="0.3" stroke="#ffd700" stroke-width="1.5" fill="none" stroke-linecap="round">
        <animateTransform attributeName="transform" type="translate" values="0,0; -40,0" dur="2s" repeatCount="indefinite" />
        <path d="M 20 45 Q 30 35, 40 45 T 60 45 T 80 45 T 100 45 T 120 45 T 140 45 T 160 45 T 180 45 T 200 45 T 220 45 T 240 45 T 260 45 T 280 45 T 300 45 T 320 45 T 340 45 T 360 45"/>
      </g>
      
      <text class="hud-label" x="40" y="22" filter="url(#glow)">${escapeXml(label).toUpperCase()}</text>
      <text class="hud-value" x="40" y="48" font-size="28" font-weight="800" filter="url(#glow)">[ ${escapeXml(value)} ]</text>
    </g>`;
  }).join('\n  ');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="740" viewBox="0 0 900 740" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:100%;height:auto">
  <title id="metrics-title">Sekhmet Solar HUD</title>
  <desc id="metrics-desc">V3 Kinetic UI GitHub Metrics</desc>
  <defs>
    <clipPath id="metrics-frame"><rect width="900" height="740" rx="30"/></clipPath>
    <radialGradient id="nebula">
      <stop stop-color="#ff7700" stop-opacity=".3"/><stop offset=".4" stop-color="#d4a017" stop-opacity=".15"/><stop offset="1" stop-color="#050712" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="core-glow">
      <stop stop-color="#ffffff" stop-opacity=".8"/><stop offset=".2" stop-color="#ffd700" stop-opacity=".6"/><stop offset="1" stop-color="#ffd700" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="blur" />
      <feGaussianBlur stdDeviation="8" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2"/>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .panel{fill:#02040a}.hud-label{fill:#c2b280;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:2px}
    .hud-value{fill:#e6edf3;font-family:system-ui,-apple-system,sans-serif}
    .hud-title{fill:#ffd700;font-family:system-ui,-apple-system,sans-serif;letter-spacing:4px}
    .orbit{fill:none;stroke:#ffd700;stroke-width:1.5}
    @media(prefers-reduced-motion: reduce){ * { animation: none !important; } }
  </style>
  
  <rect class="panel" width="900" height="740" rx="30"/>
  
  <g clip-path="url(#metrics-frame)">
    <!-- Deep Space Background & Grid -->
    <g opacity="0.1" stroke="#ffffff" stroke-width="0.5">
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none"/>
      </pattern>
      <rect width="900" height="740" fill="url(#grid)"/>
    </g>

    <ellipse cx="650" cy="370" rx="450" ry="350" fill="url(#nebula)">
      <animate attributeName="opacity" values="0.4;0.8;0.4" dur="6s" repeatCount="indefinite" />
    </ellipse>

    <!-- Complex Gyroscope HUD Core -->
    <g transform="translate(650, 370)">
      <!-- Outer Data Ring -->
      <g filter="url(#glow)">
        <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="60s" repeatCount="indefinite" />
        <circle r="260" class="orbit" stroke-dasharray="10 40" opacity="0.6"/>
        <circle r="240" class="orbit" stroke-dasharray="100 20 10 20" opacity="0.8"/>
      </g>

      <!-- Middle Gyro Ring -->
      <g filter="url(#glow)">
        <animateTransform attributeName="transform" type="rotate" values="360; 0" dur="30s" repeatCount="indefinite" />
        <ellipse rx="210" ry="120" class="orbit" stroke-dasharray="40 10" opacity="0.9"/>
        <ellipse rx="210" ry="120" class="orbit" transform="rotate(90)" stroke-dasharray="20 30" opacity="0.5"/>
      </g>

      <!-- Inner High-Speed Ring -->
      <g filter="url(#glow)">
        <animateTransform attributeName="transform" type="rotate" values="0; 360" dur="15s" repeatCount="indefinite" />
        <circle r="140" class="orbit" stroke-width="2" stroke-dasharray="5 15" stroke-dashoffset="0">
           <animate attributeName="stroke-dashoffset" values="0; 20" dur="1s" repeatCount="indefinite" />
        </circle>
        <circle r="120" class="orbit" stroke-width="1" stroke-dasharray="50 50" opacity="0.8"/>
      </g>
      
      <!-- Pulsing Core -->
      <circle r="80" fill="url(#core-glow)">
        <animateTransform attributeName="transform" type="scale" values="0.9; 1.1; 0.9" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle r="30" fill="#ffffff" filter="url(#glow)">
        <animateTransform attributeName="transform" type="scale" values="1; 1.2; 1" dur="1.5s" repeatCount="indefinite" />
      </circle>
      
      <!-- Particle Burst -->
      <g fill="#ffd700" filter="url(#glow)">
        <animateTransform attributeName="transform" type="rotate" values="0; -360" dur="20s" repeatCount="indefinite" />
        <circle cx="0" cy="-180" r="4"/><circle cx="150" cy="100" r="3"/><circle cx="-150" cy="100" r="5"/>
        <circle cx="230" cy="-50" r="2"/><circle cx="-200" cy="-120" r="4"/><circle cx="0" cy="250" r="3"/>
      </g>
    </g>

    <!-- Scanline Sweep Effect -->
    <rect width="900" height="2" fill="#ffd700" opacity="0.3" filter="url(#glow)">
      <animate attributeName="y" values="-10; 750" dur="4s" repeatCount="indefinite" />
    </rect>
  </g>

  <!-- HUD Text Overlay -->
  <g transform="translate(40, 60)">
    <rect x="0" y="0" width="12" height="12" fill="#ff7700" filter="url(#glow)">
      <animate attributeName="opacity" values="1; 0; 1" dur="2s" repeatCount="indefinite" step="end"/>
    </rect>
    <text class="hud-title" x="25" y="12" font-size="20" font-weight="900" filter="url(#glow)">SEKHMET KINETIC TELEMETRY</text>
    <text class="hud-label" x="25" y="32">SYSTEM_ID: ${HANDLE}</text>
    <text class="hud-label" x="25" y="52">STATUS: ONLINE / 3D_ENGINE_ACTIVE</text>
  </g>

  ${tiles}
  
  <g transform="translate(40, 690)">
    <text class="hud-label" x="0" y="0">LAST_SYNC: ${escapeXml(values ? updated : updated)}</text>
    <text class="hud-label" x="0" y="20">DATA_SOURCE: PUBLIC_AND_ARCHIVED_REPOSITORIES</text>
  </g>
  
  <!-- Outer HUD Frame Border -->
  <rect width="896" height="736" x="2" y="2" rx="28" fill="none" stroke="#ffd700" stroke-width="3" opacity="0.4" filter="url(#glow)"/>
  <path d="M 0 50 L 10 50 L 10 100 L 0 100" fill="none" stroke="#ffd700" stroke-width="4" filter="url(#glow)"/>
  <path d="M 900 650 L 890 650 L 890 700 L 900 700" fill="none" stroke="#ffd700" stroke-width="4" filter="url(#glow)"/>
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
