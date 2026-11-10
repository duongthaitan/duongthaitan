// Rebuilds scripts/ui-icons.mjs from Phosphor Icons (MIT, https://phosphoricons.com), regular weight.
// Usage:
//   mkdir <empty dir> && cd <empty dir>
//   for n in <names below>; do curl -sfLO https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/$n.svg; done
//   node scripts/extract-ui-icons.mjs <that dir> scripts/ui-icons.mjs
// Each file must be exactly one <path> on the 256 grid; paths are re-encoded with integer
// coordinates (1/256 of the icon, invisible at the sizes used) through the same rounding-aware minifier.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { minify } from './extract-icons.mjs';

const NAMES = {
  about: 'user-circle', toolkit: 'stack', projects: 'folder-open', certificates: 'certificate', automation: 'gear-six',
  connect: 'globe-hemisphere-east', terminal: 'terminal-window', code: 'code-block',
  github: 'github-logo', linkedin: 'linkedin-logo', instagram: 'instagram-logo',
};
const SHAPE = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 256 256" fill="currentColor"><path d="([MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+)"\/><\/svg>\s*$/;

const [dir, out] = process.argv.slice(2);
const entries = Object.entries(NAMES).map(([key, file]) => {
  const m = SHAPE.exec(readFileSync(join(dir, `${file}.svg`), 'utf8'));
  if (!m) throw new Error(`${file}.svg is not a single-path Phosphor icon`);
  const d = minify(m[1], 0);
  console.log(key.padEnd(13), file.padEnd(22), String(m[1].length).padStart(5), '->', String(d.length).padStart(5));
  return `  ${key}: '${d}', // ${file}`;
});
writeFileSync(out, `// UI icons: Phosphor Icons v2.1.1, regular weight (MIT, https://phosphoricons.com), 256-unit grid.
// Regenerate with scripts/extract-ui-icons.mjs; never hand-edit a path.
export const UI = {
${entries.join('\n')}
};
`);
