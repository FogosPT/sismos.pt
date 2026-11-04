// Builds src/data/volcanoes.json from the Smithsonian Global Volcanism Program
// "Volcanoes of the World" Holocene list (WFS), country = Portugal.
//
//   node scripts/build-volcanoes.mjs
//
// Coordinates, numbers and last-eruption years come from the GVP as they are;
// only the display names and types are given in Portuguese.
import fs from 'node:fs';

const WFS =
  'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json&CQL_FILTER=Country%3D%27Portugal%27';

const PT_NAMES = {
  Fayal: 'Faial',
  'Sao Jorge': 'São Jorge',
  'Don Joao de Castro Bank': 'Banco D. João de Castro',
  'Picos Fissural Volcanic System': 'Sistema fissural dos Picos',
  'Agua de Pau': 'Água de Pau (Fogo)',
  'Monaco Bank': 'Banco do Mónaco',
};
const PT_TYPES = {
  Stratovolcano: 'estratovulcão',
  'Stratovolcano(es)': 'estratovulcão',
  'Fissure vent': 'sistema fissural',
  'Fissure vent(s)': 'sistema fissural',
  Shield: 'vulcão-escudo',
};

const json = await (await fetch(WFS)).json();
const volcanoes = json.features
  .map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return {
      gvp: p.Volcano_Number,
      name: PT_NAMES[p.Volcano_Name] ?? p.Volcano_Name,
      gvpName: p.Volcano_Name,
      type: PT_TYPES[p.Primary_Volcano_Type] ?? p.Primary_Volcano_Type,
      lastEruption: p.Last_Eruption_Year ?? null,
      lat,
      lon,
    };
  })
  .sort((a, b) => a.gvp - b.gvp);

const target = new URL('../src/data/volcanoes.json', import.meta.url);
fs.writeFileSync(target, JSON.stringify({ source: 'Smithsonian Institution, Global Volcanism Program, Volcanoes of the World', volcanoes }, null, 1) + '\n');
console.log(volcanoes.length, 'volcanoes');
