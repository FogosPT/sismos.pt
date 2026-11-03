export type Region = 'continente' | 'acores' | 'madeira' | 'outro';
export type PtRegion = Exclude<Region, 'outro'>;
export type Source = 'fogos' | 'ipma' | 'emsc' | 'usgs';

/** Mirror of fogosapi's EarthquakeResource (v2/seismic). */
export interface Earthquake {
  id: string;
  slug: string | null;
  time: string; // ISO 8601, UTC
  lat: number;
  lon: number;
  depth: number | null;
  magnitude: number | null;
  magType: string | null;
  magnitudeSource: string | null;
  provisional: boolean;
  region: Region;
  place: string | null;
  felt: boolean;
  intensity: string | null;
  intensityMax: number | null;
  local: string | null;
  shakemapUrl: string | null;
  preferredSource: string | null;
  sourceNames: string[];
  /** Nearest Portuguese place (fogosapi SeismicPlaces); absent on fallback data and older API versions. */
  nearest?: Place | null;
  updated: string | null;
}

/** A place near the epicentre; `bearing` goes from the place to the epicentre. */
export interface Place {
  name: string;
  municipality: string;
  kind: 'freguesia' | 'concelho';
  km: number;
  bearing: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';
}

/** One catalogue's report of an earthquake (fogosapi `sources.{name}`). */
export interface SourceReport {
  id: string;
  time: string;
  lat: number;
  lon: number;
  depth: number | null;
  magnitude: number | null;
  magType: string | null;
  place: string | null;
  felt: boolean | null;
  intensity: string | null;
  local: string | null;
  url: string | null;
  updatedAt: string | null;
  /** When fogosapi first saw it (latency only meaningful if close to `time`). */
  firstSeenAt?: string | null;
  extra?: Record<string, unknown>;
}

export interface EarthquakeDetail extends Earthquake {
  sources: Record<string, SourceReport>;
  aftershocks: { window: { days: number; km: number } | null; count: number; data: Earthquake[] };
  nearbyHistory: Earthquake[];
  nearestPlaces?: Place[];
}

export interface Catalogue {
  /** Where the data came from: fogosapi normally, a fallback otherwise. */
  source: Source;
  fetchedAt: string;
  events: Earthquake[];
  /** Why the sources before `source` were skipped (empty when fogosapi answered). */
  errors?: string[];
}

export const REGIONS: PtRegion[] = ['continente', 'acores', 'madeira'];
