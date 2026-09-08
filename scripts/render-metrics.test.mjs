import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawnSync } from 'node:child_process';
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
  for (const fetchImpl of [async () => ({ ok: false, status: 403 }), async () => ({ ok: false, status: 503 }), async () => ({ ok: true, json: async () => { throw new Error('upstream detail'); } }), async () => { throw new Error('upstream detail'); }, async (_url, { signal }) => { await delay(1000, null, { signal }); }])
    await rejected(fetchMetrics({ fetchImpl, timeoutMs: 15 }));
});

test('escapes XML; rejects untrusted values; exposes all values accessibly', () => {
  assert.equal(escapeXml(`<tag attr="'">&`), '&lt;tag attr=&quot;&apos;&quot;&gt;&amp;');
  assert.throws(() => renderSvg({ repos: '<script/>', stars: 0, followers: 0 }), { message: FAILURE });
  const svg = renderSvg({ repos: 4, stars: 8, followers: 16 });
  for (const tag of ['title', 'desc']) assert.match(svg, new RegExp(`<${tag}[^>]*>[^<]*Public original repos: 4; Stars on original repos: 8; Followers: 16`));
  assert.match(svg, /prefers-color-scheme:light/);
  assert.doesNotMatch(svg, /<script|<animate|<foreignObject|\bhref=|\burl\(/);
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
    await updateMetrics({ output, fetchImpl: fake([[repo(1)]]) });
    assert.match(await readFile(output, 'utf8'), /Public original repos: 1; Stars on original repos: 2; Followers: 12/);
    await rejected(updateMetrics({ output: dir, fetchImpl: fake() }));
    assert.deepEqual(await readdir(dir), ['metrics.svg']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('CLI exits nonzero with only the fixed sanitized message', () => {
  const moduleUrl = new URL('./render-metrics.mjs', import.meta.url).href;
  const code = `import { fileURLToPath } from 'node:url'; globalThis.fetch = async () => { throw new Error('upstream detail'); }; process.argv[1] = fileURLToPath(${JSON.stringify(moduleUrl)}); await import(${JSON.stringify(moduleUrl)});`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), FAILURE);
});
