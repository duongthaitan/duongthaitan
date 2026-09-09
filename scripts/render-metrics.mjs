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
  const tiles = labels.map((label, i) => {
    const value = values ? values[i].toLocaleString('en-US') : 'Pending';
    return `<g transform="translate(24 ${142 + i * 154})">
      <rect class="tile" width="552" height="140" rx="18" fill="#10140a" stroke="#3d3018" />
      <!-- Animated glowing border effect inside the tile -->
      <rect class="tile-glow" width="552" height="140" rx="18" fill="none" stroke="url(#metrics-halo)" stroke-width="2" opacity="0.5">
        <animate attributeName="opacity" values="0.2;0.8;0.2" dur="4s" begin="${i * 1.5}s" repeatCount="indefinite" />
      </rect>
      <text class="secondary" x="28" y="44" font-size="28">${escapeXml(label)}</text>
      <text class="primary" x="28" y="115" font-size="${Math.min(56, 840 / value.length)}" font-weight="650" filter="url(#glow)">${escapeXml(value)}</text>
    </g>`;
  }).join('\n  ');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="704" viewBox="0 0 600 704" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:900px;width:100%;height:auto">
  <title id="metrics-title">${escapeXml(`GitHub public snapshot — ${summary}. ${values ? 'Updated ' : ''}${updated}.`)}</title>
  <desc id="metrics-desc">${escapeXml(`${HANDLE}. ${summary}. Public, owned, non-fork repositories including archived repositories; stars on those repositories; public follower count. ${values ? 'Updated ' : ''}${updated}.`)}</desc>
  <defs>
    <clipPath id="metrics-frame"><rect width="600" height="704" rx="24"/></clipPath>
    <radialGradient id="metrics-nebula">
      <stop stop-color="#d4a017" stop-opacity=".25"/><stop offset=".5" stop-color="#c4762b" stop-opacity=".1"/><stop offset="1" stop-color="#d4a017" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-halo">
      <stop stop-color="#ffd700" stop-opacity=".3"/><stop offset="1" stop-color="#ffd700" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-planet" cx="32%" cy="24%" r="76%">
      <stop stop-color="#fff8e1"/><stop offset=".3" stop-color="#ffd700"/><stop offset=".6" stop-color="#8b6914"/><stop offset="1" stop-color="#10140a"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <style>
    .panel{fill:#070b19}.tile{fill:#10140a;stroke:#3d3018}.primary{fill:#e6edf3}.secondary{fill:#aeb8c5}
    .decoration{color:#c9a455}.orbit{fill:none;stroke:currentColor;stroke-width:1.5}.stars{fill:currentColor}
    text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    @media(prefers-color-scheme:light){.panel{fill:#fffdf6}.tile{fill:#ffffff;stroke:#e8dcc0}.primary{fill:#1f2328}.secondary{fill:#57606a}.decoration{color:#8b7d3e;opacity:.4}}
    @media(forced-colors:active){.decoration{display:none}.panel,.tile{fill:Canvas;stroke:CanvasText}.primary,.secondary{fill:CanvasText}}
    @media(prefers-reduced-motion: reduce){ * { animation: none !important; } }
  </style>
  
  <rect class="panel" width="600" height="704" rx="24"/>
  
  <!-- Animated Background Elements -->
  <g class="decoration" aria-hidden="true" clip-path="url(#metrics-frame)">
    <g>
      <animateTransform attributeName="transform" type="translate" values="0,0; -10,-10; 0,0" dur="10s" repeatCount="indefinite" />
      <ellipse cx="490" cy="132" rx="320" ry="228" fill="url(#metrics-nebula)"/>
      <ellipse cx="46" cy="540" rx="240" ry="220" fill="url(#metrics-nebula)" opacity=".65"/>
    </g>

    <!-- Pulsing Halo -->
    <g>
      <animateTransform attributeName="transform" type="scale" values="1; 1.05; 1" dur="4s" repeatCount="indefinite" transform-origin="580 24" />
      <ellipse cx="580" cy="24" rx="178" ry="164" fill="url(#metrics-halo)"/>
    </g>

    <!-- Rotating Orbits -->
    <g class="orbit" opacity=".3">
      <ellipse cx="446" cy="132" rx="236" ry="86" transform="rotate(-28 446 132)">
        <animateTransform attributeName="transform" type="rotate" from="-28 446 132" to="332 446 132" dur="60s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="344" cy="346" rx="356" ry="214" transform="rotate(-35 344 346)">
        <animateTransform attributeName="transform" type="rotate" from="-35 344 346" to="-395 344 346" dur="90s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="60" cy="586" rx="254" ry="80" transform="rotate(-24 60 586)">
         <animateTransform attributeName="transform" type="rotate" from="-24 60 586" to="336 60 586" dur="45s" repeatCount="indefinite" />
      </ellipse>
    </g>

    <!-- Floating 3D Planet -->
    <g>
      <animateTransform attributeName="transform" type="translate" values="0,0; 0,-8; 0,0" dur="6s" repeatCount="indefinite" />
      <circle cx="574" cy="30" r="78" fill="url(#metrics-planet)" stroke="#d4a017" stroke-opacity=".4" filter="url(#glow)"/>
      <ellipse class="orbit" cx="574" cy="30" rx="118" ry="27" transform="rotate(-28 574 30)" opacity=".6">
        <animateTransform attributeName="transform" type="rotate" from="-28 574 30" to="332 574 30" dur="20s" repeatCount="indefinite" />
      </ellipse>
    </g>

    <!-- Twinkling Stars -->
    <g class="stars" opacity=".8">
      <animate attributeName="opacity" values="0.4;1;0.4" dur="3s" repeatCount="indefinite" />
      <circle cx="362" cy="23" r="1.5"/><circle cx="432" cy="42" r="2"/><circle cx="473" cy="112" r="1.5"/><circle cx="550" cy="126" r="1.8"/>
      <circle cx="18" cy="122" r="1.5"/><circle cx="206" cy="127" r="1.2"/><circle cx="582" cy="223" r="1.5"/><circle cx="14" cy="286" r="2"/>
    </g>
    <g class="stars" opacity=".5">
      <animate attributeName="opacity" values="1;0.2;1" dur="4s" repeatCount="indefinite" />
      <circle cx="408" cy="289" r="1.4"/><circle cx="587" cy="390" r="1.8"/><circle cx="180" cy="442" r="1.5"/><circle cx="19" cy="482" r="1.2"/>
      <circle cx="581" cy="555" r="1.5"/><circle cx="458" cy="605" r="2"/><circle cx="20" cy="662" r="1.5"/><circle cx="570" cy="688" r="1.2"/>
    </g>

    <!-- Leo Constellation Overlay -->
    <path d="M449 91l18-12l25 8l10 20M583 310l-20 15l-10-30" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-linecap="round" opacity=".5" filter="url(#glow)">
      <animate attributeName="opacity" values="0.2;0.8;0.2" dur="5s" repeatCount="indefinite" />
    </path>
    <circle cx="449" cy="91" r="2" fill="#fff" filter="url(#glow)" />
    <circle cx="467" cy="79" r="3" fill="#ffd700" filter="url(#glow)" />
    <circle cx="492" cy="87" r="2" fill="#fff" filter="url(#glow)" />
    <circle cx="502" cy="107" r="4" fill="#ffd700" filter="url(#glow)" />
  </g>

  <text class="secondary" x="28" y="38" font-size="17" letter-spacing="2.6" filter="url(#glow)">SEKHMET SOLAR OBSERVATORY</text>
  <text class="primary" x="28" y="78" font-size="30" font-weight="650">GitHub public snapshot</text>
  <text class="secondary" x="28" y="111" font-size="23">${HANDLE}</text>
  
  ${tiles}
  
  <text class="secondary" x="28" y="637" font-size="23">${escapeXml(values ? `Updated ${updated}` : updated)}</text>
  <text class="secondary" x="28" y="675" font-size="23">Public only · Archived included</text>
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
