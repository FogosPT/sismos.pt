import { geoMercator, type GeoProjection } from 'd3-geo';
import { select, type Selection } from 'd3-selection';
import { zoom, zoomIdentity, zoomTransform } from 'd3-zoom';
import geo from '../data/geo.json';
import { radius } from '../lib/format';
import { EXTENT, PLACES } from '../lib/region';
import type { Row } from '../lib/summary';
import type { PtRegion } from '../lib/types';
import { hideTip, readRows, redrawOn, rowTip, showTip } from './ui';

const DAY = 864e5;
type Ring = [number, number][];
const COAST = geo.COAST as unknown as Record<PtRegion, Ring[]>;
const BORDERS = geo.BORDERS as unknown as Ring[];
const PLATES = geo.PLATES as unknown as Ring[];

function projectionFor(r: PtRegion, w: number, h: number, pad: number): GeoProjection {
  const b = EXTENT[r];
  return geoMercator().fitExtent([[pad, pad], [w - pad, h - pad]], { type: 'MultiPoint', coordinates: [[b[0], b[1]], [b[2], b[3]]] });
}

const ringPath = (rings: Ring[], p: GeoProjection, close = true) =>
  rings.map((r) => 'M' + r.map((c) => p(c)!.map((v) => v.toFixed(1)).join(',')).join('L') + (close ? 'Z' : '')).join('');

function graticule(g: Selection<SVGGElement, unknown, null, undefined>, p: GeoProjection, w: number, h: number, bleed = 0) {
  const [x0, y1] = p.invert!([0, 0])!;
  const [x1, y0] = p.invert!([w, h])!;
  for (let lo = Math.ceil(x0); lo <= x1; lo++) {
    const x = p([lo, 0])![0];
    g.append('line').attr('class', 'grat').attr('x1', x).attr('x2', x).attr('y1', -bleed * h).attr('y2', (1 + bleed) * h);
  }
  for (let la = Math.ceil(y0); la <= y1; la++) {
    const y = p([0, la])![1];
    g.append('line').attr('class', 'grat').attr('x1', -bleed * w).attr('x2', (1 + bleed) * w).attr('y1', y).attr('y2', y);
  }
}

/* ---------- home: locator of the latest earthquake ---------- */

function drawLocator(el: SVGSVGElement, q: Row, rows: Row[]) {
  const r = q.r as PtRegion;
  const w = 640;
  const h = el.getBoundingClientRect().width < 500 ? 480 : 512;
  const svg = select(el).attr('viewBox', `0 0 ${w} ${h}`);
  svg.selectAll('*').remove();
  const p = projectionFor(r, w, h, 28);
  graticule(svg.append('g'), p, w, h);
  svg.append('path').attr('class', 'land').attr('d', ringPath(COAST[r], p));
  if (r === 'continente') svg.append('path').attr('class', 'border').attr('d', ringPath(BORDERS, p, false));

  const lab = svg.append('g');
  PLACES[r].filter((x) => !x[3]).slice(0, 4).forEach(([n, lo, la]) => {
    const [x, y] = p([lo, la])!;
    lab.append('circle').attr('cx', x).attr('cy', y).attr('r', 1.8).style('fill', 'var(--muted)');
    lab.append('text').attr('class', 'mlabel').attr('x', x + 6).attr('y', y + 3.5).text(n);
  });

  const g = svg.append('g');
  rows.filter((x) => x !== q && x.r === r && q.t - x.t < 7 * DAY && x.t <= q.t).forEach((x) => {
    const [cx, cy] = p([x.lon, x.lat])!;
    g.append('circle').attr('class', 'q-ring').attr('cx', cx).attr('cy', cy).attr('r', radius(x.m)).style('stroke', 'var(--ink-2)').style('opacity', 0.28);
  });

  const [cx, cy] = p([q.lon, q.lat])!;
  const rr = radius(q.m);
  const m = svg.append('g').attr('transform', `translate(${cx},${cy})`);
  m.append('circle').attr('class', 'pulse').attr('r', rr);
  m.append('circle').attr('class', 'q-ring').attr('r', rr).style('stroke', 'var(--signal)');
  m.append('circle').attr('class', 'q-ring').attr('r', rr * 0.55).style('stroke', 'var(--signal)').style('opacity', 0.8);
  m.append('circle').attr('class', 'q-core').attr('r', 2.2).style('fill', 'var(--signal)');
}

