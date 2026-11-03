/**
 * Pure geometry helpers for the data build scripts (no dependencies).
 * Points are [lon, lat]; boxes are [minLon, minLat, maxLon, maxLat].
 */

const inside = ([x, y], [x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

/** Liang–Barsky: the part of segment a→b inside the box, or null. */
export function clipSegment(a, b, [x0, y0, x1, y1]) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]]) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) {
        if (r > t1) return null;
        if (r > t0) t0 = r;
      } else {
        if (r < t0) return null;
        if (r < t1) t1 = r;
      }
    }
  }
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
}

/** A polyline cut to a box: zero or more polylines, split where it leaves the box. */
export function clipLine(line, box) {
  if (line.length === 1) return inside(line[0], box) ? [line] : [];
  const out = [];
  let cur = null;
  for (let i = 0; i < line.length - 1; i++) {
    const seg = clipSegment(line[i], line[i + 1], box);
    if (!seg) {
      if (cur) out.push(cur);
      cur = null;
      continue;
    }
    const [s, e] = seg;
    const last = cur?.[cur.length - 1];
    if (cur && last[0] === s[0] && last[1] === s[1]) {
      cur.push(e);
    } else {
      if (cur) out.push(cur);
      cur = [s, e];
    }
    // Leaving the box mid-segment ends this piece.
    if (e[0] !== line[i + 1][0] || e[1] !== line[i + 1][1]) {
      out.push(cur);
      cur = null;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function perpendicular(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
}

/** Douglas–Peucker simplification with tolerance in degrees. */
export function simplify(line, tolerance) {
  if (line.length <= 2) return line.slice();
  let max = 0;
  let idx = 0;
  for (let i = 1; i < line.length - 1; i++) {
    const d = perpendicular(line[i], line[0], line[line.length - 1]);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= tolerance) return [line[0], line[line.length - 1]];
  const left = simplify(line.slice(0, idx + 1), tolerance);
  const right = simplify(line.slice(idx), tolerance);
  return [...left.slice(0, -1), ...right];
}

export const round = (line, digits = 3) => line.map(([x, y]) => [+x.toFixed(digits), +y.toFixed(digits)]);

/** GEM tuples look like "(0.1,0.01,0.1)" = (preferred, min, max); "None" when unknown. */
export function preferred(tuple) {
  const m = /^\(\s*([-\d.]+)/.exec(String(tuple ?? ''));
  return m ? Number(m[1]) : null;
}
