import fs from 'fs';
import path from 'path';

// DevTools-themed hero banner — VS Code editor window
const width = 900;
const height = 240;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="hero-title hero-desc" style="max-width:100%;height:auto">
  <title id="hero-title">Code editor — duongthaitan profile</title>
  <desc id="hero-desc">A VS Code editor window displaying a TypeScript profile file with JSDoc annotations showing developer name, role, and technology focus areas, with a blinking cursor on the last line of code.</desc>
  <defs>
    <clipPath id="hero-frame"><rect width="${width}" height="${height}" rx="10"/></clipPath>
    <style>
      text{font-family:ui-monospace,'SF Mono',Menlo,Consolas,monospace;font-size:13px;fill:#d4d4d4}
      .tb{font-size:12px;fill:#969696}.ln{fill:#6e7681;text-anchor:end}
      .cm{fill:#6a9955}.kw{fill:#569cd6}.ty{fill:#4ec9b0}
      .vr{fill:#9cdcfe}.st{fill:#ce9178}.sb{font-size:11px;fill:#fff}
      @media(prefers-reduced-motion:reduce){.cur{display:none}}
      @media(forced-colors:active){rect,circle,line{fill:Canvas;stroke:CanvasText}text,.tb,.ln,.cm,.kw,.ty,.vr,.st,.sb{fill:CanvasText}}
    </style>
  </defs>
  <g clip-path="url(#hero-frame)">
    <rect width="${width}" height="28" fill="#323233"/>
    <circle cx="20" cy="14" r="6" fill="#ff5f57"/><circle cx="38" cy="14" r="6" fill="#febc2e"/><circle cx="56" cy="14" r="6" fill="#28c840"/>
    <text x="76" y="18" class="tb">profile.ts — duongthaitan</text>
    <rect y="28" width="${width}" height="188" fill="#1e1e1e"/>
    <rect y="28" width="36" height="188" fill="#1e1e1e"/><line x1="37" y1="28" x2="37" y2="216" stroke="#2d2d2d"/>
    <text x="30" y="50" class="ln">1</text><text x="46" y="50" class="cm">/**</text>
    <text x="30" y="68" class="ln">2</text><text x="54" y="68" class="cm">*</text><text x="70" y="68" class="kw">@author</text><text x="132" y="68" class="cm">Duong Thai Tan</text>
    <text x="30" y="86" class="ln">3</text><text x="54" y="86" class="cm">*</text><text x="70" y="86" class="kw">@role</text><text x="132" y="86" class="cm">Full-Stack Developer</text>
    <text x="30" y="104" class="ln">4</text><text x="54" y="104" class="cm">*</text><text x="70" y="104" class="kw">@stack</text><text x="132" y="104" class="cm">Web · Cloud · System Design</text>
    <text x="30" y="122" class="ln">5</text><text x="46" y="122" class="cm">*/</text>
    <text x="30" y="140" class="ln">6</text>
    <text x="30" y="158" class="ln">7</text><text x="46" y="158"><tspan class="kw">export default class </tspan><tspan class="ty">Profile</tspan><tspan> {</tspan></text>
    <text x="30" y="176" class="ln">8</text><text x="62" y="176"><tspan class="kw">readonly</tspan><tspan class="vr"> status</tspan><tspan> = </tspan><tspan class="st">"always shipping"</tspan><tspan>;</tspan></text>
    <text x="30" y="194" class="ln">9</text><text x="46" y="194">}</text>
    <rect class="cur" x="350" y="164" width="2" height="15" fill="#aeafad"><animate attributeName="opacity" values="1;1;0;0" dur="1s" repeatCount="indefinite"/></rect>
    <rect y="216" width="${width}" height="24" fill="#007acc"/>
    <text x="12" y="232" class="sb">main</text><text x="56" y="232" class="sb">Ln 8, Col 43</text><text x="180" y="232" class="sb">Spaces: 2</text><text x="270" y="232" class="sb">TypeScript</text><text x="362" y="232" class="sb">UTF-8</text>
  </g>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="9.5" fill="none" stroke="#3c3c3c"/>
</svg>`;

const dir = path.join(process.cwd(), 'assets');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'hero-banner.svg'), svg);
console.log('hero-banner.svg generated.');
