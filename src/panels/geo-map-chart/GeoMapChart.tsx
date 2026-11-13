import { PanelPlugin } from "@perses-dev/plugin-system";
import { GeoMapChartComponent } from "./GeoMapChartComponent";
import {
  GeoMapChartOptions,
  GeoMapChartProps,
  createInitialGeoMapChartOptions,
} from "./geo-map-chart-types";
import { GeoMapChartSettingsEditor } from "./GeoMapChartSettingsEditor";

/** World map (choropleth by country) over a time-series query. */
export const GeoMapChart: PanelPlugin<GeoMapChartOptions, GeoMapChartProps> = {
  PanelComponent: GeoMapChartComponent,
  panelOptionsEditorComponents: [
    { label: "Settings", content: GeoMapChartSettingsEditor },
  ],
  supportedQueryTypes: ["TimeSeriesQuery"],
  createInitialOptions: createInitialGeoMapChartOptions,
};
