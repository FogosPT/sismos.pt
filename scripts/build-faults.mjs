// Builds src/data/faults.json from the GEM Global Active Faults database
// (GEMScienceTools/gem-global-active-faults on GitHub, CC BY-SA 4.0).
//
//   node scripts/build-faults.mjs [path/to/gem_active_faults_harmonized.geojson]
//
// Without a path the file is downloaded. Keeps the SHARE (Europe, which
// includes the Iberian QAFI faults) and GEM North Africa catalogues; "Bird
// 2003" is dropped because it is the PB2002 plate boundaries the map already
// draws. Lines are clipped to each region's coastline area (same boxes as
// src/scripts/geo.ts), simplified and rounded.
import fs from 'node:fs';
import { clipLine, preferred, round, simplify } from './lib/geom.mjs';

const SOURCE = 'https://raw.githubusercontent.com/GEMScienceTools/gem-global-active-faults/master/geojson/gem_active_faults_harmonized.geojson';
const BOXES = {
  continente: [-17.3, 31.6, 4.4, 46.4],
  acores: [-31.3, 32.4, -14.4, 44.2],
  madeira: [-25.2, 25.8, -5.5, 37.3],
};
const TOLERANCE = 0.004; // degrees, ~400 m
const SKIP_CATALOGS = new Set(['Bird 2003']);

const path = process.argv[2];
const gem = path ? JSON.parse(fs.readFileSync(path, 'utf8')) : await (await fetch(SOURCE)).json();

const out = { source: 'GEM Global Active Faults (CC BY-SA 4.0)', continente: [], acores: [], madeira: [] };
for (const f of gem.features) {
  const p = f.properties ?? {};
  if (!f.geometry || SKIP_CATALOGS.has(p.catalog_name)) continue;
  const lines = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const [region, box] of Object.entries(BOXES)) {
    const pieces = lines
      .flatMap((l) => clipLine(l.map(([x, y]) => [x, y]), box))
      .map((l) => round(simplify(l, TOLERANCE)))
      .filter((l) => l.length > 1);
    if (!pieces.length) continue;
    out[region].push({
      id: p.catalog_id ?? null,
      name: p.name || null,
      type: p.slip_type ?? null,
      rate: preferred(p.net_slip_rate),
      lines: pieces,
    });
  }
}

const target = new URL('../src/data/faults.json', import.meta.url);
fs.writeFileSync(target, JSON.stringify(out));
console.log(Object.fromEntries(Object.keys(BOXES).map((r) => [r, out[r].length])), fs.statSync(target).size, 'bytes');
