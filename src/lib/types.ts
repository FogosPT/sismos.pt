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
  updated: string | null;
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
