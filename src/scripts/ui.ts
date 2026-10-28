import { dayMonth, depthShort, escapeHtml, fmtMag, hm, placeName } from '../lib/format';
import type { Region } from '../lib/types';
import type { Row } from '../lib/summary';

export const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function readRows(id: string): { now: number; rows: Row[] } {
  const el = document.getElementById(id);
  return el ? JSON.parse(el.textContent || '{}') : { now: Date.now(), rows: [] };
}

const tip = () => document.getElementById('tip') as HTMLElement;

export function showTip(html: string, x: number, y: number) {
  const el = tip();
  el.innerHTML = html;
  el.style.left = Math.min(Math.max(x, 140), innerWidth - 140) + 'px';
  el.style.top = y + 'px';
  el.classList.add('on');
}

export const hideTip = () => tip().classList.remove('on');

export const rowTip = (q: Row) =>
  `<b>${fmtMag(q.m)}</b>${escapeHtml(placeName(q.p))}<span class="mono">${dayMonth(q.t, q.r as Region)} · ${hm(q.t, q.r as Region)} · ${depthShort(q.d)}${q.felt ? ' · sentido' : ''}</span>`;

/** Re-run `draw` on resize and theme changes. */
export function redrawOn(draw: () => void) {
  let timer: number | undefined;
  addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(draw, 150) as unknown as number;
  });
  addEventListener('themechange', draw);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', draw);
}
