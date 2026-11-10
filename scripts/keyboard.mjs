// A 75% mechanical keyboard in 3D with per-key RGB, typing real commands.
//
// View: orthographic, the board turned 12 degrees and seen from 40 degrees above the desk. That
// projection is affine, so the whole board is drawn flat in "plane" coordinates (x along the rows,
// y towards the viewer, in half-pixels so the numbers stay whole) inside one matrix group; height
// folds into the plane as a constant shift (ZV per unit up). Static keys are merged per row and
// colour into a few paths (paint cost in an <img> SVG scales with element count); only the keys
// that type are separate groups, pressed and lit through windows encoded in one linear() easing.
import { EASE, check, chevron, escapeXml, svg, text } from './svg-kit.mjs';

const Q = 2; // plane units per screen px
const iq = n => `${Math.round(n)}`;
const f1 = n => `${Math.round(n * 10) / 10}`;
const YAW = (12 * Math.PI) / 180;
const PITCH = (40 * Math.PI) / 180;
const MX = [Math.cos(YAW), Math.sin(YAW) * Math.sin(PITCH)]; // plane x -> screen
const MY = [-Math.sin(YAW), Math.cos(YAW) * Math.sin(PITCH)]; // plane y -> screen
const CZ = Math.cos(PITCH); // screen per unit of height
const DET = MX[0] * MY[1] - MY[0] * MX[1];
const ZV = [(MY[0] * CZ) / DET, (-MX[0] * CZ) / DET]; // plane shift for one unit up
const lift = z => [ZV[0] * z, ZV[1] * z];
const screen = (x, y, z = 0) => [(MX[0] * x + MY[0] * y) / Q, (MX[1] * x + MY[1] * y - CZ * z) / Q];

export const RGB = 6000; // one turn of the hue wave
export const HUES = ['#ff6b81', '#ffb86b', '#f9e66b', '#7ee787', '#56d4dd', '#79a8ff', '#c792ea'];
// Gradient stops that run the hue wave (left to right, one full turn across the gradient).
export const rgbStops = () => HUES.concat(HUES[0]).map((hex, k) => `<stop offset="${Math.round((k / HUES.length) * 1000) / 1000}" stop-color="${hex}" style="animation-delay:${Math.round(-(1 - k / HUES.length) * RGB)}ms"/>`).join('');
const hueKeys = prop => HUES.concat(HUES[0]).map((hex, k) => `${Math.round((k / HUES.length) * 1000) / 10}%{${prop}:${hex}}`).join('');
export const rgbCss = `.rgb stop{animation:hues ${RGB}ms linear infinite}@keyframes hues{${hueKeys('stop-color')}}`;

// ── Layout (ANSI 75%, 84 keys) ──
const K = (label, w = 1, kind = 'a') => ({ label, w, kind });
const gap = w => ({ gap: w });
const fn = list => list.map(l => K(l, 1, 'm'));
const ROWS = [
  [0, [K('esc', 1, 'x'), gap(0.25), ...fn(['F1', 'F2', 'F3', 'F4']), gap(0.25), ...fn(['F5', 'F6', 'F7', 'F8']), gap(0.25), ...fn(['F9', 'F10', 'F11', 'F12']), gap(0.25), K('del', 1, 'm'), { knob: true, w: 1 }]],
  [1.25, [...[...'`1234567890-='].map(c => K(c)), K('bksp', 2, 'm'), K('pgup', 1, 'm')]],
  [2.25, [K('tab', 1.5, 'm'), ...[...'QWERTYUIOP[]'].map(c => K(c)), K('\\', 1.5), K('pgdn', 1, 'm')]],
  [3.25, [K('caps', 1.75, 'm'), ...[..."ASDFGHJKL;'"].map(c => K(c)), K('enter', 2.25, 'x'), K('home', 1, 'm')]],
  [4.25, [K('shift', 2.25, 'm'), ...[...'ZXCVBNM,./'].map(c => K(c)), K('shift', 1.75, 'm'), K('up', 1, 'm'), K('end', 1, 'm')]],
  [5.25, [K('ctrl', 1.25, 'm'), K('win', 1.25, 'm'), K('alt', 1.25, 'm'), K('', 6.25), K('alt', 1, 'm'), K('fn', 1, 'm'), K('ctrl', 1, 'm'), K('left', 1, 'm'), K('down', 1, 'm'), K('right', 1, 'm')]],
];
const ARROW = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const SHIFTED = { '*': '8', _: '-', ':': ';', '"': "'", '>': '.', '<': ',', '?': '/' };

