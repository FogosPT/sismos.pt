import {
  capitalise, dayMonth, depthKnown, depthLong, depthShort, escapeHtml, fmtMag, hm, num, placeName, relative, SOURCE_NAME, utcHm,
} from '../lib/format';
import { EMSC_WS, mergeRows, rowFromEmsc, sameEvent, unseen } from '../lib/live';
import { REGION_NAME, TIMEZONE_NAME } from '../lib/region';
import { toRows, type Row } from '../lib/summary';
import type { Catalogue, Region } from '../lib/types';
import { setRows, store } from './store';

/**
 * Realtime layer, on every page:
 *  - polls /api/latest.json every minute (fogosapi through the edge cache);
 *    when a new earthquake shows up the server-rendered fragments of the page
 *    (headline, lists, embedded rows) are fetched again and swapped in, so the
 *    markup stays the server's;
 *  - listens to the EMSC WebSocket, which is minutes ahead of the catalogues;
 *    an EMSC event we do not have yet is shown as "preliminar (EMSC)" until
 *    fogosapi has it;
 *  - keeps every "há X minutos" fresh and the header status honest.
 */

const POLL_MS = 60_000;
const page = document.body.dataset.page ?? '';
const scopeRegion = (document.getElementById('map') as SVGSVGElement | null)?.dataset.region;
const inScope = (q: Row) => (scopeRegion ? q.r === scopeRegion : q.r !== 'outro');

let authoritative: Row[] = store.rows.filter((q) => !q.prelim);
let prelim: Row[] = [];
let known: Row[] | null = null; // every Portuguese event seen so far (null until the first poll)
/** In-scope events the poll found but the page does not show yet; retried every poll until rendered. */
let pending: Row[] = [];
const toasted: Row[] = [];

/* ---------- header status ---------- */

const status = { ws: false, pollAt: 0, pollFailed: false, source: 'fogos' };

function renderStatus() {
  const el = document.querySelector<HTMLElement>('.status');
  if (!el) return;
  const label = el.querySelector<HTMLElement>('[data-live-label]');
  const when = el.querySelector<HTMLElement>('.when');
  const online = status.ws || (status.pollAt > 0 && Date.now() - status.pollAt < 3 * POLL_MS && !status.pollFailed);
  el.dataset.live = online ? 'on' : 'off';
  if (label) {
    label.textContent = !online ? 'sem ligação' : status.source !== 'fogos' ? `fonte alternativa: ${SOURCE_NAME[status.source] ?? status.source}` : 'ao vivo';
  }
  if (when && status.pollAt) when.textContent = `atualizado ${hm(status.pollAt, 'continente')}`;
}

/* ---------- toasts ---------- */

function toast(q: Row) {
  if (toasted.some((t) => sameEvent(t, q))) return;
  toasted.push(q);
  const box = document.getElementById('toasts');
  if (!box) return;

  const age = Date.now() - q.t;
  const when = age < 2 * 60_000 ? 'há instantes' : relative(q.t, Date.now());
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML =
    `<a href="/${q.r}">Novo sismo · M${fmtMag(q.m)} · ${REGION_NAME[q.r as Region]} · <span data-rel="${new Date(q.t).toISOString()}" data-instant>${when}</span>` +
    `${q.prelim ? ' · preliminar (EMSC)' : ''}</a><button type="button" aria-label="Fechar">×</button>`;
  el.querySelector('button')!.addEventListener('click', () => el.remove());
  box.insertBefore(el, box.firstChild);
  while (box.children.length > 3) box.lastElementChild!.remove();
  setTimeout(() => el.remove(), 12_000);
}

/* ---------- relative times ---------- */

function refreshRelative() {
  const now = Date.now();
  document.querySelectorAll<HTMLElement>('[data-rel]').forEach((el) => {
    const t = Date.parse(el.dataset.rel!);
    if (!Number.isFinite(t)) return;
    const text = el.hasAttribute('data-instant') && now - t < 2 * 60_000 ? 'há instantes' : relative(t, now);
    el.textContent = el.hasAttribute('data-cap') ? capitalise(text) : text;
  });
}

/* ---------- server fragments ---------- */

