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
    <rect class="tile" width="552" height="140" rx="18"/>
    <text class="secondary" x="28" y="44" font-size="28">${escapeXml(label)}</text>
    <text class="primary" x="28" y="115" font-size="${Math.min(56, 840 / value.length)}" font-weight="650">${escapeXml(value)}</text>
  </g>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="704" viewBox="0 0 600 704" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:900px;width:100%;height:auto">
  <title id="metrics-title">${escapeXml(`GitHub public snapshot — ${summary}. ${values ? 'Updated ' : ''}${updated}.`)}</title>
  <desc id="metrics-desc">${escapeXml(`${HANDLE}. ${summary}. Public, owned, non-fork repositories including archived repositories; stars on those repositories; public follower count. ${values ? 'Updated ' : ''}${updated}.`)}</desc>
  <defs>
    <clipPath id="metrics-frame"><rect width="600" height="704" rx="24"/></clipPath>
    <radialGradient id="metrics-nebula">
      <stop stop-color="#a78bfa" stop-opacity=".2"/><stop offset=".5" stop-color="#df82b5" stop-opacity=".08"/><stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-halo">
      <stop stop-color="#67d9ed" stop-opacity=".14"/><stop offset="1" stop-color="#67d9ed" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="metrics-planet" cx="32%" cy="24%" r="76%">
      <stop stop-color="#b8e6f3"/><stop offset=".35" stop-color="#8b83c8"/><stop offset=".7" stop-color="#343957"/><stop offset="1" stop-color="#10182d"/>
    </radialGradient>
  </defs>
  <style>
    .panel{fill:#070b19}.tile{fill:#10182d;stroke:#2b3650}.primary{fill:#e6edf3}.secondary{fill:#aeb8c5}
    .decoration{color:#aeb8c5}.orbit{fill:none;stroke:currentColor;stroke-width:1}.stars{fill:currentColor}
    text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    @media(prefers-color-scheme:light){.panel{fill:#f6f8ff}.tile{fill:#ffffff;stroke:#d8dfed}.primary{fill:#1f2328}.secondary{fill:#57606a}.decoration{color:#57606a;opacity:.4}}
    @media(forced-colors:active){.decoration{display:none}.panel,.tile{fill:Canvas;stroke:CanvasText}.primary,.secondary{fill:CanvasText}}
  </style>
  <rect class="panel" width="600" height="704" rx="24"/>
  <g class="decoration" aria-hidden="true" clip-path="url(#metrics-frame)">
    <ellipse cx="490" cy="132" rx="320" ry="228" fill="url(#metrics-nebula)"/>
    <ellipse cx="46" cy="540" rx="240" ry="220" fill="url(#metrics-nebula)" opacity=".65"/>
    <ellipse cx="580" cy="24" rx="178" ry="164" fill="url(#metrics-halo)"/>
    <g class="orbit" opacity=".2">
      <ellipse cx="446" cy="132" rx="236" ry="86" transform="rotate(-28 446 132)"/>
      <ellipse cx="344" cy="346" rx="356" ry="214" transform="rotate(-35 344 346)"/>
      <ellipse cx="60" cy="586" rx="254" ry="80" transform="rotate(-24 60 586)"/>
    </g>
    <circle cx="574" cy="30" r="78" fill="url(#metrics-planet)" stroke="#b8c9f3" stroke-opacity=".25"/>
    <ellipse class="orbit" cx="574" cy="30" rx="118" ry="27" transform="rotate(-28 574 30)" opacity=".45"/>
    <g class="stars" opacity=".6">
      <circle cx="362" cy="23" r="1"/><circle cx="432" cy="42" r="1.4"/><circle cx="473" cy="112" r="1"/><circle cx="550" cy="126" r="1.2"/>
      <circle cx="18" cy="122" r="1"/><circle cx="206" cy="127" r=".8"/><circle cx="582" cy="223" r="1"/><circle cx="14" cy="286" r="1.3"/>
      <circle cx="408" cy="289" r=".9"/><circle cx="587" cy="390" r="1.2"/><circle cx="180" cy="442" r="1"/><circle cx="19" cy="482" r=".8"/>
      <circle cx="581" cy="555" r="1"/><circle cx="458" cy="605" r="1.3"/><circle cx="20" cy="662" r="1"/><circle cx="570" cy="688" r=".8"/>
    </g>
    <path d="M449 91h8m-4-4v8M583 310h6m-3-3v6" stroke="#aeb8c5" stroke-linecap="round" opacity=".5"/>
  </g>
  <text class="secondary" x="28" y="38" font-size="17" letter-spacing="2.6">ORBITAL TELEMETRY</text>
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
