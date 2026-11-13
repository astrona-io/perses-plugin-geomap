// Builds src/data/world-countries.json from the Natural Earth 1:50m countries in world-atlas.
//
// - every country is keyed by its ISO 3166-1 alpha-2 code (the form most GeoIP databases and exporters use),
//   so the panel can match a label value to a shape without a lookup table at runtime
// - Antarctica is dropped (no traffic, a third of the map)
// - shapes are simplified so the bundle stays small (~1/5 of the 50m file)
//
// Run: npm run world-data   (only needed when world-atlas or the simplification changes)
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { presimplify, quantile, simplify, filter, filterWeight } from 'topojson-simplify';
import countries from 'i18n-iso-countries';
import { quantize } from 'topojson-client';

const require = createRequire(import.meta.url);
const SOURCE = require.resolve('world-atlas/countries-50m.json');
const TARGET = new URL('../src/data/world-countries.json', import.meta.url);

// Natural Earth shapes without an ISO numeric id in world-atlas, matched by name instead.
const BY_NAME = {
  Kosovo: 'XK', // user-assigned code, widely used by GeoIP databases and the EU
  'N. Cyprus': null, // not a recognised state; drawn as part of Cyprus below
  Somaliland: null, // drawn as part of Somalia below
  'Indian Ocean Ter.': null,
  'Ashmore and Cartier Is.': null,
  'Siachen Glacier': null,
};
// English short names (CLDR, from Node's ICU: "United States", "South Korea", "Czechia") stored in
// each shape's properties, so the panel shows the same readable name in every browser locale.
// Natural Earth's own name is the fallback; it abbreviates ("Dem. Rep. Congo", "Bosnia and Herz.").
const englishNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
function englishName(code, naturalEarthName) {
  try {
    return englishNames.of(code) ?? naturalEarthName;
  } catch {
    return naturalEarthName;
  }
}

// Shapes merged into another country's code (shown and coloured as that country).
const MERGE_INTO = { 'N. Cyprus': 'CY', Somaliland: 'SO' };

const topo = JSON.parse(readFileSync(SOURCE, 'utf8'));
const geometries = [];
const unmatched = [];
for (const g of topo.objects.countries.geometries) {
  const name = g.properties?.name ?? '';
  let code = g.id !== undefined ? countries.numericToAlpha2(g.id) : undefined;
  if (!code && name in MERGE_INTO) code = MERGE_INTO[name];
  if (!code && name in BY_NAME) code = BY_NAME[name] ?? undefined;
  if (code === 'AQ') continue;
  if (!code) {
    unmatched.push(`${g.id ?? '-'} ${name}`);
    continue;
  }
  geometries.push({ type: g.type, arcs: g.arcs, id: code, properties: { name: englishName(code, name) } });
}
topo.objects.countries.geometries = geometries;
delete topo.objects.land;

const pre = presimplify(topo);
const minWeight = quantile(pre, 0.3);
// Simplify the lines, then drop the rings (small islands) that collapse below the same weight.
const simplified = filter(simplify(pre, minWeight), filterWeight(pre, minWeight));
// presimplify stores a weight as a third coordinate on every point; strip it.
simplified.arcs = simplified.arcs.map((arc) => arc.map((point) => [point[0], point[1]]));
// Back to a quantized, delta-encoded topology: integer coordinates keep the file small.
writeFileSync(TARGET, JSON.stringify(quantize(simplified, 1e4)));
const codes = new Set(geometries.map((g) => g.id));
console.log(`wrote ${geometries.length} shapes, ${codes.size} country codes -> ${TARGET.pathname}`);
if (unmatched.length) console.log(`dropped (no ISO code): ${unmatched.join(', ')}`);
