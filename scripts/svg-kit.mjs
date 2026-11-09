// Shared design tokens and SVG helpers for every profile asset.
// One palette, one type face, one motion vocabulary: change it here, regenerate, done.

export const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]);

// Monospace is the material. Every run is pinned to 0.6em per glyph with textLength,
// so typing reveals and carets land on the same pixel on macOS, Windows and Linux.
export const MONO = "ui-monospace,'SF Mono','Cascadia Mono','JetBrains Mono',Menlo,Consolas,'Liberation Mono',monospace";
export const ADV = 0.6;

export const EASE = {
  out: 'cubic-bezier(.23,1,.32,1)', // entrances
  inOut: 'cubic-bezier(.77,0,.175,1)', // on-screen movement
  linear: 'linear', // constant flow (line drawing)
};

// Cards have no background of their own: everything sits directly on GitHub's page, so the profile
// reads as one surface in every theme (light, dark, dark dimmed, high contrast). Surfaces are
// translucent white (dark) or ink (light) layered over whatever the page colour is.
// Colour beyond the accent stays analogous (green, teal, blue from GitHub's own ANSI set);
// brand colours appear only on the tool logos they belong to.
const DARK = { bg: '#0d1117', raised: 'rgba(255,255,255,.045)', panel: 'rgba(22,27,34,.92)', screen: 'rgba(1,4,9,.55)', fg: '#e6edf3', muted: '#9198a1', faint: 'rgba(255,255,255,.07)', line: 'rgba(255,255,255,.12)', accent: '#7ee787', glow: '#d2ffd6', deep: '#2ea043', teal: '#39c5cf', blue: '#79c0ff', vox: '#2d333b' };
const LIGHT = { bg: '#ffffff', raised: 'rgba(31,35,40,.035)', panel: 'rgba(255,255,255,.95)', screen: 'rgba(246,248,250,.9)', fg: '#1f2328', muted: '#59636e', faint: 'rgba(31,35,40,.07)', line: 'rgba(31,35,40,.15)', accent: '#1a7f37', glow: '#4ac26b', deep: '#0f5323', teal: '#1b7c83', blue: '#0969da', vox: '#8c959f' };
const vars = tokens => Object.entries(tokens).map(([key, value]) => `--${key}:${value}`).join(';');

const r2 = n => Math.round(n * 100) / 100;
export const width = (str, size) => r2(str.length * ADV * size);

// Base state of every element is its final state; keyframes only describe where it comes from.
// That way reduced motion (animation:none) shows the finished composition, never a blank card.
const CSS = `
:root{${vars(DARK)}}
@media (prefers-color-scheme:light){:root{${vars(LIGHT)}}}
text{font-family:${MONO};fill:var(--fg)}
.fg{fill:var(--fg)}.mu{fill:var(--muted)}.ac{fill:var(--accent)}.bg{fill:var(--bg)}.fa{fill:var(--faint)}.rs{fill:var(--raised)}
.frame{fill:var(--raised);stroke:var(--line)}.xa{fill:var(--line)}.xb{fill:var(--faint)}
.hair{fill:none;stroke:var(--line)}
.chev,.tick{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.shs{stop-color:var(--accent)}
.pop,.ring,.chip,.spin,.tick{transform-box:fill-box;transform-origin:center}
.grow,.run{transform-box:fill-box;transform-origin:0 50%}
.draw{stroke-dasharray:1 1}
.mv{transform:translateX(var(--d))}
.cv,.cvs{transform-box:fill-box;transform-origin:100% 50%}.cv{transform:scaleX(0)}
.ring{fill:none;stroke:var(--accent);stroke-width:1.5}
.spin{fill:none;stroke:var(--accent);stroke-width:2;stroke-linecap:round}
.beam{fill:none;stroke:var(--accent)}
.ring,.run,.spin,.beam,.pk,.flash,.fr,.off{opacity:0}
.px{opacity:.55;--o:.55}
@keyframes in{from{opacity:0}}
@keyframes up{from{opacity:0;transform:translateY(8px)}}
@keyframes side{from{opacity:0;transform:translateX(-10px)}}
@keyframes rise{from{opacity:0;transform:translateY(var(--rise))}}
@keyframes pop{from{opacity:0;transform:scale(.5)}}
@keyframes chip{from{opacity:0;transform:translateY(6px) scale(.96)}}
@keyframes grow{from{transform:scaleX(0)}}
@keyframes draw{from{stroke-dashoffset:1}}
@keyframes type{from{transform:translateX(0)}}
@keyframes wipe{from{transform:scaleX(1)}}
@keyframes ch{from{fill-opacity:0}}
@keyframes vanish{to{opacity:0}}
@keyframes blink{0%,45%{opacity:1}55%,100%{opacity:0}}
@keyframes ring{0%{opacity:.55;transform:scale(1)}45%,100%{opacity:0;transform:scale(3)}}
@keyframes run{0%{opacity:1;transform:scaleX(0)}75%{opacity:1;transform:scaleX(1)}100%{opacity:0;transform:scaleX(1)}}
@keyframes show{from,to{opacity:1}}
@keyframes spin{from{opacity:1;transform:rotate(0)}to{opacity:1;transform:rotate(360deg)}}
@keyframes sweep{0%{transform:translateX(0);animation-timing-function:${EASE.inOut}}38%,100%{transform:translateX(var(--d))}}
@keyframes orbit{from{stroke-dashoffset:var(--o0)}to{stroke-dashoffset:var(--o1)}}
@keyframes beamfade{0%{opacity:0}6%,94%{opacity:var(--bo)}100%{opacity:0}}
@keyframes glint{8%{opacity:1}26%{opacity:var(--o)}}
@keyframes glintT{8%{fill:var(--glow)}26%{fill:var(--accent)}}
@keyframes descend{0%{opacity:0;transform:translateY(0)}4%,52%{opacity:1}56%,100%{opacity:0;transform:translateY(var(--d))}}
@keyframes flash{0%{opacity:0}5%{opacity:.22}24%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}.transient,.fx{display:none}}
@media (forced-colors:active){text,.fg,.mu,.ac,.fa,.rs{fill:CanvasText}.frame,.bg{fill:Canvas}.frame,.hair{stroke:CanvasText}.chev,.tick{stroke:CanvasText}}
`;

