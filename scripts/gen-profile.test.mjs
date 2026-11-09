import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderAssets } from './gen-profile.mjs';

const root = new URL('../', import.meta.url);
const assets = Object.entries(renderAssets());

test('committed artwork matches the generator', async () => {
  for (const [file, svg] of assets) {
    const committed = (await readFile(new URL(file, root), 'utf8')).replace(/\r\n/g, '\n');
    assert.equal(committed, svg, `${file} is stale: run node scripts/gen-profile.mjs`);
  }
});

test('artwork is ASCII only, so no glyph depends on platform font coverage', () => {
  for (const [file, svg] of assets) assert.doesNotMatch(svg, /[^\t\n\r\x20-\x7e]/, file);
});

test('every animated element starts from a finished base state', () => {
  for (const [file, svg] of assets) {
    // Loops stay finite: attention loops stop on their own.
    assert.doesNotMatch(svg, /\bindefinite\b|\binfinite\b/, file);
    for (const [, count] of svg.matchAll(/repeatCount="([^"]*)"/g)) assert.match(count, /^\d+$/, file);
    // SMIL ignores prefers-reduced-motion, so every SMIL animation sits under .fx (display:none there)
    // or inside a mask that only an .fx layer uses.
    const stack = [];
    for (const [, close, name, attrs, selfClose] of svg.replace(/<style>[\s\S]*?<\/style>/g, '').matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
      if (close) { stack.pop(); continue; }
      if (/^animate/.test(name)) assert.ok(stack.some(el => el.name === 'mask' || /class="fx"/.test(el.attrs)), `${file}: <${name}> outside .fx`);
      if (!selfClose) stack.push({ name, attrs });
    }
    // Fill-mode both on every one-shot entrance keeps delayed items from flashing their end state first.
    for (const [, list] of svg.matchAll(/style="[^"]*?animation:([^"]+)"/g))
      for (const entry of list.split(/,(?![^(]*\))/)) assert.match(entry.trim(), /\b(both|forwards|\d+)$/, `${file}: ${entry}`);
  }
});
