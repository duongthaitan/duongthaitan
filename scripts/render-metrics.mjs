import { writeFile, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { A, ADV, EASE, chevron, escapeXml, style, svg, text, typed } from './svg-kit.mjs';

export { escapeXml };

const HANDLE = 'duongthaitan';
export const FAILURE = 'Metrics update failed; previous asset preserved.';
const invalid = () => { throw new Error(FAILURE); };
const count = value => Number.isSafeInteger(value) && value >= 0 ? value : invalid();

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
  const titleText = `GitHub metrics: ${accessibleText}`;
  const descText = values
    ? `Terminal card running gh api for ${HANDLE}. ${accessibleText}. Updated ${updated}`
    : `Terminal card running gh api for ${HANDLE}. Awaiting first successful update.`;

  const W = 900;
  const cmd = typed(52, 50, `gh api users/${HANDLE}`, { size: 15, delay: 200, cps: 30, caret: 'vanish' });
  const parts = [chevron(32, 50, 15, A('in', 240, 80)), cmd.svg];
  const t0 = cmd.end + 360;

  if (values) {
    // Three stat tiles. Values wear text ink and only fade: data the reader is reading never moves.
    const tiles = ['Public repos', 'Stars', 'Followers'];
    const colW = (W - 64) / 3;
    values.forEach((value, i) => {
      const x = 32 + i * colW;
      const formatted = value.toLocaleString('en-US');
      const size = Math.min(40, Math.floor((colW - 40) / (formatted.length * ADV)));
      const delay = t0 + i * 80;
      if (i) parts.push(`<path class="hair" d="M${Math.round(x - 20)}.5 86V170"${style(A('in', 400, t0))}/>`);
      parts.push(`<rect class="ac grow" x="${Math.round(x)}" y="86" width="20" height="2" rx="1"${style(A('grow', 480, delay, EASE.inOut))}/>`);
      parts.push(text(x, 116, tiles[i], { size: 13, cls: 'mu', anim: A('in', 420, delay + 60) }));
      parts.push(text(x, 160, formatted, { size, weight: 600, anim: A('in', 600, delay + 120) }));
    });
    // Live indicator: real state (the panel refreshes daily), so a status dot is earned here.
    const liveAt = t0 + 520;
    parts.push(`<g${style(A('in', 420, liveAt))}><circle class="ac" cx="37" cy="202" r="3.5"/>${text(52, 206, `Updated ${updated}`, { size: 12, cls: 'mu' })}</g>`);
    parts.push(`<circle class="ring" cx="37" cy="202" r="3.5"${style(`ring 2400ms ${EASE.out} ${Math.round(liveAt + 500)}ms 5`)}/>`);
  } else {
    parts.push(text(52, 100, 'Awaiting first successful update', { size: 14, cls: 'mu', anim: A('in', 420, t0) }));
  }

  return svg({ w: W, h: values ? 232 : 136, id: 'metrics', title: titleText, desc: descText, body: parts.join('\n') });
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
