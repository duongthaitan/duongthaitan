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
  const updated = values ? now.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : null;

  const accessibleText = values
    ? labels.map((l, i) => `${l}: ${values[i]}`).join('; ')
    : 'Awaiting first successful update';

  const titleText = values
    ? `Console output — ${accessibleText}`
    : 'Console output — Awaiting first successful update';

  const descText = values
    ? `DevTools Console panel showing GitHub metrics. ${accessibleText}. Updated ${updated}`
    : 'DevTools Console panel. Awaiting first successful update.';

  const height = values ? 300 : 200;

  let content;
  if (values) {
    const formatted = values.map(v => v.toLocaleString('en-US'));
    content = `
    <text x="20" y="80"><tspan class="pr">&gt; </tspan><tspan class="fn">gh.api</tspan><tspan>.</tspan><tspan class="fn">getMetrics</tspan><tspan>(</tspan><tspan class="st">"${escapeXml(HANDLE)}"</tspan><tspan>)</tspan></text>
    <text x="20" y="110">{</text>
    <text x="36" y="130"><tspan class="vr">repos</tspan><tspan class="op">: </tspan><tspan class="nm">${escapeXml(formatted[0])}</tspan><tspan class="op">,</tspan></text>
    <text x="36" y="150"><tspan class="vr">stars</tspan><tspan class="op">: </tspan><tspan class="nm">${escapeXml(formatted[1])}</tspan><tspan class="op">,</tspan></text>
    <text x="36" y="170"><tspan class="vr">followers</tspan><tspan class="op">: </tspan><tspan class="nm">${escapeXml(formatted[2])}</tspan></text>
    <text x="20" y="190" class="op">}</text>
    <text x="20" y="230" class="ok">✓ Updated ${escapeXml(updated)}</text>
    <text x="20" y="260"><tspan class="pr">&gt; </tspan></text>
    <rect class="cur" x="34" y="248" width="7" height="14" fill="#aeafad"><animate attributeName="opacity" values="1;1;0;0" dur="1s" repeatCount="indefinite"/></rect>`;
  } else {
    content = `
    <text x="20" y="80"><tspan class="pr">&gt; </tspan><tspan class="fn">gh.api</tspan><tspan>.</tspan><tspan class="fn">getMetrics</tspan><tspan>(</tspan><tspan class="st">"${escapeXml(HANDLE)}"</tspan><tspan>)</tspan></text>
    <text x="20" y="120" class="wait">Awaiting first successful update</text>
    <text x="20" y="160"><tspan class="pr">&gt; </tspan></text>
    <rect class="cur" x="34" y="148" width="7" height="14" fill="#aeafad"><animate attributeName="opacity" values="1;1;0;0" dur="1s" repeatCount="indefinite"/></rect>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="${height}" viewBox="0 0 900 ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="metrics-title metrics-desc" style="max-width:100%;height:auto">
  <title id="metrics-title">${escapeXml(titleText)}</title>
  <desc id="metrics-desc">${escapeXml(descText)}</desc>
  <defs>
    <clipPath id="metrics-frame"><rect width="900" height="${height}" rx="8"/></clipPath>
    <style>
      text{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:14px;fill:#d4d4d4}
      .tab{font-size:11px;fill:#8b949e}.tab-on{font-size:11px;fill:#e6edf3}
      .pr{fill:#569cd6}.fn{fill:#dcdcaa}.vr{fill:#9cdcfe}
      .st{fill:#ce9178}.nm{fill:#b5cea8}.op{fill:#d4d4d4}
      .ok{fill:#3fb950}.wait{fill:#8b949e}
      .cur{fill:#aeafad}
      @media(prefers-color-scheme:light){
        .bg{fill:#ffffff}.tab-bar{fill:#f3f3f3}
        text,.op{fill:#1e1e1e}.tab{fill:#616161}
        .tab-on{fill:#1e1e1e}.pr{fill:#0451a5}
        .fn{fill:#795e26}.vr{fill:#001080}.st{fill:#a31515}
        .nm{fill:#098658}.ok{fill:#1a7f37}.wait{fill:#57606a}
        .bdr{stroke:#d0d7de}.tab-bdr{stroke:#d0d7de}
      }
      @media(prefers-reduced-motion:reduce){.cur{display:none}}
      @media(forced-colors:active){.bg{fill:Canvas}.bdr{stroke:CanvasText}text,.tab,.tab-on,.pr,.fn,.vr,.st,.nm,.op,.ok,.wait{fill:CanvasText}}
    </style>
  </defs>
  <g clip-path="url(#metrics-frame)">
    <rect class="bg" width="900" height="${height}" fill="#0d1117"/>
    <rect class="tab-bar" width="900" height="28" fill="#161b22"/>
    <rect width="64" height="28" fill="#0d1117"/>
    <text x="12" y="18" class="tab-on">Console</text>
    <text x="78" y="18" class="tab">Elements</text>
    <text x="148" y="18" class="tab">Sources</text>
    <text x="210" y="18" class="tab">Network</text>
    <line x1="0" y1="28" x2="900" y2="28" stroke="#30363d" class="tab-bdr"/>
    <rect y="27" width="64" height="2" fill="#0078d4"/>
    <rect y="28" width="900" height="24" fill="#161b22" opacity="0.5"/>
    <text x="12" y="46" fill="#8b949e" font-size="11">Filter</text>
    <line x1="0" y1="52" x2="900" y2="52" stroke="#30363d" stroke-width="0.5" class="tab-bdr"/>
    ${content}
  </g>
  <rect class="bdr" x=".5" y=".5" width="899" height="${height - 1}" rx="7.5" fill="none" stroke="#30363d"/>
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
