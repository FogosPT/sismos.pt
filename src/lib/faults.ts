import faultsData from '../data/faults.json';
import volcanoData from '../data/volcanoes.json';
import { num } from './format';
import { EXTENT } from './region';
import type { PtRegion } from './types';

export interface Fault {
  id: string | null;
  name: string | null;
  type: string | null;
  /** Net slip rate, mm/year (GEM preferred value). */
  rate: number | null;
  lines: [number, number][][];
}

export interface Volcano {
  gvp: number;
  name: string;
  gvpName: string;
  type: string;
  /** Year of the last known eruption; negative = BCE (GVP convention). */
  lastEruption: number | null;
  lat: number;
  lon: number;
}

export const FAULTS = faultsData as unknown as Record<PtRegion, Fault[]> & { source: string };
export const VOLCANOES = (volcanoData as unknown as { volcanoes: Volcano[] }).volcanoes;

/** GEM `slip_type` → Portuguese. */
const SLIP: Record<string, string> = {
  Normal: 'falha normal',
  Reverse: 'falha inversa',
  'Blind Thrust': 'cavalgamento cego',
  Dextral: 'falha de desligamento direito',
  Sinistral: 'falha de desligamento esquerdo',
  'Dextral-Normal': 'desligamento direito com componente normal',
  'Dextral-Reverse': 'desligamento direito com componente inversa',
  'Sinistral-Normal': 'desligamento esquerdo com componente normal',
  'Sinistral-Reverse': 'desligamento esquerdo com componente inversa',
  'Normal-Dextral': 'falha normal com componente de desligamento direito',
  'Normal-Sinistral': 'falha normal com componente de desligamento esquerdo',
  'Reverse-Dextral': 'falha inversa com componente de desligamento direito',
  'Reverse-Sinistral': 'falha inversa com componente de desligamento esquerdo',
  Anticline: 'anticlinal ativo',
  Syncline: 'sinclinal ativo',
  Dextral_Transform: 'falha transformante direita',
  Sinistral_Transform: 'falha transformante esquerda',
  Spreading_Ridge: 'crista de expansão',
  Subduction_Thrust: 'cavalgamento de subducção',
};

export const slipLabel = (t: string | null) => (t ? SLIP[t] ?? 'falha ativa' : 'falha ativa');

export const rateLabel = (mm: number | null) => (mm == null ? null : `${num(mm, mm < 1 ? 2 : 1)} mm/ano`);

export function eruptionLabel(year: number | null): string {
  if (year == null) return 'última erupção desconhecida';
  return year < 0 ? `última erupção por volta de ${num(-year, 0).replace(/\s/g, '')} a.C.` : `última erupção em ${year}`;
}

const inExtent = (r: PtRegion, lon: number, lat: number) => {
  const [x0, y0, x1, y1] = EXTENT[r];
  return lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1;
};

/** Faults with at least one vertex inside the region's initial map view. */
export const faultsIn = (r: PtRegion) => FAULTS[r].filter((f) => f.lines.some((l) => l.some(([x, y]) => inExtent(r, x, y))));

export const volcanoesIn = (r: PtRegion) => VOLCANOES.filter((v) => inExtent(r, v.lon, v.lat));
