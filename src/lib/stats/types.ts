/** Shapes of fogosapi `GET v2/seismic/stats` (App\Support\SeismicStatsBuilder). */

export type StatsRegion = 'pt' | 'continente' | 'acores' | 'madeira';
export type StatsWindow = '7d' | '30d' | '1y' | '10y' | 'all';

export interface QuakeRef {
  id: string;
  slug: string | null;
  time: string;
  magnitude: number | null;
  depth: number | null;
  place: string | null;
  intensity: string | null;
}

export interface GutenbergRichter {
  b: number;
  sigma: number;
  n: number;
  mc: number;
  mean: number;
  bootstrap: { mean: number; std: number; iterations: number } | null;
  returnPeriodsYears: Record<string, number> | null;
}

export interface RateAnomaly {
  mc: number;
  observed: number;
  expected: number;
  ratio: number;
  z: number;
  pPoisson: number;
  baselineDays: number;
}

export interface Sequence {
  mainshock: QuakeRef;
  aftershocks: number;
  largestAftershock: number;
  durationDays: number;
  omoriP: number | null;
  window: { days: number; km: number };
}

export interface SourceQuality {
  magnitudeDifference: Record<string, { n: number; mean: number; median: number }>;
  latencyMinutes: Record<string, { n: number; median: number; p90: number }>;
}

export interface SeriesPoint {
  t: string;
  n: number;
  maxM: number | null;
  energyJ: number;
  benioff: number;
}

export interface YearCompleteness {
  year: number;
  n: number;
  mc: number | null;
  b: number | null;
  maxM: number;
}

export interface SeismicStats {
  region: StatsRegion;
  window: StatsWindow;
  from: string | null;
  to: string;
  count: number;
  felt: number;
  unknownMagnitude: number;
  magnitude: {
    max: QuakeRef | null;
    mean: number | null;
    histogram: { m: number; n: number }[];
    cumulative: { m: number; n: number }[];
  };
  gutenbergRichter: GutenbergRichter | null;
  completenessByYear: YearCompleteness[] | null;
  energy: {
    totalJ: number;
    tntTonnes: number;
    largestShare: number | null;
    cumulative: { t: string; energyJ: number; benioff: number }[];
  };
  depth: {
    undetermined: number;
    median: number | null;
    p90: number | null;
    histogram: { from: number; to: number | null; n: number }[];
  };
  timeOfDay: { timezone: string; hours: number[]; weekdays: number[] };
  series: { bucket: 'day' | 'week' | 'month' | 'year'; data: SeriesPoint[] };
  rate: RateAnomaly | null;
  sequences: Sequence[] | null;
  sourceQuality: SourceQuality | null;
  top: QuakeRef[];
  feltEvents: QuakeRef[];
}

export type StatsResult =
  | { ok: true; stats: SeismicStats; computedAt: string | null }
  | { ok: false; reason: 'not_computed' | 'unavailable' };
