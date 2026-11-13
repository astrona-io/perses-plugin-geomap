import { registerMap, getMap } from "echarts";
import { feature, merge } from "topojson-client";
import type {
  Topology,
  GeometryCollection,
  GeometryObject,
} from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
// Natural Earth 1:50m countries (public domain) via world-atlas, keyed by ISO 3166-1 alpha-2.
// Regenerate with `npm run world-data`. Bundled: the browser never fetches map data.
import worldTopology from "../../data/world-countries.json";

export const WORLD_MAP_NAME = "perses-geomap-world";

/** Width scale ECharts applies to longitude (plate carrée looks too wide at our latitudes). */
export const WORLD_ASPECT_SCALE = 0.85;

let registered = false;
let knownCodes: Set<string> | undefined;
/** English name per code, from the geo data's `properties.name` (baked in at build time). */
const geoNames = new Map<string, string>();
let bounds: Bounds = { minLon: -180, maxLon: 180, minLat: -60, maxLat: 85 };
/** Unwrapped geometry per code, for zooming to a country. */
const geometries = new Map<string, Geometry>();
const regionBoundsCache = new Map<string, Bounds | null>();

export interface Bounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
}

type Ring = number[][];

/**
 * ECharts draws lon/lat on a plane, so a ring that crosses the antimeridian (Chukotka, Fiji)
 * becomes a stripe across the whole map. Shift such rings' western half by +360 so they stay
 * in one piece just east of 180°.
 */
function unwrapRing(ring: Ring): Ring {
  let crosses = false;
  for (let i = 1; i < ring.length; i++) {
    if (Math.abs(ring[i]![0]! - ring[i - 1]![0]!) > 180) {
      crosses = true;
      break;
    }
  }
  if (!crosses) return ring;
  return ring.map(([lon, lat]) => [lon! < 0 ? lon! + 360 : lon!, lat!]);
}

function unwrapGeometry(geometry: Geometry): Geometry {
  if (geometry.type === "Polygon") {
    return { ...geometry, coordinates: geometry.coordinates.map(unwrapRing) };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...geometry,
      coordinates: geometry.coordinates.map((p) => p.map(unwrapRing)),
    };
  }
  return geometry;
}

function emptyBounds(): Bounds {
  return {
    minLon: Infinity,
    maxLon: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity,
  };
}

function extend(b: Bounds, ring: Ring): Bounds {
  for (const [lon, lat] of ring) {
    b.minLon = Math.min(b.minLon, lon!);
    b.maxLon = Math.max(b.maxLon, lon!);
    b.minLat = Math.min(b.minLat, lat!);
    b.maxLat = Math.max(b.maxLat, lat!);
  }
  return b;
}

function polygonsOf(g: Geometry): Ring[][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

function computeBounds(features: Feature[]): Bounds {
  const b = emptyBounds();
  for (const f of features)
    for (const polygon of polygonsOf(f.geometry))
      polygon.forEach((r) => extend(b, r));
  return b;
}

/** Rough area of a ring in km²-like units: shoelace in degrees, scaled by cos(latitude). */
function ringArea(ring: Ring): number {
  let sum = 0;
  let lat = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]!;
    const [x2, y2] = ring[(i + 1) % ring.length]!;
    sum += x1! * y2! - x2! * y1!;
    lat += y1!;
  }
  return Math.abs(sum / 2) * Math.cos(((lat / ring.length) * Math.PI) / 180);
}

/** Polygons below this share of the largest one are left out of a country's zoom box. */
const MAIN_LAND_SHARE = 0.2;

/**
 * The part of a country worth zooming to: the box around its main land masses. Small outlying
 * islands and overseas territories (French Guiana, Svalbard, Attu) would otherwise make the box
 * span half the world. When even the main land masses span more than 180° of longitude, only the
 * largest polygon is used.
 */