/** Re-fetch this page and swap every [data-live] fragment and the embedded rows. */
async function swapFromServer() {
  try {
    const res = await fetch(location.href, { cache: 'no-cache', headers: { Accept: 'text/html' } });
    if (!res.ok) return;
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    document.querySelectorAll<HTMLElement>('[data-live]').forEach((el) => {
      const fresh = doc.querySelector<HTMLElement>(`[data-live="${el.dataset.live}"]`);
      if (!fresh) return;
      const expanded = el.classList.contains('all');
      el.replaceWith(fresh);
      if (expanded) fresh.classList.add('all');
    });

    const data = doc.getElementById('quakes-data');
    if (data?.textContent) {
      const parsed = JSON.parse(data.textContent) as { now: number; rows: Row[] };
      authoritative = parsed.rows;
      // The page's catalogue is cached separately from /api/latest.json: only
      // events it actually renders are settled, the rest is retried next poll.
      pending = pending.filter((p) => !authoritative.some((a) => sameEvent(a, p)));
      setRows(mergeRows(authoritative, prelim), Date.now());
      document.getElementById('quakes-data')!.textContent = data.textContent;
    }
    // Preliminary events fogosapi still does not have survive the swap.
    prelim = prelim.filter((p) => !authoritative.some((a) => sameEvent(a, p)));
    prelim.slice().sort((a, b) => a.t - b.t).forEach((q) => {
      showPrelimOnHome(q);
      showPrelimInList(q);
    });
    refreshRelative();
  } catch {
    /* next poll tries again */
  }
}

/* ---------- preliminary (EMSC-only) events ---------- */

/**
 * Home: a preliminary event newer than the headline takes the headline over;
 * an EMSC revision of the event already shown rewrites it in place.
 */
function showPrelimOnHome(q: Row, revision = false) {
  const section = document.querySelector<HTMLElement>('[data-live="now"]');
  if (!section || page !== 'agora') return;
  if (revision) {
    if (section.dataset.prelimId !== q.id) return;
  } else {
    const shown = Date.parse(section.dataset.t ?? '');
    if (Number.isFinite(shown) && shown >= q.t) return;
  }

  const r = q.r as Region;
  const iso = new Date(q.t).toISOString();
  section.dataset.t = iso;
  section.dataset.prelimId = q.id;
  const h1 = section.querySelector('h1');
  const where = section.querySelector('.where');
  if (h1) {
    h1.innerHTML = `<span data-rel="${iso}" data-cap data-instant>Há instantes</span>, ${q.m == null ? 'magnitude por rever' : `magnitude <span class="m">${fmtMag(q.m)}</span>`}.`;
  }
  if (where) {
    const depth = depthKnown(q.d) ? `A ${num(q.d, 0)} km de profundidade.` : 'Profundidade não determinada.';
    where.textContent = `${placeName(q.p)}, ${REGION_NAME[r]}. ${depth} Dados preliminares do EMSC, ainda por confirmar pelo IPMA.`;
  }
  const dd = section.querySelectorAll('.facts dd');
  if (dd.length >= 5) {
    dd[0].innerHTML = `${hm(q.t, r)} <small>${TIMEZONE_NAME[r]} · ${utcHm(q.t)} UTC</small>`;
    dd[1].innerHTML = `${fmtMag(q.m)} <small>preliminar</small>`;
    dd[2].textContent = depthLong(q.d);
    dd[3].textContent = 'sem registo';
    dd[4].textContent = 'EMSC (preliminar)';
  }
  // A preliminary event has no page yet: the map links to the region instead.
  const map = section.querySelector<HTMLAnchorElement>('.now-map');
  if (map) {
    map.href = `/${r}`;
    map.setAttribute('aria-label', `Ver o mapa de ${REGION_NAME[r]}`);
    const tag = map.querySelector('.tag');
    if (tag) tag.textContent = 'ver mapa →';
  }
}

/** Region page: a preliminary event of this region goes to the top of the list (or is rewritten on revision). */
function showPrelimInList(q: Row) {
  const list = document.getElementById('qlist');
  if (!list || q.r !== scopeRegion) return;
  const r = q.r as Region;
  const iso = new Date(q.t).toISOString();
  const existing = [...list.querySelectorAll<HTMLElement>('li.prelim')].find((el) => el.dataset.prelimId === q.id);
  const li = existing ?? document.createElement('li');
  li.className = 'prelim';
  li.dataset.prelimId = q.id;
  li.innerHTML =
    `<div class="row"><span class="qt"><time datetime="${iso}">${dayMonth(q.t, r)}<br />${hm(q.t, r)}</time></span>` +
    `<span class="qm">${fmtMag(q.m)}</span>` +
    `<span class="qp">${escapeHtml(placeName(q.p))}<small>preliminar (EMSC) · <span data-rel="${iso}" data-instant>há instantes</span></small></span>` +
    `<span class="qd"><svg class="ico sm" aria-hidden="true"><use href="#i-profundidade" /></svg>${depthShort(q.d)}</span></div>`;
  if (!existing) list.insertBefore(li, list.firstChild);
}

