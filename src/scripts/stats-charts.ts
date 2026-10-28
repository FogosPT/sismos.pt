import { max as d3max, range } from 'd3-array';
import { axisBottom, axisLeft } from 'd3-axis';
import { scaleBand, scaleLinear, scaleLog, scaleTime } from 'd3-scale';
import { pointer, select, type Selection } from 'd3-selection';
import { area, curveStepAfter, line } from 'd3-shape';
import { num } from '../lib/format';
import type { SeismicStats } from '../lib/stats/types';
import { hideTip, redrawOn, showTip } from './ui';

/**
 * Charts of /estatisticas, drawn from the stats document embedded as
 * #stats-data. One series each, in the signal colour; text stays in ink
 * tokens; hairline recessive axes; hover tooltips on every mark.
 */

type Svg = Selection<SVGSVGElement, unknown, null, undefined>;

function box(id: string, ratio: number, maxH: number) {
  const el = document.getElementById(id);
  if (!el) return null;
  const W = Math.max(300, el.clientWidth || 600);
  const H = Math.round(Math.min(maxH, W * ratio));
  const svg = select(el).selectAll<SVGSVGElement, unknown>('svg').data([null]).join('svg') as unknown as Svg;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').selectAll('*').remove();
  return { el, svg, W, H };
}

const axisStyle = (g: Selection<SVGGElement, unknown, null, undefined>) => {
  g.attr('class', 'ax');
  g.select('.domain').remove();
  g.selectAll('.tick line').remove();
};

function gridY(svg: Svg, y: (v: number) => number, ticks: number[], x0: number, x1: number) {
  ticks.forEach((v) => svg.append('line').attr('class', 'gridl').attr('x1', x0).attr('x2', x1).attr('y1', y(v)).attr('y2', y(v)));
}

/** "2026-10-03T…" | "2026-10" | "2026" → Date (UTC). */
function parseT(t: string): Date {
  if (/^\d{4}$/.test(t)) return new Date(Date.UTC(+t, 0, 1));
  if (/^\d{4}-\d{2}$/.test(t)) return new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, 1));
  return new Date(t);
}

function energyUnit(maxJ: number) {
  if (maxJ >= 1e15) return { div: 1e15, label: 'PJ' };
  if (maxJ >= 1e12) return { div: 1e12, label: 'TJ' };
  return { div: 1e9, label: 'GJ' };
}

/* ---------- Gutenberg-Richter ---------- */
function drawGR(s: SeismicStats) {
  const b = box('c-gr', 0.62, 400);
  if (!b || !s.magnitude.cumulative.length) return;
  const { svg, W, H } = b;
  svg.attr('aria-label', 'Distribuição de magnitudes, escala logarítmica');
  const m = { l: 44, r: 14, t: 22, b: 36 };
  const cum = s.magnitude.cumulative;
  const hist = s.magnitude.histogram;
  const mMin = Math.floor(Math.min(...cum.map((d) => d.m)));
  const mMax = Math.ceil(Math.max(...cum.map((d) => d.m)) + 0.1);
  const x = scaleLinear().domain([mMin, mMax]).range([m.l, W - m.r]);
  const top = Math.pow(10, Math.ceil(Math.log10(d3max(cum, (d) => d.n) ?? 10)));
  const y = scaleLog().domain([0.8, top]).range([H - m.b, m.t]).clamp(true);
  const decades = range(0, Math.log10(top) + 1).map((k) => Math.pow(10, k));
  gridY(svg, y, decades, m.l, W - m.r);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(axisLeft(y).tickValues(decades).tickFormat((d) => num(+d, 0))).call(axisStyle);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(axisBottom(x).ticks(mMax - mMin).tickFormat((d) => `M${d}`)).call(axisStyle);
  svg.append('text').attr('class', 'alab').attr('x', m.l).attr('y', m.t - 8).text('sismos com magnitude ≥ M (escala logarítmica)');

  // Non-cumulative histogram as recessive columns.
  const bw = Math.max(2, Math.min(24, x(0.1) - x(0) - 2));
  hist.forEach((d) => {
    svg.append('rect').attr('x', x(d.m) - bw / 2).attr('width', bw).attr('y', y(d.n)).attr('height', Math.max(0, y(0.8) - y(d.n))).style('fill', 'var(--bg-2)');
  });

  const gr = s.gutenbergRichter;
  if (gr) {
    const nMc = cum.find((d) => Math.abs(d.m - gr.mc) < 1e-6)?.n ?? gr.n;
    const fit = (mag: number) => nMc * Math.pow(10, -gr.b * (mag - gr.mc));
    const mEnd = Math.min(mMax, gr.mc + Math.log10(nMc / 0.8) / gr.b);
    svg.append('line').attr('x1', x(gr.mc)).attr('x2', x(mEnd)).attr('y1', y(fit(gr.mc))).attr('y2', y(fit(mEnd))).style('stroke', 'var(--signal)').style('stroke-width', 2).style('stroke-linecap', 'round');
    svg.append('line').attr('x1', x(gr.mc)).attr('x2', x(gr.mc)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--ink-2)').style('stroke-dasharray', '2 3');
    svg.append('text').attr('class', 'ann').attr('x', x(gr.mc) + 6).attr('y', m.t + 12).text(`Mc ${num(gr.mc, 1)} · b ${num(gr.b, 2)}`);
  }

  cum.forEach((d) => {
    svg.append('circle').attr('cx', x(d.m)).attr('cy', y(d.n)).attr('r', 3).style('fill', 'var(--ink)').style('stroke', 'var(--bg)').style('stroke-width', 1.5);
    svg.append('circle').attr('cx', x(d.m)).attr('cy', y(d.n)).attr('r', 9).style('fill', 'transparent')
      .on('mousemove', (e: MouseEvent) => showTip(`<b>${num(d.n, 0)}</b>sismos<span class="mono">com magnitude ≥ ${num(d.m, 1)}</span>`, e.clientX, e.clientY))
      .on('mouseleave', hideTip);
  });
}

