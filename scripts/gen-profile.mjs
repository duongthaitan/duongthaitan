// Generates every static SVG on the profile from the tokens in svg-kit.mjs.
// Run: node scripts/gen-profile.mjs   (the metrics panel is rendered by render-metrics.mjs)
//
// Motion rules (from the agents-skills animation set):
// - Entrances run once, transform/opacity only, base state = finished state.
// - Ambient loops are finite and start only after the entrance has settled.
// - SMIL (motion along a path, animated masks) lives under class="fx", hidden for reduced motion.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { A, EASE, check, chevron, escapeXml, extrude, haloDef, hexRgb, icon, logoInk, loopEase, loopWindow, loopify, looping, rrect, spinner, style, svg, text, toHex, typed, width, withLoop } from './svg-kit.mjs';
import { UI } from './ui-icons.mjs';
import { LAND } from './earth-data.mjs';
import { PLATEAUS, RANGES } from './relief-data.mjs';
import { ICONS } from './tool-icons.mjs';
import { renderSite } from './gen-site.mjs';
import { CURRENT, GLYPHS, LINKS, NEOFETCH, PROFILE, SLUGS, STACK } from './profile-data.mjs';

const r2 = n => Math.round(n * 100) / 100;
const ms = n => `${Math.round(n)}ms`;

// ── Hero ────────────────────────────────────────────────────────────────────
// Lead: the name rising out of a mask, then a sheen of light crossing its glyphs.
// Support: a role line that types, holds, deletes and types the next phrase.
// Signature: a git graph drawing itself up to HEAD; afterwards packets of light ride main
// into HEAD and every arrival sends out the ring pulse.

function cubicLength(p0, p1, p2, p3, samples = 32) {
  let length = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const u = 1 - t;
    const point = [0, 1].map(k => u ** 3 * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t ** 3 * p3[k]);
    length += Math.hypot(point[0] - prev[0], point[1] - prev[1]);
    prev = point;
  }
  return length;
}

// A branch: forks from (x0,y0) out to lane x1, runs up to y2, merges back into x0 at y3.
function lane(x0, y0, x1, y1, y2, y3) {
  const m1 = (y0 + y1) / 2;
  const m2 = (y2 + y3) / 2;
  const fork = cubicLength([x0, y0], [x0, m1], [x1, m1], [x1, y1]);
  const merge = cubicLength([x1, y2], [x1, m2], [x0, m2], [x0, y3]);
  return {
    d: `M${x0} ${y0}C${x0} ${m1} ${x1} ${m1} ${x1} ${y1}L${x1} ${y2}C${x1} ${m2} ${x0} ${m2} ${x0} ${y3}`,
    length: fork + (y1 - y2) + merge,
    at: y => fork + (y1 - y),
  };
}

// Typewriter that cycles phrases: type, hold (caret blinks), delete, next.
// The cycle starts and ends on phrase 0 fully typed, which is also the base state,
// so when the finite loops run out the line simply rests.
function rotator(id, x, y, phrases, { size, delay, introCps = 34, typeCps = 42, delCps = 22, hold = 2100, gap = 280, loops = 2 }) {
  const n = phrases.map(p => p.length);
  const w = phrases.map(p => width(p, size));
  const intro = n[0] * introCps;
  const start = delay + intro;

  const segs = [];
  let t = 0;
  const mark = (kind, j, dur) => { segs.push({ kind, j, start: t, end: t + dur }); t += dur; };
  mark('hold', 0, hold + 300);
  mark('del', 0, n[0] * delCps);
  mark('gap', 1, gap);
  for (let j = 1; j < phrases.length; j++) {
    mark('type', j, n[j] * typeCps);
    mark('hold', j, hold);
    mark('del', j, n[j] * delCps);
    mark('gap', (j + 1) % phrases.length, gap);
  }
  mark('type', 0, n[0] * typeCps);
  const T = t;
  const pct = v => `${r2((v / T) * 100)}%`;
  const seg = (kind, j) => segs.find(s => s.kind === kind && s.j === j);
  const tx = v => `transform:translateX(${r2(v)}px)`;
  const steps = j => `animation-timing-function:steps(${n[j]},end)`;

  // Each glyph gets its own visible window inside the cycle: it switches on at its keystroke while
  // typing and off as the delete passes it. Nothing paints over the text, so the page colour never matters.
  const kf = [];
  const lines = phrases.map((phrase, j) => {
    const typing = seg('type', j);
    const deleting = seg('del', j);
    const glyphs = [...phrase].map((c, k) => {
      if (c === ' ') return ' ';
      const on = typing.start + (k + 1) * typeCps;
      const off = deleting.start + (n[j] - k) * delCps;
      const name = `${id}${j}_${k}`;
      kf.push(j === 0
        ? `@keyframes ${name}{0%{fill-opacity:1}${pct(off)}{fill-opacity:0}${pct(on)}{fill-opacity:1}}`
        : `@keyframes ${name}{0%{fill-opacity:0}${pct(on)}{fill-opacity:1}${pct(off)}{fill-opacity:0}}`);
      const anims = [`${name} ${ms(T)} step-end ${ms(start)} ${loops}`];
      if (j === 0) anims.unshift(A('ch', 1, delay + (k + 1) * introCps, EASE.linear));
      return `<tspan${j ? ' class="rh"' : ''} style="animation:${anims.join(',')}">${escapeXml(c)}</tspan>`;
    }).join('');
    return `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" textLength="${w[j]}" class="ac">${glyphs}</text>`;
  });

  // Caret position and blink follow the same segments.
  const move = [`0%{${tx(w[0])}}`];
  const blink = ['0%{opacity:1}'];
  segs.forEach((s, i) => {
    const next = segs[i + 1];
    const at = s.kind === 'del' || s.kind === 'gap' ? 0 : w[s.j];
    const timing = next && (next.kind === 'type' || next.kind === 'del') ? `;${steps(next.j)}` : '';
    move.push(`${pct(s.end)}{${tx(at)}${timing}}`);
    if (s.kind === 'hold') {
      for (let k = 1; s.start + k * 530 < s.end - 120; k++) blink.push(`${pct(s.start + k * 530)}{opacity:${k % 2 ? 0 : 1}}`);
      blink.push(`${pct(s.end)}{opacity:1}`);
    }
  });
  kf.push(`@keyframes ${id}m{${move.join('')}}`, `@keyframes ${id}b{${blink.join('')}}`);

  const cycle = (name, timing) => `${id}${name} ${ms(T)} ${timing} ${ms(start)} ${loops}`;
  const out = lines;
  kf.push('.rh{fill-opacity:0}');
  out.push(`<rect class="ac mv" x="${r2(x + 1)}" y="${r2(y - size * 0.82)}" width="${r2(size * 0.5)}" height="${r2(size * 1.02)}" rx="1"${style([
    A('in', 1, delay, EASE.linear), A('type', intro, delay, `steps(${n[0]},end)`), cycle('m', 'linear'), cycle('b', 'step-end'),
  ], `--d:${w[0]}px;`)}/>`);
  return { svg: out.join('\n'), css: kf.join('\n'), end: start + T * loops, introEnd: start };
}

