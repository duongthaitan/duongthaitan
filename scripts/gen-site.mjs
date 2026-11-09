// Builds terminal/index.html: the interactive 3D version of the profile, published on GitHub Pages.
// One self-contained file (no CDN, no fonts to fetch); content comes from profile-data.mjs so the
// page and the README artwork always state the same facts. Called from gen-profile.mjs.
import { readFileSync } from 'node:fs';
import { escapeXml as esc, logoInk } from './svg-kit.mjs';
import { ICONS } from './tool-icons.mjs';
import { CERTS, CURRENT, GLYPHS, LINKS, NEOFETCH, PROFILE, PROJECTS, SITE_URL, SLUGS, STACK } from './profile-data.mjs';

const source = file => readFileSync(new URL(`./site/${file}`, import.meta.url), 'utf8').split('\r\n').join('\n');
// The page must stay ASCII (like every generated asset); escape anything else for JS/JSON.
const asciiJs = s => s.replace(/[^\x00-\x7e]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

// neofetch art: the <T/> mark as block characters, brackets muted and the T in accent.
// Half blocks pack two pixel rows into one line, so the 7-row mark takes 4 lines.
function art() {
  const order = ['<', 'T', '/', '>'];
  const on = (g, r, c) => (GLYPHS[g][r] || '.....')[c] === '#';
  const lines = [];
  for (let r = 0; r < 7; r += 2) {
    lines.push(order.flatMap((g, i) => {
      const text = [0, 1, 2, 3, 4].map(c => {
        const top = on(g, r, c);
        const bottom = on(g, r + 1, c);
        return top && bottom ? '█' : top ? '▀' : bottom ? '▄' : ' ';
      }).join('');
      const seg = [[text, g === 'T' ? 'ac' : 'mu']];
      return i < order.length - 1 ? [...seg, [' ', '']] : seg;
    }));
  }
  return lines;
}

const logo = (tool, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[SLUGS[tool]].d}"/></svg>`;

function keyboard() {
  let i = 0;
  return STACK.map(([group, items]) => `<div class="kbrow"><span class="lbl">${esc(group)}</span>${items.map(tool => {
    const on = CURRENT.has(tool);
    return `<button class="cap${on ? ' on' : ''}" type="button" data-tool="${esc(tool)}" style="--i:${i++};${logoInk(ICONS[SLUGS[tool]].hex)}" aria-label="${esc(tool)}${on ? ', in production now' : ''}">${logo(tool)}<span class="nm">${esc(tool)}</span></button>`;
  }).join('')}</div>`).join('\n');
}

// What the terminal shows before (or without) JavaScript: the same neofetch, as plain lines.
function staticNeofetch() {
  const rows = art().map(row => `<div class="ln">${row.map(([t, c]) => `<span class="${c}">${esc(t).replace(/[▀-█]/g, c => `&#${c.charCodeAt(0)};`)}</span>`).join('')}</div>`);
  rows.push('<div class="ln"></div>', `<div class="ln b ac">${esc(PROFILE.handle)}@github</div>`);
  for (const [k, v] of NEOFETCH) rows.push(`<div class="ln"><span class="ac">${esc(k.padEnd(10))}</span>${esc(v)}</div>`);
  return rows.join('');
}

export function renderSite() {
  const data = {
    profile: PROFILE,
    neofetch: NEOFETCH,
    stack: STACK,
    current: [...CURRENT],
    projects: PROJECTS,
    certs: CERTS,
    links: LINKS,
    art: art(),
  };
  const json = asciiJs(JSON.stringify(data)).replace(/</g, '\\u003c');
  const depth = [['var(--blue)', '.14', '-18px'], ['var(--blue)', '.28', '-12px'], ['var(--teal)', '.42', '-8px'], ['var(--accent)', '.6', '-4px']];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(PROFILE.name)}, ${esc(PROFILE.role)}: interactive terminal</title>
<meta name="description" content="${esc(PROFILE.name)}, ${esc(PROFILE.role)} from ${esc(PROFILE.location)}. ${esc(PROFILE.line)} An interactive 3D terminal you can type into.">
<meta name="color-scheme" content="dark light">
<link rel="canonical" href="${SITE_URL}">
<link rel="icon" href="data:,">
<script>try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style>
${source('terminal.css')}</style>
</head>
<body>
<a class="skip" href="#term-input">Skip to the terminal</a>
<div class="aurora" aria-hidden="true"></div>
<canvas id="field" aria-hidden="true"></canvas>

<header class="wrap top">
  <a class="brand" href="https://github.com/${esc(PROFILE.handle)}">~/${esc(PROFILE.handle)}</a>
  <nav aria-label="Sections"><a href="#toolkit">toolkit</a><a href="#projects">projects</a><a href="#certificates">certificates</a><a href="#connect">connect</a></nav>
  <button class="theme" id="theme" type="button">theme: auto</button>
</header>

<main class="wrap">
  <section class="hero" aria-label="Introduction">
    <div class="intro">
      <p class="prompt"><span class="chev">&gt;</span>whoami</p>
      <h1 class="name">${depth.map(([c, o, z]) => `<span class="d" aria-hidden="true" style="--c:${c};--o:${o};--z:${z}">${esc(PROFILE.name)}</span>`).join('')}<span class="face">${esc(PROFILE.name)}</span></h1>
      <p class="role"><span id="role">${esc(PROFILE.role)}</span><span class="caret" aria-hidden="true"></span></p>
      <p class="line">${esc(PROFILE.line)}</p>
      <div class="actions">
        <button class="key primary" type="button" data-run="help">run help</button>
        <a class="key" href="https://github.com/${esc(PROFILE.handle)}">github profile</a>
      </div>
    </div>
    <div class="stage">
      <div class="term" id="term">
        <div class="bar"><i></i><i></i><i></i><span>~/${esc(PROFILE.handle)} : zsh</span></div>
        <div class="screen"><div class="out" id="out" role="log" aria-live="polite" aria-label="Terminal output">${staticNeofetch()}</div></div>
        <form class="inputline" id="form" autocomplete="off">
          <label class="sr" for="term-input">Type a command</label>
          <span class="chev" aria-hidden="true">&#10095;</span>
          <input id="term-input" name="cmd" type="text" spellcheck="false" autocapitalize="off" placeholder="type help and press enter">
        </form>
        <div class="glare" aria-hidden="true"></div>
      </div>
      <div class="chips" aria-label="Quick commands">${['neofetch', 'stack', 'projects', 'info react', 'certs', 'matrix'].map(c => `<button class="key" type="button" data-run="${c}">${c}</button>`).join('')}</div>
    </div>
  </section>

  <section class="block" id="toolkit">
    <h2><span class="chev">&gt;</span>ls ~/toolkit</h2>
    <p>Every key is a tool I use. Hover to lift it, click to inspect it, or type <span class="ac">info &lt;tool&gt;</span> in the terminal and watch the matching keys rise.</p>
    <div class="kbwrap">
      <div class="kbstage"><div class="kb" id="kb">
${keyboard()}
      </div></div>
      <aside class="inspector" id="inspector" aria-live="polite">
        <p class="cmd"><span class="ac">&#10095; </span>info</p>
        <div class="big"></div>
        <dl></dl>
        <p class="hint">Green keys are in production now.</p>
      </aside>
    </div>
  </section>

  <section class="block" id="projects">
    <h2><span class="chev">&gt;</span>ls ~/projects</h2>
    <p>Selected work. Cards turn toward you as you move over them.</p>
    <div class="grid2">
${PROJECTS.map(p => `      <article class="card"><h3>${esc(p.name)}</h3><p>${esc(p.what)}</p><ul>${p.stack.map(s => `<li>${esc(s)}</li>`).join('')}</ul><div class="glare" aria-hidden="true"></div></article>`).join('\n')}
    </div>
  </section>

  <section class="block" id="certificates">
    <h2><span class="chev">&gt;</span>cat certificates.json</h2>
    <p>Each one links to its credential.</p>
    <div class="certs">
${CERTS.map(c => `      <a href="${esc(c.url)}" target="_blank" rel="noopener"><span>${esc(c.name)}</span><code>${esc(c.id)}</code><span class="who">${esc(c.issuer)}</span></a>`).join('\n')}
    </div>
  </section>

  <section class="block" id="connect">
    <h2><span class="chev">&gt;</span>ping ${esc(PROFILE.handle)}</h2>
    <p>Say hello.</p>
    <div class="links">
${LINKS.map(l => `      <a class="key" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('\n')}
    </div>
  </section>
</main>

<footer class="wrap">
  Generated by <code>scripts/gen-site.mjs</code> in <a href="https://github.com/${esc(PROFILE.handle)}/${esc(PROFILE.handle)}">${esc(PROFILE.handle)}/${esc(PROFILE.handle)}</a>. Logos from Simple Icons (CC0); trademarks belong to their owners.
</footer>

<script type="application/json" id="data">${json}</script>
<script>
${asciiJs(source('terminal.js'))}</script>
</body>
</html>
`;
}
