import {
  getCalculation,
  CalculationType,
  PanelData,
} from "@perses-dev/plugin-system";
import { TimeSeriesData } from "@perses-dev/spec";

/** A place drawn as a point, from a series whose labels carry coordinates. */
export interface CityPoint {
  /** City label, or the coordinates when the series has no city label. */
  name: string;
  /** ISO alpha-2 code from the country label, when the series has one. */
  country?: string;
  lat: number;
  lon: number;
  /** Reduced value. Series with the same name and coordinates are summed. */
  value: number;
}

export interface GeoValues {
  /** Reduced value per ISO alpha-2 code (upper case). Series that share a code are summed. */
  values: Map<string, number>;
  /** `country_name` label per code, when the series carry one (e.g. joined from a country info metric). */
  labelNames: Map<string, string>;
  /** Series with coordinate labels: drawn as points instead of shading their country. */
  points: CityPoint[];
  /** Series meant as points whose coordinates are missing or invalid: listed, never drawn. */
  badPoints: Array<[string, number]>;
  /** Series without a country label and without coordinates. */
  missingLabel: number;
}

export interface ReduceOptions {
  calculation: CalculationType;
  countryLabel: string;
  cityLabel: string;
  latitudeLabel: string;
  longitudeLabel: string;
  /** False: ignore coordinates and add every series to its country. */
  points: boolean;
}

/** Optional label with a readable name, used when the map's geo data has none for a code. */
export const COUNTRY_NAME_LABEL = "country_name";

// Codes some sources use that are not ISO 3166-1 alpha-2.
const ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };

export function normaliseCountryCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  return ALIASES[code] ?? code;
}

/** Decimal degrees within ±`limit`, or undefined for a missing, empty or out-of-range label. */
export function parseCoordinate(
  raw: string | undefined,
  limit: number,
): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : undefined;
}

/**
 * Reduces every series to one value and sorts it onto the map:
 * - with points on, a series with a latitude, longitude or city label is a point;
 * - otherwise a series with a country label shades its country;
 * - anything else is counted in `missingLabel`.
 */
export function reduceSeries(
  queryResults: Array<PanelData<TimeSeriesData>>,
  opts: ReduceOptions,
): GeoValues {
  const values = new Map<string, number>();
  const labelNames = new Map<string, string>();
  const points = new Map<string, CityPoint>();
  const badPoints = new Map<string, number>();
  let missingLabel = 0;
  for (const result of queryResults) {
    for (const series of result.data.series) {
      const labels = series.labels ?? {};
      const rawCountry = labels[opts.countryLabel];
      const rawLat = labels[opts.latitudeLabel];
      const rawLon = labels[opts.longitudeLabel];
      const city = labels[opts.cityLabel]?.trim();
      const isPoint =
        opts.points && (rawLat !== undefined || rawLon !== undefined || !!city);
      if (!rawCountry && !isPoint) {
        missingLabel += 1;
        continue;
      }
      const value = getCalculation(series.values, opts.calculation);
      if (value === null || value === undefined || !Number.isFinite(value))
        continue;
      const country = rawCountry ? normaliseCountryCode(rawCountry) : undefined;
      const labelName = labels[COUNTRY_NAME_LABEL];
      if (country && labelName && !labelNames.has(country))
        labelNames.set(country, labelName);

      if (!isPoint) {
        if (country) values.set(country, (values.get(country) ?? 0) + value);
        continue;
      }
      const lat = parseCoordinate(rawLat, 90);
      const lon = parseCoordinate(rawLon, 180);
      if (lat === undefined || lon === undefined) {
        const key =
          city ||
          [rawLat, rawLon].filter((v) => v !== undefined).join(", ") ||
          "Unnamed place";
        badPoints.set(key, (badPoints.get(key) ?? 0) + value);
        continue;
      }
      const name = city || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      const key = `${name}\u0000${lat}\u0000${lon}`;
      const existing = points.get(key);
      if (existing) existing.value += value;
      else points.set(key, { name, country, lat, lon, value });
    }
  }
  return {
    values,
    labelNames,
    points: [...points.values()],
    badPoints: [...badPoints.entries()],
    missingLabel,
  };
}
