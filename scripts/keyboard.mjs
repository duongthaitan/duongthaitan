// A 75% mechanical keyboard in 3D with per-key RGB, typing real commands.
//
// View: orthographic, the board turned 12 degrees and seen from 40 degrees above the desk. That
// projection is affine, so the whole board is drawn flat in "plane" coordinates (px, x along the
// rows, y towards the viewer) inside one matrix group; height folds into the plane as a constant
// shift (ZV per px up). Static keys are merged per row and colour into a few paths (paint cost in
// an <img> SVG scales with element count); only the keys that type are separate, moving groups.
import { EASE, check, chevron, escapeXml, svg } from './svg-kit.mjs';

const U = 36; // px per key unit
const f1 = n => `${Math.round(n * 10) / 10}`;
const YAW = (12 * Math.PI) / 180;
const PITCH = (40 * Math.PI) / 180;
const MX = [Math.cos(YAW), Math.sin(YAW) * Math.sin(PITCH)]; // plane x -> screen
const MY = [-Math.sin(YAW), Math.cos(YAW) * Math.sin(PITCH)]; // plane y -> screen
const CZ = Math.cos(PITCH); // screen px per px of height
const DET = MX[0] * MY[1] - MY[0] * MX[1];
const ZV = [(MY[0] * CZ) / DET, (-MX[0] * CZ) / DET]; // plane shift for 1px up
const lift = z => [ZV[0] * z, ZV[1] * z];

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

// ── Keycap geometry (plane px). Tapered sides: the left wall is edge-on from this view and the
// back wall faces away, so a cap is its right wall, front wall and top. The top is a rect inset by
// the corner radius and stroked in its own colour with round joins: rounded corners for free. ──
const G = 0.04 * U;
const CAP = 0.42 * U;
const [SIDE, BACK, FRONT, RAD] = [0.13 * U, 0.1 * U, 0.17 * U, 0.06 * U];
const [zx, zy] = lift(CAP);
function cap(x0, y0, w) {
  const [bx0, bx1, by0, by1] = [x0 + G, x0 + w * U - G, y0 + G, y0 + U - G];
  const [tx0, tx1, ty0, ty1] = [bx0 + SIDE + zx, bx1 - SIDE + zx, by0 + BACK + zy, by1 - FRONT + zy];
  return {
    right: `M${f1(bx1)} ${f1(by0)}V${f1(by1)}L${f1(tx1)} ${f1(ty1)}V${f1(ty0)}Z`,
    front: `M${f1(bx0)} ${f1(by1)}H${f1(bx1)}L${f1(tx1)} ${f1(ty1)}H${f1(tx0)}Z`,
    top: `M${f1(tx0 + RAD)} ${f1(ty0 + RAD)}H${f1(tx1 - RAD)}V${f1(ty1 - RAD)}H${f1(tx0 + RAD)}Z`,
    edge: `M${f1(tx0 + RAD)} ${f1(ty1)}H${f1(tx1 - RAD)}`,
    cx: (tx0 + tx1) / 2,
    cy: (ty0 + ty1) / 2,
  };
}

function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Script: two commands per cycle, each key goes down at the moment its glyph appears ──
const CYCLE = 11000;
const RGB = 6000; // one hue turn
const HUES = ['#ff6b81', '#ffb86b', '#f9e66b', '#7ee787', '#56d4dd', '#79a8ff', '#c792ea'];
const p2 = ms => `${Math.round((ms / CYCLE) * 10000) / 100}%`;
const SCRIPT = [['npm run build', 'done in 1.2s', 500, 5000], ['git push origin main', 'main -> origin', 5500, 10500]];

