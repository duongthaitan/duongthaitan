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
import { A, EASE, beam, check, chevron, haloDef, rrect, spinner, style, svg, text, typed, width } from './svg-kit.mjs';
import { ICONS } from './tool-icons.mjs';

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
  const cv = typedOut => `transform:scaleX(${typedOut ? 0 : 1})`; // cover: 0 = text fully shown
  const steps = j => `animation-timing-function:steps(${n[j]},end)`;

  const kf = [];
  phrases.forEach((_, j) => {
    if (j === 0) {
      kf.push(`@keyframes ${id}c0{0%{${cv(1)}}${pct(seg('hold', 0).end)}{${cv(1)};${steps(0)}}${pct(seg('del', 0).end)}{${cv(0)}}${pct(seg('type', 0).start)}{${cv(0)};${steps(0)}}100%{${cv(1)}}}`);
      kf.push(`@keyframes ${id}v0{0%{opacity:1}${pct(seg('del', 0).end)}{opacity:0}${pct(seg('type', 0).start)}{opacity:1}100%{opacity:1}}`);
    } else {
      const ty = seg('type', j);
      const de = seg('del', j);
      kf.push(`@keyframes ${id}c${j}{0%{${cv(0)}}${pct(ty.start)}{${cv(0)};${steps(j)}}${pct(ty.end)}{${cv(1)}}${pct(seg('hold', j).end)}{${cv(1)};${steps(j)}}${pct(de.end)}{${cv(0)}}100%{${cv(0)}}}`);
      kf.push(`@keyframes ${id}v${j}{0%{opacity:0}${pct(ty.start)}{opacity:1}${pct(de.end)}{opacity:0}100%{opacity:0}}`);
    }
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
  const cover = (j, extra = []) => `<rect class="bg ${j ? 'cvs' : 'cv'}" x="${r2(x - 1)}" y="${r2(y - size)}" width="${r2(w[j] + 2)}" height="${r2(size * 1.4)}"${style([...extra, cycle(`c${j}`, 'linear')])}/>`;
  const out = phrases.map((phrase, j) =>
    `<g${j ? ' class="off"' : ''}${style(cycle(`v${j}`, 'step-end'))}>${text(x, y, phrase, { size, cls: 'ac' })}${cover(j, j ? [] : [A('wipe', intro, delay, `steps(${n[0]},end)`)])}</g>`);
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
  parts.push(`<g clip-path="url(#hero-frame)"${style(A('in', 1400, 100, EASE.out))}><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="15" fill="url(#hero-dots)"/><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="15" fill="url(#hero-vig)"/></g>`);
  parts.push(`<ellipse cx="640" cy="80" rx="150" ry="110" fill="url(#hero-au1)" class="spot" style="animation:spot 12000ms ${EASE.inOut} 2800ms 1"/>`);
  // Aurora: three analogous lights drifting once behind the graph.
  const aurora = [['hero-au1', 700, 96, 230, 130, '-40px', '22px', 9000], ['hero-au2', 830, 250, 190, 120, '-30px', '-24px', 10000], ['hero-au3', 640, 300, 200, 100, '34px', '-18px', 11000]];
  parts.push(`<g class="aur" clip-path="url(#hero-frame)"${style(A('in', 1800, 200, EASE.out))}>${aurora.map(([gid, cx, cy, rx, ry, dx, dy, dur]) =>
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
  parts.push(line(B.d, 'gl gb', startB, B.length / vBranch));
  parts.push(line(Alane.d, 'gl gb', startA, Alane.length / vBranch));
  parts.push(line(mainD, 'gl gm', G, (mainBottom - mainTop) / vMain));

  // Packets ride the lines once they exist. The main packet lands on HEAD at 60% of its period,
  // exactly when the CSS ring pulse fires, so every arrival visibly "commits".
  const tHead = tMain(mainTop);
  const period = 2600;
  const loops = 4;
  const packetAt = tHead + 420;
  const ringAt = packetAt + period * 0.6;
  const packet = (path, dur, begin, repeat, core, arrive = 0.6) =>
    `<g class="fx" opacity="0"><circle r="${core * 4}" fill="url(#hero-halo)"/><circle class="ac" r="${core}"/><animateMotion path="${path}" dur="${ms(dur)}" begin="${ms(begin)}" repeatCount="${repeat}" calcMode="spline" keyPoints="0;1;1" keyTimes="0;${arrive};1" keySplines=".77 0 .175 1;0 0 1 1"/><animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;.08;${r2(arrive - 0.06)};${arrive};1" dur="${ms(dur)}" begin="${ms(begin)}" repeatCount="${repeat}"/></g>`;
  parts.push(packet(B.d, period * 1.5, packetAt + 900, 3, 2.4, 0.7));
  parts.push(packet(mainD, period, packetAt, loops, 3));

  const node = (cx, cy, cls, delay) => `<circle class="nd ${cls} pop" cx="${cx}" cy="${cy}" r="4.5"${style(A('pop', 420, delay))}/>`;
  const merges = { 120: endA, 88: endB };
  for (const y of [276, 238, 176, 120, 88]) parts.push(node(L0, y, 'nm', Math.max(tMain(y), merges[y] ?? 0)));
  for (const y of [200, 166]) parts.push(node(698, y, 'nb', startA + Alane.at(y) / vBranch));
  const bNodes = [222, 182, 142];
  for (const y of bNodes) parts.push(node(736, y, 'nb', startB + B.at(y) / vBranch));

  parts.push(`<circle class="ring" cx="${L0}" cy="${mainTop}" r="5"${style(`ring ${period}ms ${EASE.out} ${ms(ringAt)} ${loops}`)}/>`);
  parts.push(`<circle class="ac pop" cx="${L0}" cy="${mainTop}" r="5.5"${style(A('pop', 480, tHead))}/>`);

  // Branch decorations, git log style
  const pill = (x, y, label, accent, delay) => {
    const w = width(label, 11) + 14;
    return `<g${style(A('side', 520, delay))}><rect class="${accent ? 'pill-on' : 'pill'}" x="${x}" y="${y - 13}" width="${r2(w)}" height="19" rx="5"/>${label === 'HEAD -> main'
      ? `<text x="${x + 7}" y="${y}" font-size="11" textLength="${width(label, 11)}"><tspan class="mu">HEAD -&gt; </tspan><tspan class="ac">main</tspan></text>`
      : text(x + 7, y, label, { size: 11, cls: 'mu' })}</g>`;
  };
  parts.push(pill(676, mainTop + 4, 'HEAD -> main', true, tHead + 120));
  parts.push(pill(752, bNodes.at(-1) + 4, 'infra/aws', false, startB + B.at(bNodes.at(-1)) / vBranch + 120));

  // Star border: two laps of light around the card once everything has landed.
  parts.push(beam(W, H, 16, { delay: 2700, lap: 6000, laps: 2 }));

  const glyphs = words.map(([word, col]) => text(wordAt(col), 150, word, { size: nameSize, weight: 700 })).join('');
  const defs = `<pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle class="fa" cx="9" cy="9" r="1.1"/></pattern>
<radialGradient id="hero-vig" cx=".77" cy=".5" r=".4"><stop offset=".25" class="vg" stop-opacity="0"/><stop offset="1" class="vg"/></radialGradient>
<linearGradient id="hero-sheen"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".95"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
${haloDef('hero-halo')}
<radialGradient id="hero-au1"><stop offset="0" class="shs" stop-opacity=".17"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au2"><stop offset="0" class="sht" stop-opacity=".15"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au3"><stop offset="0" class="shb" stop-opacity=".14"/><stop offset="1" class="shb" stop-opacity="0"/></radialGradient>
<clipPath id="hero-name"><rect x="40" y="96" width="572" height="84"/></clipPath>
<clipPath id="hero-glyphs">${glyphs}</clipPath>
<style>.sht{stop-color:var(--teal)}.shb{stop-color:var(--blue)}.vg{stop-color:var(--bg)}.spot{opacity:0}
@keyframes spot{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}50%{transform:translate(200px,150px)}85%{opacity:.9}100%{opacity:0;transform:translate(60px,40px)}}
.x1{fill:var(--accent);opacity:.55}.x2{fill:var(--teal);opacity:.42}.x3{fill:var(--blue);opacity:.3}.x4{fill:var(--blue);opacity:.15}
@media (prefers-color-scheme:light){.aur{opacity:.75}.x1{opacity:.35}.x2{opacity:.28}.x3{opacity:.2}.x4{opacity:.1}}
@keyframes extrude{from{opacity:0;transform:translate(var(--e),var(--e))}}
@keyframes drift{50%{transform:translate(var(--dx),var(--dy))}}
.gl{fill:none;stroke-width:2}.gm{stroke:var(--accent)}.gb{stroke:var(--muted);opacity:.65}.nd{fill:var(--bg);stroke-width:2}.nm{stroke:var(--accent)}.nb{stroke:var(--muted)}.pill{fill:var(--raised);stroke:var(--line)}.pill-on{fill:var(--raised);stroke:var(--accent);stroke-opacity:.6}
${css.join('\n')}</style>`;

  return svg({
    w: W, h: H, id, defs,
    title: 'Duong Thai Tan, full-stack developer',
    desc: 'Terminal-style hero. The command whoami types out and the name Duong Thai Tan rises into view while a sheen of light crosses it. The role line types and rotates between full-stack developer, cloud infrastructure builder and visual creator. The line "I build web apps and the cloud systems that run them." fades in. On the right, a git commit graph draws itself from the first commit up to HEAD on main, with feat/web and infra/aws branches merging in; packets of light then travel up main and pulse on arrival at HEAD.',
    body: parts.join('\n'),
  });
}

// ── Fetch card ──────────────────────────────────────────────────────────────
// neofetch-style identity card: a pixel <T/> mark assembling in a diagonal wave beside key/value
// rows whose values decrypt from noise, left to right. Later a glint wave crosses the mark.

const GLYPHS = {
  '<': ['....#', '...#.', '..#..', '.#...', '..#..', '...#.', '....#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '>': ['#....', '.#...', '..#..', '...#.', '..#..', '.#...', '#....'],
};

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
  const H = 322;
  const id = 'fetch';
  const parts = [];

  parts.push(chevron(40, 52, 15, A('in', 240, 100)));
  parts.push(typed(60, 52, 'neofetch', { size: 15, delay: 220, cps: 62, caret: 'vanish', vanishAt: 820 }).svg);

  // Voxel mark: every pixel is a block with two receding faces (oblique depth toward the
  // bottom-right). Painted back to front so neighbours hide each other's inner faces.
  const cell = 10;
  const pitch = 12;
  const dz = 4;
  const mx = 50;
  const my = 150;
  const voxels = [];
  let col = 0;
  for (const char of ['<', 'T', '/', '>']) {
    GLYPHS[char].forEach((row, r) => [...row].forEach((on, c) => {
      if (on !== '#') return;
      voxels.push({ x: mx + (col + c) * pitch, y: my + r * pitch, t: char === 'T', order: col + c + r, pop: 760 + (col + c) * 15 + r * 26 });
    }));
    col += 6;
  }
  voxels.sort((p, q) => p.order - q.order);
  for (const v of voxels) {
    const faces = `<path class="${v.t ? 'vd' : 'vg'}" d="M${v.x + cell} ${v.y}l${dz} ${dz}v${cell}l${-dz} ${-dz}zM${v.x} ${v.y + cell}h${cell}l${dz} ${dz}h${-cell}z"/>`;
    const front = `<rect class="${v.t ? 'ac' : 'mu px'}" x="${v.x}" y="${v.y}" width="${cell}" height="${cell}" rx="1.5"${style(`${v.t ? 'glintT' : 'glint'} 4600ms ${EASE.inOut} ${ms(2600 + v.order * 26)} 2`)}/>`;
    parts.push(`<g class="pop"${style(A('pop', 520, v.pop))}>${faces}${front}</g>`);
  }

  // Info rows
  const kx = 380;
  const vx = kx + 10 * 14 * 0.6;
  const t0 = 900;
  parts.push(`<g${style(A('in', 420, t0))}>${text(kx, 100, 'thaitan', { size: 14, cls: 'ac', weight: 700 })}${text(kx + 7 * 8.4, 100, '@', { size: 14, cls: 'mu' })}${text(kx + 8 * 8.4, 100, 'github', { size: 14, cls: 'ac', weight: 700 })}</g>`);
  parts.push(`<path class="hair grow" d="M${kx} 113H${r2(kx + 14 * 8.4)}"${style(A('grow', 520, t0 + 80, EASE.inOut))}/>`);

  const rows = [
    ['role', 'full-stack developer'],
    ['location', 'soc trang, vietnam'],
    ['shipping', 'typescript across the stack'],
    ['stack', 'react, node.js, postgresql, aws'],
    ['focus', 'clean architecture, testing'],
    ['certs', 'meta, google, ibm, aws, deeplearning.ai'],
    ['github', 'duongthaitan'],
  ];
  // Delays shrink as the list goes on: a wave, not a metronome.
  let delay = t0 + 160;
  const frame = 55;
  rows.forEach(([key, value], i) => {
    const y = 140 + i * 22;
    const rand = random(i * 977 + 13);
    const frames = [0, 1, 2, 3].map(k => text(vx, y, garble(value, Math.floor((value.length * k) / 4), rand), {
      size: 14, cls: 'mu fr', anim: A('show', frame, delay + 40 + k * frame, EASE.linear, '1'),
    }));
    const real = text(vx, y, value, { size: 14, anim: A('in', 1, delay + 40 + 4 * frame, EASE.linear) });
    parts.push(`<g${style(A('side', 480, delay))}>${text(kx, y, key, { size: 14, cls: 'ac' })}${frames.join('')}${real}</g>`);
    delay += Math.max(34, 70 - i * 6);
  });

  // Colour blocks, the neofetch signature, in GitHub's own terminal ANSI palette.
  const sy = 140 + rows.length * 22 + 6;
  for (let i = 0; i < 8; i++) {
    parts.push(`<rect class="a${i} pop" x="${kx + i * 30}" y="${sy}" width="26" height="12" rx="2"${style(A('pop', 420, delay + 260 + i * 32))}/>`);
  }
  const ansi = (list, scope = '') => list.map((hex, i) => `${scope}.a${i}{fill:${hex}}`).join('');

  return svg({
    w: W, h: H, id,
    defs: `<style>.vd{fill:var(--deep)}.vg{fill:var(--vox)}${ansi(['#484f58', '#ff7b72', '#3fb950', '#d29922', '#58a6ff', '#bc8cff', '#39c5cf', '#b1bac4'])}
@media (prefers-color-scheme:light){${ansi(['#24292f', '#cf222e', '#116329', '#9a6700', '#0969da', '#8250df', '#1b7c83', '#6e7781'])}}</style>`,
    title: 'neofetch: thaitan@github',
    desc: `A neofetch-style card with a pixel-art <T/> logo assembling in a diagonal wave; each value decrypts from noise into text. ${rows.map(([k, v]) => `${k}: ${v}`).join('; ')}.`,
    body: parts.join('\n'),
  });
}

// ── Section headers ─────────────────────────────────────────────────────────
// Each section opens with its command: it types, runs (spinner plus a progress line across the
// card), and the spinner resolves into a check.

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
  const cmd = typed(48, y, command, { size: 15, delay: 160, cps: 42, caret: 'vanish' });
  const enterAt = cmd.end + 200;
  const runAt = cmd.end + 380;
  const runDur = 1000;
  const doneAt = runAt + runDur * 0.75;
  const body = [
    `<path class="kb" d="${rrect(depth + 0.5, depth + 0.5, fw, fh, 11.5)}"/>`,
    `<path class="ks" d="M${fw + 0.5} 12l${depth} ${depth}V${fh - 6}l${-depth} ${-depth}zM12 ${fh + 0.5}l${depth} ${depth}H${fw - 6}l${-depth} ${-depth}z"/>`,
    `<g${style(`press 300ms ${EASE.out} ${Math.round(enterAt)}ms 1`)}>`,
    `<path class="frame" d="${rrect(0.5, 0.5, fw, fh, 11.5)}"/>`,
    chevron(28, y, 15, A('in', 240, 60)),
    cmd.svg,
    `<rect class="ac run" x="0" y="${fh - 2.5}" width="${fw}" height="2" clip-path="url(#${id}-key)"${style(A('run', runDur, runAt, EASE.inOut))}/>`,
    spinner(fw - 66, y - 5, runAt, doneAt - runAt),
    check(fw - 72, y - 1, A('pop', 360, doneAt)),
    text(fw - 22, y, 'done', { size: 13, cls: 'mu', anchor: 'end', anim: A('in', 360, doneAt + 60) }),
    '</g>',
  ].join('\n');
  return svg({
    w: W, h: H, id, body, frame: false,
    defs: `<clipPath id="${id}-key"><rect width="${fw + 1}" height="${fh + 1}" rx="12"/></clipPath><style>.kb{fill:var(--line)}.ks{fill:var(--faint)}@keyframes press{40%{transform:translate(${depth / 2}px,${depth / 2}px)}}</style>`,
    title: `$ ${command}`,
    desc: `A 3D terminal key that types the command "${command}", presses in as it runs with a spinner, and reports done.`,
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
<rect class="a" x="${W / 2 - 24}" y="11.5" width="48" height="2" rx="1" style="animation:slide 1600ms ${EASE.out} 200ms both"/>
</svg>
`;
}

// ── Toolkit tree ────────────────────────────────────────────────────────────

const STACK = [
  ['languages', ['typescript', 'javascript', 'python', 'go', 'rust']],
  ['frontend', ['react', 'next.js', 'vue', 'tailwind', 'three.js']],
  ['backend', ['node.js', 'nestjs', 'graphql']],
  ['data', ['postgresql', 'mongodb', 'redis']],
  ['devops', ['docker', 'kubernetes', 'aws', 'github actions']],
];
const CURRENT = new Set(['typescript', 'react', 'node.js', 'postgresql', 'aws']); // from the About copy

// ── Isometric toolkit islands ───────────────────────────────────────────────
// Two platforms (client, server) where every tool is a block. Isometric projection is affine,
// so each logo is drawn flat and mapped onto the lit left face with one matrix: real 3D geometry,
// no CSS 3D (which SVG images do not support). Blocks drop in back to front, shadows grow as
// they land, then the island breathes in a slow wave.

const SLUGS = {
  typescript: 'typescript', javascript: 'javascript', python: 'python', go: 'go', rust: 'rust',
  react: 'react', 'next.js': 'nextdotjs', vue: 'vuedotjs', tailwind: 'tailwindcss', 'three.js': 'threedotjs',
  'node.js': 'nodedotjs', nestjs: 'nestjs', graphql: 'graphql', postgresql: 'postgresql', mongodb: 'mongodb',
  redis: 'redis', docker: 'docker', kubernetes: 'kubernetes', aws: 'amazonwebservices', 'github actions': 'githubactions',
};

const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (p, q) => { const [hi, lo] = [luminance(p), luminance(q)].sort((m, n) => n - m); return (hi + 0.05) / (lo + 0.05); };
const toHex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Brand colour on its own logo. Near-black marks switch to the text ink so they survive dark mode;
// pale marks are darkened just enough to hold 2.4:1 on the light face.
function logoInk(hex) {
  const rgb = hexRgb(hex);
  if (luminance(rgb) < 0.05) return '--c:var(--fg)';
  let light = rgb;
  while (contrast(light, hexRgb('#f3f5f7')) < 2.4) light = light.map(v => v * 0.9);
  const cl = toHex(light);
  return cl.toLowerCase() === hex.toLowerCase() ? `--c:${hex}` : `--c:${hex};--cl:${cl}`;
}

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
    parts.push(`<path class="sd shd" d="${rhAt(x, yf, 1.06)}" style="animation-delay:${ms(drop)},${ms(bob)}"/>`);
    parts.push(`<g class="dr" style="animation-delay:${ms(drop)}"><g class="bb" style="animation-delay:${ms(bob)}"><use href="#${id}-block" x="${x}" y="${yt}"/><use href="#${id}-tint" x="${x}" y="${yt}" color="${icon.hex}"/>${lit}${logo}</g></g>`);
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
.ft{fill:#1f2732}.fl{fill:#171e27}.fr{fill:#10151c}.dish{fill:#fff;opacity:.025}.edge{fill:none;stroke:#fff;stroke-opacity:.09}
.shd{fill:#000;opacity:.45}.on{fill:none;stroke:var(--accent);stroke-width:1.4;stroke-opacity:.85}
.lg{fill:var(--c)}
@media (prefers-color-scheme:light){.ft{fill:#fff}.fl{fill:#f0f3f6}.fr{fill:#dfe4ea}.dish{fill:#1f2328;opacity:.03}.edge{stroke:#1f2328;stroke-opacity:.08}.shd{fill:#1f2328;opacity:.13}.lg{fill:var(--cl,var(--c))}.pl{fill:#e6eaef}.pr{fill:#d8dee4}}
.dr{animation:drop 820ms ${EASE.out} both}
.bb{animation:bob 3600ms ${EASE.inOut} 3}
.sd,.halo{transform-box:fill-box;transform-origin:center}
.sd{animation:shin 820ms ${EASE.out} both,shbob 3600ms ${EASE.inOut} 3}
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
  parts.push(`<g${style(A('in', 1200, 100))}><ellipse cx="300" cy="372" rx="300" ry="70" fill="url(#${id}-pool)"/><ellipse cx="740" cy="300" rx="170" ry="60" fill="url(#${id}-pool2)"/><g class="tg">${grid.join('')}</g></g>`);

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
  css.push(`.scroll{transform:translateY(${finalOffset}px)}@keyframes scroll{${stops.map(([at, off], k) => `${r2((at / scrollT) * 100)}%{transform:translateY(${off}px)${k % 2 ? `;animation-timing-function:${EASE.out}` : ''}}`).join('')}}`);

  const screen = `<rect class="bg" x="-208" y="-92" width="416" height="208" rx="6"/>
<g clip-path="url(#${id}-scr)"><g class="scroll" style="animation:scroll ${scrollT}ms linear 0ms both">${rendered.join('')}</g>
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
    ...[-92, -50, -8, 30].map(x => `<circle class="gnode" cx="${x}" cy="18" r="4.5"/>`),
    `<circle class="ring" cx="72" cy="18" r="5"${style(`ring 2200ms ${EASE.out} ${pushedAt + 260}ms 3`)}/>`,
    `<circle class="ac pop" cx="72" cy="18" r="5.5"${style(A('pop', 420, pushedAt + 200))}/>`,
    `<g style="--d:42px;animation:type 520ms ${EASE.out} ${pushedAt + 160}ms both" class="mv"><rect class="tpill" x="8" y="-5" width="44" height="16" rx="5"/>${text(15, 7, 'main', { size: 11, cls: 'ac' })}</g>`,
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

  const defs = `<clipPath id="${id}-scr"><rect x="-208" y="-84" width="416" height="200" rx="6"/></clipPath>
<radialGradient id="${id}-pool"><stop offset="0" class="shs" stop-opacity=".14"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-pool2"><stop offset="0" class="sht" stop-opacity=".12"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-reflect" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shs" stop-opacity=".06"/><stop offset=".3" class="shfg" stop-opacity=".025"/><stop offset="1" class="shfg" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".09"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-glare"><stop offset="0" class="shfg" stop-opacity="0"/><stop offset=".5" class="shfg" stop-opacity=".07"/><stop offset="1" class="shfg" stop-opacity="0"/></linearGradient>
<style>.sht{stop-color:var(--teal)}.shfg{stop-color:var(--fg)}
.tg{fill:none;stroke:var(--line);stroke-width:1}.tr{fill:var(--line);opacity:.6}
.tb{fill:var(--raised);stroke:var(--line)}.tp{fill:var(--line)}.trim{fill:none;stroke:var(--accent);stroke-opacity:.5}
.tsh{opacity:.9}.tpill{fill:var(--raised);stroke:var(--accent);stroke-opacity:.6}
.gline{fill:none;stroke:var(--muted);stroke-width:2;opacity:.7}.gnode{fill:var(--bg);stroke:var(--muted);stroke-width:2}
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

// ── Output ──────────────────────────────────────────────────────────────────

export function renderAssets() {
  const assets = {
    'assets/hero-banner.svg': hero(),
    'assets/typing-anim.svg': fetchCard(),
    'assets/section-divider.svg': divider(),
    'assets/stack-client.svg': island({ id: 'client', title: 'client', subtitle: 'languages and frontend', groups: STACK.slice(0, 2), cols: 5, offset: 0 }),
    'assets/stack-server.svg': island({ id: 'server', title: 'server', subtitle: 'backend, data and devops', groups: STACK.slice(2), cols: 4, offset: 300 }),
  };
  for (const [slug, command] of SECTIONS) assets[`assets/galaxy/${slug}.svg`] = sectionHeader(slug, command);
  // The terminal prints the real sizes of everything generated above.
  const bytes = file => Buffer.byteLength(assets[file]);
  const galaxy = SECTIONS.reduce((sum, [slug]) => sum + bytes(`assets/galaxy/${slug}.svg`), 0);
  assets['assets/terminal-3d.svg'] = terminal3d({
    'hero-banner.svg': bytes('assets/hero-banner.svg'),
    'typing-anim.svg': bytes('assets/typing-anim.svg'),
    'stack-client.svg': bytes('assets/stack-client.svg'),
    'stack-server.svg': bytes('assets/stack-server.svg'),
    'galaxy/*.svg': galaxy,
    'section-divider.svg': bytes('assets/section-divider.svg'),
  });
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
