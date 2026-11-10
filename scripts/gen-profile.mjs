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
import { A, EASE, check, chevron, entrance, escapeXml, extrude, haloDef, hexRgb, icon, logoInk, loopWindow, loopify, looping, rrect, spinner, startAt, style, svg, text, toHex, typed, width, withLoop } from './svg-kit.mjs';
import { UI } from './ui-icons.mjs';
import { LAND } from './earth-data.mjs';
import { PLATEAUS, RANGES } from './relief-data.mjs';
import { ICONS } from './tool-icons.mjs';
import { renderSite } from './gen-site.mjs';
import { deskTerminal, keyboard } from './keyboard.mjs';
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
  // Each glyph only says when it switches on (--a) and off (--b) inside the cycle; two shared classes
  // carry the timing (phrase 0 starts typed, so its window is the other way round). The intro typing
  // of phrase 0 mirrors with the scene like every other entrance.
  const half = looping();
  const kf = [
    `.${id}0{animation:${half ? `ch ${half}ms linear(0, 0 var(--i), 1 var(--i), 1 100%) 0ms infinite alternate both` : 'ch 1ms linear var(--i) both'},${id}w ${ms(T)} linear(1, 1 var(--b), 0 var(--b), 0 var(--a), 1 var(--a), 1 100%) ${ms(start)} infinite}`,
    `.${id}n{animation:${id}w ${ms(T)} linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) ${ms(start)} infinite}`,
    `@keyframes ${id}w{from{fill-opacity:0}to{fill-opacity:1}}`,
  ];
  const lines = phrases.map((phrase, j) => {
    const typing = seg('type', j);
    const deleting = seg('del', j);
    const glyphs = [...phrase].map((c, k) => {
      if (c === ' ') return ' ';
      const on = typing.start + (k + 1) * typeCps;
      const off = deleting.start + (n[j] - k) * delCps;
      const intro = delay + (k + 1) * introCps;
      const i = half ? `--i:${r2((intro / half) * 100)}%;` : `--i:${ms(intro)};`;
      return `<tspan class="${j ? `rh ${id}n` : `${id}0`}" style="${j ? '' : i}--a:${pct(on)};--b:${pct(off)}">${escapeXml(c)}</tspan>`;
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
    return `<g${style(A('rise', 900, delay), '--rise:84px;')}>${layers.join('')}${text(x, 150, word, { size: nameSize, weight: 700, cls: 'nm-f' })}</g>`;
  }).join('')}</g>`);
  // Shiny text: a skewed band of accent light crosses the glyphs a few times, then stops.
  parts.push(`<g clip-path="url(#hero-glyphs)"><g transform="skewX(-18)"><rect x="-96" y="90" width="136" height="90" fill="url(#hero-sheen)" style="--d:790px;animation:sweep 6400ms linear 2350ms 2"/></g></g>`);

  // Viewfinder (the photographer half of tandev): frame corners, then an AF box that hunts in on the
  // name and locks green, the shot (a soft flash centred on the name, fading out before the edges),
  // and the exposure readout with its meter needle settling on zero.
  const vf = (x, y, dx, dy) => `M${x} ${y + dy}V${y}H${x + dx}`;
  parts.push(`<path class="vfc" d="${vf(14, 14, 26, 26)}${vf(886, 14, -26, 26)}${vf(14, 290, 26, -26)}${vf(886, 290, -26, -26)}"${style(A('in', 900, 200))}/>`);
  const box = [36, 96, 556, 176];
  const afd = `${vf(box[0], box[1], 18, 14)}${vf(box[2], box[1], -18, 14)}${vf(box[0], box[3], 18, -14)}${vf(box[2], box[3], -18, -14)}`;
  const lockAt = 1900;
  parts.push(`<path class="af afh" d="${afd}"${style(A('lock', 760, lockAt - 760, 'cubic-bezier(.3,1.5,.5,1)'))}/>`);
  parts.push(`<g${style(A('in', 90, lockAt))}><path class="af afl" d="${afd}"/><rect class="afp" x="${box[2] - 34}" y="${box[1] - 21}" width="34" height="15" rx="3"/>${text(box[2] - 29, box[1] - 10, 'AF-S', { size: 10, cls: 'afpt', weight: 700 })}</g>`);
  parts.push(`<ellipse class="shot" cx="290" cy="138" rx="270" ry="110" fill="url(#hero-shot)" style="animation:shot 9000ms linear ${lockAt + 260}ms infinite"/>`);
  const exif = 'F1.8   1/250   ISO 125   25mm';
  parts.push(`<g${style(A('in', 700, 1700))}>${text(x0, 286, exif, { size: 11, cls: 'mu', pre: true })}<path class="meter" d="M${x0 + 262} 282h120"/><path class="tickm" d="M${x0 + 262} 279v6M${x0 + 322} 277v10M${x0 + 382} 279v6"/>${text(x0 + 252, 286, '-', { size: 11, cls: 'mu' })}${text(x0 + 386, 286, '+', { size: 11, cls: 'mu' })}<path class="needle" d="M${x0 + 322} 291l-4 6h8z"${style(A('slide', 1200, lockAt - 1000, EASE.inOut))}/></g>`);
  // Bokeh: a few out-of-focus lights drifting behind the name.
  const bokeh = [[470, 50, 22, 'hero-bk1', 9000], [606, 254, 28, 'hero-bk2', 11000], [372, 262, 14, 'hero-bk1', 13000], [836, 244, 18, 'hero-bk2', 10000], [300, 40, 11, 'hero-bk2', 12000]];
  parts.splice(1, 0, `<g class="bk"${style(A('in', 1600, 400))}>${bokeh.map(([cx, cy, r, gid, dur], k) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${gid})" style="--dx:${k % 2 ? 14 : -12}px;--dy:${k % 2 ? -8 : 10}px;animation:drift ${dur}ms ${EASE.inOut} ${-k * 1700}ms infinite"/>`).join('')}</g>`);

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
<linearGradient id="hero-ng" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ng0"/><stop offset=".55" class="ng1"/><stop offset="1" class="ng2"/></linearGradient>
<radialGradient id="hero-shot"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-bk1"><stop offset="0" class="sht" stop-opacity=".07"/><stop offset=".78" class="sht" stop-opacity=".09"/><stop offset=".9" class="sht" stop-opacity=".16"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-bk2"><stop offset="0" class="shs" stop-opacity=".06"/><stop offset=".78" class="shs" stop-opacity=".08"/><stop offset=".9" class="shs" stop-opacity=".15"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au1"><stop offset="0" class="shs" stop-opacity=".17"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au2"><stop offset="0" class="sht" stop-opacity=".15"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<radialGradient id="hero-au3"><stop offset="0" class="shb" stop-opacity=".14"/><stop offset="1" class="shb" stop-opacity="0"/></radialGradient>
<clipPath id="hero-name"><rect x="40" y="96" width="572" height="84"/></clipPath>
<clipPath id="hero-glyphs">${glyphs}</clipPath>
<style>.sht{stop-color:var(--teal)}.shb{stop-color:var(--blue)}.spot{opacity:0}
@keyframes spot{0%{opacity:0;transform:translate(0,0)}15%{opacity:.9}50%{transform:translate(120px,34px)}85%{opacity:.9}100%{opacity:0;transform:translate(40px,14px)}}
.nm-f{fill:url(#hero-ng)}.ng0{stop-color:#fff}.ng1{stop-color:#e6edf3}.ng2{stop-color:#9fb0c2}
@media (prefers-color-scheme:light){.ng0{stop-color:#24292f}.ng1{stop-color:#1f2328}.ng2{stop-color:#57606a}.shot{display:none}}
.vfc{fill:none;stroke:var(--muted);stroke-opacity:.55;stroke-width:1.5}.af{fill:none;stroke-width:1.6;transform-box:fill-box;transform-origin:center}.afh{stroke:var(--muted)}.afl{stroke:var(--accent)}
.afp{fill:var(--accent)}.afpt{fill:var(--bg)}.shot{opacity:0}.meter{stroke:var(--line)}.tickm{stroke:var(--muted)}.needle{fill:var(--accent)}
@keyframes lock{from{opacity:0;transform:scale(1.14)}}
@keyframes slide{from{transform:translateX(-46px)}}
@keyframes shot{0%{opacity:0}1.2%{opacity:1}7%,100%{opacity:0}}
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
    desc: 'Terminal-style hero framed like a camera viewfinder. The command whoami types out and the name Duong Thai Tan, in brushed metal, rises into view while a sheen of light crosses it; an autofocus box hunts in on the name, locks green and the shot flashes, with the exposure readout F1.8 1/250 ISO 125 25mm along the bottom. The role line types and rotates between full-stack developer, cloud infrastructure builder and visual creator. The line "I build web apps and the cloud systems that run them." fades in. On the right, a git commit graph draws itself from the first commit up to HEAD on main, with feat/web and infra/aws branches merging in; packets of light then travel up main and pulse on arrival at HEAD.',
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
  parts.push(`<ellipse class="vsh" cx="${scx}" cy="${scy}" rx="${(23 * pitch) / 2 + 8}" ry="12" transform="rotate(${r2((Math.atan(S) * 180) / Math.PI)} ${scx} ${scy})" fill="url(#${id}-shadow)"${style(A('in', 900, 900))}/>`);

  // Hologram volume: light walls rising off the pedestal edges (back and left behind the sign,
  // front and right over it), fading upward and flickering like a projection.
  const vt = -34;
  const wallPath = (ua, da, ub, db) => `<path d="${quad(P(ua, vf, da), P(ub, vf, db), P(ub, vt, db), P(ua, vt, da))}"/>`;
  parts.push(`<g class="hv"${style(A('in', 900, 1700))}>${wallPath(u0, d1, u1, d1)}${wallPath(u0, d0, u0, d1)}</g>`);

  // Orbit: a tilted ring around the sign. The far half is drawn behind the blocks, the near half
  // over them, and two sparks ride it (SMIL), each switching layers as it passes the sides.
  const [cu, cv, cdp, R1, R2, tilt] = [149, 45, 6, 182, 66, (20 * Math.PI) / 180];
  const scr = (du, dv, dd) => [du + dd * DV[0], dv + du * S + dd * DV[1]];
  const C0 = P(cu, cv, cdp).split(' ').map(Number);
  const e1 = scr(R1, 0, 0);
  const e2 = scr(0, -R2 * Math.sin(tilt), R2 * Math.cos(tilt));
  const at = t => [C0[0] + e1[0] * Math.cos(t) + e2[0] * Math.sin(t), C0[1] + e1[1] * Math.cos(t) + e2[1] * Math.sin(t)];
  const tan = t => [-e1[0] * Math.sin(t) + e2[0] * Math.cos(t), -e1[1] * Math.sin(t) + e2[1] * Math.cos(t)];
  const kq = 0.5523; // quarter-circle Bezier handle, exact under the affine map
  const arc = (t0, n) => {
    let d = `M${at(t0).map(r2).join(' ')}`;
    for (let q = 0; q < n; q++) {
      const a0 = t0 + (q * Math.PI) / 2;
      const a1 = a0 + Math.PI / 2;
      const [p0, p1, g0, g1] = [at(a0), at(a1), tan(a0), tan(a1)];
      d += `C${r2(p0[0] + kq * g0[0])} ${r2(p0[1] + kq * g0[1])} ${r2(p1[0] - kq * g1[0])} ${r2(p1[1] - kq * g1[1])} ${r2(p1[0])} ${r2(p1[1])}`;
    }
    return d;
  };
  const spark = (begin, front) => `<g><circle r="8" fill="url(#${id}-halo)"/><circle r="2.2" class="spk"/><animateMotion dur="7s" begin="${begin}" repeatCount="indefinite"><mpath href="#${id}-ring"/></animateMotion>${front ? `<animate attributeName="opacity" values="0;1" keyTimes="0;.5" calcMode="discrete" dur="7s" begin="${begin}" repeatCount="indefinite"/>` : ''}</g>`;
  const sparks = front => `<g class="fx"${style(A('in', 600, 2000))}>${spark('0s', front)}${spark('-3.5s', front)}</g>`;
  parts.push(`<path class="orb ob"${style(A('draw', 1100, 1500, EASE.inOut))} pathLength="1" d="${arc(0, 2)}"/>`, sparks(false));

  // Blocks fly in from scattered points in 3D, each from its own depth, height and side, then ride
  // a slow wave through the columns. A scan plane climbs the sign and each row glints as it passes.
  const rand3 = random(4242);
  const blocks = voxels.map(({ c, r, t }) => {
    const u = c * pitch;
    const v = r * pitch;
    const k = t ? 't' : 'g';
    let faces = `<path class="${k}f" d="${quad(P(u, v), P(u + cell, v), P(u + cell, v + cell), P(u, v + cell))}"/>`;
    if (!filled.has(`${c},${r - 1}`)) faces += `<path class="${k}t" d="${quad(P(u, v), P(u + cell, v), P(u + cell, v, D), P(u, v, D))}"/>`;
    if (!filled.has(`${c + 1},${r}`)) faces += `<path class="${k}r" d="${quad(P(u + cell, v), P(u + cell, v, D), P(u + cell, v + cell, D), P(u + cell, v + cell))}"/>`;
    const [fx, fy] = scr((rand3() * 2 - 1) * 46, -44 - rand3() * 70, (rand3() * 2 - 1) * 110);
    return `<g class="vx" style="${startAt(620 + c * 26 + (6 - r) * 34)};--x:${Math.round(fx)}px;--y:${Math.round(fy)}px;--c:${c};--r:${r}">${faces}</g>`;
  });
  parts.push(blocks.join(''));

  const scanQuad = quad(P(-8, 0, -6), P(306, 0, -6), P(306, 0, D + 6), P(-8, 0, D + 6));
  parts.push(`<g class="scan"><path class="sp" d="${scanQuad}"/><path class="se" d="M${P(-8, 0, -6)}L${P(306, 0, -6)}L${P(306, 0, D + 6)}"/></g>`);
  parts.push(`<path class="orb of"${style(A('draw', 1100, 1500, EASE.inOut))} pathLength="1" d="${arc(Math.PI, 2)}"/>`, sparks(true));
  parts.push(`<g class="hv hf"${style(A('in', 900, 1700))}>${wallPath(u0, d0, u1, d0)}${wallPath(u1, d0, u1, d1)}</g>`);
  const motes = Array.from({ length: 9 }, (_, n) => {
    const [mx, my] = P(10 + rand3() * 280, vf - 4, d0 + 6 + rand3() * 28).split(' ').map(Number);
    return `<rect class="mo" x="${r2(mx)}" y="${r2(my)}" width="3" height="3" style="animation-delay:${-n * 470}ms"/>`;
  });
  parts.push(motes.join(''));
  const ringDef = `<path id="${id}-ring" d="${arc(0, 4)}"/>`;

  // ── Info panel: a raised slab with its back plate one step deeper ──
  const [px, py, pw, ph] = [388, 72, 476, 252];
  // A comet of light circles the panel edge and a soft scan band rolls down its glass.
  const edge = rrect(px, py, pw, ph, 14);
  const comet = [[0.16, 0.2, 1.5], [0.035, 0.95, 2]].map(([len, o, sw]) => `<path class="pbm" d="${edge}" pathLength="1" stroke-width="${sw}" stroke-dasharray="${len} ${r2(1 - len)}" style="--o0:${len};--o1:${r2(len - 1)};opacity:${o}"/>`).join('');
  parts.push(`<g${style(A('up', 760, 260))}>${extrude(px, py, pw, ph, 8, -5.5, 12, ['ipt', 'ipr'])}<rect class="ip" x="${px}" y="${py}" width="${pw}" height="${ph}" rx="14"/><path class="ip-trim" d="M${px + 16} ${py + 0.5}H${px + pw - 16}"/><rect class="psc" x="${px + 1}" y="${py}" width="${pw - 2}" height="48" fill="url(#${id}-band)"/>${comet}</g>`);

  const kx = px + 24;
  const vx = kx + 10 * 8.4;
  const t0 = 900;
  // Header with two receding depth layers, on the same up-right depth axis as the blocks. The
  // layers swing from one side to the other, so the word seems to turn in space (translate only).
  const header = (cls, dx, dy) => `${text(kx + dx, 104 + dy, 'thaitan', { size: 15, cls, weight: 700 })}${text(kx + 7 * 9 + dx, 104 + dy, '@', { size: 15, cls: cls === 'ac' ? 'mu' : cls })}${text(kx + 8 * 9 + dx, 104 + dy, 'github', { size: 15, cls, weight: 700 })}`;
  parts.push(`<g${style(A('in', 420, t0))}><g class="yw" style="--dx:-4.8px">${header('hx2', 2.4, -1.7)}</g><g class="yw" style="--dx:-2.4px">${header('hx1', 1.2, -0.85)}</g>${header('ac', 0, 0)}</g>`);
  parts.push(`<path class="hair grow" d="M${kx} 117H${r2(kx + 14 * 9)}"${style(A('grow', 520, t0 + 80, EASE.inOut))}/>`);

  const rows = NEOFETCH;
  // Delays shrink as the list goes on: a wave, not a metronome.
  let delay = t0 + 160;
  // Each value shows two frames of noise, then itself. Shared classes carry the timing; each row
  // only sets where its moments fall inside the cycle.
  const frame = 90;
  const when = ms => startAt(ms).slice(4);
  rows.forEach(([key, value], i) => {
    const y = 142 + i * 21;
    const rand = random(i * 977 + 13);
    const t = delay + 40;
    const frames = [0, 1].map(k => text(vx, y, garble(value, Math.floor((value.length * k) / 2), rand), {
      size: 14, cls: 'mu fr fw', custom: `--a:${when(t + k * frame)};--b:${when(t + (k + 1) * frame)}`,
    }));
    const real = text(vx, y, value, { size: 14, cls: 'fg rv', custom: `--s:${when(t + 2 * frame)}` });
    parts.push(`<g class="rw" style="${startAt(delay)}">${text(kx, y, key, { size: 14, cls: 'ac' })}${frames.join('')}${real}</g>`);
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
    cubes.push(`<g class="cb" style="${startAt(delay + 260 + i * 40)};--i:${i}"><path class="a${i}t" d="${top}"/><path class="a${i}r" d="${right}"/><path class="a${i}" d="${front}"/></g>`);
  }
  parts.push(cubes.join(''));

  const cubeWave = delay + 1400;
  const shade = (hex, to, f) => toHex(hexRgb(hex).map((v, i) => v + (hexRgb(to)[i] - v) * f));
  const ansi = list => list.map((hex, i) => `.a${i}{fill:${hex}}.a${i}t{fill:${shade(hex, '#ffffff', 0.32)}}.a${i}r{fill:${shade(hex, '#000000', 0.38)}}`).join('');

  return svg({
    w: W, h: H, id,
    defs: `<radialGradient id="${id}-pool"><stop offset="0" class="shs" stop-opacity=".16"/><stop offset=".6" class="sht" stop-opacity=".05"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient><radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>${haloDef(`${id}-halo`)}${ringDef}
<linearGradient id="${id}-wall" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="shs" stop-opacity=".09"/><stop offset=".7" class="sht" stop-opacity="0"/></linearGradient>
<linearGradient id="${id}-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".85" class="shs" stop-opacity=".06"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<style>.sht{stop-color:var(--teal)}:root{--gf:#4d5562;--gt:#7d8590;--gr:#262c36}
.rw{animation:${entrance('side', 480)}}.cb{animation:${entrance('drop', 480)},wave 2600ms ${EASE.inOut} calc(${cubeWave}ms + var(--i) * 90ms) infinite}
.fw{animation:showw ${looping()}ms linear(0, 0 var(--a), 1 var(--a), 1 var(--b), 0 var(--b), 0 100%) 0ms infinite alternate both}.rv{animation:in ${looping()}ms linear(0, 0 var(--s), 1 var(--s), 1 100%) 0ms infinite alternate both}
.vx{animation:${entrance('asm', 680)},wv 3600ms ${EASE.inOut} calc(var(--c) * -130ms) infinite}
.tf{animation:glintT 4800ms ${EASE.inOut} calc(4016ms - var(--r) * 260ms) infinite}.gf{animation:glintG 4800ms ${EASE.inOut} calc(4016ms - var(--r) * 260ms) infinite}
.scan{opacity:0;animation:scan 4800ms linear 2600ms infinite}.sp{fill:var(--accent);fill-opacity:.07}.se{fill:none;stroke:var(--glow);stroke-width:1.2;stroke-opacity:.8}
.orb{fill:none;stroke:var(--accent);stroke-dasharray:1 1}.ob{stroke-opacity:.22}.of{stroke-opacity:.45}.spk{fill:var(--glow)}
.hv{fill:url(#${id}-wall)}.hv path{animation:hol 5200ms linear infinite}.hf path{animation-delay:-2600ms}
.mo{fill:var(--glow);opacity:0;animation:mote 4200ms linear infinite}
.pbm{fill:none;stroke:var(--accent);stroke-linecap:round;animation:orbit 7000ms linear infinite}
.psc{opacity:0;animation:band 6000ms linear 1800ms infinite}
.yw{animation:yaw 6400ms ${EASE.inOut} infinite}
@keyframes asm{from{opacity:0;transform:translate(var(--x),var(--y))}}
@keyframes wv{50%{translate:0 -6px}}
@keyframes scan{0%{opacity:0;transform:translateY(96px)}6%,38%{opacity:1}45%,100%{opacity:0;transform:translateY(-12px)}}
@keyframes hol{0%,100%{opacity:1}46%{opacity:.75}48%{opacity:.35}50%{opacity:.9}70%{opacity:.6}}
@keyframes mote{0%{opacity:0;transform:translateY(0)}12%{opacity:.75}100%{opacity:0;transform:translateY(-118px)}}
@keyframes band{0%{opacity:0;transform:translateY(0)}10%,80%{opacity:1}100%{opacity:0;transform:translateY(${ph - 48}px)}}
@keyframes yaw{50%{transform:translateX(var(--dx))}}
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
    desc: `A neofetch-style card. A 3D voxel <T/> sign assembles from blocks flying in from every side inside a hologram projector, then ripples like a wave while a scan plane climbs it and two sparks orbit it on a tilted ring; beside it a raised panel, with a light circling its edge, lists ${rows.map(([k, v]) => `${k}: ${v}`).join('; ')}, each value decrypting from noise, above eight 3D colour cubes in the terminal ANSI palette.`,
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
  const H = 372; // headroom above the back row for the holograms
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
  const ox = 308 - (minX + maxX) / 2; // right of centre: the holograms rise clear of the title
  const oy = (84 + H) / 2 - (minY + maxY) / 2;
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
<path class="rrun" d="M${pt(D0)}L${pt(C0)}L${pt(B0)}" pathLength="1" stroke-dasharray=".14 .86" style="--o0:.14;--o1:-1"/>
</g>`);
  // Data packets run the floor grid between the caps (painted before the caps, which hide them).
  const lane2 = (p, q, n) => { const [dx, dy] = [q[0] - p[0], q[1] - p[1]]; const k = 13 / Math.hypot(dx, dy); return `<path class="fp" d="M${pt(p)}l${r2(-dx * k)} ${r2(-dy * k)}" style="--v:${r2(dx)}px,${r2(dy)}px;animation-delay:${n * -900}ms"/>`; };
  const lanes = [lane2(P(-0.5, 0.5), P(rows - 0.5, 0.5), 0), lane2(P(0.5, -0.5), P(0.5, cols - 0.5), 1), lane2(P(-0.5, cols - 1.5), P(rows - 0.5, cols - 1.5), 2), lane2(P(rows - 0.5, -0.5), P(rows - 0.5, cols - 0.5), 3)];
  parts.push(`<g${style(A('in', 700, 420))}>${zoneTiles}<path class="grid" d="${grid.join('')}"/>${lanes.join('')}</g>`);

  // Keycaps, painted back to front. Logos lie on the cap, foreshortened 2:1 like the floor.
  // Scaled pieces (shadow, halo) are absolute paths: transform-box on <use x y> ignores the offset in Chrome.
  const rhAt = (x, y, f) => `M${x} ${r2(y - bk * f)}l${r2(ak * f)} ${r2(bk * f)}l${r2(-ak * f)} ${r2(bk * f)}l${r2(-ak * f)} ${r2(-bk * f)}z`;
  const cells = groups.flatMap(([, items], i) => items.map((item, j) => ({ item, i, j }))).sort((p, q) => p.i + p.j - (q.i + q.j));
  // Typing: every cap is struck once per bar, in a fixed shuffled order, so one key is always going down.
  const order = cells.map((_, n) => n);
  const rnd = random(cells.length * 31 + offset);
  for (let n = order.length - 1; n > 0; n--) { const m = Math.floor(rnd() * (n + 1)); [order[n], order[m]] = [order[m], order[n]]; }
  const holo = [];
  cells.forEach((cell, n) => { cell.press = 2400 + offset + (order[n] * 6000) / cells.length; });
  for (const { item, i, j, press } of cells) {
    const icon = ICONS[SLUGS[item]];
    const [x, yf] = P(i, j);
    const yt = r2(yf - h);
    const drop = offset + 520 + (i + j) * 80 + i * 24;
    const bob = offset + 2600 + (i + j) * 150;
    const on = CURRENT.has(item);
    const sx = (ak * 0.9) / 24;
    const sy = sx * (b / a);
    const ink = logoInk(icon.hex);
    const [tx, ty] = [r2(x - 12 * sx), r2(yt - 12 * sy)];
    const lid = `${id}-l${i}${j}`;
    const logo = `<path id="${lid}" class="lg" transform="matrix(${r2(sx)} 0 0 ${r2(sy)} ${tx} ${ty})" d="${icon.d}"/>`;
    const lit = on ? `<use href="#${id}-cap" x="${x}" y="${yt}" class="on"/>` : '';
    parts.push(`<path class="sd shd" d="${rhAt(x, yf, 1.06)}" style="--d:${ms(bob)}"/>`);
    // The ripple rides with the drop but not the bob or the press, so it stays on the floor.
    parts.push(`<g class="dc" style="${startAt(drop)};${ink};--p:${ms(press)}"><path class="rp" d="${rhAt(x, yf, 1.06)}"/><g class="bb" style="--d:${ms(bob)}"><use href="#${id}-block" x="${x}" y="${yt}"/><use href="#${id}-tint" x="${x}" y="${yt}" color="${icon.hex}"/>${lit}<use href="#${id}-cap" x="${x}" y="${yt}" class="kf"/>${logo}</g></g>`);
    if (on && (i === 0 || j === 0)) {
      // Hologram: the cap projects its logo upright above itself, turning slowly in a cone of light.
      // Only caps with nothing directly behind them project, so no hologram lands on another logo.
      const sz = 1.3;
      const yc = yt - 52;
      const m = `matrix(${r2(sz / sx)} 0 0 ${r2(sz / sy)} ${r2(x - 12 * sz - (sz / sx) * tx)} ${r2(yc - 12 * sz - (sz / sy) * ty)})`;
      holo.push(`<g class="hg" style="${ink};animation-delay:${-holo.length * 1700}ms"><path class="cone" d="M${r2(x - 12)} ${r2(yt - 2)}L${r2(x + 12)} ${r2(yt - 2)}L${r2(x + 24)} ${r2(yc - 4)}L${r2(x - 24)} ${r2(yc - 4)}Z"/><path class="emit" d="${rhAt(x, yt, 0.32)}"/><g class="hov"><circle cx="${x}" cy="${r2(yc)}" r="26" fill="url(#${id}-glow)"/><g class="sp3" style="animation-delay:${-holo.length * 1300}ms"><use href="#${lid}" transform="${m}"/></g></g></g>`);
    }
  }
  parts.push(`<g${style(A('in', 900, offset + 2000))}>${holo.join('')}</g>`);

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
  let y = Math.round((84 + H) / 2 - panelH / 2 + 10);
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
  const defs = `<linearGradient id="${id}-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" class="shs" stop-opacity=".4"/><stop offset="1" class="sht" stop-opacity="0"/></linearGradient><radialGradient id="${id}-glow"><stop offset="0" class="shs" stop-opacity=".16"/><stop offset=".6" class="sht" stop-opacity=".05"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>${zoneDefs}
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
.dc{animation:${entrance('drop', 820)}}
.bb{animation:bob 3600ms ${EASE.inOut} var(--d) infinite,press 6000ms linear var(--p) infinite}.sd{animation:shbob 3600ms ${EASE.inOut} var(--d) infinite}
.kf{fill:var(--c);opacity:0;animation:kfl 6000ms linear var(--p) infinite}
.rp{fill:none;stroke:var(--c);stroke-width:1.5;opacity:0;animation:rip 6000ms ${EASE.out} var(--p) infinite}
.rrun{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;animation:orbit 4200ms linear infinite}
.fp{fill:none;stroke:var(--glow);stroke-width:2;stroke-linecap:round;opacity:0;animation:fpk 3600ms linear infinite}
.hg{animation:hol 5200ms linear infinite}.cone{fill:url(#${id}-beam)}.emit{fill:var(--glow);opacity:.5}
.hov{animation:hov 3000ms ${EASE.inOut} infinite}.sp3{transform-box:fill-box;transform-origin:center;animation:sp3 4200ms cubic-bezier(.45,0,.55,1) infinite}
.sp3 use{fill:var(--c)}
@media (prefers-color-scheme:light){.kf,.sp3 use{fill:var(--cl,var(--c))}.rp{stroke:var(--cl,var(--c))}}
@keyframes press{0%,8%,100%{translate:0 0}3%{translate:0 6px}}
@keyframes kfl{0%,16%,100%{opacity:0}3%{opacity:.5}}
@keyframes rip{0%{opacity:0;transform:scale(1)}3%{opacity:.85;transform:scale(1)}22%,100%{opacity:0;transform:scale(1.4)}}
@keyframes fpk{0%{opacity:0;transform:translate(0,0)}10%,82%{opacity:.95}100%{opacity:0;transform:translate(var(--v))}}
@keyframes hol{0%,100%{opacity:1}46%{opacity:.8}48%{opacity:.4}50%{opacity:.95}70%{opacity:.7}}
@keyframes hov{50%{transform:translateY(-5px)}}
@keyframes sp3{50%{transform:scaleX(-1);opacity:.55}}
.sd,.rp{transform-box:fill-box;transform-origin:center}
@keyframes drop{from{opacity:0;transform:translateY(-96px)}}
@keyframes bob{50%{transform:translateY(-7px)}}
@keyframes shin{from{opacity:0;transform:scale(.3)}}
@keyframes shbob{50%{opacity:.45;transform:scale(.8)}}
</style>`;

  const names = groups.map(([label, items]) => `${label}: ${items.join(', ')}`).join('; ');
  return svg({
    w: W, h: H, id, defs,
    title: `Toolkit, ${title}`,
    desc: `Isometric keyboard where each tool is a keycap carrying its logo. The keys strike one after another and flash their brand colour, packets run along the floor grid, and tools in production project a turning hologram of their logo. A name panel sits beside it. ${names}. In production now: ${groups.flatMap(([, items]) => items).filter(item => CURRENT.has(item)).join(', ')}.`,
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
// The tandev mark (Tandev.foto: developer and photographer): a Fujifilm X-T5 in silver with a 25mm
// prime and a speedlight on the hot shoe, in three-quarter view on the same receding axis as every
// other 3D object here (faces parallel to the picture plane stay true, so the lens rings are
// circles). Dials are discs on the top plate drawn through the top-plane matrix. Every few seconds
// it takes a picture the way a camera does: half-press (AF lamp, focus ring turns), full press (the
// button bottoms out, the flash fires, the iris snaps shut, the body recoils), then the speedlight
// recycles (its ready lamp blinks red, then green). Transform, opacity and fill only.

const CAM = { dv: [0.62, -0.42], shot: 6000, first: 1800 };
// Point on the top plate: u along the width from the front-left corner, d into depth, z up.
const topAt = (u, d, z = 0) => [30 + u + CAM.dv[0] * d, 92 + CAM.dv[1] * d - z];
const disc = (u, d, z, r, cls, extra = '') => {
  const [x, y] = topAt(u, d, z);
  return `<circle class="${cls}" r="${r}" transform="matrix(1 0 ${CAM.dv[0]} ${CAM.dv[1]} ${r2(x)} ${r2(y)})"${extra}/>`;
};
// A knurled dial: side built from stacked discs, vertical knurl lines along its front half, a lit
// top with engraved ticks, and an index mark.
function dial(u, d, r, h, { mark = '#e6edf3', ticks = 24 } = {}) {
  const side = [0, 0.33, 0.66].map(f => disc(u, d, h * f, r, 'dside')).join('');
  const [cx, cy] = topAt(u, d, h);
  const knurl = [];
  for (let k = 0; k <= 16; k++) {
    const a = Math.PI + (k / 16) * Math.PI; // front half (towards the viewer)
    const x = cx + r * Math.cos(a) + CAM.dv[0] * r * Math.sin(a);
    const y = cy + CAM.dv[1] * r * Math.sin(a);
    knurl.push(`M${r2(x)} ${r2(y)}v${h}`);
  }
  return `${side}<path class="dknurl" d="${knurl.join('')}"/>${disc(u, d, h, r, 'dtop')}${disc(u, d, h, r * 0.78, 'dtick', ` stroke-dasharray="${r2((2 * Math.PI * r * 0.78) / ticks / 3)} ${r2(((2 * Math.PI * r * 0.78) / ticks) * (2 / 3))}"`)}${disc(u, d, h, r * 0.3, 'dhub')}${disc(u - r * 0.62, d + r * 0.1, h, 1.3, 'dmark', ` style="fill:${mark}"`)}`;
}

function camera(id) {
  const { shot, first } = CAM;
  const cyc = name => `${name} ${shot}ms linear ${first}ms infinite`;
  // Lens: mount centre C, axis towards the viewer (down-left), rings are circles along it.
  const C = [127, 130];
  const AX = [-0.62, 0.42];
  const LEN = 44;
  const at = t => [C[0] + AX[0] * LEN * t, C[1] + AX[1] * LEN * t];
  const ring = (t, r, cls, extra = '') => { const [x, y] = at(t); return `<circle class="${cls}" cx="${r2(x)}" cy="${r2(y)}" r="${r}"${extra}/>`; };
  const norm = Math.hypot(AX[0], AX[1]);
  const n = [AX[1] / norm, -AX[0] / norm];
  const band = (t0, t1, r) => { const [a, b] = [at(t0), at(t1)]; return `M${r2(a[0] + n[0] * r)} ${r2(a[1] + n[1] * r)}L${r2(b[0] + n[0] * r)} ${r2(b[1] + n[1] * r)}L${r2(b[0] - n[0] * r)} ${r2(b[1] - n[1] * r)}L${r2(a[0] - n[0] * r)} ${r2(a[1] - n[1] * r)}Z`; };
  const [gx, gy] = at(1);
  const iris = Array.from({ length: 7 }, (_, k) => { const a = ((k * 360) / 7 + 12) * Math.PI / 180; return `${r2(gx + 9 * Math.cos(a))} ${r2(gy + 9 * Math.sin(a))}`; });
  const blades = iris.map((p, k) => { const a = ((k * 360) / 7 + 64) * Math.PI / 180; return `M${p}L${r2(gx + 3 * Math.cos(a))} ${r2(gy + 3 * Math.sin(a))}`; }).join('');
  const arc = (r, a0, a1) => {
    const p = a => [r2(gx + r * Math.cos((a * Math.PI) / 180)), r2(gy + r * Math.sin((a * Math.PI) / 180))];
    const [s, e] = [p(a0), p(a1)];
    return `M${s[0]} ${s[1]}A${r} ${r} 0 0 1 ${e[0]} ${e[1]}`;
  };

  // Speedlight on the hot shoe: foot, body, then the head with its Fresnel window facing forward.
  const box = (x, y, w, h, dep, front, top, side) => {
    const [dx, dy] = [CAM.dv[0] * dep, CAM.dv[1] * dep];
    return `<path class="${top}" d="M${x} ${y}L${x + w} ${y}L${r2(x + w + dx)} ${r2(y + dy)}L${r2(x + dx)} ${r2(y + dy)}Z"/><path class="${side}" d="M${x + w} ${y}L${r2(x + w + dx)} ${r2(y + dy)}L${r2(x + w + dx)} ${r2(y + h + dy)}L${x + w} ${y + h}Z"/><rect class="${front}" x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`;
  };
  const flash = [
    `<path class="shoe" d="M128 55.5L146 55.5L152 51.5L134 51.5Z"/>`,
    box(129, 47, 16, 7, 9, 'fl-foot', 'fl-top', 'fl-side'),
    box(122, 27, 30, 20, 16, 'fl-body', 'fl-top', 'fl-side'),
    `<circle cx="${r2(152 + CAM.dv[0] * 8)}" cy="${r2(37 + CAM.dv[1] * 8)}" r="1.7" class="ready" style="animation:${cyc('ready')}"/>`,
    box(117, 7, 40, 20, 20, 'fl-head', 'fl-top', 'fl-side'),
    `<rect x="121" y="10" width="32" height="14" rx="1.5" fill="url(#${id}-fresnel)"/><rect x="121" y="10" width="32" height="14" rx="1.5" fill="url(#${id}-lines)"/>`,
    `<rect x="121" y="10" width="32" height="14" rx="1.5" class="fwin" style="animation:${cyc('fwin')}"/>`,
  ].join('');

  const body = [
    // body: top plate (silver), right side, front (leatherette between silver bands), grip
    `<path class="c-edge" fill="url(#${id}-top)" d="M30 92L206 92L233.3 73.5L57.3 73.5Z"/>`,
    `<path class="c-sidel" d="M206 92L233.3 73.5L233.3 159.5L206 178Z"/>`,
    `<path class="c-side" d="M206 92L233.3 73.5V86.5L206 105Z"/><path class="c-side" d="M206 171L233.3 152.5V159.5L206 178Z"/><path class="c-hl" d="M206.5 105L233 87"/>`,
    `<ellipse cx="214" cy="93" rx="2.6" ry="3.4" class="lug"/>`,
    `<rect x="30" y="92" width="176" height="86" rx="8" class="leather"/>`,
    `<rect x="30" y="92" width="176" height="86" rx="8" fill="url(#${id}-grain)"/>`,
    `<path fill="url(#${id}-band)" d="M30 105V100a8 8 0 0 1 8 -8H198a8 8 0 0 1 8 8V105Z"/>`,
    `<path fill="url(#${id}-band)" d="M30 171H206V170a8 8 0 0 1 -8 8H38a8 8 0 0 1 -8 -8Z"/>`,
    `<rect x="30" y="92" width="176" height="86" rx="8" fill="url(#${id}-shade)"/>`,
    `<path class="c-hl" d="M33 105.5H203"/><path class="c-hl2" d="M37 92.4H199"/>`,
    `<rect x="30" y="105" width="30" height="66" rx="7" class="grip"/><rect x="30" y="105" width="30" height="66" rx="7" fill="url(#${id}-grain)"/><path class="c-hl" d="M34 112V164"/>`,
    text(196, 101, 'X-T5', { size: 5.6, cls: 'c-ink', anchor: 'end', weight: 700 }),
    `<circle cx="70" cy="114" r="3" class="aflamp"/><circle cx="70" cy="114" r="3" class="afon" style="animation:${cyc('af')}"/>`,
    `<circle cx="182" cy="150" r="3.4" class="c-btn"/>`,
    // dials behind the viewfinder: exposure compensation, shutter speed
    dial(16, 30, 10, 6),
    dial(46, 25, 13, 7.5, { mark: '#ff6b5b', ticks: 30 }),
    // viewfinder hump: front, top, side, the FUJIFILM name, hot shoe and speedlight
    `<path class="c-side" d="M156 60L174.6 47.4L182.6 79.4L164 92Z"/>`,
    `<path class="c-edge" fill="url(#${id}-top)" d="M100 60L156 60L174.6 47.4L118.6 47.4Z"/>`,
    `<path class="c-edge" fill="url(#${id}-hump)" d="M92 92L164 92L156 60L100 60Z"/>`,
    `<path class="c-hl" d="M100.5 60.5H155.5"/>`,
    text(128, 80, 'FUJIFILM', { size: 7.2, cls: 'c-ink', anchor: 'middle', weight: 700 }),
    // ISO dial to the right of the hump
    dial(160, 24, 13, 7.5, { ticks: 28 }),
    // shutter button in its power-switch collar, at the front of the grip
    disc(18, 9, 0.5, 8.5, 'collar'),
    `<path class="lever" d="M${topAt(9, 2, 1).map(r2).join(' ')}l-5 3"/>`,
    `<g style="animation:${cyc('press')}">${disc(18, 9, 1.5, 4.6, 'btn-s')}${disc(18, 9, 3, 4.6, 'btn-s')}${disc(18, 9, 4, 4.6, 'btn-t')}</g>`,
    `<g class="rip" style="animation:${cyc('rip')}">${disc(18, 9, 2, 6, 'ripple')}</g>`,
    // lens: flange, barrel, aperture ring, focus ring, front rim and the glass
    `<circle cx="${C[0]}" cy="${C[1]}" r="35" fill="url(#${id}-metal)"/>`,
    `<path fill="url(#${id}-barrel)" d="${band(0.04, 1, 31)}"/>`,
    ring(0.04, 31.5, 'mount'),
    ring(0.12, 30, 'ap'),
    ring(0.3, 30, 'apribs'),
    `<path class="apmarks" d="${(() => { const [x, y] = at(0.33); return [-62, -50, -38, -26, -14].map(a => { const r = (a * Math.PI) / 180; return `M${r2(x + 30 * Math.cos(r))} ${r2(y + 30 * Math.sin(r))}l${r2(-1.8 * Math.cos(r))} ${r2(-1.8 * Math.sin(r))}`; }).join(''); })()}"/>`,
    ring(0.46, 31, 'fbase'),
    ring(0.62, 31, 'focus', ` style="animation:${cyc('focus')}"`),
    ring(0.86, 29.5, 'front'),
    ring(1, 29, 'rim', ` fill="url(#${id}-rim)"`),
    `<path id="${id}-name" class="none" d="M${r2(gx + 25.4 * Math.cos(2.62))} ${r2(gy + 25.4 * Math.sin(2.62))}A25.4 25.4 0 1 1 ${r2(gx + 25.4 * Math.cos(0.52))} ${r2(gy + 25.4 * Math.sin(0.52))}"/>`,
    `<text font-size="4.2" class="lensname"><textPath href="#${id}-name">25mm  1:1.8  52mm</textPath></text>`,
    `<circle cx="${r2(gx)}" cy="${r2(gy)}" r="22.5" class="rim-in"/>`,
    `<circle cx="${r2(gx)}" cy="${r2(gy)}" r="20" fill="url(#${id}-glass)"/>`,
    `<path class="ct-violet" d="${arc(15.5, 200, 285)}"/><path class="ct-green" d="${arc(11.5, 20, 95)}"/><path class="ct-amber" d="${arc(17.5, 115, 150)}"/>`,
    `<g class="iris" style="animation:${cyc('iris')}"><path class="blade" d="M${iris.join('L')}Z"/><path class="bladeline" d="${blades}"/></g>`,
    `<ellipse cx="${r2(gx - 7)}" cy="${r2(gy - 8)}" rx="5.4" ry="2.6" transform="rotate(-32 ${r2(gx - 7)} ${r2(gy - 8)})" class="spec"/><circle cx="${r2(gx + 6)}" cy="${r2(gy + 7)}" r="1" class="spec2"/>`,
    `<circle cx="${r2(gx)}" cy="${r2(gy)}" r="20" class="glassflash" style="animation:${cyc('gflash')}"/>`,
    flash,
  ].join('');

  const markup = ['<g transform="translate(0 24)">',
    `<ellipse cx="128" cy="186" rx="92" ry="8" fill="url(#${id}-shadow)"${style(`shb 4400ms ${EASE.inOut} 1200ms 4`)} class="cshadow"/>`,
    `<g${style([A('up', 900, 150), `bob 4400ms ${EASE.inOut} 1200ms 4`])}><g style="animation:${cyc('recoil')}">${body}</g></g>`,
    `<g class="burst" style="animation:${cyc('burst')}"><circle cx="137" cy="17" r="40" fill="url(#${id}-burst)"/><ellipse cx="137" cy="17" rx="128" ry="5" fill="url(#${id}-burst)"/></g>`,
    '</g>',
  ].join('\n');

  const defs = `<linearGradient id="${id}-top" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f3f5"/><stop offset=".55" stop-color="#c3c9d0"/><stop offset="1" stop-color="#8f979f"/></linearGradient>
<linearGradient id="${id}-hump" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4e8ec"/><stop offset=".6" stop-color="#b9c0c8"/><stop offset="1" stop-color="#9aa2ab"/></linearGradient>
<linearGradient id="${id}-band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe3e8"/><stop offset="1" stop-color="#a3abb4"/></linearGradient>
<pattern id="${id}-grain" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r=".5" fill="#fff" fill-opacity=".06"/></pattern>
<pattern id="${id}-lines" width="4" height="1.6" patternUnits="userSpaceOnUse"><rect width="4" height=".5" fill="#000" fill-opacity=".14"/></pattern>
<linearGradient id="${id}-fresnel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset="1" stop-color="#c2c8cf"/></linearGradient>
<radialGradient id="${id}-metal" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#eef1f4"/><stop offset=".5" stop-color="#a0a8b1"/><stop offset="1" stop-color="#4a5058"/></radialGradient>
<linearGradient id="${id}-barrel" gradientUnits="userSpaceOnUse" x1="95" y1="105" x2="130" y2="170"><stop offset="0" stop-color="#4c535d"/><stop offset=".45" stop-color="#1d2026"/><stop offset="1" stop-color="#0b0d10"/></linearGradient>
<radialGradient id="${id}-rim" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#5b626c"/><stop offset=".6" stop-color="#22262c"/><stop offset="1" stop-color="#0c0e11"/></radialGradient>
<radialGradient id="${id}-glass" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#23406e"/><stop offset=".45" stop-color="#0a1426"/><stop offset="1" stop-color="#020305"/></radialGradient>
<radialGradient id="${id}-shadow"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<radialGradient id="${id}-burst"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".3" stop-color="#fffbea" stop-opacity=".5"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-shade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".07"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>`;

  // Shot timeline (one cycle): half-press at 8%, full press at 20%, the shot at 21%, recycle to 60%.
  const css = `.c-side{fill:#8a929b}.c-sidel{fill:#121417}.lug{fill:none;stroke:#c3c9d0;stroke-width:1.4}.c-hl2{fill:none;stroke:#fff;stroke-opacity:.8;stroke-linecap:round}.leather{fill:#1b1d21}.grip{fill:#141619}.c-hl{fill:none;stroke:#fff;stroke-opacity:.35;stroke-linecap:round}
.c-ink{fill:#1f2328}.aflamp{fill:#5a3b12}.afon{fill:#ffb347;opacity:0}.c-btn{fill:#c6ccd3;stroke:#7d858e;stroke-width:.6}
.dside{fill:#7c848d}.dknurl{stroke:#3b4047;stroke-width:.7}.dtop{fill:#d9dee3;stroke:#8f979f;stroke-width:.5}.dtick{fill:none;stroke:#3b4047;stroke-width:1.6}.dhub{fill:#c3c9d0;stroke:#8f979f;stroke-width:.4}
.collar{fill:#2b2f35;stroke:#5c636c;stroke-width:.5}.lever{stroke:#2b2f35;stroke-width:2.4;stroke-linecap:round}.btn-s{fill:#9aa2ab}.btn-t{fill:#e6e9ed;stroke:#8f979f;stroke-width:.4}
.rip{opacity:0}.ripple{fill:none;stroke:var(--accent);stroke-width:.8}
.shoe{fill:#1a1d22}.fl-foot,.fl-body,.fl-head{fill:#202328}.fl-top{fill:#3b4048}.fl-side{fill:#121418}.ready{fill:#3fb950}
.fwin{fill:#fff;opacity:0}.burst{opacity:0}
.mount{fill:none;stroke:#c9ced4;stroke-width:1.2}.ap{fill:#16191d}.apribs{fill:#121418;stroke:#000;stroke-width:3;stroke-dasharray:1 1.2}
.apmarks{stroke:#e6edf3;stroke-width:.7}.fbase{fill:#16191d}.focus{fill:#0f1114;stroke:#050607;stroke-width:6;stroke-dasharray:1.3 1.1}.front{fill:#1d2025}
.rim{stroke:#6c737d;stroke-width:.6}.rim-in{fill:#06070a;stroke:#2c3138;stroke-width:.8}.none{fill:none}.lensname{fill:#c9d1d9;letter-spacing:.3px}
.ct-violet{fill:none;stroke:#8f73ff;stroke-width:1.6;stroke-opacity:.55;stroke-linecap:round}.ct-green{fill:none;stroke:#3fd6a0;stroke-width:1.2;stroke-opacity:.42;stroke-linecap:round}
.ct-amber{fill:none;stroke:#ffb347;stroke-width:1.1;stroke-opacity:.5;stroke-linecap:round}
.blade{fill:#070a10;stroke:#273041;stroke-width:.5}.bladeline{stroke:#2b3547;stroke-width:.5}
.spec{fill:#fff;opacity:.75}.spec2{fill:#fff;opacity:.9}
.iris,.cshadow,.rip{transform-box:fill-box;transform-origin:center}
.glassflash{fill:#fff;opacity:0}
@keyframes press{0%,7%{transform:none}9%,19%{transform:translateY(.8px)}21%,27%{transform:translateY(1.8px)}31%,100%{transform:none}}
@keyframes rip{0%,20%{opacity:0;transform:scale(.6)}21%{opacity:.9;transform:scale(.8)}32%,100%{opacity:0;transform:scale(1.7)}}
@keyframes af{0%,7.5%{opacity:0}9%,19%{opacity:1}20%,100%{opacity:0}}
@keyframes focus{0%,8%{stroke-dashoffset:0}16%,100%{stroke-dashoffset:-7}}
@keyframes recoil{0%,21%{translate:0 0}22%{translate:-.5px 1px}25%,100%{translate:0 0}}
@keyframes iris{0%,21%{transform:scale(1)}22.5%{transform:scale(.18)}28%,100%{transform:scale(1)}}
@keyframes fwin{0%,20.8%{opacity:0}21.4%{opacity:1}26%,100%{opacity:0}}
@keyframes burst{0%,20.8%{opacity:0}21.4%{opacity:1}24%{opacity:.5}34%,100%{opacity:0}}
@keyframes gflash{0%,21%{opacity:0}22%{opacity:.6}28%,100%{opacity:0}}
@keyframes ready{0%,21%{fill:#3fb950}22%,38%{fill:#3a1f1f}40%,44%{fill:#ff5a4f}46%,50%{fill:#3a1f1f}52%,56%{fill:#ff5a4f}58%,100%{fill:#3fb950}}
@media (prefers-color-scheme:light){.c-edge{stroke:#6e7781;stroke-width:.6}}
@keyframes bob{50%{transform:translateY(-4px)}}
@keyframes shb{50%{transform:scale(.88);opacity:.7}}`;
  return { markup, defs, css };
}

function brand() {
  const W = 900;
  const H = 222;
  const id = 'brand';
  const cam = camera(id);
  const parts = [`<ellipse cx="128" cy="124" rx="120" ry="96" fill="url(#${id}-glow)"/>`, cam.markup];
  // Wordmark with two receding depth layers on the shared up-right axis, then a sheen.
  const wx = 274;
  const wy = 136;
  const word = 'tandev';
  const layers = [['wd2', 3.6, -2.5], ['wd1', 1.8, -1.25]].map(([cls, dx, dy], k) =>
    text(wx + dx, wy + dy, word, { size: 60, weight: 800, cls, anim: A('extrude', 700, 760 + (1 - k) * 60), custom: `--e:${-dx}px;` }));
  parts.push(`<g${style(A('rise', 800, 520), '--rise:24px;')}>${layers.join('')}${text(wx, wy, word, { size: 60, weight: 800 })}</g>`);
  parts.push(`<g clip-path="url(#${id}-word)"><g transform="skewX(-18)"><rect x="210" y="62" width="96" height="86" fill="url(#${id}-sheen)" style="--d:330px;animation:sweep 6400ms linear 1700ms 2"/></g></g>`);
  parts.push(text(wx + 2, wy + 32, `${PROFILE.name.toLowerCase()}  /  ${PROFILE.role}  /  soc trang, vietnam`, { size: 13, cls: 'mu', pre: true, anim: A('in', 600, 1100) }));
  // Top right: the handle as a quiet signature, and what the camera on the left is.
  parts.push(`<g${style(A('in', 600, 1300))}>${icon(W - 214, 44, 18, UI.github, 'mu')}${text(W - 188, 58, `github.com/${PROFILE.handle}`, { size: 12, cls: 'mu' })}</g>`);
  parts.push(text(wx + 2, wy + 54, 'shot on x-t5 + 25mm f/1.8', { size: 11, cls: 'mu fade', anim: A('in', 600, 1500) }));

  const glyphs = text(wx, wy, word, { size: 60, weight: 800 });
  return svg({
    w: W, h: H, id, frame: false,
    defs: `<radialGradient id="${id}-glow"><stop offset="0" class="shs" stop-opacity=".2"/><stop offset=".6" class="sht" stop-opacity=".06"/><stop offset="1" class="sht" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}-sheen"><stop offset="0" class="shs" stop-opacity="0"/><stop offset=".5" class="shs" stop-opacity=".9"/><stop offset="1" class="shs" stop-opacity="0"/></linearGradient>
<clipPath id="${id}-word">${glyphs}</clipPath>
${cam.defs}
<style>.sht{stop-color:var(--teal)}${cam.css}
.wd1{fill:var(--teal);opacity:.5}.wd2{fill:var(--blue);opacity:.28}.fade{opacity:.7}
@media (prefers-color-scheme:light){.wd1{opacity:.32}.wd2{opacity:.18}}
@keyframes extrude{from{opacity:0;transform:translate(var(--e),calc(var(--e) * -.7))}}</style>`,
    title: 'tandev',
    desc: `The tandev brand mark: a silver Fujifilm X-T5 with a 25mm f/1.8 lens and a speedlight on the hot shoe, in 3D. Every few seconds it takes a picture: the shutter button half-presses (the AF lamp lights, the focus ring turns), then presses fully, the flash fires, the iris snaps shut and the body recoils, and the speedlight's ready lamp blinks red while it recycles, then turns green. Beside it, the wordmark tandev and the line ${PROFILE.name}, ${PROFILE.role}, Soc Trang, Vietnam.`,
    body: parts.join('\n'),
  });
}

// ── Output ──────────────────────────────────────────────────────────────────

// Half-periods: each scene builds, holds, rewinds and rebuilds over twice this long.
const LOOPS = { hero: 9000, fetch: 8000, divider: 5000, launch: 7000, brand: 9000, ping: 9000, island: 8000, section: 6500, key: 6000 };

export function renderAssets() {
  const L = (half, render) => loopify(withLoop(half, render));
  const assets = {
    'assets/hero-banner.svg': L(LOOPS.hero, hero),
    'assets/typing-anim.svg': L(LOOPS.fetch, fetchCard),
    'assets/keyboard.svg': loopify(keyboard()),
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
  // The terminal prints the real sizes of the files generated above, and counts them (itself and
  // the metrics card included).
  const bytes = file => Buffer.byteLength(assets[file]);
  const count = Object.keys(assets).filter(f => f.endsWith('.svg')).length + 2;
  assets['assets/terminal-3d.svg'] = loopify(deskTerminal({
    sizes: { 'hero-banner.svg': bytes('assets/hero-banner.svg'), 'keyboard.svg': bytes('assets/keyboard.svg'), 'stack-server.svg': bytes('assets/stack-server.svg') },
    count,
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