function hero() {
  const W = 900;
  const H = 304;
  const id = 'hero';
  const parts = [];
  const css = [];

  // Performance note: an SVG inside <img> is re-rasterised whole on every frame that anything in it
  // moves. So no masks (each needs an offscreen buffer), and continuous motion settles within ~15s.
  //
  // Texture: a dot grid faded by a background-coloured vignette painted over it (a gradient, not a
  // mask), with a soft light drifting across it once.
  parts.push(`<rect width="${W}" height="${H}" fill="url(#hero-dots)" mask="url(#hero-fade)"${style(A('in', 1400, 100, EASE.out))}/>`);
  parts.push(`<ellipse cx="610" cy="140" rx="120" ry="86" fill="url(#hero-au1)" class="spot" style="animation:spot 12000ms ${EASE.inOut} 2800ms 1"/>`);
  // Aurora: three analogous lights drifting once behind the graph.
  const aurora = [['hero-au1', 690, 122, 170, 104, '-18px', '10px', 9000], ['hero-au2', 784, 196, 96, 86, '-14px', '-12px', 10000], ['hero-au3', 610, 214, 150, 74, '16px', '-10px', 11000]];
  parts.push(`<g class="aur"${style(A('in', 1800, 200, EASE.out))}>${aurora.map(([gid, cx, cy, rx, ry, dx, dy, dur]) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${gid})"${style(`drift ${dur}ms ${EASE.inOut} 600ms 1`, `--dx:${dx};--dy:${dy};`)}/>`).join('')}</g>`);

  // whoami → the name
  const x0 = 56;
  parts.push(chevron(x0, 78, 15, A('in', 240, 120)));
  parts.push(typed(x0 + 20, 78, 'whoami', { size: 15, delay: 260, cps: 70, caret: 'vanish', vanishAt: 820 }).svg);

  const nameSize = 56;
  const words = [['Duong', 0, 840], ['Thai', 6, 940], ['Tan', 11, 1020]];
  const wordAt = col => x0 + col * nameSize * 0.6;
  // Depth text: four offset layers (green, teal, blue, blue) extrude from behind each word once it
  // has landed, giving the name real thickness without a filter.
  const depth = [['x1', 1.6], ['x2', 3.2], ['x3', 4.8], ['x4', 6.4]];
  parts.push(`<g clip-path="url(#hero-name)">${words.map(([word, col, delay]) => {
    const x = wordAt(col);
    const layers = depth.slice().reverse().map(([cls, o], k) =>
      text(x + o, 150 + o, word, { size: nameSize, weight: 700, cls, anim: A('extrude', 700, delay + 620 + (3 - k) * 50), custom: `--e:${-o}px;` }));
    return `<g${style(A('rise', 900, delay), '--rise:84px;')}>${layers.join('')}${text(x, 150, word, { size: nameSize, weight: 700 })}</g>`;
  }).join('')}</g>`);
  // Shiny text: a skewed band of accent light crosses the glyphs a few times, then stops.
  parts.push(`<g clip-path="url(#hero-glyphs)"><g transform="skewX(-18)"><rect x="-96" y="90" width="136" height="90" fill="url(#hero-sheen)" style="--d:790px;animation:sweep 6400ms linear 2350ms 2"/></g></g>`);

  const role = rotator('rr', x0, 194, ['full-stack developer', 'cloud infrastructure builder', 'visual creator'], { size: 18, delay: 1300 });
  parts.push(role.svg);
  css.push(role.css);
  parts.push(text(x0, 238, 'I build web apps and the cloud systems that run them.', { size: 15, cls: 'mu', anim: A('up', 700, 1520) }));

  // Git graph
  const L0 = 660;
  const vMain = 0.16; // px per ms
  const vBranch = 0.2;
  const G = 600;
  const mainTop = 58;
  const mainBottom = 276;
  const mainD = `M${L0} ${mainBottom}L${L0} ${mainTop}`;
  const tMain = y => G + (mainBottom - y) / vMain;
  const B = lane(L0, 276, 736, 246, 118, 88); // infra/aws: long-lived, wide lane
  const Alane = lane(L0, 238, 698, 214, 144, 120); // feat/web: short, inner lane
  const startB = G;
  const startA = tMain(238);
  const endB = startB + B.length / vBranch;
  const endA = startA + Alane.length / vBranch;

  const line = (d, cls, delay, dur) => `<path class="${cls} draw" d="${d}" pathLength="1"${style(A('draw', dur, delay, EASE.linear))}/>`;
  parts.push(line(B.d, 'gl gr', startB, B.length / vBranch));
  parts.push(line(Alane.d, 'gl gy', startA, Alane.length / vBranch));
  parts.push(line(mainD, 'gl gm', G, (mainBottom - mainTop) / vMain));
  const flow = (d, tone, delay, dur) => [['glow', 6], ['core', 2.4]].map(([kind, w]) =>
    `<path class="flow ${tone} ${kind}" d="${d}" pathLength="1" stroke-width="${w}" stroke-dasharray=".14 .86"${style(`flow ${dur}ms linear ${Math.round(delay)}ms 10`)}/>`).join('');
  parts.push(flow(B.d, 'fr', startB + B.length / vBranch + 200, 2600));
  parts.push(flow(Alane.d, 'fy', startA + Alane.length / vBranch + 500, 2000));

  // Packets ride the lines once they exist. The main packet lands on HEAD at 60% of its period,
  // exactly when the CSS ring pulse fires, so every arrival visibly "commits".
  const tHead = tMain(mainTop);
  const period = 2600;
  const loops = 4;
  const packetAt = tHead + 420;
  const ringAt = packetAt + period * 0.6;
  const packet = (path, dur, begin, repeat, core, arrive = 0.6, tone = 'ac', halo = 'hero-halo') =>
    `<g class="fx" opacity="0"><circle r="${core * 4}" fill="url(#${halo})"/><circle class="${tone}" r="${core}"/><animateMotion path="${path}" dur="${ms(dur)}" begin="${ms(begin)}" repeatCount="${repeat}" calcMode="spline" keyPoints="0;1;1" keyTimes="0;${arrive};1" keySplines=".77 0 .175 1;0 0 1 1"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;${r2(arrive - 0.06)};${arrive};1" dur="${ms(dur)}" begin="${ms(begin)}" repeatCount="${repeat}"/></g>`;
  parts.push(packet(B.d, period * 1.5, packetAt + 900, 3, 2.4, 0.7, 'nr', 'hero-halo-r'));
  parts.push(packet(mainD, period, packetAt, loops, 3));

  const node = (cx, cy, cls, delay) => `<circle class="${cls} pop" cx="${cx}" cy="${cy}" r="4"${style(A('pop', 420, delay))}/>`;
  const merges = { 120: endA, 88: endB };
  for (const y of [276, 238, 176, 120, 88]) parts.push(node(L0, y, 'nm', Math.max(tMain(y), merges[y] ?? 0)));
  for (const y of [200, 166]) parts.push(node(698, y, 'ny', startA + Alane.at(y) / vBranch));
  const bNodes = [222, 182, 142];
  for (const y of bNodes) parts.push(node(736, y, 'nr', startB + B.at(y) / vBranch));

  parts.push(`<circle class="ring" cx="${L0}" cy="${mainTop}" r="5"${style(`ring ${period}ms ${EASE.out} ${ms(ringAt)} ${loops}`)}/>`);
  parts.push(`<circle class="ac pop" cx="${L0}" cy="${mainTop}" r="5.5"${style(A('pop', 480, tHead))}/>`);

  // Branch decorations, git log style
  const pill = (x, y, label, accent, delay) => {
    const w = width(label, 11) + 14;
    return `<g${style(A('side', 520, delay))}><rect class="${accent === 'red' ? 'pill-r' : accent ? 'pill-on' : 'pill'}" x="${x}" y="${y - 13}" width="${r2(w)}" height="19" rx="5"/>${label === 'HEAD -> main'
      ? `<text x="${x + 7}" y="${y}" font-size="11" textLength="${width(label, 11)}"><tspan class="mu">HEAD -&gt; </tspan><tspan class="ac">main</tspan></text>`
      : text(x + 7, y, label, { size: 11, cls: 'pr-t' })}</g>`;
  };
  parts.push(pill(676, mainTop + 4, 'HEAD -> main', true, tHead + 120));
  parts.push(pill(752, bNodes.at(-1) + 4, 'infra/aws', 'red', startB + B.at(bNodes.at(-1)) / vBranch + 120));


  const glyphs = words.map(([word, col]) => text(wordAt(col), 150, word, { size: nameSize, weight: 700 })).join('');
  const defs = `<pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle class="fa" cx="9" cy="9" r="1.1"/></pattern>
<radialGradient id="hero-fg" cx=".75" cy=".5" r=".3"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="hero-fade"><rect width="${W}" height="${H}" fill="url(#hero-fg)"/></mask>
<linearGradient id="hero-sheen"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".95"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
${haloDef('hero-halo')}<radialGradient id="hero-halo-r"><stop offset="0" class="shr" stop-opacity=".7"/><stop offset="1" class="shr" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au1"><stop offset="0" class="shs" stop-opacity=".17"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au2"><stop offset="0" class="sht" stop-opacity=".15"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au3"><stop offset="0" class="shb" stop-opacity=".14"/><stop offset="1" class="shb" stop-opacity="0"/></radialGradient>
<clipPath id="hero-name"><rect x="40" y="96" width="572" height="84"/></clipPath>
<clipPath id="hero-glyphs">${glyphs}</clipPath>
<style>.sht{stop-color:var(--teal)}.shb{stop-color:var(--blue)}.spot{opacity:0}
@keyframes spot{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}50%{transform:translate(120px,34px)}85%{opacity:.9}100%{opacity:0;transform:translate(40px,14px)}}
.x1{fill:var(--accent);opacity:.55}.x2{fill:var(--teal);opacity:.42}.x3{fill:var(--blue);opacity:.3}.x4{fill:var(--blue);opacity:.15}
@media (prefers-color-scheme:light){.aur{opacity:.75}.x1{opacity:.35}.x2{opacity:.28}.x3{opacity:.2}.x4{opacity:.1}}
@keyframes extrude{from{opacity:0;transform:translate(var(--e),var(--e))}}
@keyframes drift{50%{transform:translate(var(--dx),var(--dy))}}
.gl{fill:none;stroke-width:2}.gm{stroke:var(--accent)}.gb{stroke:var(--muted);opacity:.65}.gr{stroke:var(--red);opacity:.8}.gy{stroke:var(--yellow);opacity:.8}.nm{fill:var(--accent)}.nb{fill:var(--muted)}.nr{fill:var(--red)}.ny{fill:var(--yellow)}.shr{stop-color:var(--red)}
.flow{fill:none;stroke-linecap:round;opacity:0}.fr{stroke:var(--red)}.fy{stroke:var(--yellow)}.glow{stroke-opacity:.28}
@keyframes flow{0%{opacity:1;stroke-dashoffset:.14}100%{opacity:1;stroke-dashoffset:-.86}}
.pill-r{fill:var(--raised);stroke:var(--red);stroke-opacity:.6}.pr-t{fill:var(--red)}.pill{fill:var(--raised);stroke:var(--line)}.pill-on{fill:var(--raised);stroke:var(--accent);stroke-opacity:.6}
${css.join('\n')}</style>`;

  return svg({
    w: W, h: H, id, defs,
    title: 'Duong Thai Tan, full-stack developer',
    desc: 'Terminal-style hero. The command whoami types out and the name Duong Thai Tan rises into view while a sheen of light crosses it. The role line types and rotates between full-stack developer, cloud infrastructure builder and visual creator. The line "I build web apps and the cloud systems that run them." fades in. On the right, a git commit graph draws itself from the first commit up to HEAD on main, with feat/web and infra/aws branches merging in; packets of light then travel up main and pulse on arrival at HEAD.',
    body: parts.join('\n'),
  });
}

// ── Fetch card ──────────────────────────────────────────────────────────────
// neofetch-style identity card: a 3D voxel <T/> sculpture floating over a pedestal beside a raised
// panel of key/value rows whose values decrypt from noise, left to right.