export function keyboard() {
  const id = 'kbd';
  const W = 900;
  const rand = random(75);
  const presses = new Map();
  const press = (label, t) => presses.set(label, [...(presses.get(label) || []), t]);
  const lines = SCRIPT.map(([cmd, out, start, clear]) => {
    let at = start;
    const glyphs = [...cmd].map(c => {
      at += 76 + rand() * 64 + (c === ' ' ? 50 : 0);
      press(c === ' ' ? '' : c.toUpperCase(), at);
      return [c, at];
    });
    const enter = at + 380;
    press('enter', enter);
    return { cmd, out, glyphs, enter, outAt: enter + 260, clear };
  });

  // ── Place the board: centre its screen footprint, top just under the prompt ──
  const CASE = { x0: -0.5 * U, x1: 16.5 * U, y0: -0.5 * U, y1: 6.75 * U, r: 0.42 * U, h: 0.62 * U };
  const corners = [];
  for (const x of [CASE.x0, CASE.x1]) for (const y of [CASE.y0, CASE.y1]) for (const z of [-CASE.h, CAP]) corners.push([MX[0] * x + MY[0] * y, MX[1] * x + MY[1] * y - CZ * z]);
  const xs = corners.map(c => c[0]);
  const ys = corners.map(c => c[1]);
  const ox = W / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const oy = 78 - Math.min(...ys);
  const H = Math.round(oy + Math.max(...ys) + 34);
  const plane = `matrix(${[MX[0], MX[1], MY[0], MY[1]].map(v => Math.round(v * 10000) / 10000).join(' ')} ${f1(ox)} ${f1(oy)})`;

  const parts = [];

  // Prompt line: the glyphs of each command switch on at their keystroke and off when the line clears.
  const px = 40;
  const py = 40;
  const cw = 8.4;
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

  // ── Desk: soft shadow under the board and the light bar's reflection fanning out in front ──
  const S = (x, y, z = 0) => [ox + MX[0] * x + MY[0] * y, oy + MX[1] * x + MY[1] * y - CZ * z];
  const [scx, scy] = S((CASE.x0 + CASE.x1) / 2, (CASE.y0 + CASE.y1) / 2, -CASE.h);
  parts.push(`<ellipse class="ksh" cx="${f1(scx)}" cy="${f1(scy + 8)}" rx="${f1((Math.max(...xs) - Math.min(...xs)) * 0.56)}" ry="${f1((Math.max(...ys) - Math.min(...ys)) * 0.5)}" fill="url(#${id}-sh)"/>`);
  const [dzx, dzy] = lift(-CASE.h);
  // Stacked translucent bands: the farther from the bar, the wider and fainter (a gradient fade
  // would need a mask, which costs an offscreen pass every frame).
  const deskGlow = [0.1, 0.08, 0.065, 0.05, 0.038, 0.028, 0.019, 0.012, 0.006].map((o, k) => {
    const [ya, yb] = [CASE.y1 + dzy, CASE.y1 + dzy + (k + 1) * 4.5];
    const [xa, xb] = [CASE.x0 + CASE.r + dzx, CASE.x1 - CASE.r + dzx];
    return `<path opacity="${o}" d="M${f1(xa)} ${f1(ya)}H${f1(xb)}L${f1(xb + (k + 1) * 4)} ${f1(yb)}H${f1(xa - (k + 1) * 4)}Z"/>`;
  }).join('');

  // ── Case: walls are stacked copies of the footprint (rounded corners included), then the top. ──
  const walls = [6, 5, 4, 3, 2, 1].map(k => { const [dx, dy] = lift((-CASE.h * k) / 6); return `<use href="#${id}-case" x="${f1(dx)}" y="${f1(dy)}"/>`; }).join('');
  const [bz0, bz1] = [lift(-CASE.h * 0.36), lift(-CASE.h * 0.5)];
  const bar = `<path class="bar" d="M${f1(CASE.x0 + CASE.r + bz0[0])} ${f1(CASE.y1 + bz0[1])}H${f1(CASE.x1 - CASE.r + bz0[0])}L${f1(CASE.x1 - CASE.r + bz1[0])} ${f1(CASE.y1 + bz1[1])}H${f1(CASE.x0 + CASE.r + bz1[0])}Z"/>`;
  const caseTop = `<rect class="ctop" x="${CASE.x0}" y="${CASE.y0}" width="${CASE.x1 - CASE.x0}" height="${CASE.y1 - CASE.y0}" rx="${CASE.r}"/><path class="chi" d="M${f1(CASE.x0 + CASE.r)} ${CASE.y1}H${f1(CASE.x1 - CASE.r)}"/>`;
  const plate = `<rect class="plate" x="${-0.08 * U}" y="${-0.08 * U}" width="${16.16 * U}" height="${6.41 * U}" rx="${0.14 * U}"/><rect class="glow" x="${-0.08 * U}" y="${-0.08 * U}" width="${16.16 * U}" height="${6.41 * U}" rx="${0.14 * U}"/>`;

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
      const s = 3.4;
      const pts = [[ax * s, ay * s], [-ay * s * 0.8 - ax * s * 0.6, ax * s * 0.8 - ay * s * 0.6], [ay * s * 0.8 - ax * s * 0.6, -ax * s * 0.8 - ay * s * 0.6]];
      return `<path style="--x:${xu}" d="M${pts.map(([x, y]) => `${f1(c.cx + x)} ${f1(c.cy + y)}`).join('L')}Z"/>`;
    }
    if (!k.label) return '';
    const big = k.label.length === 1;
    return `<text${big ? '' : ' class="sm"'} x="${f1(c.cx)}" y="${f1(c.cy + (big ? 4.2 : 2.9))}" style="--x:${xu}">${escapeXml(k.label)}</text>`;
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
      const x0 = x * U;
      const y0 = ry * U;
      const xu = Math.round((x + k.w / 2) * 10) / 10;
      x += k.w;
      if (k.knob) { rows.push({ knob: [x0 + U / 2, y0 + U / 2] }); continue; }
      const c = cap(x0, y0, k.w);
      const times = presses.get(k.label);
      if (times && !live.some(l => l.label === k.label)) {
        // A typing key: its own group, pressed and lit through windows encoded in one easing.
        const pts = ['0'];
        for (const t of times.sort((p, q) => p - q)) pts.push(`0 ${p2(t)}`, `1 ${p2(t + 45)}`, `1 ${p2(t + 100)}`, `0 ${p2(t + 200)}`);
        pts.push('0 100%');
        const key = symbol(k.kind, k.w);
        const leg = k.kind === 'x' ? `<g class="lx">${legend(k, c, xu)}</g>` : `<g class="lg">${legend(k, c, xu)}</g>`;
        live.push({ label: k.label, svg: `<g class="p" style="--e:linear(${pts.join(', ')})"><use href="#${id}-${key}" x="${f1(x0)}" y="${f1(y0)}"/><use href="#${id}-h${key}" x="${f1(x0)}" y="${f1(y0)}" class="hl"/>${leg}</g>` });
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
  const knobSvg = ([kx, ky]) => {
    const r = 0.36 * U;
    const discs = [0, 1, 2, 3, 4, 5].map(k => { const [dx, dy] = lift((0.5 * U * k) / 5); return `<circle class="${k === 5 ? 'ktop' : 'kside'}" cx="${f1(kx + dx)}" cy="${f1(ky + dy)}" r="${r}"/>`; }).join('');
    const [tx2, ty2] = [kx + lift(0.5 * U)[0], ky + lift(0.5 * U)[1]];
    return `${discs}<circle class="knurl" cx="${f1(tx2)}" cy="${f1(ty2)}" r="${f1(r - 1.2)}"/><g class="kn"><circle cx="${f1(tx2)}" cy="${f1(ty2)}" r="${r}" fill="none"/><path class="kind" d="M${f1(tx2)} ${f1(ty2 - r * 0.78)}V${f1(ty2 - r * 0.38)}"/></g>`;
  };

  const board = rows.map(r => (r.knob ? knobSvg(r.knob) : r.svg)).join('\n');
  parts.push(`<g transform="${plane}"><g fill="url(#${id}-rgb)">${deskGlow}</g><g class="flt">${walls}${bar}${caseTop}${plate}\n${board}</g></g>`);

  const stops = HUES.concat(HUES[0]).map((hex, k) => `<stop offset="${Math.round((k / HUES.length) * 1000) / 1000}" stop-color="${hex}" style="animation-delay:${Math.round(-(1 - k / HUES.length) * RGB)}ms"/>`).join('');
  const hueKeys = prop => HUES.concat(HUES[0]).map((hex, k) => `${Math.round((k / HUES.length) * 1000) / 10}%{${prop}:${hex}}`).join('');
  const [px2, py2] = lift(-0.11 * U);
  const kinds = {
    a: ['#3a414b', '#262b33', '#1c2026'],
    m: ['#262c34', '#1a1e24', '#13161b'],
    x: ['#2ea043', '#1f7a31', '#175f26'],
  };
  const capCss = Object.entries(kinds).map(([k, [t, f, r]]) => `.${k}t{fill:${t};stroke:${t};stroke-width:${2 * RAD};stroke-linejoin:round}.${k}f{fill:${f}}.${k}r{fill:${r}}`).join('');

  return svg({
    w: W, h: H, id,
    defs: `<linearGradient id="${id}-rgb" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${16 * U}" y2="0">${stops}</linearGradient>
<linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3d444d"/><stop offset=".5" stop-color="#2a3038"/><stop offset="1" stop-color="#22272e"/></linearGradient>
<radialGradient id="${id}-sh"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset=".7" stop-color="#000" stop-opacity=".18"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-knob" cx=".35" cy=".3"><stop offset="0" stop-color="#8b949e"/><stop offset="1" stop-color="#30363d"/></radialGradient>
<rect id="${id}-case" class="cwall" x="${CASE.x0}" y="${CASE.y0}" width="${CASE.x1 - CASE.x0}" height="${CASE.y1 - CASE.y0}" rx="${CASE.r}"/>
${[...symbols.values()].join('\n')}
<style>.ctop{fill:url(#${id}-top)}.cwall{fill:#15191f}.chi{fill:none;stroke:#8b949e;stroke-opacity:.35;stroke-width:1.2}
.plate{fill:#0b0e12}.glow{fill:url(#${id}-rgb);opacity:.5}.bar{fill:url(#${id}-rgb)}
${capCss}.edge{fill:none;stroke:#fff;stroke-opacity:.1;stroke-width:1}
.lg>*{fill:#c9d1d9;animation:hue ${RGB}ms linear calc(var(--x) * ${RGB / 16}ms - ${RGB}ms) infinite}.lg text,.lx text{text-anchor:middle;font-size:11px;font-weight:700}.lg .sm,.lx .sm{font-size:7.5px}
.lx>*{fill:#0d1117}
.p{animation:kp ${CYCLE}ms var(--e) infinite}.hl{fill:#fff;opacity:0;animation:hlf ${CYCLE}ms var(--e) infinite}
.kside{fill:#1c2026}.ktop{fill:url(#${id}-knob)}.knurl{fill:none;stroke:#0d1117;stroke-opacity:.6;stroke-dasharray:1.5 1.5}.kind{stroke:var(--accent);stroke-width:2;stroke-linecap:round}
.kn{transform-box:fill-box;transform-origin:center;animation:knob 7000ms ${EASE.inOut} infinite}
.flt{animation:flt 6000ms ${EASE.inOut} infinite}.ksh{transform-box:fill-box;transform-origin:center;animation:ksh 6000ms ${EASE.inOut} infinite}
.tg{animation:tw ${CYCLE}ms linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) infinite}.t2{fill-opacity:0}
.ow{animation:showw ${CYCLE}ms linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) infinite}.o2{opacity:0}
.car{fill:var(--accent);opacity:0}
#${id}-rgb stop{animation:hues ${RGB}ms linear infinite}
@media (prefers-color-scheme:light){.ksh{opacity:.45}}
@keyframes hue{${hueKeys('fill')}}
@keyframes hues{${hueKeys('stop-color')}}
@keyframes kp{to{transform:translate(${f1(px2)}px,${f1(py2)}px)}}
@keyframes hlf{to{opacity:.3}}
@keyframes knob{0%,100%{transform:rotate(-50deg)}50%{transform:rotate(70deg)}}
@keyframes flt{50%{transform:translate(${f1(lift(6)[0])}px,${f1(lift(6)[1])}px)}}
@keyframes ksh{50%{transform:scale(.95);opacity:.8}}
@keyframes tw{from{fill-opacity:0}to{fill-opacity:1}}
@keyframes crm{to{transform:translateX(var(--d))}}</style>`,
    title: 'Mechanical keyboard, 75% layout, per-key RGB',
    desc: `A 3D 75% mechanical keyboard with 84 keys and a rotary knob. A rainbow wave of RGB light sweeps across the legends, the plate and the light bar along the front edge, reflected on the desk, while the board types ${lines.map(l => `${l.cmd} (${l.out})`).join(', then ')}; every key goes down and lights up the moment its letter appears on the prompt above.`,
    body: parts.join('\n'),
  });
}
