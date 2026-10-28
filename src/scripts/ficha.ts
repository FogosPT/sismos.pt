import { scaleSymlog } from 'd3-scale';
import { create } from 'd3-selection';
import { depthKnown, fmtMag, num, radius } from '../lib/format';
import { latencyLabel } from '../lib/detail';
import type { PtRegion, Region } from '../lib/types';
import { COAST, coastFor, projectionAround, projectionFor, ringPath } from './geo';
import { redrawOn } from './ui';

interface FichaData {
  q: { t: number; lat: number; lon: number; d: number | null; m: number | null; r: Region };
  moho: number;
  sources: { name: string; d: number | null; m: number | null; mt: string | null; latency: number | null; preferred: boolean }[];
}

const el = document.getElementById('ficha-data');
const data: FichaData | null = el ? JSON.parse(el.textContent || 'null') : null;

/** Vertical cross-section: surface, Moho, hypocentre (and other catalogues' depths). */
function drawXsec(box: HTMLElement, f: FichaData) {
  const { q, moho } = f;
  const W = Math.max(300, box.clientWidth || 480);
  const H = Math.round(Math.min(420, W * 0.78));
  const others = f.sources.filter((s) => !s.preferred && depthKnown(s.d)).map((s) => s.d as number);
  const d = depthKnown(q.d) ? q.d : 0;
  const maxD = Math.max(Math.ceil((Math.max(d, moho, ...others) * 1.35) / 10) * 10, 20);
  const top = 70;
  const bot = H - 24;
  const y = (v: number) => top + (v / maxD) * (bot - top);
  const cx = W * 0.5;
  const svg = create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('aria-hidden', 'true');

  const surf: [number, number][] = [];
  for (let x = 0; x <= W; x += 4) surf.push([x, top + Math.sin(x / 37) * 2.2 + Math.sin(x / 11 + 1) * 1.1]);
  const line = 'M' + surf.map((p) => p.join(',')).join('L');
  svg.append('path').attr('d', `${line}L${W},${bot}L0,${bot}Z`).style('fill', 'var(--bg-2)').style('opacity', 0.6);
  svg.append('path').attr('d', line).style('fill', 'none').style('stroke', 'var(--ink-2)').style('stroke-width', 1.5);
  for (let k = 10; k < maxD; k += 10) {
    svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(k)).attr('y2', y(k)).style('stroke', 'var(--rule)').style('stroke-dasharray', '1 4');
    svg.append('text').attr('x', W).attr('y', y(k) - 5).attr('text-anchor', 'end').text(`${k} km`);
  }
  svg.append('line').attr('x1', 0).attr('x2', W).attr('y1', y(moho)).attr('y2', y(moho)).style('stroke', 'var(--ink-2)').style('stroke-dasharray', '6 4').style('opacity', 0.6);
  svg.append('text').attr('class', 'lab').attr('x', 0).attr('y', y(moho) + 16).text(`Moho, ≈ ${moho} km`);
  svg.append('text').attr('class', 'lab').attr('x', 0).attr('y', top - 14).text('superfície');
  svg.append('g').attr('transform', `translate(${cx - 10},${top - 34})`).html('<use href="#i-epicentro" width="20" height="20" style="stroke:var(--ink);fill:none;stroke-width:1.5"/>');
  svg.append('text').attr('class', 'lab').attr('x', cx + 16).attr('y', top - 20).text('epicentro');

  if (!depthKnown(q.d)) {
    svg.append('text').attr('class', 'hyl').attr('x', cx).attr('y', top + 48).attr('text-anchor', 'middle').text('profundidade não determinada');
    box.replaceChildren(svg.node()!);
    return;
  }

  svg.append('line').attr('x1', cx).attr('x2', cx).attr('y1', top + 3).attr('y2', y(d) - 6).style('stroke', 'var(--signal)').style('stroke-dasharray', '2 4');
  // Other catalogues' depths, grouped when they agree ("EMSC · USGS · GFZ 10 km").
  const byDepth = new Map<number, string[]>();
  f.sources.filter((s) => !s.preferred && depthKnown(s.d) && Math.abs((s.d as number) - d) >= 1).forEach((s) => {
    const k = Math.round(s.d as number);
    byDepth.set(k, [...(byDepth.get(k) ?? []), s.name]);
  });
  [...byDepth].slice(0, 3).forEach(([k, names]) => {
    const yy = y(k);
    svg.append('circle').attr('cx', cx).attr('cy', yy).attr('r', 5).style('fill', 'none').style('stroke', 'var(--muted)').style('stroke-dasharray', '2 2');
    svg.append('text').attr('x', cx - 14).attr('y', yy + 4).attr('text-anchor', 'end').text(`${names.join(' · ')} ${k} km`);
  });
  [30, 17].forEach((rr, k) => svg.append('circle').attr('cx', cx).attr('cy', y(d)).attr('r', rr).style('fill', 'none').style('stroke', 'var(--signal)').style('opacity', k ? 0.45 : 0.22));
  svg.append('circle').attr('cx', cx).attr('cy', y(d)).attr('r', 5).style('fill', 'var(--signal)');
  const shallow = y(d) - top < 40;
  svg.append('text').attr('class', 'hyl').attr('x', cx + (shallow ? 0 : 40)).attr('y', shallow ? y(d) + 58 : y(d) + 7).attr('text-anchor', shallow ? 'middle' : 'start').text(`hipocentro · ${num(d, 0)} km`);
  box.replaceChildren(svg.node()!);
}

