// Interactive terminal page. Progressive enhancement: everything here is optional, the HTML
// already holds the content. Motion is transform-only and honours prefers-reduced-motion.
(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const root = document.documentElement;
  let matrixOn = false;

  // ---------------------------------------------------------------- theme
  const themeBtn = $('#theme');
  const themes = ['auto', 'dark', 'light'];
  let theme = 'auto';
  try { theme = localStorage.getItem('theme') || 'auto'; } catch (e) { /* storage blocked */ }
  const applyTheme = t => {
    theme = t;
    if (t === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t);
    themeBtn.textContent = 'theme: ' + t;
    try { localStorage.setItem('theme', t); } catch (e) { /* storage blocked */ }
    colours = readColours();
    drawField();
  };
  themeBtn.addEventListener('click', () => applyTheme(themes[(themes.indexOf(theme) + 1) % 3]));

  // ---------------------------------------------------------------- pointer + springs
  // One rAF loop serves every 3D surface. Each surface eases toward its target (a critically
  // damped follow), so motion stays smooth whatever the pointer does, and the loop sleeps at rest.
  const pointer = { x: innerWidth * 0.66, y: innerHeight * 0.4, moved: false };
  const surfaces = [];
  const surface = (el, opts) => { const s = { el, rx: 0, ry: 0, hover: false, ...opts }; surfaces.push(s); return s; };
  let raf = 0;
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function frame() {
    raf = 0;
    let busy = false;
    for (const s of surfaces) {
      let tx = 0;
      let ty = 0;
      if (fine && !reduce && (!s.local || s.hover)) {
        const r = s.el.getBoundingClientRect();
        const nx = clamp((pointer.x - (r.left + r.width / 2)) / (s.local ? r.width / 2 : innerWidth / 2), -1, 1);
        const ny = clamp((pointer.y - (r.top + r.height / 2)) / (s.local ? r.height / 2 : innerHeight / 2), -1, 1);
        tx = -ny * s.max;
        ty = nx * s.max;
        if (s.glare) {
          s.glare.style.setProperty('--gx', ((pointer.x - r.left) / r.width * 100).toFixed(1) + '%');
          s.glare.style.setProperty('--gy', ((pointer.y - r.top) / r.height * 100).toFixed(1) + '%');
        }
      }
      s.rx += (tx - s.rx) * 0.1;
      s.ry += (ty - s.ry) * 0.1;
      if (Math.abs(tx - s.rx) > 0.02 || Math.abs(ty - s.ry) > 0.02) busy = true;
      s.apply(s.rx, s.ry);
    }
    if (pointer.moved) { drawField(); pointer.moved = false; }
    if (busy || matrixOn) kick();
  }

  addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true; kick(); }, { passive: true });
  addEventListener('scroll', () => { pointer.moved = true; kick(); }, { passive: true });

  // Hero name: depth layers parallax as the heading turns.
  const name = $('.name');
  surface(name, { max: 7, apply: (rx, ry) => { name.style.setProperty('--nrx', rx.toFixed(2) + 'deg'); name.style.setProperty('--nry', ry.toFixed(2) + 'deg'); } });
  // Terminal: tilts toward the pointer, with a glare that follows it.
  const term = $('#term');
  surface(term, { max: 9, glare: $('#term .glare'), apply: (rx, ry) => { term.style.setProperty('--rx', rx.toFixed(2) + 'deg'); term.style.setProperty('--ry', ry.toFixed(2) + 'deg'); } });
  // Keyboard: the whole board turns a little, like a desk object.
  const kb = $('#kb');
  surface(kb, { max: 5, apply: (rx, ry) => { kb.style.setProperty('--krx', rx.toFixed(2) + 'deg'); kb.style.setProperty('--krz', (ry * 0.8).toFixed(2) + 'deg'); } });
  // Project cards: tilt only while hovered.
  for (const card of $$('.card')) {
    const s = surface(card, { max: 8, local: true, glare: card.querySelector('.glare'), apply: (rx, ry) => { card.style.setProperty('--rx', rx.toFixed(2) + 'deg'); card.style.setProperty('--ry', ry.toFixed(2) + 'deg'); } });
    card.addEventListener('pointerenter', () => { s.hover = true; kick(); });
    card.addEventListener('pointerleave', () => { s.hover = false; kick(); });
  }

  // ---------------------------------------------------------------- background field
  // A dot grid that leans away from the pointer and lights up around it.
  const canvas = $('#field');
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let colours = readColours();
  function readColours() {
    const cs = getComputedStyle(root);
    return { dot: cs.getPropertyValue('--muted').trim(), accent: cs.getPropertyValue('--accent').trim(), bg: cs.getPropertyValue('--bg').trim() };
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawField();
  }
  const GAP = 28;
  const R = 170;
  function drawField() {
    if (matrixOn) return;
    ctx.clearRect(0, 0, W, H);
    for (let y = GAP / 2; y < H; y += GAP) {
      for (let x = GAP / 2; x < W; x += GAP) {
        const dx = x - pointer.x;
        const dy = y - pointer.y;
        const d = Math.hypot(dx, dy) || 1;
        const f = reduce ? 0 : Math.max(0, 1 - d / R);
        const k = f * f;
        const px = x + (dx / d) * k * 10;
        const py = y + (dy / d) * k * 10;
        ctx.globalAlpha = 0.16 + k * 0.75;
        ctx.fillStyle = k > 0.02 ? colours.accent : colours.dot;
        const size = 1.6 + k * 2;
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }
  addEventListener('resize', resize);
  resize();

  // ---------------------------------------------------------------- matrix (easter egg)
  async function matrix() {
    if (reduce) return ['matrix: motion is reduced on this device, so the rain stays in the code.'];
    matrixOn = true;
    const cols = Math.ceil(W / 16);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    const glyphs = '01<>/{}[]=;:+*#$%&ACDEFGHJKLMNPRSTUVWXYZ';
    const end = performance.now() + 5200;
    ctx.font = '14px ' + getComputedStyle(document.body).fontFamily;
    await new Promise(done => {
      const step = now => {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = colours.bg;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = now > end ? Math.max(0, 1 - (now - end) / 900) : 1;
        ctx.fillStyle = colours.accent;
        for (let i = 0; i < cols; i++) {
          ctx.fillText(glyphs[(Math.random() * glyphs.length) | 0], i * 16, drops[i] * 16);
          if (drops[i] * 16 > H && Math.random() > 0.975) drops[i] = 0;
          drops[i] += 1;
        }
        if (now < end + 900) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
    matrixOn = false;
    drawField();
    return [['wake up, ' + data.profile.handle + '...', 'ac'], 'the matrix has you. type help to get out.'];
  }

  // ---------------------------------------------------------------- terminal
  const out = $('#out');
  const input = $('#term-input');
  const form = $('#form');
  const history = [];
  let hpos = 0;
  let busy = false;

  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
  const link = (text, url) => { const a = el('a', text); a.href = url; a.target = '_blank'; a.rel = 'noopener'; return a; };
  function print(line) {
    const div = el('div', null, 'ln');
    if (typeof line === 'string') div.textContent = line;
    else if (Array.isArray(line) && typeof line[0] === 'string' && typeof line[1] === 'string') { div.textContent = line[0]; div.className += ' ' + line[1]; }
    else for (const part of [].concat(line)) div.append(typeof part === 'string' ? part : part);
    out.append(div);
    out.scrollTop = out.scrollHeight;
  }
  async function printAll(lines) {
    for (const l of lines) { print(l); if (!reduce) await sleep(16); }
  }
  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
  const tools = data.stack.flatMap(([group, items]) => items.map(t => ({ name: t, group })));

  function neofetch() {
    const lines = data.art.map(row => row.map(([t, c]) => el('span', t, c)));
    lines.push('');
    lines.push([el('span', data.profile.handle + '@github', 'b ac')]);
    lines.push([el('span', '-'.repeat(data.profile.handle.length + 7), 'mu')]);
    for (const [k, v] of data.neofetch) lines.push([el('span', pad(k, 10), 'ac'), v]);
    const blocks = [];
    ['var(--muted)', 'var(--red)', 'var(--deep)', 'var(--yellow)', 'var(--blue)', '#bc8cff', 'var(--teal)', 'var(--fg)'].forEach(c => { const b = el('span', '███'); b.style.color = c; blocks.push(b); });
    lines.push(blocks);
    return lines;
  }

  const files = { 'about.md': () => data.profile.about, 'certificates.json': () => certs(), 'contact.txt': () => contact() };
  function certs() { return data.certs.map(c => [el('span', pad(c.issuer, 17), 'ac'), c.name + '  ', link(c.id, c.url)]); }
  function contact() { return data.links.map(l => [el('span', pad(l.where, 11), 'ac'), link(l.label, l.url)]); }
  function info(arg) {
    const q = (arg || '').toLowerCase();
    const t = tools.find(x => x.name === q) || tools.find(x => x.name.startsWith(q));
    if (!q || !t) return [['usage: info <tool>   e.g. info react', 'mu'], 'tools: ' + tools.map(x => x.name).join(', ')];
    select(t.name, false);
    const same = data.stack.find(([g]) => g === t.group)[1].filter(n => n !== t.name);
    return [[el('span', pad('tool', 10), 'ac'), t.name], [el('span', pad('layer', 10), 'ac'), t.group],
      [el('span', pad('status', 10), 'ac'), data.current.includes(t.name) ? el('span', 'in production now', 'ac') : 'in the toolkit'],
      [el('span', pad('alongside', 10), 'ac'), same.join(', ')]];
  }

  const commands = {
    help: () => [['available commands', 'b'], ...[
      ['whoami', 'who is behind this terminal'], ['about', 'the short version'], ['neofetch', 'system info, developer edition'],
      ['ls', 'list files'], ['cat <file>', 'read a file (about.md, certificates.json, contact.txt)'], ['projects', 'selected work'],
      ['stack', 'the toolkit, layer by layer'], ['info <tool>', 'one tool in detail, also lights its key (try: info react)'],
      ['certs', 'certificates with credential links'], ['contact', 'where to find me'], ['theme [dark|light|auto]', 'switch colours'],
      ['matrix', '?'], ['clear', 'clear the screen (or ctrl+l)'], ['history', 'what you typed'],
    ].map(([c, d]) => [el('span', pad(c, 24), 'ac'), d]), ['tab completes, arrow keys walk history', 'mu']],
    whoami: () => [[data.profile.name, 'b'], [data.profile.role + ', ' + data.profile.location, 'ac'], data.profile.line],
    about: () => data.profile.about,
    neofetch,
    ls: () => [[el('span', 'about.md  ', 'fg'), el('span', 'certificates.json  ', 'fg'), el('span', 'contact.txt  ', 'fg'), el('span', 'projects/  ', 'bl'), el('span', 'toolkit/', 'bl')]],
    cat: ([f]) => files[f] ? files[f]() : [['cat: ' + (f || '') + ': no such file. try ls', 'er']],
    projects: () => data.projects.flatMap(p => [[p.name, 'b'], [el('span', '  ' + p.what + '  ', 'mu'), el('span', p.stack.join(' / '), 'tl')]]),
    stack: () => data.stack.map(([g, items]) => [el('span', pad(g, 11), 'ac'), ...items.map(i => el('span', i + '  ', data.current.includes(i) ? 'ac' : 'fg'))]).concat([['green = in production now', 'mu']]),
    info: ([t]) => info(t),
    certs,
    contact,
    theme: ([t]) => { const next = themes.includes(t) ? t : themes[(themes.indexOf(theme) + 1) % 3]; applyTheme(next); return [['theme: ' + next, 'ac']]; },
    matrix,
    history: () => history.map((h, i) => [el('span', String(i + 1).padStart(3) + '  ', 'mu'), h]),
    clear: () => { out.textContent = ''; return []; },
    date: () => [new Date().toString()],
    echo: args => [args.join(' ')],
    sudo: () => [['nice try. this terminal runs as guest, and guest cannot be root.', 'er']],
    exit: () => [['there is no exit. only more commands. (try help)', 'mu']],
    'git': ([sub]) => sub === 'log'
      ? [['feat: interactive 3D terminal page', 'ac'], ['feat: seamless profile on any GitHub theme, 3D neofetch', 'ac'], ['feat: rebuild profile as an animated 3D terminal', 'ac']]
      : [['usage: git log', 'mu']],
  };
  const aliases = { cls: 'clear', '?': 'help', man: 'help', ll: 'ls', dir: 'ls', skills: 'stack', toolkit: 'stack', work: 'projects', certificates: 'certs', socials: 'contact' };

  async function run(raw) {
    const cmd = raw.trim();
    print([el('span', '❯ ', 'ac'), cmd]);
    if (!cmd) return;
    history.push(cmd);
    hpos = history.length;
    const [word, ...args] = cmd.split(/\s+/);
    const key = aliases[word.toLowerCase()] || word.toLowerCase();
    const fn = commands[key];
    if (!fn) { print(['command not found: ' + word + '. type help', 'er']); return; }
    busy = true;
    const res = await fn(args);
    await printAll(res);
    busy = false;
  }

  form.addEventListener('submit', e => { e.preventDefault(); if (busy) return; const v = input.value; input.value = ''; highlight(''); run(v); });
  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' && history.length) { e.preventDefault(); hpos = Math.max(0, hpos - 1); input.value = history[hpos]; }
    else if (e.key === 'ArrowDown' && history.length) { e.preventDefault(); hpos = Math.min(history.length, hpos + 1); input.value = history[hpos] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value;
      const parts = v.split(/\s+/);
      const pool = parts.length > 1 ? (parts[0] === 'info' ? tools.map(t => t.name) : parts[0] === 'cat' ? Object.keys(files) : []) : Object.keys(commands);
      const hit = pool.filter(c => c.startsWith(parts.at(-1)));
      if (hit.length === 1) { parts[parts.length - 1] = hit[0]; input.value = parts.join(' ') + (parts.length === 1 ? ' ' : ''); }
      else if (hit.length > 1) print([['  ' + hit.join('   '), 'mu']]);
    } else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); out.textContent = ''; }
  });
  input.addEventListener('input', () => { const m = /^info\s+(\S*)$/.exec(input.value); highlight(m ? m[1].toLowerCase() : ''); });
  $('.screen').addEventListener('pointerup', () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });
  for (const b of $$('[data-run]')) b.addEventListener('click', () => { if (busy) return; input.focus({ preventScroll: true }); run(b.dataset.run); });

  // ---------------------------------------------------------------- 3D keyboard
  const caps = $$('.cap');
  const insp = $('#inspector');
  function highlight(prefix) { for (const c of caps) c.classList.toggle('match', !!prefix && c.dataset.tool.startsWith(prefix)); }
  function select(toolName, scroll) {
    const cap = caps.find(c => c.dataset.tool === toolName);
    if (!cap) return;
    for (const c of caps) c.classList.toggle('sel', c === cap);
    const t = tools.find(x => x.name === toolName);
    const same = data.stack.find(([g]) => g === t.group)[1].filter(n => n !== t.name);
    const on = data.current.includes(t.name);
    insp.querySelector('.cmd').innerHTML = '';
    insp.querySelector('.cmd').append(el('span', '❯ ', 'ac'), 'info ' + t.name);
    const big = insp.querySelector('.big');
    big.innerHTML = '';
    const logo = cap.querySelector('svg').cloneNode(true);
    big.style.cssText = cap.style.cssText;
    big.append(logo, el('strong', t.name));
    const dl = insp.querySelector('dl');
    dl.innerHTML = '';
    for (const [k, v, cls] of [['layer', t.group], ['status', on ? 'in production now' : 'in the toolkit', on ? 'ac' : ''], ['alongside', same.join(', ')]]) {
      dl.append(el('dt', k), el('dd', v, cls));
    }
    if (scroll) cap.focus({ preventScroll: true });
  }
  for (const c of caps) c.addEventListener('click', () => select(c.dataset.tool, false));

  // ---------------------------------------------------------------- hero role rotator
  const role = $('#role');
  (async () => {
    if (reduce) return;
    const phrases = data.profile.roles;
    let i = 0;
    await sleep(2600);
    for (;;) {
      if (document.hidden) { await sleep(500); continue; }
      const cur = phrases[i];
      for (let n = cur.length; n >= 0; n--) { role.textContent = cur.slice(0, n); await sleep(24); }
      i = (i + 1) % phrases.length;
      const next = phrases[i];
      await sleep(260);
      for (let n = 1; n <= next.length; n++) { role.textContent = next.slice(0, n); await sleep(46); }
      await sleep(2400);
    }
  })();

  // ---------------------------------------------------------------- boot
  (async () => {
    out.textContent = '';
    if (!reduce) {
      await sleep(500);
      for (const ch of 'neofetch') { input.value += ch; await sleep(70); }
      await sleep(260);
      input.value = '';
    }
    await run('neofetch');
    print([el('span', 'type ', 'mu'), el('span', 'help', 'ac'), el('span', ', or try ', 'mu'), el('span', 'info react', 'ac'), el('span', ' and ', 'mu'), el('span', 'matrix', 'ac')]);
    select('react', false);
  })();
  applyTheme(theme);
  kick();
})();
