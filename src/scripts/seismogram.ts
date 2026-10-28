import { dayMonth, hourOf } from '../lib/format';
import type { Row } from '../lib/summary';
import { css, hideTip, readRows, redrawOn, rowTip, showTip } from './ui';

/**
 * Helicorder ("sismógrafo de tambor"): the last 72 h in 24 rows of 3 h, the
 * newest at the bottom; every earthquake is drawn in red with a duration and
 * amplitude that grow with magnitude. The trace itself is deterministic noise.
 */
const ROWS = 24;
const SPAN = 3 * 36e5;

const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

interface Hit { x: number; y: number; q: Row }

function draw(cv: HTMLCanvasElement, rows: Row[], now: number): Hit[] {
  const W = cv.parentElement!.clientWidth;
  const narrow = W < 640;
  const lpad = narrow ? 16 : Math.min(56, Math.max(16, W * 0.04));
  const rowH = narrow ? 14 : 20;
  const top = 14;
  const gut = lpad + (narrow ? 34 : 52);
  const plotW = W - gut - lpad;
  const H = top + ROWS * rowH + 10;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.height = H + 'px';
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, W, H);

  const end = Math.ceil(now / SPAN) * SPAN;
  const start = end - ROWS * SPAN;
  const col = { trace: css('--trace'), sig: css('--signal'), grid: css('--grid'), mut: css('--muted'), ink: css('--ink-2') };
  const qs = rows
    .filter((q) => q.t >= start - 36e5 && q.t <= now)
    .map((q) => {
      const m = q.m ?? 1.1;
      return { q, dur: 1.25 * Math.pow(10, 0.3 * m) * 6e4, A: Math.min(rowH * 0.16 * Math.pow(10, 0.42 * (m - 1.1)), rowH * 2.6) };
    });

  c.strokeStyle = col.grid;
  c.lineWidth = 1;
  for (let k = 0; k <= 6; k++) {
    const x = Math.round(gut + (k / 6) * plotW) + 0.5;
    c.beginPath();
    c.moveTo(x, top);
    c.lineTo(x, top + ROWS * rowH);
    c.stroke();
  }

  c.font = `${narrow ? 10 : 11}px "Geist Mono", ui-monospace, monospace`;
  c.textBaseline = 'middle';
  const hits: Hit[] = [];
  const step = narrow ? 0.7 : 0.6;

  for (let i = 0; i < ROWS; i++) {
    const y0 = top + i * rowH + rowH / 2;
    const rs = start + i * SPAN;
    const hr = hourOf(rs, 'continente');
    c.fillStyle = hr === 0 ? col.ink : col.mut;
    if (!narrow || hr % 6 === 0) c.fillText(hr === 0 ? dayMonth(rs, 'continente') : String(hr).padStart(2, '0') + 'h', lpad, y0);

    const pts: [number, number][] = [];
    for (let x = 0; x <= plotW; x += step) {
      const t = rs + (x / plotW) * SPAN;
      if (t > now) break;
      const n = x / step + i * 9973;
      let v = (rnd(n) - 0.5) * 1.5 + Math.sin(t / 7.3e4 + i) * 0.55;
      for (const e of qs) {
        const u = (t - e.q.t) / e.dur;
        if (u < 0 || u > 1) continue;
        const env = u < 0.1 ? 0.3 * Math.sin(((u / 0.1) * Math.PI) / 2) : u < 0.16 ? 0.3 + (0.7 * (u - 0.1)) / 0.06 : Math.exp(-(u - 0.16) * 5.2);
        v += e.A * env * (rnd(n * 1.7 + (e.q.t % 997)) * 2 - 1) * (1 - u * 0.3);
      }
      pts.push([gut + x, y0 + v]);
    }

    c.strokeStyle = col.trace;
    c.lineWidth = 0.9;
    c.globalAlpha = 0.85;
    c.beginPath();
    pts.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    c.globalAlpha = 1;

    for (const e of qs) {
      const x0 = ((e.q.t - rs) / SPAN) * plotW;
      const x1 = ((e.q.t + e.dur - rs) / SPAN) * plotW;
      if (x1 < 0 || x0 > plotW) continue;
      const seg = pts.filter((p) => p[0] - gut >= x0 && p[0] - gut <= x1);
      if (seg.length < 2) continue;
      c.strokeStyle = col.sig;
      c.lineWidth = 1.1;
      c.beginPath();
      seg.forEach((p, k) => (k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.stroke();
      if (x0 >= 0) hits.push({ x: gut + x0 + Math.min(12, (x1 - x0) * 0.3), y: y0, q: e.q });
    }

    if (i === ROWS - 1 && pts.length) {
      const p = pts[pts.length - 1];
      c.fillStyle = col.sig;
      c.beginPath();
      c.arc(p[0], y0, 3, 0, 7);
      c.fill();
    }
  }

  return hits;
}

const cv = document.getElementById('drumcv') as HTMLCanvasElement | null;
if (cv) {
  const { now, rows } = readRows('quakes-data');
  let hits: Hit[] = [];
  const render = () => (hits = draw(cv, rows, now));
  render();
  redrawOn(render);

  const find = (e: MouseEvent) => {
    const r = cv.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    let best: Hit | null = null;
    let bd = 26 * 26;
    for (const h of hits) {
      const d = (h.x - x) ** 2 + ((h.y - y) * 1.6) ** 2;
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  };
  cv.addEventListener('mousemove', (e) => {
    const h = find(e);
    if (h) showTip(rowTip(h.q), e.clientX, e.clientY);
    else hideTip();
    cv.style.cursor = h?.q.u ? 'pointer' : 'crosshair';
  });
  cv.addEventListener('mouseleave', hideTip);
  cv.addEventListener('click', (e) => {
    const h = find(e);
    if (h?.q.u) location.href = h.q.u;
  });
}
