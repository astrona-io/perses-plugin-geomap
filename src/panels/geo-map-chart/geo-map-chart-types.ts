import { TimeSeriesData } from "@perses-dev/spec";
import {
  CalculationType,
  OptionsEditorProps,
  PanelProps,
} from "@perses-dev/plugin-system";
import { FormatOptions } from "@perses-dev/components";

export type QueryData = TimeSeriesData;

export type GeoMapChartProps = PanelProps<GeoMapChartOptions, QueryData>;
export type GeoMapChartEditorProps = OptionsEditorProps<GeoMapChartOptions>;

export type ColorScheme =
  "blues" | "greens" | "oranges" | "purples" | "reds" | "viridis";
export type ScaleType = "linear" | "log";
/** When the city layer is drawn: `auto` once zoomed in (or always when there are only cities). */
export type ShowCities = "auto" | "always" | "never";

export interface GeoMapChartOptions {
  /** How each series is reduced to one value. */
  calculation: CalculationType;
  /** Series label that holds the ISO 3166-1 alpha-2 country code. Default `country`. */
  countryLabel?: string;
  format?: FormatOptions;
  /** Sequential colour scale for countries with data. Default `blues`. */
  colorScheme?: ColorScheme;
  /** `log` spreads heavy-tailed values (requests per country) across the scale. Default `linear`. */
  scale?: ScaleType;
  /** Fixed lower/upper bound of the colour scale. Taken from the data when unset. */
  min?: number;
  max?: number;
  /** Show the colour scale under the map. Default true. */
  showLegend?: boolean;
  /** Mouse-wheel / pinch zoom, drag to pan and the zoom buttons. Default true. */
  zoom?: boolean;
  /** Clicking a country zooms to it; clicking it again or the sea zooms back out. Default true. */
  clickToZoom?: boolean;
  /** Series label with a city (or place) name, for series drawn as points. Default `city`. */
  cityLabel?: string;
  /** Series label with the latitude in decimal degrees. Default `latitude`. */
  latitudeLabel?: string;
  /** Series label with the longitude in decimal degrees. Default `longitude`. */
  longitudeLabel?: string;
  /** When series with coordinates are drawn as points. Default `auto`. */
  showCities?: ShowCities;
}

export const DEFAULT_COUNTRY_LABEL = "country";
export const DEFAULT_COLOR_SCHEME: ColorScheme = "blues";
export const DEFAULT_SCALE: ScaleType = "linear";
export const DEFAULT_CITY_LABEL = "city";
export const DEFAULT_LATITUDE_LABEL = "latitude";
export const DEFAULT_LONGITUDE_LABEL = "longitude";
export const DEFAULT_SHOW_CITIES: ShowCities = "auto";

export function createInitialGeoMapChartOptions(): GeoMapChartOptions {
  return {
    calculation: "last",
    countryLabel: DEFAULT_COUNTRY_LABEL,
    format: { unit: "decimal" },
    colorScheme: DEFAULT_COLOR_SCHEME,
    scale: DEFAULT_SCALE,
    showLegend: true,
    zoom: true,
    clickToZoom: true,
  };
}

export const COLOR_SCHEME_LABELS: Record<ColorScheme, string> = {
  blues: "Blues",
  greens: "Greens",
  oranges: "Oranges",
  purples: "Purples",
  reds: "Reds",
  viridis: "Viridis",
};

/**
 * Sequential ramps, low to high. Light mode runs from pale to dark; dark mode from dim to bright,
 * so the lowest value always sits closest to the neutral "no data" fill and the highest stands out.
 */
export const COLOR_RAMPS: Record<
  ColorScheme,
  { light: string[]; dark: string[] }
> = {
  blues: {
    light: ["#c6dbef", "#6baed6", "#2171b5", "#08306b"],
    dark: ["#1c3d5a", "#2f6fa8", "#5aa7e6", "#c2e2ff"],
  },
  greens: {
    light: ["#c7e9c0", "#74c476", "#238b45", "#00441b"],
    dark: ["#173d2a", "#2a7a4b", "#52b77a", "#bff2cf"],
  },
  oranges: {
    light: ["#fdd0a2", "#fd8d3c", "#d94801", "#7f2704"],
    dark: ["#4a2a12", "#9a4a14", "#e57a2e", "#ffd8b3"],
  },
  purples: {
    light: ["#dadaeb", "#9e9ac8", "#6a51a3", "#3f007d"],
    dark: ["#2e2550", "#5b4a9c", "#9686e0", "#e0daff"],
  },
  reds: {
    light: ["#fcbba1", "#fb6a4a", "#cb181d", "#67000d"],
    dark: ["#4a1a1a", "#9c2a2a", "#e65555", "#ffcccc"],
  },
  viridis: {
    light: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    dark: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
  },
};
