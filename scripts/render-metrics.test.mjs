import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { FAILURE, escapeXml, fetchMetrics, renderSvg, updateMetrics } from './render-metrics.mjs';

const owner = { id: 7, login: 'duongthaitan' };
const user = { ...owner, followers: 12 };
const repo = (id, extra = {}) => ({ id, owner, fork: false, private: false, stargazers_count: 2, ...extra });
const response = data => ({ ok: true, json: async () => data });
const fake = (pages = [], profile = user) => async url => {
  const page = new URL(url).searchParams.get('page');
  return response(page ? pages[Number(page) - 1] ?? [] : profile);
};
const rejected = promise => assert.rejects(promise, { message: FAILURE });

// ponytail: regression guard for owned SVGs; use a real sanitizer before accepting uploaded artwork.
function checkSvg(svg) {
  assert.match(svg, /<svg(?:\s|>)/);
  assert.doesNotMatch(svg, /<\s*(?:script|foreignObject|animate\w*|set)\b|\son\w+\s*=|@import\b|<!DOCTYPE|<!ENTITY|\binfinite\b/i);
  const ids = [...svg.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'SVG IDs must be unique');
  const refs = [...svg.matchAll(/\burl\s*\(\s*([^)]*?)\s*\)/gi)].map(match => match[1].replace(/^(['"])(.*)\1$/, '$2'));
  refs.push(...[...svg.matchAll(/\b(?:xlink:)?href=["']([^"']+)["']/gi)].map(match => match[1]));
  for (const ref of refs) {
    assert.match(ref, /^#[\w-]+$/, 'Only local SVG fragments allowed');
    assert.ok(ids.includes(ref.slice(1)), 'SVG reference must resolve');
  }
  if (/\banimation\s*:/i.test(svg)) assert.match(svg, /prefers-reduced-motion\s*:\s*reduce/);
}

test('paginates beyond 100 to empty; excludes forks/private; includes archived', async () => {
  const pages = [Array.from({ length: 100 }, (_, i) => repo(i + 1)), [repo(101, { archived: true }), repo(102, { fork: true }), repo(103, { private: true })], []];
  const urls = [];
  const fetchImpl = async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return fake(pages)(url);
  };
  assert.deepEqual(await fetchMetrics({ fetchImpl }), { repos: 101, stars: 202, followers: 12 });
  assert.deepEqual(urls, ['https://api.github.com/users/duongthaitan', ...[1, 2, 3].map(page => `https://api.github.com/users/duongthaitan/repos?type=owner&per_page=100&page=${page}&sort=full_name`)]);
});

test('empty account renders genuine zeros, not placeholder', async () => {
  const metrics = await fetchMetrics({ fetchImpl: fake([], { ...user, followers: 0 }) });
  assert.deepEqual(metrics, { repos: 0, stars: 0, followers: 0 });
  const svg = renderSvg(metrics, new Date('2026-01-02T03:04:05Z'));
  assert.match(svg, /Public original repos: 0; Stars on original repos: 0; Followers: 0/);
  assert.match(svg, /Updated 2026-01-02 03:04:05 UTC/);
  assert.doesNotMatch(svg, /Pending|Awaiting/);
  assert.match(renderSvg(), /Awaiting first successful update/);
  assert.doesNotMatch(renderSvg(), /repos: 0|Followers: 0|Updated/);
});

test('rejects malformed counters, identity, schema, duplicates and overflow', async () => {
  for (const value of [-1, 1.5, '3', null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await rejected(fetchMetrics({ fetchImpl: fake([], { ...user, followers: value }) }));
    await rejected(fetchMetrics({ fetchImpl: fake([[repo(1, { stargazers_count: value })]]) }));
  }
  for (const profile of [null, {}, { ...user, login: 'other' }, { ...user, login: 1 }, { ...user, id: 0 }])
    await rejected(fetchMetrics({ fetchImpl: fake([], profile) }));
  for (const pages of [[{}], [[null]], [[repo(0)]], [[repo(1, { owner: { ...owner, id: 9 } })]], [[repo(1, { owner: { ...owner, login: 'other' } })]], [[repo(1, { fork: 'false' })]], [[repo(1, { private: null })]], [[repo(1)], [repo(1)]], [Array.from({ length: 101 }, (_, i) => repo(i + 1))], [[repo(1, { stargazers_count: Number.MAX_SAFE_INTEGER }), repo(2)]]])
    await rejected(fetchMetrics({ fetchImpl: fake(pages) }));
});

test('sanitizes HTTP, invalid JSON, network and timeout failures', async () => {
  for (const fetchImpl of [async () => ({ ok: false, status: 403 }), async () => ({ ok: false, status: 429 }), async () => ({ ok: false, status: 503 }), async () => ({ ok: true, json: async () => { throw new Error('upstream detail'); } }), async () => { throw new Error('upstream detail'); }, async (_url, { signal }) => { await delay(1000, null, { signal }); }])
    await rejected(fetchMetrics({ fetchImpl, timeoutMs: 15 }));
});

test('escapes XML; rejects untrusted values; exposes all values accessibly', () => {
  assert.equal(escapeXml(`<tag attr="'">&`), '&lt;tag attr=&quot;&apos;&quot;&gt;&amp;');
  assert.throws(() => renderSvg({ repos: '<script/>', stars: 0, followers: 0 }), { message: FAILURE });
  const svg = renderSvg({ repos: 4, stars: 8, followers: 16 });
  for (const tag of ['title', 'desc']) assert.match(svg, new RegExp(`<${tag}[^>]*>[^<]*Public original repos: 4; Stars on original repos: 8; Followers: 16`));
  assert.match(svg, /prefers-color-scheme:light/);
  checkSvg(svg);
});

test('preserves old asset on failure; replaces atomically on success; cleans temp', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'profile-metrics-'));
  const output = join(dir, 'metrics.svg');
  try {
    await writeFile(output, 'previous asset');
    for (const fetchImpl of [async () => { throw new Error('upstream detail'); }, fake([[repo(1)], [repo(2, { stargazers_count: -1 })]]), async (_url, { signal }) => { await delay(1000, null, { signal }); }]) {
      await rejected(updateMetrics({ output, fetchImpl, timeoutMs: 15 }));
      assert.equal(await readFile(output, 'utf8'), 'previous asset');
      assert.deepEqual(await readdir(dir), ['metrics.svg']);
    }
    for (const suffix of ['', '?preview=1', '#preview']) {
      const fileUrl = new URL(`${pathToFileURL(output).href}${suffix}`);
      await updateMetrics({ output: fileUrl, fetchImpl: fake([[repo(1)]]) });
      const snapshot = await readFile(output, 'utf8');
      assert.match(snapshot, /Public original repos: 1; Stars on original repos: 2; Followers: 12/);
      await rejected(updateMetrics({ output: fileUrl, fetchImpl: async () => { throw new Error('upstream detail'); } }));
      assert.equal(await readFile(output, 'utf8'), snapshot);
      assert.deepEqual(await readdir(dir), ['metrics.svg']);
    }
    await rejected(updateMetrics({ output: dir, fetchImpl: fake() }));
    assert.deepEqual(await readdir(dir), ['metrics.svg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('galaxy SVG guard permits local paint but rejects missing or external references', () => {
  checkSvg('<svg><linearGradient id="light"/><rect fill="url(#light)"/></svg>');
  for (const fragment of ['<script/>', '<animate/>', '<foreignObject/>', '<rect onclick="run()"/>', '<style>@import "https://example.com/font";</style>', '<rect fill="url(https://example.com/paint)"/>', '<image href="data:image/png;base64,AA=="/>', '<rect fill="url(#missing)"/>', '<g id="same"/><g id="same"/>'])
    assert.throws(() => checkSvg(`<svg>${fragment}</svg>`));
});

test('all sections have local artwork and every README navigation anchor resolves', async () => {
  const root = new URL('../', import.meta.url);
  const scenes = ['about', 'toolkit', 'selected-work', 'certificates', 'automation', 'connect'];
  const readme = await readFile(new URL('README.md', root), 'utf8');
  for (const file of ['assets/hero-banner.svg', 'assets/section-divider.svg', 'assets/github-metrics.svg', ...scenes.map(scene => `assets/galaxy/${scene}.svg`)]) {
    const svg = await readFile(new URL(file, root), 'utf8');
    checkSvg(svg);
    assert.ok(readme.includes(`./${file}`), 'Every scene must appear in README');
    assert.ok(Buffer.byteLength(svg) < 32_000, 'Keep local artwork lightweight');
  }
  for (const match of readme.matchAll(/(?:src=["']|href=["']|\]\()(\.\/[^"'\s)]+)/g))
    await readFile(new URL(match[1].split(/[?#]/)[0], root));
  const headings = [...readme.matchAll(/^#{1,6}\s+(.+)$/gm), ...readme.matchAll(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/g)].map(match => match[1].toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-'));
  for (const match of readme.matchAll(/href="#([^"]+)"/g)) assert.ok(headings.includes(match[1]), 'Navigation must resolve');
  for (const certificate of ['cert/4tv2o', 'cert/d0gj4', 'cert/kj7vr', 'CT-11PGKZIX', 'CC-USOBZSX7']) assert.ok(readme.includes(certificate));
});

test('maximum counters keep exact accessible values without moving data', () => {
  const max = Number.MAX_SAFE_INTEGER;
  const svg = renderSvg({ repos: max, stars: max, followers: max });
  checkSvg(svg);
  assert.ok(svg.includes(`Public original repos: ${max}`));
  assert.ok(svg.includes(max.toLocaleString('en-US')));
  assert.doesNotMatch(svg, /<animate|\banimation\s*:/i);
});

test('CLI exits nonzero with only the fixed sanitized message', () => {
  const moduleUrl = new URL('./render-metrics.mjs', import.meta.url).href;
  const code = `import { fileURLToPath } from 'node:url'; globalThis.fetch = async () => { throw new Error('upstream detail'); }; process.argv[1] = fileURLToPath(${JSON.stringify(moduleUrl)}); await import(${JSON.stringify(moduleUrl)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), FAILURE);
});