// One animation entry for a style attribute: name duration easing delay tail.
export const A = (name, dur, delay = 0, ease = EASE.out, tail = 'both') => `${name} ${Math.round(dur)}ms ${ease} ${Math.round(delay)}ms ${tail}`;

export const style = (anim, custom = '') => {
  const list = anim ? [].concat(anim) : [];
  if (!list.length && !custom) return '';
  return ` style="${custom}${list.length ? `animation:${list.join(',')}` : ''}"`;
};

// pre: keep runs of spaces (as &#160;), for column-aligned terminal output on one baseline.
export function text(x, y, str, { size = 14, cls = 'fg', weight, anchor, anim, custom, pre = false } = {}) {
  const attrs = [`x="${r2(x)}"`, `y="${r2(y)}"`, `font-size="${size}"`, `textLength="${width(str, size)}"`];
  if (cls) attrs.push(`class="${cls}"`);
  if (weight) attrs.push(`font-weight="${weight}"`);
  if (anchor) attrs.push(`text-anchor="${anchor}"`);
  const body = escapeXml(str);
  return `<text ${attrs.join(' ')}${style(anim, custom)}>${pre ? body.replace(/ /g, '&#160;') : body}</text>`;
}

// Prompt chevron drawn as a path: the glyph version depends on font coverage.
export const chevron = (x, y, size = 15, anim) =>
  `<path class="chev" d="M${r2(x)} ${r2(y - size * 0.7)}l${r2(size * 0.32)} ${r2(size * 0.32)}l${r2(-size * 0.32)} ${r2(size * 0.32)}"${style(anim)}/>`;

export const check = (x, y, anim) => `<path class="tick" d="M${r2(x)} ${r2(y - 5)}l3.5 3.5l7 -7"${style(anim)}/>`;

// Typed text: each glyph switches on (fill-opacity) at its keystroke, so no cover has to match the
// page colour, which an SVG inside <img> cannot know. A caret rides along.
// caret: 'blink' stays and blinks a few times; 'vanish' leaves once the command "runs".
export function typed(x, y, str, { size = 15, cls = 'fg', delay = 0, cps = 50, caret = 'blink', blinks = 8, vanishAt } = {}) {
  const n = str.length;
  const w = width(str, size);
  const dur = n * cps;
  const steps = `steps(${n},end)`;
  const glyphs = [...str].map((c, i) => (c === ' ' ? ' ' : `<tspan style="animation:ch 1ms linear ${Math.round(delay + (i + 1) * cps)}ms both">${escapeXml(c)}</tspan>`)).join('');
  let out = `<text x="${r2(x)}" y="${r2(y)}" font-size="${size}" textLength="${w}" class="${cls}">${glyphs}</text>`;
  if (caret) {
    const anims = [A('in', 1, delay, EASE.linear), A('type', dur, delay, steps)];
    if (caret === 'vanish') anims.push(A('vanish', 120, vanishAt ?? delay + dur + 320, EASE.linear, 'forwards'));
    else anims.push(`blink 1100ms linear ${Math.round(delay + dur + 240)}ms ${blinks}`);
    out += `<rect class="ac mv${caret === 'vanish' ? ' transient' : ''}" x="${r2(x + 1)}" y="${r2(y - size * 0.82)}" width="${r2(size * 0.5)}" height="${r2(size * 1.02)}" rx="1"${style(anims, `--d:${w}px;`)}/>`;
  }
  return { svg: out, end: delay + dur, width: w };
}