/* ---------- Energia libertada ---------- */
function drawEnergy(s: SeismicStats) {
  const b = box('c-energia', 0.58, 380);
  const pts = s.energy.cumulative;
  if (!b || !pts.length) return;
  const { svg, W, H } = b;
  svg.attr('aria-label', 'Energia sísmica libertada ao longo do período');
  const m = { l: 52, r: 16, t: 22, b: 36 };
  const unit = energyUnit(s.energy.totalJ);
  const t0 = s.from ? new Date(s.from) : parseT(pts[0].t);
  const t1 = new Date(s.to);
  const series: [Date, number][] = [[t0, 0], ...pts.map((p) => [parseT(p.t), p.energyJ / unit.div] as [Date, number]), [t1, s.energy.totalJ / unit.div]];
  const x = scaleTime().domain([t0, t1]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, s.energy.totalJ / unit.div]).nice().range([H - m.b, m.t]);
  gridY(svg, y, y.ticks(4), m.l, W - m.r);
  // pt-PT dates (d3's default formatter is English): "4 out" for short windows, the year for long ones.
  const longSpan = t1.getTime() - t0.getTime() > 2 * 365.25 * 864e5;
  const fmt = new Intl.DateTimeFormat('pt-PT', longSpan ? { year: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'short', timeZone: 'UTC' });
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(axisBottom(x).ticks(W < 560 ? 3 : 5).tickFormat((d) => fmt.format(d as Date).replace('.', ''))).call(axisStyle);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(axisLeft(y).ticks(4).tickFormat((d) => num(+d, 0))).call(axisStyle);
  svg.append('text').attr('class', 'alab').attr('x', m.l).attr('y', m.t - 8).text(`energia libertada, soma ao longo do período (${unit.label})`);

  const xa = (d: [Date, number]) => x(d[0]);
  const ya = (d: [Date, number]) => y(d[1]);
  svg.append('path').attr('d', area<[Date, number]>().curve(curveStepAfter).x(xa).y0(y(0)).y1(ya)(series)).style('fill', 'var(--signal-soft)');
  svg.append('path').attr('d', line<[Date, number]>().curve(curveStepAfter).x(xa).y(ya)(series)).style('fill', 'none').style('stroke', 'var(--signal)').style('stroke-width', 2);

  const maxQ = s.magnitude.max;
  if (maxQ?.magnitude != null) {
    const tm = new Date(maxQ.time);
    const after = series.find((p) => p[0] >= tm) ?? series[series.length - 1];
    const cx = x(tm);
    const cy = y(after[1]);
    svg.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 4.5).style('fill', 'var(--signal)').style('stroke', 'var(--bg)').style('stroke-width', 2);
    const left = cx > W * 0.6;
    svg.append('text').attr('class', 'ann').attr('x', cx + (left ? -10 : 10)).attr('y', cy + (cy < m.t + 20 ? 16 : -8)).attr('text-anchor', left ? 'end' : 'start').text(`M${num(maxQ.magnitude, 1)}`);
  }

  const cross = svg.append('line').style('stroke', 'var(--ink-2)').style('display', 'none').attr('y1', m.t).attr('y2', H - m.b);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
    .on('mousemove', (e: MouseEvent) => {
      const [mx] = pointer(e, svg.node());
      const t = x.invert(mx);
      let v = 0;
      for (const p of series) if (p[0] <= t) v = p[1];
      cross.style('display', null).attr('x1', mx).attr('x2', mx);
      showTip(`<b>${num(v, v < 10 ? 1 : 0)}</b>${unit.label} libertados<span class="mono">até ${t.toLocaleDateString('pt-PT')}</span>`, e.clientX, e.clientY);
    })
    .on('mouseleave', () => {
      cross.style('display', 'none');
      hideTip();
    });
}

