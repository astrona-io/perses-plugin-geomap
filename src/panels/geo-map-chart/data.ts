import {
  getCalculation,
  CalculationType,
  PanelData,
} from "@perses-dev/plugin-system";
import { TimeSeriesData } from "@perses-dev/spec";

export interface CountryValues {
  /** Reduced value per ISO alpha-2 code (upper case). Series that share a code are summed. */
  values: Map<string, number>;
  /** `country_name` label per code, when the series carry one (e.g. joined from a country info metric). */
  labelNames: Map<string, string>;
  /** Series without the country label. */
  missingLabel: number;
}

/** Optional label with a readable name, used when the map's geo data has none for a code. */
export const COUNTRY_NAME_LABEL = "country_name";

// Codes some sources use that are not ISO 3166-1 alpha-2.
const ALIASES: Record<string, string> = { UK: "GB", EL: "GR" };

export function normaliseCountryCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  return ALIASES[code] ?? code;
}

export function reduceToCountries(
  queryResults: Array<PanelData<TimeSeriesData>>,
  calculation: CalculationType,
  countryLabel: string,
): CountryValues {
  const values = new Map<string, number>();
  const labelNames = new Map<string, string>();
  let missingLabel = 0;
  for (const result of queryResults) {
    for (const series of result.data.series) {
      const raw = series.labels?.[countryLabel];
      if (!raw) {
        missingLabel += 1;
        continue;
      }
      const value = getCalculation(series.values, calculation);
      if (value === null || value === undefined || !Number.isFinite(value))
        continue;
      const code = normaliseCountryCode(raw);
      const labelName = series.labels?.[COUNTRY_NAME_LABEL];
      if (labelName && !labelNames.has(code)) labelNames.set(code, labelName);
      values.set(code, (values.get(code) ?? 0) + value);
    }
  }
  return { values, labelNames, missingLabel };
}
