import { dayMonth, depthLong, fmtMag, hm, magTypeLabel, placeName } from './format';
import { REGION_NAME, TIMEZONE_NAME } from './region';
import type { Earthquake } from './types';

/** Minimal element objects for satori (no React needed). */
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Node => ({
  type,
  props: { style: { display: 'flex', ...style }, children, ...extra },
});

const C = { bg: '#151412', ink: '#ECE8DF', ink2: '#B9B3A7', muted: '#857F74', rule: '#2E2C28', signal: '#FF6B42', trace: '#9A9488' };

/** A seismogram-like trace with one burst, as a data-URI SVG. */
function trace(width: number, height: number, burstAt: number, amplitude: number): string {
  const mid = height / 2;
  let d = `M0,${mid}`;
  let red = '';
  for (let x = 0; x <= width; x += 3) {
    const u = (x - burstAt) / (width * 0.22);
    const env = u < 0 || u > 1 ? 0 : u < 0.08 ? (u / 0.08) * 0.35 : u < 0.14 ? 0.35 + ((u - 0.08) / 0.06) * 0.65 : Math.exp(-(u - 0.14) * 5);
    const noise = Math.sin(x * 12.9898) * 43758.5453;
    const n = noise - Math.floor(noise) - 0.5;
    const y = mid + n * 3 + env * amplitude * (Math.sin(x * 0.9) + n);
    if (env > 0.02) red += `${red ? 'L' : 'M'}${x},${y.toFixed(1)}`;
    d += `L${x},${y.toFixed(1)}`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path d="${d}" fill="none" stroke="${C.trace}" stroke-width="1.4" opacity=".7"/><path d="${red}" fill="none" stroke="${C.signal}" stroke-width="1.8"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function quakeCard(q: Earthquake): Node {
  const t = Date.parse(q.time);
  const r = q.region;
  const where = r === 'outro' ? placeName(q.place) : `${placeName(q.place)}, ${REGION_NAME[r]}`;
  const m = q.magnitude == null ? '?' : fmtMag(q.magnitude);
  const amp = q.magnitude == null ? 20 : Math.min(70, 8 * Math.pow(1.5, q.magnitude));

  return h('div', { width: '100%', height: '100%', background: C.bg, color: C.ink, flexDirection: 'column', padding: '56px 72px', fontFamily: 'Geist Mono' }, [
    h('div', { justifyContent: 'space-between', alignItems: 'center', fontSize: 26, color: C.ink2 }, [
      h('div', { fontFamily: 'Fraunces', fontSize: 40, color: C.ink }, ['sismos', h('span', { color: C.signal }, '.'), 'pt']),
      h('div', {}, 'VOST Portugal'),
    ]),
    h('div', { flex: 1, alignItems: 'center', gap: 56 }, [
      h('div', { fontFamily: 'Fraunces', fontSize: 250, lineHeight: 1, color: q.magnitude == null ? C.muted : C.signal, letterSpacing: -6 }, m),
      h('div', { flexDirection: 'column', gap: 18, flex: 1 }, [
        h('div', { fontFamily: 'Fraunces', fontSize: 56, lineHeight: 1.1, color: C.ink }, where),
        h('div', { fontSize: 28, color: C.ink2 }, `${dayMonth(t, r)} · ${hm(t, r)} ${TIMEZONE_NAME[r]} · ${magTypeLabel(q.magType)}`),
        h('div', { fontSize: 26, color: C.muted }, `profundidade ${depthLong(q.depth)}${q.felt ? ` · sentido${q.intensity ? ` (${q.intensity})` : ''}` : ''}`),
      ]),
    ]),
    h('img', { width: 1056, height: 90 }, undefined, { src: trace(1056, 90, 360, amp), width: 1056, height: 90 }),
  ]);
}

export function siteCard(): Node {
  return h('div', { width: '100%', height: '100%', background: C.bg, color: C.ink, flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', fontFamily: 'Geist Mono' }, [
    h('div', { justifyContent: 'space-between', fontSize: 26, color: C.ink2 }, [h('div', {}, 'VOST Portugal'), h('div', {}, 'ao vivo')]),
    h('div', { flexDirection: 'column', gap: 18 }, [
      h('div', { fontFamily: 'Fraunces', fontSize: 150, lineHeight: 1 }, ['sismos', h('span', { color: C.signal }, '.'), 'pt']),
      h('div', { fontSize: 32, color: C.ink2 }, 'Sismos em Portugal Continental, Açores e Madeira'),
    ]),
    h('img', { width: 1056, height: 90 }, undefined, { src: trace(1056, 90, 640, 40), width: 1056, height: 90 }),
  ]);
}