/* ---------- Profundidade ---------- */
function drawDepth(s: SeismicStats) {
  const bins = s.depth.histogram.filter((d) => d.n > 0 || (d.to ?? 999) <= 60);
  const b = box('c-profundidade', 0.62, 420);
  if (!b || !bins.length) return;
  const { svg, W } = b;
  const rowH = 22;
  const m = { l: 64, r: 44, t: 24, b: 8 };
  const H = m.t + bins.length * rowH + m.b;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('aria-label', 'Sismos por profundidade');
  const label = (d: { from: number; to: number | null }) => (d.to == null ? `> ${d.from} km` : `${d.from}–${d.to} km`);
  const yb = scaleBand<string>().domain(bins.map(label)).range([m.t, H - m.b]).paddingInner(0.3);
  const x = scaleLinear().domain([0, d3max(bins, (d) => d.n) ?? 1]).range([m.l, W - m.r]);
  svg.append('text').attr('class', 'alab').attr('x', m.l).attr('y', m.t - 10).text('superfície');
  const bh = Math.min(16, yb.bandwidth());
  bins.forEach((d) => {
    const yy = yb(label(d))! + (yb.bandwidth() - bh) / 2;
    const shallow = d.to != null && d.to <= 10;
    const w = x(d.n) - m.l;
    const r = Math.min(4, bh / 2, w);
    svg.append('text').attr('class', 'ax').attr('x', m.l - 8).attr('y', yy + bh / 2 + 4).attr('text-anchor', 'end').style('font-family', 'var(--mono)').style('font-size', '11px').style('fill', 'var(--muted)').text(label(d));
    if (d.n > 0) {
      svg.append('path').attr('d', `M${m.l},${yy}h${w - r}a${r},${r} 0 0 1 ${r},${r}v${bh - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${w - r}z`).style('fill', shallow ? 'var(--signal)' : 'var(--ink-2)').style('opacity', shallow ? 1 : 0.55);
    }
    svg.append('text').attr('class', 'ann').attr('x', m.l + w + 6).attr('y', yy + bh / 2 + 4).text(num(d.n, 0));
    svg.append('rect').attr('x', m.l).attr('y', yy - 3).attr('width', W - m.l - m.r).attr('height', bh + 6).style('fill', 'transparent')
      .on('mousemove', (e: MouseEvent) => showTip(`<b>${num(d.n, 0)}</b>sismos<span class="mono">${label(d)} de profundidade</span>`, e.clientX, e.clientY))
      .on('mouseleave', hideTip);
  });
}

/* ---------- Hora do dia ---------- */
function drawHour(s: SeismicStats) {
  const hours = s.timeOfDay.hours;
  const total = hours.reduce((a, b) => a + b, 0);
  const b = box('c-hora', 0.48, 320);
  if (!b || !total) return;
  const { svg, W, H } = b;
  svg.attr('aria-label', 'Sismos por hora do dia, hora local');
  const m = { l: 34, r: 8, t: 22, b: 32 };
  const x = scaleBand<number>().domain(range(24)).range([m.l, W - m.r]).paddingInner(0.25);
  const y = scaleLinear().domain([0, d3max(hours) ?? 1]).nice().range([H - m.b, m.t]);
  gridY(svg, y, y.ticks(3), m.l, W - m.r);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(axisLeft(y).ticks(3).tickFormat((d) => num(+d, 0))).call(axisStyle);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(axisBottom(x).tickValues([0, 6, 12, 18, 23]).tickFormat((d) => `${d}h`)).call(axisStyle);
  const bw = Math.min(24, x.bandwidth());
  hours.forEach((n, h) => {
    const hgt = y(0) - y(n);
    const r = Math.min(4, bw / 2, hgt);
    const x0 = x(h)! + (x.bandwidth() - bw) / 2;
    if (n) svg.append('path').attr('d', `M${x0},${y(0)}v-${hgt - r}a${r},${r} 0 0 1 ${r},-${r}h${bw - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${hgt - r}z`).style('fill', 'var(--ink-2)').style('opacity', 0.75);
    svg.append('rect').attr('x', x(h)! - 2).attr('width', x.bandwidth() + 4).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'transparent')
      .on('mousemove', (e: MouseEvent) => showTip(`<b>${num(n, 0)}</b>sismos<span class="mono">das ${h}h às ${h + 1}h</span>`, e.clientX, e.clientY))
      .on('mouseleave', hideTip);
  });
  const mean = total / 24;
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(mean)).attr('y2', y(mean)).style('stroke', 'var(--signal)').style('stroke-width', 1.5).style('stroke-dasharray', '5 3');
  svg.append('text').attr('class', 'ann').attr('x', W - m.r).attr('y', m.t - 8).attr('text-anchor', 'end').text('- - -  se fosse ao acaso');
}