// Deterministic noise so regenerating never changes committed output.
function random(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NOISE = '01#$%*+=/|?<>{}abcdef';
const garble = (str, keep, rand) => [...str].map((c, i) => (i < keep || c === ' ' || c === ',' ? c : NOISE[Math.floor(rand() * NOISE.length)])).join('');

function fetchCard() {
  const W = 900;
  const H = 344;
  const id = 'fetch';
  const parts = [];

  parts.push(chevron(40, 52, 15, A('in', 240, 100)));
  parts.push(typed(60, 52, 'neofetch', { size: 15, delay: 220, cps: 62, caret: 'vanish', vanishAt: 820 }).svg);

  // ── Voxel sculpture ──
  // Three-quarter view shared with the 3D terminal: the sign's width runs along a gentle slope and
  // depth recedes up-right, so each block shows a front, a lit top and a shaded right side. Faces
  // hidden by a neighbour are culled; rows paint bottom to top, columns left to right.
  const S = 0.18; // slope of the sign's horizontal axis
  const DV = [0.6, -0.42]; // screen step per pixel of depth
  const ox = 40;
  const oy = 110;
  const P = (u, v, d = 0) => `${r2(ox + u + d * DV[0])} ${r2(oy + v + u * S + d * DV[1])}`;
  const quad = (a, b, c, d) => `M${a}L${b}L${c}L${d}Z`;
  const cell = 12;
  const pitch = 13;
  const D = 12;

  const filled = new Set();
  const voxels = [];
  let col = 0;
  for (const char of ['<', 'T', '/', '>']) {
    GLYPHS[char].forEach((row, r) => [...row].forEach((on, c) => {
      if (on !== '#') return;
      filled.add(`${col + c},${r}`);
      voxels.push({ c: col + c, r, t: char === 'T' });
    }));
    col += 6;
  }
  voxels.sort((p, q) => q.r - p.r || p.c - q.c);

  // Pedestal the sign floats above, with a soft shadow and a light pooling beneath.
  const vf = 7 * pitch + 14; // floor level under the sign
  const [u0, u1, d0, d1, th] = [-14, 23 * pitch + 8, -10, 30, 9];
  const down = pt => { const [x, y] = pt.split(' ').map(Number); return `${x} ${r2(y + th)}`; };
  const fl = P(u0, vf, d0);
  const fr = P(u1, vf, d0);
  const br = P(u1, vf, d1);
  const bl = P(u0, vf, d1);
  parts.push(`<g${style(A('up', 800, 160))}>
<ellipse cx="200" cy="292" rx="200" ry="44" fill="url(#${id}-pool)"/>
<path class="pd-t" d="${quad(fl, fr, br, bl)}"/>
<path class="pd-f" d="${quad(fl, fr, down(fr), down(fl))}"/>
<path class="pd-r" d="${quad(fr, br, down(br), down(fr))}"/>
<path class="pd-rim" d="M${fl}L${fr}L${br}"/>
<path class="pd-run" d="M${fl}L${fr}L${br}" pathLength="1" stroke-dasharray=".12 .88"${style(`rim 3200ms ${EASE.inOut} 2300ms 2`)}/>
</g>`);
  const [scx, scy] = P((23 * pitch) / 2, vf, 10).split(' ').map(Number);
  parts.push(`<ellipse class="vsh" cx="${scx}" cy="${scy}" rx="${(23 * pitch) / 2 + 8}" ry="12" transform="rotate(${r2((Math.atan(S) * 180) / Math.PI)} ${scx} ${scy})" fill="url(#${id}-shadow)" style="animation:in 900ms ${EASE.out} 900ms both,shb 4200ms ${EASE.inOut} 2400ms 3"/>`);

  const columns = new Map();
  voxels.forEach(({ c, r, t }) => {
    const u = c * pitch;
    const v = r * pitch;
    const k = t ? 't' : 'g';
    let faces = `<path class="${k}f" d="${quad(P(u, v), P(u + cell, v), P(u + cell, v + cell), P(u, v + cell))}"${style(`${t ? 'glintT' : 'glintG'} 4600ms ${EASE.inOut} ${ms(3200 + (c + r) * 24)} 2`)}/>`;
    if (!filled.has(`${c},${r - 1}`)) faces += `<path class="${k}t" d="${quad(P(u, v), P(u + cell, v), P(u + cell, v, D), P(u, v, D))}"/>`;
    if (!filled.has(`${c + 1},${r}`)) faces += `<path class="${k}r" d="${quad(P(u + cell, v), P(u + cell, v, D), P(u + cell, v + cell, D), P(u + cell, v + cell))}"/>`;
    columns.set(c, (columns.get(c) || '') + faces);
  });
  // Columns drop in a wave from left to right.
  const blocks = [...columns].sort((p, q) => p[0] - q[0]).map(([c, faces]) => `<g${style(A('drop', 560, 700 + c * 30))}>${faces}</g>`);
  parts.push(`<g style="--b:-7px;animation:bob 4200ms ${EASE.inOut} 2400ms 3">${blocks.join('')}</g>`);

  // ── Info panel: a raised slab with its back plate one step deeper ──
  const [px, py, pw, ph] = [388, 72, 476, 252];
  parts.push(`<g${style(A('up', 760, 260))}>${extrude(px, py, pw, ph, 8, -5.5, 12, ['ipt', 'ipr'])}<rect class="ip" x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14"/><path class="ip-trim" d="M${px + 16} ${py + 0.5}H${px + pw - 16}"/></g>`);

  const kx = px + 24;
  const vx = kx + 10 * 8.4;
  const t0 = 900;
  // Header with two receding depth layers, on the same up-right depth axis as the blocks.
  const header = (cls, dx, dy) => `${text(kx + dx, 104 + dy, 'thaitan', { size: 15, cls, weight: 700 })}${text(kx + 7 * 9 + dx, 104 + dy, '@', { size: 15, cls: cls === 'ac' ? 'mu' : cls })}${text(kx + 8 * 9 + dx, 104 + dy, 'github', { size: 15, cls, weight: 700 })}`;
  parts.push(`<g${style(A('in', 420, t0))}>${header('hx2', 2.4, -1.7)}${header('hx1', 1.2, -0.85)}${header('ac', 0, 0)}</g>`);
  parts.push(`<path class="hair grow" d="M${kx} 117H${r2(kx + 14 * 9)}"${style(A('grow', 520, t0 + 80, EASE.inOut))}/>`);

  const rows = NEOFETCH;
  // Delays shrink as the list goes on: a wave, not a metronome.
  let delay = t0 + 160;
  const frame = 90;
  rows.forEach(([key, value], i) => {
    const y = 142 + i * 21;
    const rand = random(i * 977 + 13);
    const frames = [0, 1].map(k => text(vx, y, garble(value, Math.floor((value.length * k) / 2), rand), {
      size: 14, cls: 'mu fr', anim: A('show', frame, delay + 40 + k * frame, EASE.linear, '1'),
    }));
    const real = text(vx, y, value, { size: 14, anim: A('in', 1, delay + 40 + 2 * frame, EASE.linear) });
    parts.push(`<g${style(A('side', 480, delay))}>${text(kx, y, key, { size: 14, cls: 'ac' })}${frames.join('')}${real}</g>`);
    delay += Math.max(34, 70 - i * 6);
  });

  // ── Colour blocks as little 3D cubes in GitHub's terminal ANSI palette ──
  const cw = 20;
  const chh = 13;
  const cd = 8;
  const cubes = [];
  for (let i = 0; i < 8; i++) {
    const x = kx + i * 30;
    const y = 296;
    const [dx, dy] = [cd * DV[0], cd * DV[1]];
    const front = `M${x} ${y}h${cw}v${chh}h${-cw}z`;
    const top = `M${x} ${y}h${cw}l${r2(dx)} ${r2(dy)}h${-cw}z`;
    const right = `M${x + cw} ${y}l${r2(dx)} ${r2(dy)}v${chh}l${r2(-dx)} ${r2(-dy)}z`;
    cubes.push(`<g${style([A('drop', 480, delay + 260 + i * 40), `wave 2600ms ${EASE.inOut} ${ms(delay + 1400 + i * 90)} 2`])}><path class="a${i}t" d="${top}"/><path class="a${i}r" d="${right}"/><path class="a${i}" d="${front}"/></g>`);
  }
  parts.push(cubes.join(''));

  const shade = (hex, to, f) => toHex(hexRgb(hex).map((v, i) => v + (hexRgb(to)[i] - v) * f));
  const ansi = list => list.map((hex, i) => `.a${i}{fill:${hex}}.a${i}t{fill:${shade(hex, '#ffffff', 0.32)}}.a${i}r{fill:${shade(hex, '#000000', 0.38)}}`).join('');

  return svg({
    w: W, h: H, id,
    defs: `<radialGradient id="${id}-pool"><stop offset="0" class="shs" stop-opacity=".16"/><stop offset=".6" class="sht" stop-opacity=".05"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient><radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<style>.sht{stop-color:var(--teal)}:root{--gf:#4d5562;--gt:#7d8590;--gr:#262c36}
@media (prefers-color-scheme:light){:root{--gf:#8c959f;--gt:#c4cbd3;--gr:#57606a}}
.tf{fill:var(--accent)}.tt{fill:var(--glow)}.tr{fill:var(--deep)}.gf{fill:var(--gf)}.gt{fill:var(--gt)}.gr{fill:var(--gr)}
.pd-t{fill:var(--raised)}.pd-f{fill:var(--line)}.pd-r{fill:var(--faint)}.pd-rim{fill:none;stroke:var(--accent);stroke-opacity:.45}
.pd-run{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;opacity:0}
.vsh{transform-box:fill-box;transform-origin:center}@media (prefers-color-scheme:light){.vsh{opacity:.3}}
.ip{fill:var(--raised);stroke:var(--line)}.ipt{fill:var(--line)}.ipr{fill:var(--faint)}.ip-trim{fill:none;stroke:var(--accent);stroke-opacity:.5}
.hx1{fill:var(--teal);opacity:.5}.hx2{fill:var(--blue);opacity:.28}
${ansi(['#484f58', '#ff7b72', '#3fb950', '#d29922', '#58a6ff', '#bc8cff', '#39c5cf', '#b1bac4'])}
@media (prefers-color-scheme:light){${ansi(['#24292f', '#cf222e', '#116329', '#9a6700', '#0969da', '#8250df', '#1b7c83', '#6e7781'])}.hx1{opacity:.3}.hx2{opacity:.16}}
@keyframes drop{from{opacity:0;transform:translateY(-46px)}}
@keyframes bob{50%{transform:translateY(var(--b))}}
@keyframes shb{50%{transform:scale(.86)}}
@keyframes wave{0%,40%,100%{transform:translateY(0)}20%{transform:translateY(-5px)}}
@keyframes glintG{8%{fill:var(--gt)}26%{fill:var(--gf)}}
@keyframes rim{0%{opacity:0;stroke-dashoffset:.12}10%,85%{opacity:1}100%{opacity:0;stroke-dashoffset:-.88}}</style>`,
    title: 'neofetch: thaitan@github',
    desc: `A neofetch-style card. A 3D voxel <T/> sculpture assembles block by block above a lit pedestal and floats; beside it a raised panel lists ${rows.map(([k, v]) => `${k}: ${v}`).join('; ')}, each value decrypting from noise, above eight 3D colour cubes in the terminal ANSI palette.`,
    body: parts.join('\n'),
  });
}

// ── Section headers ─────────────────────────────────────────────────────────
// Each section opens with its command: it types, runs (spinner plus a progress line across the
// card), and the spinner resolves into a check.

const SECTION_ICON = { about: 'about', toolkit: 'toolkit', 'selected-work': 'projects', certificates: 'certificates', automation: 'automation', connect: 'connect' };

const SECTIONS = [
  ['about', 'cat about.md'],
  ['toolkit', 'ls ~/toolkit/{client,server}'],
  ['selected-work', 'ls ~/projects'],
  ['certificates', 'cat certificates.json'],
  ['automation', 'gh workflow list'],
  ['connect', 'ping duongthaitan'],
];

// The card is a 3D key: a face sitting on a base plate offset into depth. When the command is
// entered the face presses into its base and springs back, the way a real key would.
function sectionHeader(slug, command) {
  const W = 900;
  const H = 64;
  const depth = 6;
  const fw = W - depth - 1;
  const fh = H - depth - 1;
  const id = slug;
  const y = 34;
  const cmd = typed(76, y, command, { size: 15, delay: 160, cps: 42, caret: 'vanish' });
  const enterAt = cmd.end + 200;
  const runAt = cmd.end + 380;
  const runDur = 1000;
  const doneAt = runAt + runDur * 0.75;
  const body = [
    extrude(0.5, 0.5, fw, fh, depth, depth, 10, ['kb', 'ks']),
    `<g${style(looping() ? `pressd ${looping()}ms linear(0, 0 ${r2((enterAt / looping()) * 100)}%, 1 ${r2(((enterAt + 110) / looping()) * 100)}%, 0 ${r2(((enterAt + 300) / looping()) * 100)}%, 0 100%) 0ms infinite alternate both` : `press 300ms ${EASE.out} ${Math.round(enterAt)}ms 1`)}>`,
    `<path class="frame" d="${rrect(0.5, 0.5, fw, fh, 11.5)}"/>`,
    icon(24, y - 14, 18, UI[SECTION_ICON[slug]], 'ac', A('pop', 360, 40)),
    `<path class="sep" d="M50 ${y - 15}v20"/>`,
    chevron(58, y, 15, A('in', 240, 60)),
    cmd.svg,
    `<rect class="ac run" x="0" y="${fh - 2.5}" width="${fw}" height="2" clip-path="url(#${id}-key)"${style(looping() ? [A('grow', runDur * 0.75, runAt, EASE.inOut), loopWindow('showw', runAt, runAt + runDur)] : A('run', runDur, runAt, EASE.inOut))}/>`,
    spinner(fw - 66, y - 5, runAt, doneAt - runAt),
    check(fw - 72, y - 1, A('pop', 360, doneAt)),
    text(fw - 22, y, 'done', { size: 13, cls: 'mu', anchor: 'end', anim: A('in', 360, doneAt + 60) }),
    '</g>',
  ].join('\n');
  return svg({
    w: W, h: H, id, body, frame: false,
    defs: `<clipPath id="${id}-key"><rect width="${fw + 1}" height="${fh + 1}" rx="12"/></clipPath><style>.kb{fill:var(--line)}.ks{fill:var(--faint)}@keyframes press{40%{transform:translate(${depth / 2}px,${depth / 2}px)}}@keyframes pressd{to{transform:translate(${depth / 2}px,${depth / 2}px)}}.sep{stroke:var(--line)}</style>`,
    title: `$ ${command}`,
    desc: `A 3D terminal key that types the command "${command}", presses in as it runs with a spinner, and reports done.`,
  });
}

// ── Launch key ──────────────────────────────────────────────────────────────
// The README's one call to action: a bigger 3D key that types the launch command, then waits with
// a slow accent pulse and an enter symbol, inviting the click (the image is wrapped in a link).
function launchKey() {
  const W = 900;
  const H = 84;
  const depth = 7;
  const fw = W - depth - 1;
  const fh = H - depth - 1;
  const id = 'launch';
  const y = 46;
  const cmd = typed(86, y, './terminal --interactive --3d', { size: 17, delay: 300, cps: 40, caret: 'blink', blinks: 6 });
  const ready = cmd.end + 200;
  const label = 'open the interactive terminal';
  const lx = fw - 76 - width(label, 13);
  const enter = `M${fw - 46} ${y - 13}v9h-16m0 0l5 -5m-5 5l5 5`;
  const body = [
    extrude(0.5, 0.5, fw, fh, depth, depth, 12, ['kb', 'ks']),
    `<path class="face" d="${rrect(0.5, 0.5, fw, fh, 13)}"/>`,
    `<path class="pulse" d="${rrect(0.5, 0.5, fw, fh, 13)}"${style(`pulse 2600ms ${EASE.inOut} ${Math.round(ready)}ms 4`)}/>`,
    icon(26, y - 17, 22, UI.terminal, 'ac', A('pop', 360, 40)),
    chevron(62, y, 17, A('in', 240, 80)),
    cmd.svg,
    `<g${style(A('side', 520, ready))}>${text(lx, y - 1, label, { size: 13, cls: 'mu' })}<rect class="ek" x="${fw - 66}" y="${y - 22}" width="40" height="28" rx="6"/><path class="tick" d="${enter}"/></g>`,
  ].join('\n');
  return svg({
    w: W, h: H, id, body, frame: false,
    defs: `<style>.kb{fill:var(--line)}.ks{fill:var(--faint)}.face{fill:var(--raised);stroke:var(--accent);stroke-opacity:.55}.pulse{fill:none;stroke:var(--accent);stroke-width:2;opacity:0}.ek{fill:var(--raised);stroke:var(--line)}
@keyframes pulse{0%,100%{opacity:0}45%{opacity:.85}}</style>`,
    title: 'Open the interactive 3D terminal',
    desc: 'A 3D key that types ./terminal --interactive --3d and invites a click to open the interactive terminal page, where you can type commands, tilt the terminal and press the tool keys.',
  });
}

// ── Divider ─────────────────────────────────────────────────────────────────

function divider() {
  const W = 900;
  const H = 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="div-title" style="max-width:100%;height:auto">
<title id="div-title">Section divider</title>
<style>:root{--line:#262c36;--accent:#7ee787}@media (prefers-color-scheme:light){:root{--line:#d1d9e0;--accent:#1a7f37}}
.e{stop-color:var(--line)}.a{fill:var(--accent)}.g{stop-color:var(--accent)}.t{opacity:0}
@keyframes slide{from{opacity:0;transform:translateX(-430px)}}
@keyframes trace{0%{opacity:0;transform:translateX(0)}10%,85%{opacity:1}100%{opacity:0;transform:translateX(${W}px)}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}</style>
<defs><linearGradient id="div-edge" gradientUnits="userSpaceOnUse" x1="0" x2="${W}" y1="0" y2="0"><stop offset="0" class="e" stop-opacity="0"/><stop offset=".2" class="e"/><stop offset=".8" class="e"/><stop offset="1" class="e" stop-opacity="0"/></linearGradient>
<linearGradient id="div-trace"><stop offset="0" class="g" stop-opacity="0"/><stop offset="1" class="g" stop-opacity=".8"/></linearGradient></defs>
<rect y="12" width="${W}" height="1" fill="url(#div-edge)"/>
<rect class="t" x="-160" y="12" width="160" height="1" fill="url(#div-trace)" style="animation:trace 2400ms ${EASE.inOut} 1500ms 2"/>
<rect class="a" x="${W / 2 - 24}" y="11.5" width="48" height="2" rx="1" style="animation:${A('slide', 1600, 200)}"/>
</svg>
`;
}

// ── Toolkit tree ────────────────────────────────────────────────────────────


// ── Isometric toolkit islands ───────────────────────────────────────────────
// Two platforms (client, server) where every tool is a block. Isometric projection is affine,
// so each logo is drawn flat and mapped onto the lit left face with one matrix: real 3D geometry,
// no CSS 3D (which SVG images do not support). Blocks drop in back to front, shadows grow as
// they land, then the island breathes in a slow wave.



function island({ id, title, subtitle, groups, cols, offset }) {
  const W = 900;
  const H = 336;
  const a = 56; // iso half-width of a cell
  const b = 28; // iso half-height
  const h = 20; // keycap height
  const k = 0.82; // keycap footprint inside its cell
  const t = 14; // platform thickness
  const ak = a * k;
  const bk = b * k;
  const rows = groups.length;
  const [i0, i1, j0, j1] = [-0.66, rows - 0.34, -0.66, cols - 0.34];
  const zones = ['shs', 'sht', 'shb']; // green, teal, blue: one analogous hue per category

  const minX = (j0 - i1) * a;
  const maxX = (j1 - i0) * a;
  const minY = Math.min((i0 + j0) * b, -h - bk);
  const maxY = (i1 + j1) * b + t;
  const ox = 268 - (minX + maxX) / 2;
  const oy = (36 + H) / 2 - (minY + maxY) / 2;
  const P = (i, j) => [r2(ox + (j - i) * a), r2(oy + (i + j) * b)];
  const pt = ([x, y]) => `${x} ${y}`;
  const quad = (p, q, r, s) => `M${pt(p)}L${pt(q)}L${pt(r)}L${pt(s)}Z`;

  const parts = [];
  parts.push(`<g${style(A('in', 420, 80))}>${text(28, 38, title, { size: 14, weight: 700 })}${text(28 + (title.length + 1) * 8.4, 38, subtitle, { size: 12, cls: 'mu' })}</g>`);

  // Platform: lit top, two receding sides, an accent rim on the front edges, a glow beneath.
  const [A0, B0, C0, D0] = [P(i0, j0), P(i0, j1), P(i1, j1), P(i1, j0)];
  const down = ([x, y]) => [x, r2(y + t)];
  const centre = P((i0 + i1) / 2, (j0 + j1) / 2);
  const zoneTiles = groups.map((_, i) => `<path fill="url(#${id}-z${i})" d="${quad(P(i - 0.46, -0.46), P(i - 0.46, cols - 0.54), P(i + 0.46, cols - 0.54), P(i + 0.46, -0.46))}"/>`).join('');
  const grid = [];
  for (let j = -0.5; j <= cols - 0.5; j++) grid.push(`M${pt(P(-0.5, j))}L${pt(P(rows - 0.5, j))}`);
  for (let i = -0.5; i <= rows - 0.5; i++) grid.push(`M${pt(P(i, -0.5))}L${pt(P(i, cols - 0.5))}`);
  parts.push(`<g${style(A('up', 760, 120))}>
<ellipse cx="${centre[0]}" cy="${r2(centre[1] + 30)}" rx="250" ry="96" fill="url(#${id}-glow)"/>
<path class="pt" d="${quad(A0, B0, C0, D0)}"/>
<path class="pl" d="${quad(D0, C0, down(C0), down(D0))}"/>
<path class="pr" d="${quad(C0, B0, down(B0), down(C0))}"/>
<path class="rim" d="M${pt(D0)}L${pt(C0)}L${pt(B0)}"/>
</g>`);
  parts.push(`<g${style(A('in', 700, 420))}>${zoneTiles}<path class="grid" d="${grid.join('')}"/></g>`);

  // Keycaps, painted back to front. Logos lie on the cap, foreshortened 2:1 like the floor.
  // Scaled pieces (shadow, halo) are absolute paths: transform-box on <use x y> ignores the offset in Chrome.
  const rhAt = (x, y, f) => `M${x} ${r2(y - bk * f)}l${r2(ak * f)} ${r2(bk * f)}l${r2(-ak * f)} ${r2(bk * f)}l${r2(-ak * f)} ${r2(-bk * f)}z`;
  const cells = groups.flatMap(([, items], i) => items.map((item, j) => ({ item, i, j }))).sort((p, q) => p.i + p.j - (q.i + q.j));
  for (const { item, i, j } of cells) {
    const icon = ICONS[SLUGS[item]];
    const [x, yf] = P(i, j);
    const yt = r2(yf - h);
    const drop = offset + 520 + (i + j) * 80 + i * 24;
    const bob = offset + 2600 + (i + j) * 150;
    const on = CURRENT.has(item);
    const sx = (ak * 0.9) / 24;
    const sy = sx * (b / a);
    const logo = `<path class="lg" style="${logoInk(icon.hex)}" transform="matrix(${r2(sx)} 0 0 ${r2(sy)} ${r2(x - 12 * sx)} ${r2(yt - 12 * sy)})" d="${icon.d}"/>`;
    const lit = on ? `<use href="#${id}-cap" x="${x}" y="${yt}" class="on"/><path class="halo" d="${rhAt(x, yt, 1)}" style="animation-delay:${ms(bob + 300)}"/>` : '';
    parts.push(`<path class="sd shd" d="${rhAt(x, yf, 1.06)}"${style(`shbob 3600ms ${EASE.inOut} ${ms(bob)} 3`)}/>`);
    parts.push(`<g${style(A('drop', 820, drop))}><g class="bb" style="animation-delay:${ms(bob)}"><use href="#${id}-block" x="${x}" y="${yt}"/><use href="#${id}-tint" x="${x}" y="${yt}" color="${icon.hex}"/>${lit}${logo}</g></g>`);
  }

  // Name panel: the readable index, keyed to the floor zones.
  const px = 560;
  const lineH = 20;
  const blocks = groups.map(([label, items]) => {
    const lines = [[]];
    let used = 0;
    for (const item of items) {
      if (used && used + item.length + 2 > 36) { lines.push([]); used = 0; }
      lines.at(-1).push(item);
      used += item.length + 2;
    }
    return { label, lines };
  });
  const panelH = blocks.reduce((sum, blk) => sum + 26 + blk.lines.length * lineH + 18, 0) - 18;
  let y = Math.round((36 + H) / 2 - panelH / 2 + 10);
  blocks.forEach(({ label, lines }, g) => {
    const row = [`<path class="zk z${g}" d="M${px + 6} ${y - 10}l8 5l-8 5l-8 -5z"/>`, text(px + 22, y, label, { size: 13, weight: 700 })];
    lines.forEach((line, n) => {
      let x = px + 22;
      for (const item of line) {
        row.push(text(x, y + 26 + n * lineH, item, { size: 13, cls: CURRENT.has(item) ? 'ac' : 'mu' }));
        x += (item.length + 2) * 7.8;
      }
    });
    parts.push(`<g${style(A('side', 520, offset + 900 + g * 110))}>${row.join('')}</g>`);
    y += 26 + lines.length * lineH + 18;
  });
  parts.push(`<g${style(A('in', 420, offset + 1700))}><path class="on" d="M${px + 6} ${H - 36}l10 6l-10 6l-10 -6z"/>${text(px + 22, H - 26, 'in production now', { size: 12, cls: 'mu' })}</g>`);

  const top = `M0 ${r2(-bk)}L${r2(ak)} 0L0 ${r2(bk)}L${r2(-ak)} 0Z`;
  const left = `M${r2(-ak)} 0L0 ${r2(bk)}V${r2(bk + h)}L${r2(-ak)} ${h}Z`;
  const right = `M0 ${r2(bk)}L${r2(ak)} 0V${h}L0 ${r2(bk + h)}Z`;
  const rh = f => `M0 ${r2(-bk * f)}L${r2(ak * f)} 0L0 ${r2(bk * f)}L${r2(-ak * f)} 0Z`;
  const zoneDefs = groups.map((_, i) => `<linearGradient id="${id}-z${i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="${zones[i]}" stop-opacity=".3"/><stop offset="1" class="${zones[i]}" stop-opacity=".1"/></linearGradient>`).join('');
  const defs = `<radialGradient id="${id}-glow"><stop offset="0" class="shs" stop-opacity=".16"/><stop offset=".6" class="sht" stop-opacity=".05"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>${zoneDefs}
<g id="${id}-block"><path class="ft" d="${top}"/><path class="fl" d="${left}"/><path class="fr" d="${right}"/><path class="dish" d="${rh(0.74)}"/><path class="edge" d="M${r2(-ak)} 0L0 ${r2(bk)}L${r2(ak)} 0M0 ${r2(bk)}V${r2(bk + h)}"/></g>
<g id="${id}-tint" fill="currentColor"><path opacity=".07" d="${top}"/><path opacity=".2" d="${right}"/><path opacity=".1" d="${left}"/></g>
<path id="${id}-cap" d="${top}"/>
<style>.sht{stop-color:var(--teal)}.shb{stop-color:var(--blue)}
.pt{fill:var(--raised)}.pl{fill:var(--line)}.pr{fill:var(--faint)}.rim{fill:none;stroke:var(--accent);stroke-opacity:.45}
.grid{fill:none;stroke:var(--line);stroke-width:.8}.z0{fill:var(--accent)}.z1{fill:var(--teal)}.z2{fill:var(--blue)}
.ft{fill:#2a3341}.fl{fill:#222a35}.fr{fill:#181e27}.dish{fill:#fff;opacity:.025}.edge{fill:none;stroke:#fff;stroke-opacity:.09}
.shd{fill:#000;opacity:.45}.on{fill:none;stroke:var(--accent);stroke-width:1.4;stroke-opacity:.85}
.lg{fill:var(--c)}
@media (prefers-color-scheme:light){.ft{fill:#fff}.fl{fill:#f0f3f6}.fr{fill:#dfe4ea}.dish{fill:#1f2328;opacity:.03}.edge{stroke:#1f2328;stroke-opacity:.08}.shd{fill:#1f2328;opacity:.13}.lg{fill:var(--cl,var(--c))}.pl{fill:#e6eaef}.pr{fill:#d8dee4}}
.bb{animation:bob 3600ms ${EASE.inOut} 3}
.sd,.halo{transform-box:fill-box;transform-origin:center}
.halo{fill:none;stroke:var(--accent);opacity:0;animation:halo 3600ms ${EASE.out} 3}
@keyframes drop{from{opacity:0;transform:translateY(-96px)}}
@keyframes bob{50%{transform:translateY(-7px)}}
@keyframes shin{from{opacity:0;transform:scale(.3)}}
@keyframes shbob{50%{opacity:.45;transform:scale(.8)}}
@keyframes halo{0%{opacity:.9;transform:scale(1)}55%,100%{opacity:0;transform:scale(1.45)}}</style>`;

  const names = groups.map(([label, items]) => `${label}: ${items.join(', ')}`).join('; ');
  return svg({
    w: W, h: H, id, defs,
    title: `Toolkit, ${title}`,
    desc: `Isometric keyboard where each tool is a keycap carrying its logo, with a name panel beside it. ${names}. In production now: ${groups.flatMap(([, items]) => items).filter(item => CURRENT.has(item)).join(', ')}.`,
    body: parts.join('\n'),
  });
}

// ── 3D terminal scene ───────────────────────────────────────────────────────
// The automation section, shown rather than told: a terminal standing in 3D space runs this
// repo's real pipeline (generate, test, push) while two panels floating at other depths react to
// it. Depth cues: thickness plate, floor shadow and glossy reflection, parallax (each panel bobs
// with its own amplitude and period), and a slow yaw. An orthographic yaw is affine, so it is a
// skewY plus a scaleX: real geometry, transform-only, compositor-friendly at 60fps.

function terminal3d(sizes) {
  const W = 900;
  const H = 452;
  const id = 'term';
  const s0 = 0.2; // resting slope of a panel's horizontal axis (camera yaw)
  const deg = v => r2((Math.atan(v) * 180) / Math.PI);
  const parts = [];
  const css = [];

  // Motion is translation only. Any animated skew or scale changes the text's screen scale and
  // makes Chrome re-layout every glyph each frame (measured: the yaw version dropped to ~45fps).
  // Depth comes from parallax instead: after the run, each layer pans by an amount set by its
  // depth (back 6px, middle 12px, front 18px), so near things visibly travel further.
  // Pan cycle: rest, one side, through to the other, rest; velocity is zero only at the turns.
  css.push(`.yw{transform:skewY(${deg(s0)}deg)}`);
  css.push(`@keyframes pan{0%{animation-timing-function:${EASE.inOut}}25%{transform:translateX(var(--pn));animation-timing-function:${EASE.inOut}}75%{transform:translateX(var(--pp));animation-timing-function:${EASE.inOut}}}`);
  css.push('@keyframes bob{50%{transform:translateY(var(--b))}}');
  const pan = (amp, delay, inner) => `<g style="--pn:${-amp}px;--pp:${amp}px;animation:pan 9000ms linear ${Math.round(delay)}ms 1">${inner}</g>`;

  // Floor: an oblique grid on the same yaw, fading out radially, with light pooling under panels.
  const O = [360, 382];
  const ex = [48, 48 * s0];
  const ez = [-26, 18];
  const Q = (u, v) => `${r2(O[0] + u * ex[0] + v * ez[0])} ${r2(O[1] + u * ex[1] + v * ez[1])}`;
  // Fade by distance from the centre with per-line opacity: a mask would cost an offscreen pass per frame.
  const grid = [];
  const fade = k => r2(Math.max(0, 1 - Math.abs(k) / 5.2) ** 1.4);
  for (let v = -4; v <= 4; v++) grid.push(`<path d="M${Q(-6, v)}L${Q(6, v)}" opacity="${fade(v * 1.3)}"/>`);
  for (let u = -6; u <= 6; u++) grid.push(`<path d="M${Q(u, -4)}L${Q(u, 4)}" opacity="${fade(u)}"/>`);
  parts.push(`<g${style(A('in', 1200, 100))}><ellipse cx="300" cy="372" rx="300" ry="70" fill="url(#${id}-pool)"/><ellipse cx="740" cy="300" rx="148" ry="56" fill="url(#${id}-pool2)"/><g class="tg" mask="url(#${id}-floor)">${grid.join('')}</g></g>`);

  // A floating panel: placement > entrance > parallax pan > bob > static yaw. The back plate sits
  // one step deeper; shadow and reflection pan with the panel but bob against it.
  const panel = ({ cx, cy, w, h, enter, bobAmp, bobDur, bobDelay, depth, content, reflect = false, gap = 0 }) => {
    const hw = w / 2;
    const hh = h / 2;
    const bob = (amp, inner) => `<g style="--b:${amp}px;animation:bob ${bobDur}ms ${EASE.inOut} ${bobDelay}ms 3">${inner}</g>`;
    const yawG = inner => `<g class="yw">${inner}</g>`;
    const plate = `<g transform="translate(8 -5.5)">${yawG(`<rect class="tp" x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="12"/>`)}</g>`;
    const face = yawG(`<rect class="tb" x="${-hw}" y="${-hh}" width="${w}" height="${h}" rx="12"/><path class="trim" d="M${-hw + 14} ${-hh + 0.5}H${hw - 14}"/>${content}`);
    let inner = '';
    if (reflect) {
      const shadow = `<ellipse class="tsh" cx="0" cy="${hh + gap + 4}" rx="${hw + 10}" ry="18" transform="rotate(${deg(s0)} 0 ${hh + gap + 4})" fill="url(#${id}-shadow)"/>`;
      const glass = yawG(`<rect x="${-hw}" y="${hh + 2 * gap}" width="${w}" height="${h * 0.4}" rx="12" fill="url(#${id}-reflect)"/>`);
      inner += `${shadow}${bob(-bobAmp, glass)}`;
    }
    inner += bob(bobAmp, plate + face);
    return `<g transform="translate(${cx} ${cy})"><g${style(A('up', 900, enter))}>${pan(depth * 6, end + 300 + depth * 120, inner)}</g></g>`;
  };

  // ── Main terminal content (panel-local coordinates) ──
  const tw = 440;
  const th = 250;
  const x0 = -194;
  const lineH = 19;
  const first = -70;
  const visible = 10;
  const lines = [];
  let t = 700;
  const cmd = text => { const at = t; t += 220; lines.push({ kind: 'cmd', text, at, typeAt: t }); t += text.length * 38 + 320; };
  const out = (cells, gap = 85) => { lines.push({ kind: 'out', cells, at: t }); t += gap; };
  const kb = bytes => `${(bytes / 1000).toFixed(1)} kB`;

  cmd('node scripts/gen-profile.mjs');
  const assetRows = Object.entries(sizes);
  const assetAt = {};
  for (const [name, bytes] of assetRows) {
    assetAt[name] = t;
    out([[`${name.padEnd(21)}${kb(bytes).padStart(8)}`, 'mu', 0]]);
  }
  t += 300;
  cmd('node --test scripts/*.test.mjs');
  out([['ok', 'ac', 0], ['render-metrics.test.mjs', 'fg', 30]], 260);
  out([['ok', 'ac', 0], ['gen-profile.test.mjs', 'fg', 30]], 260);
  t += 300;
  cmd('git push origin main');
  out([['To github.com:duongthaitan/duongthaitan.git', 'mu', 0]], 320);
  const pushedAt = t;
  out([['main -> main', 'fg', 24]], 300);
  lines.push({ kind: 'prompt', at: t });
  const end = t;

  const rendered = lines.map((line, n) => {
    const y = first + n * lineH;
    let inner;
    if (line.kind === 'cmd') {
      const typedCmd = typed(x0 + 18, y, line.text, { size: 13, delay: line.typeAt, cps: 38, caret: 'vanish', vanishAt: line.typeAt + line.text.length * 38 + 260 });
      inner = chevron(x0, y, 13) + typedCmd.svg;
    } else if (line.kind === 'out') {
      inner = line.cells.map(([str, cls, dx]) => text(x0 + 18 + dx, y, str, { size: 13, cls, pre: true })).join('');
    } else {
      inner = `${chevron(x0, y, 13)}<rect class="ac" x="${x0 + 19}" y="${r2(y - 10.7)}" width="6.5" height="13.3" rx="1"${style(`blink 1100ms linear ${line.at + 200}ms 10`)}/>`;
    }
    return `<g${style(A('in', 1, line.at, EASE.linear))}>${inner}</g>`;
  });

  // Scroll: each line past the tenth pushes the buffer up one row with a short ease-out.
  const stops = [[0, 0]];
  lines.forEach((line, n) => {
    if (n < visible) return;
    const prev = stops.at(-1)[1];
    stops.push([line.at, prev], [line.at + 200, -(n - visible + 1) * lineH]);
  });
  const finalOffset = stops.at(-1)[1];
  const scrollT = stops.at(-1)[0];
  css.push(`.scroll{transform:translateY(${finalOffset}px)}@keyframes scrollm{from{transform:translateY(0)}}@keyframes scroll{${stops.map(([at, off], k) => `${r2((at / scrollT) * 100)}%{transform:translateY(${off}px)${k % 2 ? `;animation-timing-function:${EASE.out}` : ''}}`).join('')}}`);

  const screen = `<rect class="scr" x="-208" y="-92" width="416" height="208" rx="6"/>
<g clip-path="url(#${id}-scr)"><g class="scroll" style="animation:${looping() ? `scrollm ${looping()}ms linear(0, ${stops.slice(1).map(([at, off]) => `${r2(off / finalOffset)} ${r2((at / looping()) * 100)}%`).join(', ')}, 1 100%) 0ms infinite alternate both` : `scroll ${scrollT}ms linear 0ms both`}">${rendered.join('')}</g>
<rect class="scan" x="-208" y="-98" width="416" height="8" fill="url(#${id}-scan)" style="animation:scan 4600ms linear ${end + 400}ms 2"/>
<g transform="skewX(-18)"><rect x="-330" y="-92" width="80" height="208" fill="url(#${id}-glare)" style="--d:620px;animation:sweep 7600ms linear ${end - 1400}ms 2"/></g></g>`;
  const chrome = `<circle class="a1" cx="-198" cy="-109" r="4.5"/><circle class="a3" cx="-183" cy="-109" r="4.5"/><circle class="a2" cx="-168" cy="-109" r="4.5"/>${text(0, -105, '~/duongthaitan', { size: 11, cls: 'mu', anchor: 'middle' })}<path class="hair" d="M-220 -96H220"/>`;

  // ── Assets panel: bars grow as the terminal prints each file ──
  const max = Math.max(...assetRows.map(([, bytes]) => bytes));
  const assetsContent = [
    // In a yawed plane rows slope, so a label and its value share one short run and the bar sits
    // right under them: no far-apart columns for the eye to mismatch.
    text(-112, -80, 'assets, kB', { size: 11, weight: 700 }),
    `<path class="hair" d="M-130 -68H130"/>`,
    ...assetRows.map(([name, bytes], i) => {
      const y = -46 + i * 25;
      const at = assetAt[name] + 70;
      const label = name.replace('.svg', '');
      return `${text(-112, y, label, { size: 11, cls: 'mu' })}${text(-112 + (label.length + 2) * 6.6, y, (bytes / 1000).toFixed(1), { size: 11, anim: A('in', 260, at + 120) })}<rect class="tr" x="-112" y="${y + 5}" width="220" height="4" rx="2"/><rect class="ac grow" x="-112" y="${y + 5}" width="${r2((bytes / max) * 220)}" height="4" rx="2"${style(A('grow', 620, at))}/>`;
    }),
  ].join('');

  // ── Git panel: a new commit lands on main the moment the push completes ──
  const gitContent = [
    text(-104, -26, 'git log --graph', { size: 11, cls: 'mu' }),
    `<path class="hair" d="M-120 -14H120"/>`,
    `<path class="gline" d="M-92 18H32"/>`,
    `<path class="gline draw" d="M32 18H72" pathLength="1"${style(A('draw', 260, pushedAt, EASE.out))}/>`,
    ...[-92, -50, -8, 30].map(x => `<circle class="gnode" cx="${x}" cy="18" r="4"/>`),
    `<circle class="ring" cx="72" cy="18" r="5"${style(`ring 2200ms ${EASE.out} ${pushedAt + 260}ms 3`)}/>`,
    `<circle class="ac pop" cx="72" cy="18" r="5.5"${style(A('pop', 420, pushedAt + 200))}/>`,
    `<g style="--d:42px;animation:${A('type', 520, pushedAt + 160)}" class="mv"><rect class="tpill" x="8" y="-5" width="44" height="16" rx="5"/>${text(15, 7, 'main', { size: 11, cls: 'ac' })}</g>`,
  ].join('');

  parts.push(panel({ cx: 726, cy: 148, w: 260, h: 212, enter: 320, bobAmp: -9, bobDur: 6200, bobDelay: 0, depth: 1, content: assetsContent }));
  parts.push(panel({ cx: 292, cy: 200, w: tw, h: th, enter: 120, bobAmp: -6, bobDur: 5200, bobDelay: 0, depth: 2, content: chrome + screen, reflect: true, gap: 26 }));
  parts.push(panel({ cx: 752, cy: 366, w: 240, h: 104, enter: 480, bobAmp: -5, bobDur: 4400, bobDelay: 600, depth: 3, content: gitContent }));

  // Data particles drifting up off the terminal's top edge.
  const rand = random(4242);
  const dots = [];
  for (let n = 0; n < 12; n++) {
    const px = -190 + rand() * 380;
    const x = r2(292 + px);
    const y = r2(200 - 125 + px * s0 - 10);
    const size = rand() > 0.6 ? 3 : 2;
    dots.push(`<rect class="${['ac', 'tl', 'bl'][n % 3]} pt" x="${x}" y="${y}" width="${size}" height="${size}" rx=".5" style="animation:rise ${Math.round(2800 + rand() * 1400)}ms ${EASE.out} ${Math.round(end + rand() * 3000)}ms 3"/>`);
  }
  parts.push(dots.join(''));

  const defs = `<radialGradient id="${id}-fl" cx=".4" cy=".78" r=".25"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="${id}-floor"><rect width="${W}" height="${H}" fill="url(#${id}-fl)"/></mask>
<clipPath id="${id}-scr"><rect x="-208" y="-84" width="416" height="200" rx="6"/></clipPath>
<radialGradient id="${id}-pool"><stop offset="0" class="shs" stop-opacity=".14"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-pool2"><stop offset="0" class="sht" stop-opacity=".12"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-reflect" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shs" stop-opacity=".06"/><stop offset=".3" class="shfg" stop-opacity=".025"/><stop offset="1" class="shfg" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".09"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-glare"><stop offset="0" class="shfg" stop-opacity="0"/><stop offset=".5" class="shfg" stop-opacity=".07"/><stop offset="1" class="shfg" stop-opacity="0"/></linearGradient>
<style>.sht{stop-color:var(--teal)}.shfg{stop-color:var(--fg)}
.tg{fill:none;stroke:var(--line);stroke-width:1}.tr{fill:var(--line);opacity:.6}
.tb{fill:var(--panel);stroke:var(--line)}.tp{fill:var(--line)}.trim{fill:none;stroke:var(--accent);stroke-opacity:.5}
.tsh{opacity:.9}.tpill{fill:var(--raised);stroke:var(--accent);stroke-opacity:.6}
.gline{fill:none;stroke:var(--muted);stroke-width:2;opacity:.7}.gnode{fill:var(--muted)}.scr{fill:var(--screen)}
.a1{fill:#ff7b72}.a2{fill:#3fb950}.a3{fill:#d29922}.tl{fill:var(--teal)}.bl{fill:var(--blue)}
.scan,.pt{opacity:0}
@media (prefers-color-scheme:light){.a1{fill:#cf222e}.a2{fill:#1a7f37}.a3{fill:#bf8700}.tsh{opacity:.25}}
@keyframes scan{0%{opacity:0;transform:translateY(0)}10%,90%{opacity:1}100%{opacity:0;transform:translateY(212px)}}
@keyframes rise{0%{opacity:0;transform:translateY(0)}15%{opacity:.9}100%{opacity:0;transform:translateY(-72px)}}
${css.join('\n')}</style>`;

  return svg({
    w: W, h: H, id, defs,
    title: 'Automation: the pipeline that builds this profile',
    desc: `A terminal floating in 3D space runs node scripts/gen-profile.mjs, listing the generated assets (${assetRows.map(([name, bytes]) => `${name} ${kb(bytes)}`).join(', ')}), then node --test scripts/*.test.mjs with render-metrics and gen-profile tests ok, then git push origin main. A panel of asset-size bars grows as each file prints, and a git graph gains a new commit on main when the push completes.`,
    body: parts.join('\n'),
  });
}

// ── Clickable keys ──────────────────────────────────────────────────────────
// A README cannot run code, but every image can be a link. Each key is its own small image so each
// one is its own click target. On load the row pops up like keys springing back in a wave, then a
// sheen crosses each face once in the same order.

function keycap({ id, w, h, i, lines, title, glyph, size = 16 }) {
  const depth = 5;
  const fw = w - depth - 1;
  const fh = h - depth - 1;
  const delay = 160 + i * 110;
  const cy = fh / 2;
  const body = [
    extrude(0.5, 0.5, fw, fh, depth, depth, 9, ['kb', 'ks']),
    `<g${style(A('pop3d', 620, delay))}>`,
    `<path class="face" d="${rrect(0.5, 0.5, fw, fh, 10)}"/>`,
    `<g clip-path="url(#${id}-key)"><g transform="skewX(-20)"><rect x="-90" y="0" width="60" height="${h}" fill="url(#${id}-sheen)" style="--d:${w + 160}px;animation:sweep 5200ms linear ${delay + 900}ms 2"/></g></g>`,
    `<g class="pop"${style(A('pop', 420, delay + 180))}>${icon(14, cy - size / 2 + 0.5, size, glyph)}</g>`,
    ...lines.map(([str, cls, fs, dy], k) => text(22 + size, cy + dy, str, { size: fs, cls, anim: A('up', 480, delay + 260 + k * 70) })),
    '</g>',
  ].join('\n');
  return svg({
    w, h, id, body, frame: false,
    defs: `<clipPath id="${id}-key"><rect width="${fw + 1}" height="${fh + 1}" rx="10"/></clipPath><linearGradient id="${id}-sheen"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".22"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<style>.kb{fill:var(--line)}.ks{fill:var(--faint)}.face{fill:var(--raised);stroke:var(--line)}@keyframes pop3d{from{transform:translate(${depth}px,${depth}px)}}</style>`,
    title,
    desc: `A 3D key labelled ${lines.map(([s]) => s).join(' ')}.`,
  });
}

const NAV = [['about', '~/about'], ['toolkit', '~/toolkit'], ['selected-work', '~/projects'], ['certificates', '~/certificates'], ['automation', '~/automation'], ['connect', '~/connect']];
const navKey = ([slug, label], i) => keycap({ id: `nav-${slug}`, w: 160, h: 50, i, lines: [[label, 'fg', 13, 4.5]], title: `Go to ${label}`, glyph: UI[SECTION_ICON[slug]] });
const linkKey = (link, i) => keycap({ id: `link-${link.where}`, w: 288, h: 64, i, lines: [[link.where, 'mu', 11, -6], [link.label, 'ac', 13, 13]], title: `Open ${link.label}`, glyph: UI[link.where], size: 24 });

// ── Ping globe ──────────────────────────────────────────────────────────────
// `ping duongthaitan` beside a realistic Earth, built from real geography (Natural Earth land).
// Orthographic projection while turning: the map is cut into vertical strips, and each strip shows
// the map scaled by the sphere's local stretch at that x (R*cos) and sliding at its own speed, so
// continents compress toward the limb exactly as on a globe. Latitude is pre-projected (sin) in the
// data. Lighting is layered gradients: sunlit ocean, latitude-tinted land, clouds, a day/night
// terminator, limb darkening, specular glint and a glowing atmosphere. All motion is transform-only
// CSS (strips) or SMIL kept under .fx with a still copy in .nofx for reduced motion.

function pingGlobe() {
  const W = 900;
  const H = 320;
  const id = 'ping';
  const [cx, cy, R] = [186, 160, 122];
  const turn = 32000; // ms per revolution
  const turns = 2;
  const rad = d => (d * Math.PI) / 180;
  const sample = (n, f) => Array.from({ length: n + 1 }, (_, j) => f(j / n));

  // Map units: u = (lon + 180) * 2 (720 per turn, tiled twice), v = -sin(lat) * 500.
  // The centre meridian sweeps eastward-facing: c(t) falls from 1080 to 360 over one turn.
  const c0 = 1080;
  const centre = t => c0 - 720 * t;
  const N = 20;
  const sw = (2 * R) / N;
  const ky = R / 500;
  const kc = (R * 0.86 * Math.PI) / 360; // clouds: one layer at the mean stretch, no slicing
  const strips = [];
  const clips = [];
  for (let i = 0; i < N; i++) {
    const x0 = -R + (i + 0.5) * sw;
    const k = (Math.sqrt(R * R - x0 * x0) * Math.PI) / 360; // px per map unit at this strip
    const off = (Math.asin(x0 / R) * 360) / Math.PI; // map units from the centre meridian
    const tx = t => r2(cx + x0 - k * (centre(t) + off));
    clips.push(`<clipPath id="${id}-s${i}"><rect x="${r2(cx + x0 - sw / 2 - 0.4)}" y="${cy - R}" width="${r2(sw + 0.8)}" height="${2 * R}"/></clipPath>`);
    strips.push(`<g clip-path="url(#${id}-s${i})"><use href="#${id}-map" class="strip" style="--a:${tx(0)}px;--b:${tx(1)}px;--k:${r2(k * 1000) / 1000}"/></g>`);
  }

  // Relief: ranges and plateaus in map units, shaded like a relief map (lit north-west flank, shaded
  // south-east flank, snow on the highest), so they turn with the land through the same strips.
  const pu = ([lon, lat]) => `${Math.round((lon + 180) * 2)} ${Math.round(-Math.sin(rad(lat)) * 500)}`;
  const ridges = RANGES.map(r => 'M' + r.path.map(pu).join('L')).join('');
  const snow = RANGES.filter(r => r.snow).map(r => 'M' + r.path.map(pu).join('L')).join('');
  const plateaus = PLATEAUS.map(p => 'M' + p.map(pu).join('L') + 'Z').join('');

  // Clouds ride with the surface: soft bands in map units (ITCZ near the equator, storm tracks).
  const clouds = [[120, -60, 70, 14], [300, -20, 90, 12], [470, 10, 80, 13], [610, -40, 70, 12], [40, 120, 60, 10], [210, -330, 80, 16], [430, -300, 100, 14],
    [620, -360, 70, 15], [160, 330, 90, 14], [380, 380, 80, 13], [560, 300, 70, 12], [690, 150, 60, 11]];
  const cloudShapes = clouds.map(([u, v, rx, ry]) => `<ellipse cx="${u}" cy="${v}" rx="${rx}" ry="${ry * 4}" fill="url(#${id}-cloud)"/>`).join('');

  // Soc Trang, 9.6N 106E, and the satellite: SMIL paths sampled from the same rotation.
  const lat = 9.6;
  const lonU = (106 + 180) * 2;
  const delta = t => { let d = (lonU - centre(t)) / 2; while (d < -180) d += 360; while (d > 180) d -= 360; return d; };
  const pinX = t => r2(R * Math.cos(rad(lat)) * Math.sin(rad(delta(t))));
  const pinO = t => r2(Math.max(0, Math.min(1, Math.cos(rad(delta(t))) * 3)));
  const pinY = r2(cy - R * Math.sin(rad(lat)));
  const pinBody = `<circle class="pin" cx="${cx}" cy="${pinY}" r="3.6"/>${text(cx + 9, pinY + 4, 'soc trang', { size: 11, cls: 'plabel' })}`;
  const pin = `<g class="fx" opacity="${pinO(0)}" transform="translate(${pinX(0)} 0)"><animateTransform attributeName="transform" type="translate" values="${sample(48, t => `${pinX(t)} 0`).join(';')}" dur="${turn}ms" repeatCount="${turns}"/><animate attributeName="opacity" values="${sample(48, pinO).join(';')}" dur="${turn}ms" repeatCount="${turns}"/>${pinBody}<circle class="pring" cx="${cx}" cy="${pinY}" r="4"><animate attributeName="r" values="4;20" dur="2000ms" begin="600ms" repeatCount="30"/><animate attributeName="opacity" values=".9;0" dur="2000ms" begin="600ms" repeatCount="30"/></circle></g>`;
  const pinStill = `<g class="nofx" opacity="${pinO(0.7)}" transform="translate(${pinX(0.7)} 0)">${pinBody}</g>`;

  const orx = 176;
  const ory = 36;
  const otilt = -14;
  const back = `M${cx - orx} ${cy}a${orx} ${ory} 0 0 1 ${2 * orx} 0`;
  const front = `M${cx + orx} ${cy}a${orx} ${ory} 0 0 1 ${-2 * orx} 0`;
  const full = `${front}a${orx} ${ory} 0 0 1 ${2 * orx} 0`;
  const satellite = `<g class="fx"><circle r="10" fill="url(#${id}-halo)"/><circle class="sat" r="2.8"/><animateMotion path="${full}" dur="9000ms" repeatCount="6"/><animate attributeName="opacity" values="1;1;.15;.15;1" keyTimes="0;.47;.53;.97;1" dur="9000ms" repeatCount="6"/></g>`;

  // Stars: deterministic, behind everything, a few twinkle.
  const rand = random(2026);
  const stars = Array.from({ length: 16 }, (_, n) => {
    let x;
    let y;
    do { x = 14 + rand() * 360; y = 10 + rand() * (H - 20); } while (Math.hypot(x - cx, y - cy) < R + 26);
    const r = rand() > 0.85 ? 1.3 : 0.8;
    const tw = n % 6 === 0 ? style(`twinkle ${Math.round(2400 + rand() * 2400)}ms ${EASE.inOut} ${Math.round(rand() * 3000)}ms 8`) : '';
    return `<circle class="star" cx="${r2(x)}" cy="${r2(y)}" r="${r}" opacity="${r2(0.25 + rand() * 0.5)}"${tw}/>`;
  }).join('');

  const parts = [
    stars,
    `<circle cx="${cx}" cy="${cy}" r="${R + 22}" fill="url(#${id}-atmo)"/>`,
    `<g transform="rotate(${otilt} ${cx} ${cy})"><path class="orb" d="${back}"/></g>`,
    `<g clip-path="url(#${id}-disc)"${style(A('in', 1200, 100))}>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-ocean)"/>`,
    ...strips,
    `<use href="#${id}-skies" class="sky" style="--a:${r2(cx - kc * centre(0))}px;--b:${r2(cx - kc * centre(1))}px"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-night)"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-limb)"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}-haze)"/>`,
    `<ellipse cx="${cx - R * 0.38}" cy="${cy - R * 0.4}" rx="${R * 0.3}" ry="${R * 0.22}" fill="url(#${id}-glint)"/>`,
    '</g>',
    `<circle class="rimlight" cx="${cx}" cy="${cy}" r="${R}"/>`,
    pin,
    pinStill,
    `<g transform="rotate(${otilt} ${cx} ${cy})"><path class="orb" d="${front}"/>${satellite}</g>`,
  ];

  // Terminal side: the command, then one reply per link, each landing with its packet.
  const tx = 410;
  const cmd = typed(tx + 20, 76, `ping ${PROFILE.handle}`, { size: 15, delay: 300, cps: 45, caret: 'vanish' });
  parts.push(chevron(tx, 76, 15, A('in', 240, 200)), cmd.svg);
  parts.push(text(tx, 110, `PING ${PROFILE.handle} (soc trang, vietnam)`, { size: 13, cls: 'mu', anim: A('in', 300, cmd.end + 400) }));
  const origin = [cx + R + 4, cy - 10];
  LINKS.forEach((link, k) => {
    const y = 148 + k * 32;
    const land = cmd.end + 1100 + k * 800;
    const arc = `M${r2(origin[0])} ${r2(origin[1])}C${r2(origin[0] + 50)} ${r2(origin[1])} ${tx - 60} ${y - 5} ${tx - 12} ${y - 5}`;
    parts.push(`<path class="arc draw" d="${arc}" pathLength="1"${style(A('draw', 700, land - 700, EASE.inOut))}/>`);
    parts.push(`<g class="fx" opacity="0"><circle r="7" fill="url(#${id}-halo)"/><circle class="ac" r="2.4"/>${looping() ? (() => { const cyc = looping() * 2; const a = (land - 700) / cyc; const b = land / cyc; const k = v => Math.round(v * 10000) / 10000; return `<animateMotion path="${arc}" dur="${cyc}ms" repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${k(a)};${k(b)};1"/><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;${k(a)};${k(a + 0.004)};${k(b - 0.004)};${k(b)};1" dur="${cyc}ms" repeatCount="indefinite"/>`; })() : `<animateMotion path="${arc}" dur="700ms" begin="${land - 700}ms" fill="freeze" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines=".77 0 .175 1"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.1;.85;1" dur="760ms" begin="${land - 700}ms" fill="freeze"/>`}</g>`);
    parts.push(`<g${style(A('side', 420, land))}>${text(tx, y, 'reply from', { size: 13, cls: 'mu' })}${text(tx + 11 * 7.8, y, link.label, { size: 13, cls: 'ac' })}</g>`);
  });
  const done = cmd.end + 1100 + LINKS.length * 800;
  parts.push(text(tx, 148 + LINKS.length * 32 + 12, `--- ${LINKS.length} replies, every link answered ---`, { size: 12, cls: 'mu', anim: A('in', 400, done) }));

  // Land colour by latitude (v = -sin(lat) * 500): ice, tundra, forest, steppe, desert, savanna, rainforest.
  const band = (latDeg, colour) => `<stop offset="${r2((500 - Math.sin(rad(latDeg)) * 500) / 1000)}" stop-color="${colour}"/>`;
  const landGrad = [[90, '#eef3f6'], [70, '#dfe6ea'], [62, '#7f8f73'], [52, '#3f6b3b'], [40, '#5f7a43'], [30, '#b99c63'], [22, '#c9ab70'],
    [12, '#7d8f48'], [3, '#2f6a35'], [-10, '#3c7238'], [-22, '#a8935f'], [-32, '#86884f'], [-42, '#4d7440'], [-58, '#8b998a'], [-66, '#e2e9ec'], [-90, '#eef3f6']]
    .map(([l, c]) => band(l, c)).join('');

  return svg({
    w: W, h: H, id, frame: false,
    defs: `${haloDef(`${id}-halo`)}
<clipPath id="${id}-disc"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath>
${clips.join('')}
<linearGradient id="${id}-land" gradientUnits="userSpaceOnUse" x1="0" y1="-500" x2="0" y2="500">${landGrad}</linearGradient>
<radialGradient id="${id}-cloud"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".55" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<path id="${id}-coast" vector-effect="non-scaling-stroke" d="${LAND}"/>
<path id="${id}-ridge" vector-effect="non-scaling-stroke" d="${ridges}"/>
<g id="${id}-turn"><use href="#${id}-coast" class="shelf"/><use href="#${id}-coast" class="drop" transform="translate(3 9)"/><use href="#${id}-coast" class="land"/><path class="plateau" d="${plateaus}"/><use href="#${id}-ridge" class="rs" transform="translate(3 8)"/><use href="#${id}-ridge" class="rb"/><use href="#${id}-ridge" class="rl" transform="translate(-2 -6)"/><path class="snow" vector-effect="non-scaling-stroke" d="${snow}"/><use href="#${id}-coast" class="edge"/></g>
<g id="${id}-map"><use href="#${id}-turn"/><use href="#${id}-turn" x="720"/></g>
<g id="${id}-sky">${cloudShapes}</g>
<g id="${id}-skies"><use href="#${id}-sky"/><use href="#${id}-sky" x="720"/></g>
<radialGradient id="${id}-ocean" cx=".42" cy=".4" r=".7"><stop offset="0" stop-color="#2f7fc4"/><stop offset=".55" stop-color="#14508f"/><stop offset="1" stop-color="#062247"/></radialGradient>
<linearGradient id="${id}-night" x1="0" y1="0" x2="1" y2=".25"><stop offset=".5" stop-color="#020814" stop-opacity="0"/><stop offset=".68" stop-color="#020814" stop-opacity=".42"/><stop offset=".8" stop-color="#020814" stop-opacity=".62"/><stop offset="1" stop-color="#020814" stop-opacity=".82"/></linearGradient>
<radialGradient id="${id}-limb" cx=".5" cy=".5" r=".5"><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset=".94" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
<radialGradient id="${id}-haze" cx=".44" cy=".44" r=".56"><stop offset=".82" stop-color="#7cc4ff" stop-opacity="0"/><stop offset=".97" stop-color="#7cc4ff" stop-opacity=".28"/><stop offset="1" stop-color="#7cc4ff" stop-opacity=".1"/></radialGradient>
<linearGradient id="${id}-rimg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfeaff" stop-opacity=".85"/><stop offset=".55" stop-color="#5fb6ff" stop-opacity=".35"/><stop offset="1" stop-color="#5fb6ff" stop-opacity=".06"/></linearGradient>
<radialGradient id="${id}-glint"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-atmo" cx=".5" cy=".5" r=".5"><stop offset="${r2(R / (R + 22) - 0.02)}" stop-color="#5fb6ff" stop-opacity="0"/><stop offset="${r2(R / (R + 22) + 0.02)}" stop-color="#5fb6ff" stop-opacity=".45"/><stop offset="1" stop-color="#5fb6ff" stop-opacity="0"/></radialGradient>
<style>.land{fill:url(#${id}-land)}
.strip{transform:translate(var(--a),${cy}px) scale(var(--k),${r2(ky * 10000) / 10000});animation:spin ${turn}ms linear ${turns}}
.sky{transform:translate(var(--a),${cy}px) scale(${r2(kc * 1000) / 1000},${r2(ky * 10000) / 10000});animation:drift ${Math.round(turn * 0.86)}ms linear 3}
@keyframes drift{to{transform:translate(var(--b),${cy}px) scale(${r2(kc * 1000) / 1000},${r2(ky * 10000) / 10000})}}
@keyframes spin{to{transform:translate(var(--b),${cy}px) scale(var(--k),${r2(ky * 10000) / 10000})}}
@keyframes twinkle{50%{opacity:.08}}
.star{fill:var(--fg)}.rimlight{fill:none;stroke:url(#${id}-rimg);stroke-width:1.6}
.shelf{fill:none;stroke:#56c6d9;stroke-opacity:.3;stroke-width:6;stroke-linejoin:round}.drop{fill:#010a1c;opacity:.5}
.plateau{fill:#8f7550;opacity:.42}.rs{fill:none;stroke:#1d1408;stroke-opacity:.3;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}
.rb{fill:none;stroke:#8a7048;stroke-opacity:.5;stroke-width:4.2;stroke-linecap:round;stroke-linejoin:round}
.rl{fill:none;stroke:#f4e7cc;stroke-opacity:.24;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.snow{fill:none;stroke:#fff;stroke-opacity:.8;stroke-width:1.1;stroke-linecap:round;stroke-linejoin:round}
.edge{fill:none;stroke:#fff;stroke-opacity:.14;stroke-width:.7}
.pin{fill:#ffd166}.pring{fill:none;stroke:#ffd166;stroke-width:1.5}.plabel{fill:#ffe6a3}.sat{fill:#e6edf3}
.orb{fill:none;stroke:var(--blue);stroke-opacity:.35;stroke-dasharray:3 5}
.arc{fill:none;stroke:var(--accent);stroke-opacity:.45;stroke-width:1.4}.nofx{display:none}
@media (prefers-color-scheme:light){.star{opacity:.35}}
@media (prefers-reduced-motion:reduce){.nofx{display:inline}}</style>`,
    title: `$ ping ${PROFILE.handle}`,
    desc: `A realistic Earth built from real geography, turning in orthographic projection with sunlit oceans, clouds, a night side and a glowing atmosphere, Soc Trang, Vietnam marked, and a satellite in orbit. Beside it, ping ${PROFILE.handle} gets a reply from each link: ${LINKS.map(l => l.label).join(', ')}.`,
    body: parts.join('\n'),
  });
}

// ── Brand ───────────────────────────────────────────────────────────────────
// The tandev mark (Tandev.foto: developer and photographer): a mirrorless camera in three-quarter
// view on the same receding axis as every other 3D object here, beside the wordmark. The lens is a
// real cylinder: rings are coaxial circles along the axis toward the viewer, so each shows the
// crescent you would see from above-right. Every few seconds it takes a picture: the shutter button
// dips, the iris closes and reopens, the flash fires. Transform/opacity only, finite loops.

function camera(id) {
  const ring = (t, r, cls, extra = '') => { const [x, y] = [98 - 20 * t, 88 + 13 * t]; return `<circle class="${cls}" cx="${r2(x)}" cy="${r2(y)}" r="${r}"${extra}/>`; };
  const [gx, gy] = [78, 101]; // front of the lens
  const click = 5200;
  const firstShot = 2600;
  const shots = 5;
  const shot = name => style(`${name} ${click}ms ${EASE.out} ${firstShot}ms ${shots}`);
  const arc = (r, a0, a1) => {
    const p = a => [r2(gx + r * Math.cos((a * Math.PI) / 180)), r2(gy + r * Math.sin((a * Math.PI) / 180))];
    const [s, e] = [p(a0), p(a1)];
    return `M${s[0]} ${s[1]}A${r} ${r} 0 0 1 ${e[0]} ${e[1]}`;
  };
  const iris = Array.from({ length: 6 }, (_, k) => { const a = (k * 60 + 15) * Math.PI / 180; return `${r2(gx + 7.5 * Math.cos(a))} ${r2(gy + 7.5 * Math.sin(a))}`; });
  const blades = iris.map((p, k) => `M${p}L${r2(gx + 2.6 * Math.cos(((k * 60 + 75) * Math.PI) / 180))} ${r2(gy + 2.6 * Math.sin(((k * 60 + 75) * Math.PI) / 180))}`).join('');

  const body = [
    // body: top (lit), right side (shade), front (graphite gradient)
    `<path class="cb-top" d="M33 56L143 56L157 47L47 47Z"/>`,
    `<path class="cb-side" d="M143 56L157 47L164 54L164 109L150 118L150 63Z"/>`,
    `<rect x="26" y="56" width="124" height="62" rx="9" fill="url(#${id}-body)"/>`,
    `<rect x="26.5" y="56.5" width="123" height="61" rx="8.5" class="cb-edge"/>`,
    // grip, leather textured, with the self-timer lamp and AF assist light
    `<rect x="19" y="58" width="31" height="60" rx="11" fill="url(#${id}-grip)"/>`,
    `<rect x="19" y="58" width="31" height="60" rx="11" fill="url(#${id}-leather)"/>`,
    `<path class="cb-hl" d="M22 66V108"/>`,
    `<circle class="led" cx="56" cy="64" r="2"${style(`blink 1000ms steps(1) ${firstShot - 1200}ms 14`)}/><circle class="af" cx="56" cy="71" r="1.5"/>`,
    // viewfinder hump with hot shoe and the wordmark
    `<path class="cb-side" d="M104 56L118 47L111 25L97 34Z"/>`,
    `<path class="cb-top" d="M69 34L97 34L111 25L83 25Z"/>`,
    `<path fill="url(#${id}-body)" d="M62 56L104 56L97 34L69 34Z"/>`,
    `<path class="shoe" d="M77 31.5L94 31.5L101 27L84 27Z"/><path class="rail" d="M78.5 30.5L95 30.5M85 28H100"/>`,
    text(83, 48.5, 'tandev', { size: 6.4, cls: 'brandtxt', anchor: 'middle' }),
    // mode dial and shutter button
    `<rect x="40" y="47" width="20" height="6" class="dial"/><ellipse cx="50" cy="47" rx="10" ry="3.6" class="dialtop"/><path class="knurl" d="M40 50H60"/>`,
    `<g${shot('press')}><ellipse cx="31" cy="54.5" rx="7.5" ry="2.8" class="btn"/><ellipse cx="31" cy="53.8" rx="5.5" ry="2" class="btntop"/></g>`,
    // lens: mount, barrel, rings toward the viewer, then the front element
    `<circle cx="98" cy="88" r="27" fill="url(#${id}-metal)"/>`,
    `<circle cx="98" cy="88" r="24" class="barrel-back"/>`,
    `<path fill="url(#${id}-barrel)" d="M84.9 67.9L111.1 108.1L91.1 121.1L64.9 80.9Z"/>`,
    ring(0.2, 22.6, 'rubber'),
    ring(0.45, 22.4, 'focus', style(`turn 3200ms linear 900ms 6`)),
    ring(0.78, 23.4, 'redring'),
    ring(1, 24, 'rim', ` fill="url(#${id}-rim)"`),
    `<circle cx="${gx}" cy="${gy}" r="20" class="rim-in"/>`,
    `<circle cx="${gx}" cy="${gy}" r="17" fill="url(#${id}-glass)"/>`,
    // coatings catch the light as faint coloured arcs
    `<path class="ct-violet" d="${arc(13.5, 200, 285)}"/><path class="ct-green" d="${arc(10, 20, 95)}"/><path class="ct-amber" d="${arc(15, 115, 150)}"/>`,
    // iris: six blades that close and reopen on each shot
    `<g class="iris"${shot('iris')}><path class="blade" d="M${iris.join('L')}Z"/><path class="bladeline" d="${blades}"/></g>`,
    `<ellipse cx="${gx - 6}" cy="${gy - 7}" rx="4.6" ry="2.4" transform="rotate(-32 ${gx - 6} ${gy - 7})" class="spec"/><circle cx="${gx + 5}" cy="${gy + 6}" r=".9" class="spec2"/>`,
    `<circle cx="${gx}" cy="${gy}" r="17" class="glassflash"${shot('flashglass')}/>`,
  ].join('');

  const markup = [
    `<ellipse cx="96" cy="133" rx="70" ry="7" fill="url(#${id}-shadow)"${style(`shb 4400ms ${EASE.inOut} 1200ms 4`)} class="cshadow"/>`,
    `<g${style([A('up', 900, 150), `bob 4400ms ${EASE.inOut} 1200ms 4`])}>${body}</g>`,
    `<circle cx="96" cy="30" r="64" fill="url(#${id}-flash)" class="flash"${shot('flash')}/>`,
  ].join('\n');

  const defs = `<linearGradient id="${id}-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a505a"/><stop offset=".35" stop-color="#2b3038"/><stop offset="1" stop-color="#15181d"/></linearGradient>
<linearGradient id="${id}-grip" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2e3339"/><stop offset=".55" stop-color="#1a1d22"/><stop offset="1" stop-color="#0d0f12"/></linearGradient>
<pattern id="${id}-leather" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r=".55" fill="#fff" fill-opacity=".07"/></pattern>
<radialGradient id="${id}-metal" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#d9dee5"/><stop offset=".45" stop-color="#8a929c"/><stop offset="1" stop-color="#3a4048"/></radialGradient>
<linearGradient id="${id}-barrel" gradientUnits="userSpaceOnUse" x1="70" y1="70" x2="104" y2="116"><stop offset="0" stop-color="#4c535d"/><stop offset=".45" stop-color="#1d2026"/><stop offset="1" stop-color="#0b0d10"/></linearGradient>
<radialGradient id="${id}-rim" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#5b626c"/><stop offset=".6" stop-color="#22262c"/><stop offset="1" stop-color="#0c0e11"/></radialGradient>
<radialGradient id="${id}-glass" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#1d3a63"/><stop offset=".45" stop-color="#0a1426"/><stop offset="1" stop-color="#020305"/></radialGradient>
<radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-flash"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff6d8" stop-opacity=".35"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>`;

  const css = `.cb-top{fill:#565d67}.cb-side{fill:#14171b}.cb-edge{fill:none;stroke:#fff;stroke-opacity:.07}.cb-hl{stroke:#fff;stroke-opacity:.1;stroke-linecap:round}
.led{fill:#ff5a4f}.af{fill:#e3b341;opacity:.85}.shoe{fill:#0f1114}.rail{stroke:#9aa3ad;stroke-width:.6;stroke-opacity:.7}.brandtxt{fill:#aeb6c0}
.dial{fill:#2a2e35}.dialtop{fill:#5d646e;stroke:#89919c;stroke-width:.6}.knurl{stroke:#0d0f12;stroke-width:5;stroke-dasharray:.8 1}
.btn{fill:#2a2e35}.btntop{fill:#c7ccd3;stroke:#ff5a4f;stroke-width:.7}
.barrel-back{fill:#1a1d22}.rubber{fill:none;stroke:#0c0e11;stroke-width:4.5;stroke-dasharray:1 1.4}
.focus{fill:none;stroke:#090a0c;stroke-width:6;stroke-dasharray:1.1 1.1}.redring{fill:none;stroke:#ff4b3e;stroke-width:1.6}
.rim{stroke:#6c737d;stroke-width:.6}.rim-in{fill:#06070a;stroke:#2c3138;stroke-width:.8}
.ct-violet{fill:none;stroke:#8f73ff;stroke-width:1.6;stroke-opacity:.55;stroke-linecap:round}.ct-green{fill:none;stroke:#3fd6a0;stroke-width:1.2;stroke-opacity:.42;stroke-linecap:round}
.ct-amber{fill:none;stroke:#ffb347;stroke-width:1.1;stroke-opacity:.5;stroke-linecap:round}
.blade{fill:#070a10;stroke:#273041;stroke-width:.5}.bladeline{stroke:#2b3547;stroke-width:.5}
.spec{fill:#fff;opacity:.75}.spec2{fill:#fff;opacity:.9}
.iris,.cshadow{transform-box:fill-box;transform-origin:center}
.flash,.glassflash{opacity:0}.glassflash{fill:#fff}
@keyframes turn{to{stroke-dashoffset:-22}}
@keyframes press{6%{transform:translateY(1.4px)}12%{transform:none}}
@keyframes iris{6%{transform:scale(1)}9%{transform:scale(.22)}15%{transform:scale(1)}}
@keyframes flash{8%{opacity:0}9.5%{opacity:1}20%{opacity:0}}
@keyframes flashglass{8%{opacity:0}9.5%{opacity:.55}16%{opacity:0}}
@keyframes bob{50%{transform:translateY(-4px)}}
@keyframes shb{50%{transform:scale(.88);opacity:.7}}
@keyframes blink{50%{opacity:.15}}`;
  return { markup, defs, css };
}

function brand() {
  const W = 900;
  const H = 150;
  const id = 'brand';
  const cam = camera(id);
  const parts = [`<ellipse cx="92" cy="80" rx="88" ry="66" fill="url(#${id}-glow)"/>`, cam.markup];
  // Wordmark with two receding depth layers on the shared up-right axis, then a sheen.
  const wx = 196;
  const word = 'tandev';
  const layers = [['wd2', 3.6, -2.5], ['wd1', 1.8, -1.25]].map(([cls, dx, dy], k) =>
    text(wx + dx, 86 + dy, word, { size: 56, weight: 800, cls, anim: A('extrude', 700, 760 + (1 - k) * 60), custom: `--e:${-dx}px;` }));
  parts.push(`<g${style(A('rise', 800, 520), '--rise:24px;')}>${layers.join('')}${text(wx, 86, word, { size: 56, weight: 800 })}</g>`);
  parts.push(`<g clip-path="url(#${id}-word)"><g transform="skewX(-18)"><rect x="140" y="20" width="90" height="80" fill="url(#${id}-sheen)" style="--d:300px;animation:sweep 6400ms linear 1700ms 2"/></g></g>`);
  parts.push(text(wx + 2, 116, `${PROFILE.name.toLowerCase()}  /  ${PROFILE.role}  /  soc trang, vietnam`, { size: 13, cls: 'mu', pre: true, anim: A('in', 600, 1100) }));
  // Right edge: the handle as a quiet signature.
  parts.push(`<g${style(A('in', 600, 1300))}>${icon(W - 214, 64, 18, UI.github, 'mu')}${text(W - 188, 78, `github.com/${PROFILE.handle}`, { size: 12, cls: 'mu' })}</g>`);

  const glyphs = text(wx, 86, word, { size: 56, weight: 800 });
  return svg({
    w: W, h: H, id, frame: false,
    defs: `<radialGradient id="${id}-glow"><stop offset="0" class="shs" stop-opacity=".2"/><stop offset=".6" class="sht" stop-opacity=".06"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-sheen"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".9"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<clipPath id="${id}-word">${glyphs}</clipPath>
${cam.defs}
<style>.sht{stop-color:var(--teal)}${cam.css}
.wd1{fill:var(--teal);opacity:.5}.wd2{fill:var(--blue);opacity:.28}
@media (prefers-color-scheme:light){.wd1{opacity:.32}.wd2{opacity:.18}}
@keyframes extrude{from{opacity:0;transform:translate(var(--e),calc(var(--e) * -.7))}}</style>`,
    title: 'tandev',
    desc: `The tandev brand mark: a mirrorless camera in 3D that takes a picture every few seconds (the shutter dips, the iris closes and reopens, the flash fires), beside the wordmark tandev and the line ${PROFILE.name}, ${PROFILE.role}, Soc Trang, Vietnam.`,
    body: parts.join('\n'),
  });
}

// ── Output ──────────────────────────────────────────────────────────────────

// Half-periods: each scene builds, holds, rewinds and rebuilds over twice this long.
const LOOPS = { hero: 9000, fetch: 8000, divider: 5000, launch: 7000, brand: 9000, ping: 9000, island: 8000, section: 6500, key: 6000, terminal: 14000 };

export function renderAssets() {
  const L = (half, render) => loopify(withLoop(half, render));
  const assets = {
    'assets/hero-banner.svg': L(LOOPS.hero, hero),
    'assets/typing-anim.svg': L(LOOPS.fetch, fetchCard),
    'assets/section-divider.svg': L(LOOPS.divider, divider),
    'assets/launch.svg': L(LOOPS.launch, launchKey),
    'assets/brand.svg': L(LOOPS.brand, brand),
    'assets/ping.svg': L(LOOPS.ping, pingGlobe),
    'assets/stack-client.svg': L(LOOPS.island, () => island({ id: 'client', title: 'client', subtitle: 'languages and frontend', groups: STACK.slice(0, 2), cols: 5, offset: 0 })),
    'assets/stack-server.svg': L(LOOPS.island, () => island({ id: 'server', title: 'server', subtitle: 'backend, data and devops', groups: STACK.slice(2), cols: 4, offset: 300 })),
  };
  for (const [slug, command] of SECTIONS) assets[`assets/galaxy/${slug}.svg`] = L(LOOPS.section, () => sectionHeader(slug, command));
  NAV.forEach((nav, i) => { assets[`assets/keys/${nav[0]}.svg`] = L(LOOPS.key, () => navKey(nav, i)); });
  LINKS.forEach((link, i) => { assets[`assets/keys/${link.where}.svg`] = L(LOOPS.key, () => linkKey(link, i)); });
  // The terminal prints the real sizes of everything generated above.
  const bytes = file => Buffer.byteLength(assets[file]);
  const galaxy = SECTIONS.reduce((sum, [slug]) => sum + bytes(`assets/galaxy/${slug}.svg`), 0);
  assets['assets/terminal-3d.svg'] = L(LOOPS.terminal, () => terminal3d({
    'hero-banner.svg': bytes('assets/hero-banner.svg'),
    'typing-anim.svg': bytes('assets/typing-anim.svg'),
    'stack-client.svg': bytes('assets/stack-client.svg'),
    'stack-server.svg': bytes('assets/stack-server.svg'),
    'galaxy/*.svg': galaxy,
    'section-divider.svg': bytes('assets/section-divider.svg'),
  }));
  // The interactive page (GitHub Pages) lives alongside the artwork and is checked the same way.
  assets['terminal/index.html'] = renderSite();
  return assets;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL('../', import.meta.url);
  for (const [file, content] of Object.entries(renderAssets())) {
    const path = fileURLToPath(new URL(file, root));
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
    console.log(`${file}  ${Buffer.byteLength(content).toLocaleString('en-US')} B`);
  }
}
