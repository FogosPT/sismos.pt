import type { PtRegion, Region } from './types';

/**
 * Same coarse polygons as fogosapi's App\Support\SeismicRegion, used when the
 * data comes straight from IPMA/EMSC/USGS (fallback). Points are [lon, lat].
 */
const POLYGONS: Record<PtRegion, [number, number][]> = {
  continente: [
    [-12.5, 42.15], [-8.87, 42.15], [-8.2, 42.15], [-7.9, 41.92], [-6.75, 41.99],
    [-6.19, 41.58], [-6.93, 41.03], [-6.83, 40.6], [-6.95, 39.66], [-7.03, 38.87],
    [-6.93, 38.2], [-7.3, 38.0], [-7.4, 37.17], [-7.4, 35.5], [-12.5, 35.5],
  ],
  acores: [[-33.0, 41.0], [-23.5, 41.0], [-23.5, 35.5], [-33.0, 35.5]],
  madeira: [[-18.5, 33.8], [-15.0, 33.8], [-15.0, 29.5], [-18.5, 29.5]],
};

/** Area polled by fogosapi (SeismicSource::BBOX). */
export const BBOX = { minLat: 29.0, maxLat: 44.5, minLon: -33.0, maxLon: -5.5 };

function contains(poly: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function classify(lat: number, lon: number): Region {
  for (const r of Object.keys(POLYGONS) as PtRegion[]) {
    if (contains(POLYGONS[r], lon, lat)) return r;
  }
  return 'outro';
}

export function inBbox(lat: number, lon: number): boolean {
  return lat >= BBOX.minLat && lat <= BBOX.maxLat && lon >= BBOX.minLon && lon <= BBOX.maxLon;
}

export const REGION_NAME: Record<Region, string> = {
  continente: 'Continente',
  acores: 'Açores',
  madeira: 'Madeira',
  outro: 'fora de Portugal',
};

export const TIMEZONE: Record<Region, string> = {
  continente: 'Europe/Lisbon',
  acores: 'Atlantic/Azores',
  madeira: 'Atlantic/Madeira',
  outro: 'Europe/Lisbon',
};

export const TIMEZONE_NAME: Record<Region, string> = {
  continente: 'hora de Lisboa',
  acores: 'hora dos Açores',
  madeira: 'hora da Madeira',
  outro: 'hora de Lisboa',
};

/**
 * Initial map extents [minLon, minLat, maxLon, maxLat]. The mainland one
 * reaches south-west past the Gorringe bank / Gulf of Cádiz (where most
 * events are) so they sit clear of the legend in the bottom-left corner.
 */
export const EXTENT: Record<PtRegion, [number, number, number, number]> = {
  continente: [-13.4, 34.9, -5.8, 42.3],
  acores: [-31.5, 36.75, -24.8, 39.95],
  madeira: [-17.4, 29.95, -15.75, 33.2],
};

/** Labels on the maps; `area` labels have no dot. */
export const PLACES: Record<PtRegion, [string, number, number, boolean?][]> = {
  continente: [['Lisboa', -9.14, 38.72], ['Porto', -8.61, 41.15], ['Faro', -7.93, 37.02], ['Coimbra', -8.43, 40.21], ['Évora', -7.91, 38.57], ['Golfo de Cádis', -7.4, 36.45, true]],
  acores: [['Grupo Ocidental', -31.15, 39.95, true], ['Grupo Central', -28.3, 39.3, true], ['Grupo Oriental', -25.4, 38.2, true], ['Ponta Delgada', -25.67, 37.74], ['Angra', -27.22, 38.65], ['Horta', -28.63, 38.53]],
  madeira: [['Funchal', -16.91, 32.65], ['Porto Santo', -16.34, 33.06], ['Desertas', -16.5, 32.45, true], ['Selvagens', -15.88, 30.2, true]],
};