/* ---------- Atividade face ao normal ---------- */
function drawRate(s: SeismicStats) {
  const r = s.rate;
  const b = box('c-atividade', 0.3, 170);
  if (!b || !r) return;
  const { svg, W } = b;
  const m = { l: 96, r: 52, t: 12, b: 8 };
  const rows = [
    { k: 'habitual', v: r.expected, c: 'var(--ink-2)', o: 0.55 },
    { k: 'este período', v: r.observed, c: 'var(--signal)', o: 1 },
  ];
  const H = m.t + rows.length * 44 + m.b;
  svg.attr('viewBox', `0 0 ${W} ${H}`).attr('aria-label', 'Sismos observados face ao habitual');
  const x = scaleLinear().domain([0, Math.max(r.observed, r.expected, 1)]).range([m.l, W - m.r]);
  rows.forEach((d, i) => {
    const yy = m.t + i * 44 + 8;
    const w = Math.max(2, x(d.v) - m.l);
    const rr = Math.min(4, w);
    svg.append('text').attr('x', m.l - 10).attr('y', yy + 13).attr('text-anchor', 'end').style('font-family', 'var(--sans)').style('font-size', '13px').style('fill', 'var(--ink-2)').text(d.k);
    svg.append('path').attr('d', `M${m.l},${yy}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${18 - 2 * rr}a${rr},${rr} 0 0 1 -${rr},${rr}h-${w - rr}z`).style('fill', d.c).style('opacity', d.o);
    svg.append('text').attr('class', 'ann').attr('x', m.l + w + 8).attr('y', yy + 13).text(num(d.v, d.v < 10 && d.v % 1 ? 1 : 0));
  });
}

/* ---------- Completude por ano ---------- */
function drawCompleteness(s: SeismicStats) {
  const years = (s.completenessByYear ?? []).filter((y) => y.mc != null);
  const b = box('c-completude', 0.45, 300);
  if (!b || years.length < 3) return;
  const { svg, W, H } = b;
  svg.attr('aria-label', 'Magnitude de completude por ano');
  const m = { l: 40, r: 14, t: 22, b: 32 };
  const x = scaleLinear().domain([years[0].year, years[years.length - 1].year]).range([m.l, W - m.r]);
  const y = scaleLinear().domain([0, Math.ceil(d3max(years, (d) => d.mc!) ?? 4)]).nice().range([H - m.b, m.t]);
  gridY(svg, y, y.ticks(4), m.l, W - m.r);
  svg.append('g').attr('transform', `translate(${m.l},0)`).call(axisLeft(y).ticks(4).tickFormat((d) => `M${num(+d, 0)}`)).call(axisStyle);
  svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(axisBottom(x).ticks(Math.min(6, years.length)).tickFormat((d) => String(d))).call(axisStyle);
  svg.append('text').attr('class', 'alab').attr('x', m.l).attr('y', m.t - 8).text('menor magnitude registada com segurança (Mc)');
  svg.append('path').attr('d', line<(typeof years)[number]>().x((d) => x(d.year)).y((d) => y(d.mc!))(years)).style('fill', 'none').style('stroke', 'var(--signal)').style('stroke-width', 2).style('stroke-linejoin', 'round');
  years.forEach((d) => {
    svg.append('circle').attr('cx', x(d.year)).attr('cy', y(d.mc!)).attr('r', 4).style('fill', 'var(--signal)').style('stroke', 'var(--bg)').style('stroke-width', 2);
    svg.append('circle').attr('cx', x(d.year)).attr('cy', y(d.mc!)).attr('r', 10).style('fill', 'transparent')
      .on('mousemove', (e: MouseEvent) => showTip(`<b>M${num(d.mc!, 1)}</b>${d.year}<span class="mono">${num(d.n, 0)} sismos${d.b != null ? ` · b ${num(d.b, 2)}` : ''}</span>`, e.clientX, e.clientY))
      .on('mouseleave', hideTip);
  });
}

const el = document.getElementById('stats-data');
if (el) {
  const s = JSON.parse(el.textContent || '{}') as SeismicStats;
  const render = () => {
    drawRate(s);
    drawGR(s);
    drawEnergy(s);
    drawDepth(s);
    drawHour(s);
    drawCompleteness(s);
  };
  render();
  redrawOn(render);
}