/** When each catalogue reached sismos.pt, on a log time axis (live events only). */
function drawTimeline(box: HTMLElement, f: FichaData) {
  const rows = f.sources.filter((s) => s.latency != null);
  if (!rows.length) return;
  const W = Math.max(300, box.clientWidth || 600);
  const narrow = W < 560;
  const dmax = Math.max(36e5, ...rows.map((s) => s.latency as number));
  const L = narrow ? 70 : 110;
  const x = scaleSymlog().constant(6e4).domain([0, dmax]).range([L, W - 20]);
  const rh = narrow ? 46 : 40;
  const H = (rows.length + 1) * rh + 36;
  const svg = create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Tempo até cada fonte publicar o sismo');
  const ticks: [number, string][] = [[0, '0'], [6e4, '1 min'], [6e5, '10 min'], [36e5, '1 h'], [6 * 36e5, '6 h']];
  ticks.filter(([v]) => v <= dmax * 1.05).forEach(([v, l]) => {
    svg.append('line').attr('x1', x(v)).attr('x2', x(v)).attr('y1', 8).attr('y2', H - 26).style('stroke', 'var(--grid)');
    svg.append('text').attr('x', x(v)).attr('y', H - 8).attr('text-anchor', 'middle').text(l);
  });
  const all = [{ name: 'Origem', latency: 0, m: null as number | null, mt: null as string | null }, ...rows];
  all.forEach((s, k) => {
    const yy = 24 + k * rh;
    const xx = x(s.latency as number);
    svg.append('text').attr('class', 'src').attr('x', 0).attr('y', yy + 4).text(s.name);
    if (k) svg.append('line').attr('x1', L).attr('x2', xx).attr('y1', yy).attr('y2', yy).style('stroke', 'var(--rule)');
    svg.append('circle').attr('cx', xx).attr('cy', yy).attr('r', k ? 5 : 4).style('fill', k ? 'var(--signal)' : 'var(--ink)');
    const right = xx > W * 0.62;
    const label = k ? `+${latencyLabel(s.latency as number)} · M ${fmtMag(s.m)} ${s.mt ?? ''}` : 'o sismo ocorre';
    svg.append('text').attr('class', 'val').attr('x', right ? xx - 10 : xx + 10).attr('y', yy + (narrow ? 18 : 4)).attr('text-anchor', right ? 'end' : 'start').text(label);
  });
  box.replaceChildren(svg.node()!);
}

function drawLocator(box: HTMLElement, f: FichaData) {
  const W = Math.min(640, Math.max(300, box.clientWidth || 520));
  const H = Math.round(W * 0.62);
  // Outside the three regions there is no fixed extent: centre on the epicentre.
  const outside = f.q.r === 'outro';
  const r = outside ? coastFor(f.q.lat, f.q.lon) : (f.q.r as PtRegion);
  const p = outside ? projectionAround(f.q.lat, f.q.lon, W, H, 16, 5) : projectionFor(r, W, H, 16);
  const svg = create('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', 'Localização do epicentro')
    .style('display', 'block').style('width', '100%').style('max-width', `${W}px`).style('height', 'auto');
  svg.append('clipPath').attr('id', 'loc-clip').append('rect').attr('width', W).attr('height', H);
  svg.append('path').attr('class', 'land').attr('clip-path', 'url(#loc-clip)').attr('d', ringPath(COAST[r], p));
  const [x, y] = p([f.q.lon, f.q.lat])!;
  const rr = radius(f.q.m);
  [rr, rr * 0.55].forEach((v) => svg.append('circle').attr('cx', x).attr('cy', y).attr('r', v).style('fill', 'none').style('stroke', 'var(--signal)'));
  svg.append('circle').attr('cx', x).attr('cy', y).attr('r', 2.2).style('fill', 'var(--signal)');
  box.replaceChildren(svg.node()!);
}

if (data) {
  const render = () => {
    const xs = document.getElementById('xsec');
    const tl = document.getElementById('tl');
    const loc = document.getElementById('loc');
    if (xs) drawXsec(xs, data);
    if (tl) drawTimeline(tl, data);
    if (loc) drawLocator(loc, data);
  };
  render();
  redrawOn(render);
}
