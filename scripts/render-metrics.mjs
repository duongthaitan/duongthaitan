import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

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
    return `<g transform="translate(24 ${108 + i * 150})">
    <rect class="tile" width="552" height="138" rx="16"/>
    <text class="secondary" x="28" y="42" font-size="28">${escapeXml(label)}</text>
    <text class="primary" x="28" y="110" font-size="${Math.min(52, 840 / value.length)}" font-weight="650">${escapeXml(value)}</text>
  </g>`;
  }).join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="650" viewBox="0 0 600 650" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:900px;width:100%;height:auto">
  <title id="metrics-title">${escapeXml(`GitHub public snapshot — ${summary}`)}</title>
  <desc id="metrics-desc">${escapeXml(`${HANDLE}. ${summary}. Public, owned, non-fork repositories including archived repositories; stars on those repositories; public follower count. ${values ? 'Updated ' : ''}${updated}.`)}</desc>
  <style>
    .panel{fill:#0d1117}.tile{fill:#161b22;stroke:#30363d}.primary{fill:#e6edf3}.secondary{fill:#aeb8c5}
    text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
    @media(prefers-color-scheme:light){.panel{fill:#ffffff}.tile{fill:#f6f8fa;stroke:#d0d7de}.primary{fill:#1f2328}.secondary{fill:#57606a}}
    @media(forced-colors:active){.panel,.tile{fill:Canvas;stroke:CanvasText}.primary,.secondary{fill:CanvasText}}
  </style>
  <rect class="panel" width="600" height="650" rx="22"/>
  <text class="primary" x="28" y="48" font-size="28" font-weight="650">GitHub · public snapshot</text>
  <text class="secondary" x="28" y="81" font-size="23">${HANDLE}</text>
  <g aria-hidden="true"><rect x="480" y="71" width="22" height="4" rx="2" fill="#0891b2"/><rect x="512" y="71" width="22" height="4" rx="2" fill="#8b5cf6"/><rect x="544" y="71" width="22" height="4" rx="2" fill="#db2777"/></g>
  ${tiles}
  <text class="secondary" x="28" y="590" font-size="23">${escapeXml(values ? `Updated ${updated}` : updated)}</text>
  <text class="secondary" x="28" y="625" font-size="23">Public only · Archived included</text>
</svg>
`;
}

export async function updateMetrics({ output = new URL('../assets/github-metrics.svg', import.meta.url), ...options } = {}) {
  let temp;
  try {
    const svg = renderSvg(await fetchMetrics(options));
    temp = output instanceof URL ? new URL(`${output.href}.${randomUUID()}.tmp`) : `${output}.${randomUUID()}.tmp`;
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