// Which keys a character needs: the key itself, plus left shift for shifted symbols.
export function keysFor(c) {
  if (c === ' ') return [''];
  if (c === '\n') return ['enter'];
  if (SHIFTED[c]) return ['shift', SHIFTED[c]];
  return [c.toUpperCase()];
}

// Keycap colours (top, front wall, right wall): alphas, modifiers, accents.
const KINDS = { a: ['#3a414b', '#262b33', '#1c2026'], m: ['#262c34', '#1a1e24', '#13161b'], x: ['#2ea043', '#1f7a31', '#175f26'] };

// presses: key label -> times (ms) inside a cycle of `cycle` ms. U: screen px per key unit.
export function buildKeyboard({ id, U, presses, cycle }) {
  const P = U * Q; // plane units per key
  const G = 0.04 * P;
  const CAP = 0.42 * P;
  const [SIDE, BACK, FRONT, RAD] = [0.13 * P, 0.1 * P, 0.17 * P, 0.06 * P];
  const [zx, zy] = lift(CAP);
  const p2 = ms => `${Math.round((ms / cycle) * 1000) / 10}%`;
  // Tapered sides: the left wall is edge-on from this view and the back wall faces away, so a cap is
  // its right wall, front wall and top. The top is a rect inset by the corner radius and stroked in
  // its own colour with round joins: rounded corners for free.
  const cap = (x0, y0, w) => {
    const [bx0, bx1, by0, by1] = [x0 + G, x0 + w * P - G, y0 + G, y0 + P - G];
    const [tx0, tx1, ty0, ty1] = [bx0 + SIDE + zx, bx1 - SIDE + zx, by0 + BACK + zy, by1 - FRONT + zy];
    return {
      right: `M${iq(bx1)} ${iq(by0)}V${iq(by1)}L${iq(tx1)} ${iq(ty1)}V${iq(ty0)}Z`,
      front: `M${iq(bx0)} ${iq(by1)}H${iq(bx1)}L${iq(tx1)} ${iq(ty1)}H${iq(tx0)}Z`,
      top: `M${iq(tx0 + RAD)} ${iq(ty0 + RAD)}H${iq(tx1 - RAD)}V${iq(ty1 - RAD)}H${iq(tx0 + RAD)}Z`,
      edge: `M${iq(tx0 + RAD)} ${iq(ty1)}H${iq(tx1 - RAD)}`,
      cx: (tx0 + tx1) / 2,
      cy: (ty0 + ty1) / 2,
    };
  };

  // Case footprint and its screen box (relative to the matrix origin).
  const CASE = { x0: -0.5 * P, x1: 16.5 * P, y0: -0.5 * P, y1: 6.75 * P, r: 0.42 * P, h: 0.62 * P };
  const pts = [];
  for (const x of [CASE.x0, CASE.x1]) for (const y of [CASE.y0, CASE.y1]) for (const z of [-CASE.h, CAP]) pts.push(screen(x, y, z));
  const box = { x0: Math.min(...pts.map(p => p[0])), x1: Math.max(...pts.map(p => p[0])), y0: Math.min(...pts.map(p => p[1])), y1: Math.max(...pts.map(p => p[1])) };

  // Desk: the light bar's reflection fanning out in front (stacked translucent bands; a gradient
  // fade would need a mask, which costs an offscreen pass every frame).
  const [dzx, dzy] = lift(-CASE.h);
  const deskGlow = [0.1, 0.08, 0.065, 0.05, 0.038, 0.028, 0.019, 0.012, 0.006].map((o, k) => {
    const [ya, yb] = [CASE.y1 + dzy, CASE.y1 + dzy + (k + 1) * 4.5 * Q];
    const [xa, xb] = [CASE.x0 + CASE.r + dzx, CASE.x1 - CASE.r + dzx];
    return `<path opacity="${o}" d="M${iq(xa)} ${iq(ya)}H${iq(xb)}L${iq(xb + (k + 1) * 4 * Q)} ${iq(yb)}H${iq(xa - (k + 1) * 4 * Q)}Z"/>`;
  }).join('');

  // Case: walls are stacked copies of the footprint (rounded corners included), then the top.
  const walls = [6, 5, 4, 3, 2, 1].map(k => { const [dx, dy] = lift((-CASE.h * k) / 6); return `<use href="#${id}-case" x="${iq(dx)}" y="${iq(dy)}"/>`; }).join('');
  const [bz0, bz1] = [lift(-CASE.h * 0.36), lift(-CASE.h * 0.5)];
  const bar = `<path class="bar" d="M${iq(CASE.x0 + CASE.r + bz0[0])} ${iq(CASE.y1 + bz0[1])}H${iq(CASE.x1 - CASE.r + bz0[0])}L${iq(CASE.x1 - CASE.r + bz1[0])} ${iq(CASE.y1 + bz1[1])}H${iq(CASE.x0 + CASE.r + bz1[0])}Z"/>`;
  const caseTop = `<rect class="ctop" x="${CASE.x0}" y="${CASE.y0}" width="${CASE.x1 - CASE.x0}" height="${CASE.y1 - CASE.y0}" rx="${CASE.r}"/><path class="chi" d="M${iq(CASE.x0 + CASE.r)} ${CASE.y1}H${iq(CASE.x1 - CASE.r)}"/>`;
  const pl = `x="${iq(-0.08 * P)}" y="${iq(-0.08 * P)}" width="${iq(16.16 * P)}" height="${iq(6.41 * P)}" rx="${iq(0.14 * P)}"`;
  const plate = `<rect class="plate" ${pl}/><rect class="glow" ${pl}/>`;

  // ── Keys, row by row (back to front) ──
  const rows = [];
  const symbols = new Map();
  const symbol = (kind, w) => {
    const key = `${kind}${w}`.replace('.', '_');
    if (!symbols.has(key)) {
      const c = cap(0, 0, w);
      symbols.set(key, `<g id="${id}-${key}"><path class="${kind}r" d="${c.right}"/><path class="${kind}f" d="${c.front}"/><path class="${kind}t" d="${c.top}"/><path class="edge" d="${c.edge}"/></g><path id="${id}-h${key}" d="${c.top}"/>`);
    }
    return key;
  };
  const legend = (k, c, xu) => {
    if (ARROW[k.label]) {
      const [ax, ay] = ARROW[k.label];
      const s = 0.095 * P;
      const tri = [[ax * s, ay * s], [-ay * s * 0.8 - ax * s * 0.6, ax * s * 0.8 - ay * s * 0.6], [ay * s * 0.8 - ax * s * 0.6, -ax * s * 0.8 - ay * s * 0.6]];
      return `<path style="--x:${xu}" d="M${tri.map(([x, y]) => `${iq(c.cx + x)} ${iq(c.cy + y)}`).join('L')}Z"/>`;
    }
    if (!k.label) return '';
    const big = k.label.length === 1;
    return `<text${big ? '' : ' class="sm"'} x="${iq(c.cx)}" y="${iq(c.cy + (big ? 0.117 : 0.08) * P)}" style="--x:${xu}">${escapeXml(k.label)}</text>`;
  };
  for (const [ry, keys] of ROWS) {
    let x = 0;
    const merged = { a: { r: '', f: '', t: '' }, m: { r: '', f: '', t: '' }, x: { r: '', f: '', t: '' } };
    let edges = '';
    const live = [];
    const lg = [];
    const dark = [];
    for (const k of keys) {
      if (k.gap) { x += k.gap; continue; }
      const [x0, y0] = [x * P, ry * P];
      const xu = Math.round((x + k.w / 2) * 10) / 10;
      x += k.w;
      if (k.knob) { rows.push({ knob: [x0 + P / 2, y0 + P / 2] }); continue; }
      const c = cap(x0, y0, k.w);
      const times = presses.get(k.label);
      if (times && !live.some(l => l.label === k.label)) {
        // Press windows: down in 50ms, back up by 160ms (sooner if the same key strikes again).
        const ts = [...times].sort((p, q) => p - q);
        const win = ['0'];
        ts.forEach((t, n) => {
          const up = Math.min(t + 160, (ts[n + 1] ?? Infinity) - 12);
          win.push(`0 ${p2(t)}`, `1 ${p2(Math.min(t + 50, up - 20))}`, `0 ${p2(up)}`);
        });
        win.push('0 100%');
        const key = symbol(k.kind, k.w);
        const leg = `<g class="${k.kind === 'x' ? 'lx' : 'lg'}">${legend(k, c, xu)}</g>`;
        live.push({ label: k.label, svg: `<g class="p" style="--e:linear(${win.join(', ')})"><use href="#${id}-${key}" x="${iq(x0)}" y="${iq(y0)}"/><use href="#${id}-h${key}" x="${iq(x0)}" y="${iq(y0)}" class="hl"/>${leg}</g>` });
        continue;
      }
      merged[k.kind].r += c.right;
      merged[k.kind].f += c.front;
      merged[k.kind].t += c.top;
      edges += c.edge;
      (k.kind === 'x' ? dark : lg).push(legend(k, c, xu));
    }
    const body = Object.entries(merged).filter(([, m]) => m.t).map(([kind, m]) => `<path class="${kind}r" d="${m.r}"/><path class="${kind}f" d="${m.f}"/><path class="${kind}t" d="${m.t}"/>`).join('');
    rows.push({ svg: `${body}<path class="edge" d="${edges}"/>${live.map(l => l.svg).join('')}<g class="lg">${lg.join('')}</g>${dark.length ? `<g class="lx">${dark.join('')}</g>` : ''}` });
  }

  // Rotary knob in the top-right corner: stacked discs, a knurled rim and a turning indicator.
  const knob = ([kx, ky]) => {
    const r = 0.36 * P;
    const discs = [0, 1, 2, 3, 4, 5].map(k => { const [dx, dy] = lift((0.5 * P * k) / 5); return `<circle class="${k === 5 ? 'ktop' : 'kside'}" cx="${iq(kx + dx)}" cy="${iq(ky + dy)}" r="${iq(r)}"/>`; }).join('');
    const [tx, ty] = [kx + lift(0.5 * P)[0], ky + lift(0.5 * P)[1]];
    return `${discs}<circle class="knurl" cx="${iq(tx)}" cy="${iq(ty)}" r="${iq(r - 2.4)}"/><g class="kn"><circle cx="${iq(tx)}" cy="${iq(ty)}" r="${iq(r)}" fill="none"/><path class="kind" d="M${iq(tx)} ${iq(ty - r * 0.78)}V${iq(ty - r * 0.38)}"/></g>`;
  };
  const board = rows.map(r => (r.knob ? knob(r.knob) : r.svg)).join('\n');

  const [px, py] = lift(-0.11 * P);
  const capCss = Object.entries(KINDS).map(([k, [t, f, r]]) => `.${k}t{fill:${t};stroke:${t};stroke-width:${iq(2 * RAD)};stroke-linejoin:round}.${k}f{fill:${f}}.${k}r{fill:${r}}`).join('');
  const defs = `<linearGradient id="${id}-rgb" class="rgb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${16 * P}" y2="0">${rgbStops()}</linearGradient>
<linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d444d"/><stop offset=".5" stop-color="#2a3038"/><stop offset="1" stop-color="#22272e"/></linearGradient>
<radialGradient id="${id}-sh"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".7" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-knob" cx=".35" cy=".3"><stop offset="0" stop-color="#8b949e"/><stop offset="1" stop-color="#30363d"/></radialGradient>
<rect id="${id}-case" class="cwall" x="${CASE.x0}" y="${CASE.y0}" width="${CASE.x1 - CASE.x0}" height="${CASE.y1 - CASE.y0}" rx="${CASE.r}"/>
${[...symbols.values()].join('\n')}`;
  const css = `.ctop{fill:url(#${id}-top)}.cwall{fill:#15191f}.chi{fill:none;stroke:#8b949e;stroke-opacity:.35;stroke-width:${1.2 * Q}}
.plate{fill:#0b0e12}.glow{fill:url(#${id}-rgb);opacity:.5}.bar{fill:url(#${id}-rgb)}
${capCss}.edge{fill:none;stroke:#fff;stroke-opacity:.1;stroke-width:${Q}}
.lg>*{fill:#c9d1d9;animation:hue ${RGB}ms linear calc(var(--x) * ${RGB / 16}ms - ${RGB}ms) infinite}.lg text,.lx text{text-anchor:middle;font-size:${f1(0.305 * P)}px;font-weight:700}.lg .sm,.lx .sm{font-size:${f1(0.21 * P)}px}
.lx>*{fill:#0d1117}
.p{animation:kp ${cycle}ms var(--e) infinite}.hl{fill:#fff;opacity:0;animation:hlf ${cycle}ms var(--e) infinite}
.kside{fill:#1c2026}.ktop{fill:url(#${id}-knob)}.knurl{fill:none;stroke:#0d1117;stroke-opacity:.6;stroke-dasharray:3 3}.kind{stroke:var(--accent);stroke-width:${2 * Q};stroke-linecap:round}
.kn{transform-box:fill-box;transform-origin:center;animation:knob 7000ms ${EASE.inOut} infinite}
.flt{animation:flt 6000ms ${EASE.inOut} infinite}.ksh{transform-box:fill-box;transform-origin:center;animation:ksh 6000ms ${EASE.inOut} infinite}
@media (prefers-color-scheme:light){.ksh{opacity:.45}}
${rgbCss}
@keyframes hue{${hueKeys('fill')}}
@keyframes kp{to{transform:translate(${iq(px)}px,${iq(py)}px)}}
@keyframes hlf{to{opacity:.3}}
@keyframes knob{0%,100%{transform:rotate(-50deg)}50%{transform:rotate(70deg)}}
@keyframes flt{50%{transform:translate(${iq(lift(6 * Q)[0])}px,${iq(lift(6 * Q)[1])}px)}}
@keyframes ksh{50%{transform:scale(.95);opacity:.8}}`;

  const render = (ox, oy) => {
    const plane = `matrix(${[MX[0], MX[1], MY[0], MY[1]].map(v => Math.round((v / Q) * 10000) / 10000).join(' ')} ${f1(ox)} ${f1(oy)})`;
    const [scx, scy] = screen((CASE.x0 + CASE.x1) / 2, (CASE.y0 + CASE.y1) / 2, -CASE.h);
    const shadow = `<ellipse class="ksh" cx="${f1(ox + scx)}" cy="${f1(oy + scy + 8)}" rx="${f1((box.x1 - box.x0) * 0.56)}" ry="${f1((box.y1 - box.y0) * 0.5)}" fill="url(#${id}-sh)"/>`;
    return `${shadow}<g transform="${plane}"><g fill="url(#${id}-rgb)">${deskGlow}</g><g class="flt">${walls}${bar}${caseTop}${plate}\n${board}</g></g>`;
  };
  // Screen x of the keys' left and right edges at mid-depth (for syncing other RGB edges).
  const span = [screen(0, 3 * P)[0], screen(16 * P, 3 * P)[0]];
  return { box, span, render, defs, css };
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pressMap = () => {
  const map = new Map();
  return { map, add: (c, t) => keysFor(c).forEach(k => map.set(k, [...(map.get(k) || []), t])) };
};

// ── Under the neofetch card: the board types two commands on a prompt line above it ──
const CYCLE = 11000;
const SCRIPT = [['npm run build', 'done in 1.2s', 500, 5000], ['git push origin main', 'main -> origin', 5500, 10500]];

export function keyboard() {
  const id = 'kbd';
  const W = 900;
  const p2 = ms => `${Math.round((ms / CYCLE) * 10000) / 100}%`;
  const rand = random(75);
  const keys = pressMap();
  const lines = SCRIPT.map(([cmd, out, start, clear]) => {
    let at = start;
    const glyphs = [...cmd].map(c => {
      at += 76 + rand() * 64 + (c === ' ' ? 50 : 0);
      keys.add(c, at);
      return [c, at];
    });
    const enter = at + 380;
    keys.add('\n', enter);
    return { cmd, out, glyphs, enter, outAt: enter + 260, clear };
  });
  const kb = buildKeyboard({ id, U: 36, presses: keys.map, cycle: CYCLE });
  const ox = W / 2 - (kb.box.x0 + kb.box.x1) / 2;
  const oy = 78 - kb.box.y0;
  const H = Math.round(oy + kb.box.y1 + 34);

  const parts = [];
  const [px, py, cw] = [40, 40, 8.4];
  const maxCol = Math.max(...lines.map(l => l.cmd.length + 3 + l.out.length + 1));
  parts.push(chevron(px, py, 15));
  const tx = px + 20;
  lines.forEach((l, n) => {
    const tsp = l.glyphs.map(([c, at]) => (c === ' ' ? ' ' : `<tspan class="tg" style="--a:${p2(at)}">${escapeXml(c)}</tspan>`)).join('');
    parts.push(`<text x="${tx}" y="${py}" font-size="14" textLength="${f1(l.cmd.length * cw)}" class="fg t${n + 1}" style="--b:${p2(l.clear)}">${tsp}</text>`);
    const ox2 = tx + (l.cmd.length + 1) * cw;
    parts.push(`<g class="ow o${n + 1}" style="--a:${p2(l.outAt)};--b:${p2(l.clear)}">${check(ox2 + 2, py - 4)}<text x="${f1(ox2 + 2 * cw)}" y="${py}" font-size="14" textLength="${f1(l.out.length * cw)}" class="mu">${escapeXml(l.out)}</text></g>`);
  });
  // Caret: stepwise positions encoded in one linear() easing.
  const steps = [];
  lines.forEach(l => {
    l.glyphs.forEach(([, at], i) => steps.push([at, (i + 1) / maxCol]));
    steps.push([l.outAt, (l.cmd.length + 3 + l.out.length) / maxCol]);
    steps.push([l.clear, 0]);
  });
  let prev = 0;
  const caretEase = ['0'];
  for (const [at, v] of steps) { caretEase.push(`${Math.round(prev * 1000) / 1000} ${p2(at)}`, `${Math.round(v * 1000) / 1000} ${p2(at)}`); prev = v; }
  caretEase.push('0 100%');
  parts.push(`<rect class="car" x="${tx + 1}" y="${py - 11.5}" width="7" height="14.3" rx="1" style="--d:${f1(maxCol * cw)}px;animation:crm ${CYCLE}ms linear(${caretEase.join(', ')}) infinite,blink 1100ms linear infinite"/>`);
  parts.push(`<text x="${W - 40}" y="${py}" font-size="12" text-anchor="end" textLength="${f1('75% / 84 keys / rgb wave'.length * 7.2)}" class="mu">75% / 84 keys / rgb wave</text>`);
  parts.push(kb.render(ox, oy));

  return svg({
    w: W, h: H, id,
    defs: `${kb.defs}
<style>${kb.css}
.tg{animation:tw ${CYCLE}ms linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) infinite}.t2{fill-opacity:0}
.ow{animation:showw ${CYCLE}ms linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) infinite}.o2{opacity:0}
.car{fill:var(--accent);opacity:0}
@keyframes tw{from{fill-opacity:0}to{fill-opacity:1}}
@keyframes crm{to{transform:translateX(var(--d))}}</style>`,
    title: 'Mechanical keyboard, 75% layout, per-key RGB',
    desc: `A 3D 75% mechanical keyboard with 84 keys and a rotary knob. A rainbow wave of RGB light sweeps across the legends, the plate and the light bar along the front edge, reflected on the desk, while the board types ${lines.map(l => `${l.cmd} (${l.out})`).join(', then ')}; every key goes down and lights up the moment its letter appears on the prompt above.`,
    body: parts.join('\n'),
  });
}

// ── Automation: a flat terminal on the desk and the board typing into it, keystroke for keystroke ──
// The terminal is an opaque dark window (an object in the scene, like the board), so the typing
// covers can be its own background colour. Each command reveals in uniform steps, and the caret,
// the covers and the key presses all share those steps.
export function deskTerminal({ sizes, count }) {
  const id = 'desk';
  const W = 900;
  const [TX, TY, TW] = [80, 14, 740];
  const [cw, lh, fs] = [7.8, 21, 13];
  const BG = '#0d1117';
  const keys = pressMap();
  const fmt = n => `${(n / 1000).toFixed(1)} kB`;
  const entries = Object.entries(sizes);
  const lines = [
    { cmd: 'node scripts/gen-profile.mjs' },
    ...entries.map(([name, b]) => ({ out: `  ${name.padEnd(22)}${fmt(b).padStart(8)}` })),
    { ok: `${count} svg files from one set of design tokens` },
    { cmd: 'node --test scripts/*.test.mjs' },
    { ok: 'all tests passed' },
    { cmd: 'git push origin main' },
    { out: '  To github.com:duongthaitan/duongthaitan.git' },
    { ok: 'GitHub Actions keeps the numbers current' },
    { prompt: true },
  ];
  // Timeline: each command shows its prompt, waits a beat, types at a steady pace, then Enter.
  const IV = 84;
  let t = 0;
  lines.forEach((l, i) => {
    if (l.cmd) {
      l.appear = i === 0 ? 0 : t + 360;
      l.start = l.appear + 420;
      [...l.cmd].forEach((c, k) => keys.add(c, l.start + (k + 1) * IV));
      l.end = l.start + l.cmd.length * IV;
      t = l.end + 320;
      keys.add('\n', t);
      t += 220;
    } else if (l.prompt) {
      l.appear = t + 360;
      t = l.appear;
    } else {
      l.appear = t + (l.ok ? 160 : 0);
      t = l.appear + 120;
    }
  });
  const CYCLE = Math.round((t + 3600) / 500) * 500;
  const clear = CYCLE - 500;
  const pc = ms => `${Math.round((ms / CYCLE) * 1000) / 10}%`;

  const TH = 34 + 24 + lines.length * lh + 10;
  const kb = buildKeyboard({ id, U: 34, presses: keys.map, cycle: CYCLE });
  const ox = W / 2 - (kb.box.x0 + kb.box.x1) / 2;
  const oy = TY + TH + 22 - kb.box.y0;
  const H = Math.round(oy + kb.box.y1 + 30);

  const parts = [];
  // Window: body, title bar, separator, traffic lights, title, and an RGB edge in step with the board.
  parts.push(`<rect x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="12" fill="${BG}"/><path d="M${TX} ${TY + 34}V${TY + 12}a12 12 0 0 1 12 -12H${TX + TW - 12}a12 12 0 0 1 12 12V${TY + 34}Z" fill="#161b22"/><path d="M${TX} ${TY + 34.5}H${TX + TW}" stroke="#30363d"/>`);
  parts.push(['#ff5f57', '#febc2e', '#28c840'].map((c, i) => `<circle cx="${TX + 20 + i * 20}" cy="${TY + 17}" r="6" fill="${c}"/>`).join(''));
  parts.push(`<text x="${TX + TW / 2}" y="${TY + 21}" font-size="12" text-anchor="middle" textLength="${f1('~/duongthaitan - automation'.length * 7.2)}" class="tp">~/duongthaitan - automation</text>`);
  parts.push(`<rect class="tglow" x="${TX}" y="${TY}" width="${TW}" height="${TH}" rx="12"/><rect class="tedge" x="${TX + 0.5}" y="${TY + 0.5}" width="${TW - 1}" height="${TH - 1}" rx="11.5"/>`);

  // Lines. The first prompt never leaves (after the clear it is the empty screen); everything else
  // shows from its moment until the screen clears at the end of the cycle.
  const x0 = TX + 26;
  const covers = [];
  lines.forEach((l, i) => {
    const y = TY + 34 + 24 + 14 + i * lh;
    l.y = y;
    let row = '';
    if (l.cmd || l.prompt) {
      row += text(x0, y, '$', { size: fs, cls: 'tp' });
      if (l.cmd) {
        const cx = x0 + 2 * cw;
        row += text(cx, y, l.cmd, { size: fs, cls: 'tc', weight: 700 });
        // Cover in the window's own colour, shrinking from the left one glyph per keystroke; it
        // snaps back when the screen clears.
        covers.push(`@keyframes cv${i}{0%,${pc(l.start)}{transform:scaleX(1);animation-timing-function:steps(${l.cmd.length},end)}${pc(l.end)}{transform:scaleX(0);animation-timing-function:step-end}${pc(clear)},100%{transform:scaleX(1)}}`);
        row += `<rect class="cv" x="${f1(cx - 0.5)}" y="${y - 12}" width="${f1(l.cmd.length * cw + 1)}" height="16" fill="${BG}" style="animation:cv${i} ${CYCLE}ms linear infinite"/>`;
      }
    } else if (l.ok) {
      row += `${check(x0, y - 4)}${text(x0 + 2 * cw, y, l.ok, { size: fs, cls: 'tk' })}`;
    } else {
      row += text(x0, y, l.out, { size: fs, cls: 'to', pre: true });
    }
    parts.push(i === 0 ? row : `<g class="ln" style="--a:${pc(l.appear)}">${row}</g>`);
  });
  // Caret: one block; its path through the session as keyframes, typing segments stepping with the keys.
  const last = lines.at(-1);
  const at = (l, col) => `translate(${f1((col - 2) * cw)}px,${f1(l.y - last.y)}px)`;
  const ks = [`0%{transform:${at(lines[0], 2)};animation-timing-function:step-end}`];
  lines.forEach(l => {
    if (!l.cmd) return;
    if (l.appear) ks.push(`${pc(l.appear)}{transform:${at(l, 2)};animation-timing-function:step-end}`);
    ks.push(`${pc(l.start)}{transform:${at(l, 2)};animation-timing-function:steps(${l.cmd.length},end)}`, `${pc(l.end)}{transform:${at(l, 2 + l.cmd.length)};animation-timing-function:step-end}`);
  });
  ks.push(`${pc(last.appear)}{transform:none;animation-timing-function:step-end}`, `${pc(clear)},100%{transform:${at(lines[0], 2)}}`);
  parts.push(`<rect class="cur" x="${f1(x0 + 2 * cw + 1)}" y="${last.y - 11}" width="7.5" height="14" rx="1"/>`);
  parts.push(kb.render(ox, oy));

  // The edge gradient spans the keys' width on screen, so the window's wave lines up with the board's.
  return svg({
    w: W, h: H, id,
    defs: `${kb.defs}
<linearGradient id="${id}-edge" class="rgb" gradientUnits="userSpaceOnUse" spreadMethod="repeat" x1="${f1(ox + kb.span[0])}" y1="0" x2="${f1(ox + kb.span[1])}" y2="0">${rgbStops()}</linearGradient>
<style>${kb.css}
.tedge{fill:none;stroke:url(#${id}-edge);stroke-width:1.5;stroke-opacity:.8}.tglow{fill:none;stroke:url(#${id}-edge);stroke-width:8;stroke-opacity:.08}
.tp{fill:#8b949e}.tc{fill:#e6edf3}.to{fill:#8b949e}.tk{fill:#3fb950}.tick{stroke:#3fb950}
.ln{animation:showw ${CYCLE}ms linear(0, 0 var(--a), 1 var(--a), 1 ${pc(clear)}, 0 ${pc(clear)}, 0 100%) infinite}
.cur{fill:#e6edf3;animation:cur ${CYCLE}ms linear infinite,blink 1100ms linear infinite}
${covers.join('\n')}
@keyframes cur{${ks.join('')}}</style>`,
    title: 'Automation: a terminal and the keyboard typing into it',
    desc: `A terminal window above a 3D 75% mechanical keyboard with per-key RGB. Key by key, the keyboard types this repo's pipeline into the terminal: node scripts/gen-profile.mjs lists generated files with their sizes (${entries.map(([n, b]) => `${n} ${fmt(b)}`).join(', ')}), ${count} SVG files from one set of design tokens; node --test scripts/*.test.mjs passes; git push origin main hands over to GitHub Actions, which keeps the numbers current. A rainbow wave runs through the keys, the plate, the light bar and the terminal's edge together.`,
    body: parts.join('\n'),
  });
}