function addPrelim(q: Row) {
  const existing = prelim.find((p) => sameEvent(p, q));
  if (existing) {
    Object.assign(existing, { ...q, id: existing.id }); // EMSC "update": refine, do not re-announce
    setRows(mergeRows(authoritative, prelim), Date.now());
    showPrelimOnHome(existing, true);
    showPrelimInList(existing);
    refreshRelative();
    return;
  }
  if ([...authoritative, ...(known ?? [])].some((k) => sameEvent(k, q))) return;

  prelim.push(q);
  setRows(mergeRows(authoritative, prelim), Date.now());
  toast(q);
  showPrelimOnHome(q);
  showPrelimInList(q);
}

/* ---------- polling ---------- */

let pollTimer: number | undefined;

async function poll() {
  try {
    const res = await fetch('/api/latest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    const catalogue = (await res.json()) as Catalogue;
    status.pollAt = Date.now();
    status.pollFailed = false;
    status.source = catalogue.source;

    const rows = toRows(catalogue.events).filter((q) => q.r !== 'outro');
    const first = known === null;
    const fresh = first ? unseen(authoritative, rows.filter(inScope)) : unseen(known!, rows);
    known = first ? rows : [...known!, ...fresh];

    fresh.forEach(toast);
    fresh.filter(inScope).forEach((q) => {
      if (!pending.some((p) => sameEvent(p, q))) pending.push(q);
    });
    if (pending.length) await swapFromServer();
  } catch {
    status.pollFailed = true;
  }
  renderStatus();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!document.hidden) pollTimer = setTimeout(async () => {
    await poll();
    schedulePoll();
  }, POLL_MS) as unknown as number;
}

/* ---------- EMSC WebSocket ---------- */

let ws: WebSocket | null = null;
let attempts = 0;
let reconnectTimer: number | undefined;
let closing = false;

function connect() {
  if (!('WebSocket' in window) || ws) return;
  closing = false;
  try {
    ws = new WebSocket(EMSC_WS);
  } catch {
    return scheduleReconnect();
  }
  ws.onopen = () => {
    attempts = 0;
    status.ws = true;
    renderStatus();
  };
  ws.onmessage = (e) => {
    try {
      const q = rowFromEmsc(JSON.parse(e.data));
      if (q) addPrelim(q);
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    ws = null;
    status.ws = false;
    renderStatus();
    if (!closing) scheduleReconnect();
  };
  ws.onerror = () => ws?.close();
}

function scheduleReconnect() {
  clearTimeout(reconnectTimer);
  const delay = Math.min(60_000, 2_000 * 2 ** attempts++) + Math.random() * 1_000;
  reconnectTimer = setTimeout(connect, delay) as unknown as number;
}

function disconnect() {
  closing = true;
  clearTimeout(reconnectTimer);
  ws?.close();
  ws = null;
}

/* ---------- lifecycle ---------- */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearTimeout(pollTimer);
  } else {
    poll().then(schedulePoll);
    refreshRelative();
  }
});
addEventListener('pagehide', disconnect);
addEventListener('pageshow', (e) => {
  if ((e as PageTransitionEvent).persisted) {
    connect();
    poll().then(schedulePoll);
  }
});
setInterval(refreshRelative, 60_000);

poll().then(schedulePoll);
connect();

// Dev only (stripped from production builds): ?live-test=1 injects a synthetic
// preliminary EMSC event a couple of seconds after load, to see the toast,
// headline, list and map react without waiting for a real earthquake.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('live-test')) {
  setTimeout(() => {
    const at: Record<string, [number, number]> = { continente: [38.9, -9.6], acores: [37.9, -26.1], madeira: [32.9, -16.6] };
    const [lat, lon] = at[scopeRegion ?? 'acores'] ?? at.acores;
    const q = rowFromEmsc({
      action: 'create',
      data: { id: 'dev-test', properties: { unid: 'dev-test', time: new Date().toISOString(), lat, lon, depth: 8, mag: 3.4, evtype: 'ke', flynn_region: 'TESTE' } },
    });
    if (q) addPrelim(q);
  }, 2_000);
}
