import type { SeismicStats } from './types';

/**
 * PHP serialises empty associative arrays as `[]`; turn those into `{}` so the
 * rest of the code can treat maps as maps.
 */
export function asMap<T>(v: Record<string, T> | T[] | null | undefined): Record<string, T> {
  if (!v || Array.isArray(v)) return {};
  return v;
}

export function normaliseStats(s: SeismicStats): SeismicStats {
  const gr = s.gutenbergRichter;
  const sq = s.sourceQuality;
  return {
    ...s,
    gutenbergRichter: gr ? { ...gr, returnPeriodsYears: gr.returnPeriodsYears ? asMap(gr.returnPeriodsYears) : null } : null,
    sourceQuality: sq ? { magnitudeDifference: asMap(sq.magnitudeDifference), latencyMinutes: asMap(sq.latencyMinutes) } : null,
    sequences: s.sequences ?? null,
    completenessByYear: s.completenessByYear ?? null,
    rate: s.rate ?? null,
    top: s.top ?? [],
    feltEvents: s.feltEvents ?? [],
  };
}
