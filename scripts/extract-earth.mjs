// Rebuilds scripts/earth-data.mjs from world-atlas land-110m (Natural Earth, public domain).
// Usage:
//   mkdir <empty dir> && cd <empty dir>
//   curl -sfLO https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json
//   node scripts/extract-earth.mjs <that dir>/land-110m.json scripts/earth-data.mjs
// Output units: x = (longitude + 180) * 2, so one turn is 720 wide; y = -sin(latitude) * 500,
// the orthographic vertical, so the globe only has to scale x as it turns.
import { readFileSync, writeFileSync } from 'node:fs';
import { minify } from './extract-icons.mjs';

const [file, out] = process.argv.slice(2);
const topo = JSON.parse(readFileSync(file, 'utf8'));
if (topo.type !== 'Topology' || !topo.objects?.land || !Array.isArray(topo.arcs)) throw new Error('not a world-atlas land topology');
const [sx, sy] = topo.transform.scale;
const [tx, ty] = topo.transform.translate;

// Decode delta-encoded, quantised arcs into lon/lat.
const arcs = topo.arcs.map(arc => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
});
const ring = refs => refs.flatMap((r, k) => {
  const pts = r < 0 ? [...arcs[~r]].reverse() : arcs[r];
  return k ? pts.slice(1) : pts;
});

// Ramer-Douglas-Peucker in degrees.
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [x1, y1] = pts[a];
    const [x2, y2] = pts[b];
    const len = Math.hypot(x2 - x1, y2 - y1);
    let best = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      // Closed rings start and end on the same point: measure from that point instead of a zero-length line.
      const d = len ? Math.abs((x2 - x1) * (y1 - pts[i][1]) - (x1 - pts[i][0]) * (y2 - y1)) / len : Math.hypot(pts[i][0] - x1, pts[i][1] - y1);
      if (d > best) { best = d; idx = i; }
    }
    if (best > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
// Rings that cross the antimeridian jump from +180 to -180; unwrap them so they stay contiguous
// (the globe tiles the map twice and never shows the seam at x = 0).
const unwrap = pts => {
  let shift = 0;
  return pts.map(([x, y], i) => {
    if (i) { const prev = pts[i - 1][0]; if (x - prev < -180) shift += 360; else if (x - prev > 180) shift -= 360; }
    return [x + shift, y];
  });
};
// ...then bring each ring back so its centre lies within [-180, 180).
const recentre = pts => { const mid = pts.reduce((sum, [x]) => sum + x, 0) / pts.length; const k = Math.round(mid / 360) * 360; return k ? pts.map(([x, y]) => [x - k, y]) : pts; };
const area = pts => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]; return s + x * y2 - x2 * y; }, 0)) / 2;

const rings = topo.objects.land.geometries.flatMap(g => (g.type === 'Polygon' ? [g.arcs] : g.arcs)).flatMap(poly => poly.map(ring));
let kept = 0;
let points = 0;
const d = rings
  .map(unwrap)
  .map(recentre)
  .filter(r => area(r) > 2.2)
  .map(r => simplify(r, 0.55))
  .filter(r => r.length >= 4)
  .map(r => {
    kept++;
    points += r.length;
    return 'M' + r.map(([lon, lat]) => `${((lon + 180) * 2).toFixed(1)} ${(-Math.sin((lat * Math.PI) / 180) * 500).toFixed(1)}`).join('L') + 'Z';
  })
  .join('');
const small = minify(d, 0);
console.log(`rings ${rings.length} -> ${kept}, points ${points}, path ${small.length} B`);
writeFileSync(out, `// Land outlines: world-atlas land-110m (Natural Earth, public domain), simplified.
// x = (longitude + 180) * 2, y = -sin(latitude) * 500. Regenerate with scripts/extract-earth.mjs.
export const LAND = '${small}';
`);