/* ---------- region page: full map ---------- */

const state = { color: 'age' as 'age' | 'depth', plates: true, heat: false, felt: false };

function colour(q: Row, now: number) {
  if (state.color === 'depth') return { c: 'var(--signal)', o: 1 - 0.78 * Math.min((q.d ?? 0) / 30, 1) };
  const age = (now - q.t) / DAY;
  return age < 1 ? { c: 'var(--signal)', o: 1 } : { c: 'var(--ink-2)', o: Math.max(0.22, 1 - (age / 30) * 0.8) };
}

function drawRegion(el: SVGSVGElement, r: PtRegion, all: Row[], now: number) {
  const box = el.parentElement!;
  const w = box.clientWidth;
  const h = box.clientHeight;
  const small = w < 600;
  // Redraws (layers, colour, theme, resize) keep the reader's zoom and pan.
  const previous = zoomTransform(el);
  const svg = select(el).attr('viewBox', `0 0 ${w} ${h}`);
  svg.selectAll('*').remove();
  const p = projectionFor(r, w, h, small ? 20 : 48);
  svg.append('defs').html(`<filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${small ? 7 : 11}"/></filter>`);
  const g = svg.append('g');
  graticule(g.append('g'), p, w, h, 1);
  g.append('path').attr('class', 'land').attr('d', ringPath(COAST[r], p));
  if (r === 'continente') g.append('path').attr('class', 'border').attr('d', ringPath(BORDERS, p, false));
  const plates = g.append('path').attr('class', 'plate').attr('d', ringPath(PLATES, p, false)).style('display', state.plates ? '' : 'none');

  const qs = all.filter((q) => !state.felt || q.felt).slice().sort((a, b) => a.t - b.t);
  const heatR = small ? 10 : 16;
  const heat = g.append('g').attr('filter', 'url(#blur)').style('display', state.heat ? '' : 'none');
  qs.forEach((q) => {
    const [x, y] = p([q.lon, q.lat])!;
    heat.append('circle').attr('cx', x).attr('cy', y).attr('r', heatR).style('fill', 'var(--signal)').style('opacity', 0.18);
  });

  const lab = g.append('g');
  PLACES[r].forEach(([n, lo, la, area]) => {
    const [x, y] = p([lo, la])!;
    const t = lab.append('g').attr('class', 'lb').attr('data-x', x).attr('data-y', y).attr('transform', `translate(${x},${y})`);
    if (!area) t.append('circle').attr('r', 1.8).style('fill', 'var(--muted)');
    t.append('text').attr('class', 'mlabel').attr('x', area ? 0 : 6).attr('y', area ? 0 : 3.5).attr('text-anchor', area ? 'middle' : 'start').text(n);
  });

  const latest = qs.at(-1);
  const nodes = g.append('g').selectAll<SVGGElement, Row>('g').data(qs).join('g')
    .attr('class', 'qg')
    .attr('data-x', (d) => p([d.lon, d.lat])![0])
    .attr('data-y', (d) => p([d.lon, d.lat])![1])
    .attr('transform', (d) => `translate(${p([d.lon, d.lat])!.join(',')})`);
  nodes.each(function (d) {
    const s = select(this);
    const { c, o } = colour(d, now);
    const rr = radius(d.m);
    s.append('circle').attr('class', 'q-ring').attr('r', rr).style('stroke', c).style('opacity', o);
    if (rr > 9) s.append('circle').attr('class', 'q-ring').attr('r', rr * 0.55).style('stroke', c).style('opacity', o * 0.8);
    s.append('circle').attr('class', 'q-core').attr('r', 1.8).style('fill', c).style('opacity', Math.min(1, o + 0.2));
    if (d === latest && now - d.t < 5 * DAY) s.append('circle').attr('class', 'pulse').attr('r', rr);
    s.append('circle').attr('class', 'q-hit').attr('r', Math.max(rr, 10));
  });
  nodes.on('mousemove', (e: MouseEvent, d) => showTip(rowTip(d), e.clientX, e.clientY)).on('mouseleave', hideTip);

  // Zoom keeps markers and labels at constant size.
  const behaviour = zoom<SVGSVGElement, unknown>().scaleExtent([1, 12]).translateExtent([[-w * 0.2, -h * 0.2], [w * 1.2, h * 1.2]]).on('zoom', (e) => {
      const t = e.transform;
      g.attr('transform', t);
      g.selectAll<SVGGElement, unknown>('.qg,.lb').attr('transform', function () {
        return `translate(${this.dataset.x},${this.dataset.y}) scale(${1 / t.k})`;
      });
      heat.selectAll('circle').attr('r', heatR / t.k);
    });
  svg.call(behaviour).on('dblclick.zoom', null);
  if (previous !== zoomIdentity && (previous.k !== 1 || previous.x !== 0 || previous.y !== 0)) {
    svg.call(behaviour.transform, previous);
  }

  const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
  $('ly-plates').checked = state.plates;
  $('ly-heat').checked = state.heat;
  $('ly-felt').checked = state.felt;
  $('ly-plates').onchange = (e) => { state.plates = (e.target as HTMLInputElement).checked; plates.style('display', state.plates ? '' : 'none'); };
  $('ly-heat').onchange = (e) => { state.heat = (e.target as HTMLInputElement).checked; heat.style('display', state.heat ? '' : 'none'); };
  $('ly-felt').onchange = (e) => { state.felt = (e.target as HTMLInputElement).checked; drawRegion(el, r, all, now); };
  document.querySelectorAll<HTMLButtonElement>('.layers .seg button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.color === state.color));
    b.onclick = () => { state.color = b.dataset.color as 'age' | 'depth'; drawRegion(el, r, all, now); };
  });

  const ms = [2, 3, 4];
  let x = 0;
  let circles = '';
  ms.forEach((m) => {
    const rr = radius(m);
    x += rr;
    circles += `<circle cx="${x}" cy="${radius(4) * 2 - rr}" r="${rr}" fill="none" style="stroke:var(--ink-2)" stroke-width="1"/><text x="${x}" y="${radius(4) * 2 + 13}" text-anchor="middle" style="fill:var(--muted);font-family:var(--mono);font-size:11px">M${m}</text>`;
    x += rr + 18;
  });
  document.getElementById('legend')!.innerHTML = `<svg width="${x}" height="${radius(4) * 2 + 16}">${circles}</svg><span class="lg-age"><i></i>${state.color === 'age' ? '24 h → 30 dias' : 'superficial → 30 km'}</span>`;
}

/* ---------- wiring ---------- */

const { now, rows } = readRows('quakes-data');

const locator = document.getElementById('nowmap') as SVGSVGElement | null;
if (locator && rows.length) {
  const latest = rows.find((q) => q.r !== 'outro');
  if (latest) {
    const render = () => drawLocator(locator, latest, rows);
    render();
    redrawOn(render);
  }
}

const regionMap = document.getElementById('map') as SVGSVGElement | null;
if (regionMap) {
  const r = regionMap.dataset.region as PtRegion;
  const render = () => drawRegion(regionMap, r, rows, now);
  render();
  redrawOn(render);

  const btn = document.getElementById('layersbtn')!;
  const panel = document.getElementById('layerspanel')!;
  btn.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.layers')) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });
}