export function regionBounds(code: string): Bounds | undefined {
  ensureWorldMap();
  const cached = regionBoundsCache.get(code);
  if (cached !== undefined) return cached ?? undefined;
  const geometry = geometries.get(code);
  let result: Bounds | null = null;
  if (geometry) {
    const polygons = polygonsOf(geometry)
      .filter((p) => p[0] && p[0].length > 2)
      .map((p) => ({ outer: p[0]!, area: ringArea(p[0]!) }))
      .sort((a, b) => b.area - a.area);
    if (polygons.length) {
      const largest = polygons[0]!.area;
      const main = emptyBounds();
      for (const p of polygons)
        if (p.area >= largest * MAIN_LAND_SHARE) extend(main, p.outer);
      result =
        main.maxLon - main.minLon > 180
          ? extend(emptyBounds(), polygons[0]!.outer)
          : main;
    }
  }
  regionBoundsCache.set(code, result);
  return result ?? undefined;
}

/** Bounding box of the whole map (unwrapped lon/lat), as ECharts lays it out. */
export function worldBounds(): Bounds {
  ensureWorldMap();
  return bounds;
}

/** Width / height of the drawn map, as ECharts lays it out (aspectScale included). */
export function worldAspect(): number {
  ensureWorldMap();
  return (
    ((bounds.maxLon - bounds.minLon) / (bounds.maxLat - bounds.minLat)) *
    WORLD_ASPECT_SCALE
  );
}

function buildFeatures(): FeatureCollection {
  const topo = worldTopology as unknown as Topology<{
    countries: GeometryCollection;
  }>;
  const byCode = new Map<string, GeometryObject[]>();
  for (const g of topo.objects.countries.geometries) {
    const code = String(g.id);
    const name = (g.properties as { name?: unknown } | undefined)?.name;
    if (typeof name === "string" && name && !geoNames.has(code))
      geoNames.set(code, name);
    const list = byCode.get(code) ?? [];
    list.push(g);
    byCode.set(code, list);
  }
  const features: Feature[] = [];
  for (const [code, geometries] of byCode) {
    // A few codes have more than one shape (Cyprus incl. the north, Somalia incl. Somaliland): one region each.
    const geometry: Geometry =
      geometries.length === 1
        ? (feature(topo, geometries[0]!) as Feature).geometry
        : merge(topo, geometries as Parameters<typeof merge>[1]);
    features.push({
      type: "Feature",
      id: code,
      properties: { name: code },
      geometry: unwrapGeometry(geometry),
    });
  }
  return { type: "FeatureCollection", features };
}

/** Registers the world map with the (shared, host-provided) ECharts instance once. */
export function ensureWorldMap(): void {
  if (registered && getMap(WORLD_MAP_NAME)) return;
  const collection = buildFeatures();
  geometries.clear();
  regionBoundsCache.clear();
  for (const f of collection.features) geometries.set(String(f.id), f.geometry);
  knownCodes = new Set(collection.features.map((f) => String(f.id)));
  bounds = computeBounds(collection.features);
  // ECharts' typings expect its own GeoJSON shape; the standard one is what it parses.
  registerMap(
    WORLD_MAP_NAME,
    collection as unknown as Parameters<typeof registerMap>[1],
  );
  registered = true;
}

/** Every code that has a shape on the map. */
export function mapCodes(): string[] {
  ensureWorldMap();
  return [...(knownCodes ?? [])];
}

export function isOnMap(code: string): boolean {
  ensureWorldMap();
  return knownCodes?.has(code) ?? false;
}

/** Codes that are not countries but appear in GeoIP data (XX: unknown, T1: Tor exit nodes, used by Cloudflare). */
const SPECIAL_NAMES: Record<string, string> = { XX: "Unknown", T1: "Tor" };

/**
 * Human-readable English name for a country code, in this order:
 * 1. the special codes XX (Unknown) and T1 (Tor)
 * 2. the world map's geo data (`properties.name`, English, baked in by `npm run world-data`)
 * 3. `labelName`: a `country_name` label on the series, if the query carries one
 * 4. the code itself
 */
export function countryName(code: string, labelName?: string): string {
  const special = SPECIAL_NAMES[code];
  if (special) return special;
  ensureWorldMap();
  return geoNames.get(code) ?? (labelName?.trim() || code);
}

/** "Denmark (DK)"; just the code when no name is known. */
export function countryDisplayName(code: string, labelName?: string): string {
  const name = countryName(code, labelName);
  return name === code ? code : `${name} (${code})`;
}