export const rrect = (x, y, w, h, r) =>
  `M${r2(x + r)} ${y}H${r2(x + w - r)}A${r} ${r} 0 0 1 ${r2(x + w)} ${r2(y + r)}V${r2(y + h - r)}A${r} ${r} 0 0 1 ${r2(x + w - r)} ${r2(y + h)}H${r2(x + r)}A${r} ${r} 0 0 1 ${x} ${r2(y + h - r)}V${r2(y + r)}A${r} ${r} 0 0 1 ${r2(x + r)} ${y}Z`;

// Border beam: a comet of light orbiting the card edge. Three dashes share a leading edge
// (long faint tail, medium body, short bright head) so the light reads as one moving object.
export function beam(w, h, radius, { delay, lap = 5600, laps = 2 }) {
  const d = rrect(0.5, 0.5, w - 1, h - 1, radius - 0.5);
  return [[0.18, 0.14, 1.5], [0.07, 0.4, 1.5], [0.02, 1, 2]].map(([len, opacity, sw]) =>
    `<path class="beam" d="${d}" pathLength="1" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${len} ${r2(1 - len)}" style="--o0:${len};--o1:${r2(len - 1)};--bo:${opacity};animation:orbit ${lap}ms linear ${Math.round(delay)}ms ${laps},beamfade ${lap * laps}ms linear ${Math.round(delay)}ms 1"/>`).join('\n');
}

// Side faces of a box extruded by (dx, dy) behind a w x h face at (x, y). Only the two visible
// faces are drawn and they never overlap the face itself, so translucent surfaces do not stack.
export function extrude(x, y, w, h, dx, dy, r = 0, cls = ['xa', 'xb']) {
  const p = (a, b) => `${r2(a)} ${r2(b)}`;
  const right = `M${p(x + w, y + r)}L${p(x + w + dx, y + r + dy)}L${p(x + w + dx, y + h - r + dy)}L${p(x + w, y + h - r)}Z`;
  const edge = dy < 0
    ? `M${p(x + r, y)}L${p(x + w - r, y)}L${p(x + w - r + dx, y + dy)}L${p(x + r + dx, y + dy)}Z`
    : `M${p(x + r, y + h)}L${p(x + w - r, y + h)}L${p(x + w - r + dx, y + h + dy)}L${p(x + r + dx, y + h + dy)}Z`;
  return `<path class="${cls[0]}" d="${edge}"/><path class="${cls[1]}" d="${right}"/>`;
}

// Busy indicator for a running command; hidden before and after it spins.
export const spinner = (cx, cy, start, dur) =>
  `<circle class="spin" cx="${cx}" cy="${cy}" r="6" pathLength="1" stroke-dasharray=".62 .38"${style(`spin 640ms linear ${Math.round(start)}ms ${r2(dur / 640)}`)}/>`;

// Soft light for moving packets: a halo gradient plus a bright core.
export const haloDef = id => `<radialGradient id="${id}"><stop offset="0" class="shs" stop-opacity=".7"/><stop offset="1" class="shs" stop-opacity="0"/></radialGradient>`;

export function svg({ w, h, id, title, desc, body, defs = '', radius = 16, frame = true }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="${id}-title ${id}-desc" style="max-width:100%;height:auto">
<title id="${id}-title">${escapeXml(title)}</title>
<desc id="${id}-desc">${escapeXml(desc)}</desc>
<style>${CSS}</style>
<defs>${frame ? `<clipPath id="${id}-frame"><rect width="${w}" height="${h}" rx="${radius}"/></clipPath>` : ''}${defs}</defs>
${body}
</svg>
`;
}

// Colour helpers shared by the artwork and the interactive page.
export const hexRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const luminance = rgb => {
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (p, q) => { const [hi, lo] = [luminance(p), luminance(q)].sort((m, n) => n - m); return (hi + 0.05) / (lo + 0.05); };
export const toHex = rgb => `#${rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

// Brand colour on its own logo. Near-black marks switch to the text ink so they survive dark mode;
// pale marks are darkened just enough to hold 2.4:1 on the light face.
export function logoInk(hex) {
  const rgb = hexRgb(hex);
  if (luminance(rgb) < 0.05) return '--c:var(--fg)';
  let light = rgb;
  while (contrast(light, hexRgb('#f3f5f7')) < 2.4) light = light.map(v => v * 0.9);
  const cl = toHex(light);
  return cl.toLowerCase() === hex.toLowerCase() ? `--c:${hex}` : `--c:${hex};--cl:${cl}`;
}
