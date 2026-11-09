// Rebuilds scripts/tool-icons.mjs from a Simple Icons download (CC0).
// Usage:
//   mkdir <empty dir> && cd <empty dir>
//   for s in <slugs below>; do curl -sfLO https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/$s.svg; done
//   curl -sfL -o data.json https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/_data/simple-icons.json
//   node scripts/extract-icons.mjs <that dir> scripts/tool-icons.mjs
// Paths are validated, then re-encoded relative with rounding measured against the rounded pen
// (one decimal on the 24-unit grid), which keeps them visually identical at roughly 60% of the size.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [dir, out] = process.argv.slice(2);
const slugs = ['typescript','javascript','python','go','rust','react','nextdotjs','vuedotjs','tailwindcss','threedotjs','nodedotjs','nestjs','graphql','postgresql','mongodb','redis','docker','kubernetes','amazonwebservices','githubactions'];
const data = JSON.parse(readFileSync(join(dir, 'data.json'), 'utf8')).icons;
const PARAMS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };

function parse(d) {
  if (!/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s+eE-]+$/.test(d)) throw new Error('unexpected path characters');
  const segs = []; let i = 0;
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const num = () => { ws(); const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i)); if (!m) throw new Error('bad number at ' + i); i += m[0].length; return +m[0]; };
  const flag = () => { ws(); const c = d[i++]; if (c !== '0' && c !== '1') throw new Error('bad flag'); return +c; };
  let cmd = null;
  while (true) {
    ws(); if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    else if (!cmd) throw new Error('number before command');
    const n = PARAMS[cmd.toLowerCase()];
    if (n === 0) { segs.push([cmd]); cmd = null; continue; }
    const args = [];
    for (let k = 0; k < n; k++) args.push(cmd.toLowerCase() === 'a' && (k === 3 || k === 4) ? flag() : num());
    segs.push([cmd, ...args]);
    if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
  }
  return segs;
}

// Absolute coordinates, then re-emit relative with rounding measured against the rounded pen,
// so rounding error never accumulates along the path.
function minify(d, digits = 1) {
  const f = 10 ** digits; const R = v => Math.round(v * f) / f;
  const fmt = v => { let s = String(R(v)); if (s === '-0') s = '0'; return s.replace(/^(-?)0\./, '$1.'); };
  let cx = 0, cy = 0, sx = 0, sy = 0;      // true pen
  let rx = 0, ry = 0, rsx = 0, rsy = 0;    // rounded pen
  let out = ''; let prevNum = null;
  const emitCmd = c => { out += c; prevNum = null; };
  const emitNum = v => { const s = fmt(v); if (prevNum !== null && !(s[0] === '-' || (s[0] === '.' && prevNum.includes('.')))) out += ' '; out += s; prevNum = s; };
  const emitFlag = v => { out += (prevNum !== null ? ' ' : '') + v; prevNum = String(v); };
  let first = true;
  for (const [c, ...a] of parse(d)) {
    const rel = c === c.toLowerCase(); const C = c.toUpperCase();
    const ax = (v, base) => rel ? base + v : v;
    if (C === 'Z') { emitCmd('z'); cx = sx; cy = sy; rx = rsx; ry = rsy; continue; }
    if (C === 'H') { const x = ax(a[0], cx); emitCmd('h'); emitNum(R(x - rx)); rx = R(rx + R(x - rx)); cx = x; continue; }
    if (C === 'V') { const y = ax(a[0], cy); emitCmd('v'); emitNum(R(y - ry)); ry = R(ry + R(y - ry)); cy = y; continue; }
    if (C === 'A') {
      const x = ax(a[5], cx), y = ax(a[6], cy);
      emitCmd('a'); emitNum(a[0]); emitNum(a[1]); emitNum(a[2]); emitFlag(a[3]); emitFlag(a[4]);
      const dx = R(x - rx), dy = R(y - ry); emitNum(dx); emitNum(dy); rx = R(rx + dx); ry = R(ry + dy); cx = x; cy = y; continue;
    }
    const pts = []; for (let k = 0; k < a.length; k += 2) pts.push([ax(a[k], cx), ax(a[k + 1], cy)]);
    if (C === 'M' && first) { emitCmd('M'); emitNum(pts[0][0]); emitNum(pts[0][1]); rx = R(pts[0][0]); ry = R(pts[0][1]); first = false; }
    else {
      emitCmd(C.toLowerCase());
      const last = pts.length - 1;
      pts.forEach(([x, y]) => { emitNum(R(x - rx)); emitNum(R(y - ry)); });
      rx = R(rx + R(pts[last][0] - rx)); ry = R(ry + R(pts[last][1] - ry));
    }
    cx = pts.at(-1)[0]; cy = pts.at(-1)[1];
    if (C === 'M') { sx = cx; sy = cy; rsx = rx; rsy = ry; }
  }
  return out;
}

const icons = slugs.map(slug => {
  const svg = readFileSync(join(dir, `${slug}.svg`), 'utf8');
  const title = /<title>([^<]+)<\/title>/.exec(svg)[1];
  const d = /<path d="([^"]+)"/.exec(svg)[1];
  const entry = data.find(e => e.title === title);
  if (!entry || !/^[0-9A-F]{6}$/i.test(entry.hex)) throw new Error('no hex for ' + title);
  const small = minify(d);
  return { slug, title, hex: entry.hex.toUpperCase(), d: small, before: d.length };
});
let total = 0, before = 0;
for (const ic of icons) { total += ic.d.length; before += ic.before; console.log(ic.slug.padEnd(18), ic.hex, String(ic.before).padStart(5), '->', String(ic.d.length).padStart(5)); }
console.log('total', before, '->', total);
const body = icons.map(({ slug, title, hex, d }) => `  ${JSON.stringify(slug)}: { title: ${JSON.stringify(title)}, hex: '#${hex}', d: '${d}' },`).join('\n');
writeFileSync(out, `// Tool logos: path data from Simple Icons v13.21.0 (CC0 1.0, https://simpleicons.org),
// re-encoded to one decimal on the 24-unit grid. Brand marks remain the property of their owners.
// Regenerate only by re-running the extractor; never hand-edit a path.
export const ICONS = {
${body}
};
`);
