import { ReactElement } from "react";
import { MenuItem, Switch, TextField } from "@mui/material";
import {
  FormatControls,
  FormatOptions,
  OptionsEditorColumn,
  OptionsEditorControl,
  OptionsEditorGrid,
  OptionsEditorGroup,
} from "@perses-dev/components";
import { CalculationSelector } from "@perses-dev/plugin-system";
import {
  COLOR_SCHEME_LABELS,
  ColorScheme,
  DEFAULT_CITY_LABEL,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COUNTRY_LABEL,
  DEFAULT_LATITUDE_LABEL,
  DEFAULT_LONGITUDE_LABEL,
  DEFAULT_SCALE,
  DEFAULT_SHOW_CITIES,
  GeoMapChartEditorProps,
  GeoMapChartOptions,
  ScaleType,
  ShowCities,
} from "./geo-map-chart-types";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

function parseBound(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function GeoMapChartSettingsEditor(
  props: GeoMapChartEditorProps,
): ReactElement {
  const { onChange, value } = props;
  const set = (patch: Partial<GeoMapChartOptions>): void =>
    onChange({ ...value, ...patch });

  return (
    <OptionsEditorGrid>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Data">
          {/* Renders its own labelled control. Series with the same country are summed after it. */}
          <CalculationSelector
            value={value.calculation ?? "last"}
            onChange={(calculation) => set({ calculation })}
          />
          <OptionsEditorControl
            label="Country label"
            description="Label holding the ISO 3166-1 alpha-2 code (DE, US, ...)"
            control={
              <TextField
                size="small"
                placeholder={DEFAULT_COUNTRY_LABEL}
                value={value.countryLabel ?? ""}
                onChange={(e) =>
                  set({ countryLabel: e.target.value || undefined })
                }
              />
            }
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Cities">
          <OptionsEditorControl
            label="Show cities"
            description="Series with coordinate labels are drawn as points. Auto: once zoomed in, or always when there are only points"
            control={
              <TextField
                select
                size="small"
                value={value.showCities ?? DEFAULT_SHOW_CITIES}
                onChange={(e) =>
                  set({ showCities: e.target.value as ShowCities })
                }
              >
                <MenuItem value="auto">Auto</MenuItem>
                <MenuItem value="always">Always</MenuItem>
                <MenuItem value="never">Never (add to country)</MenuItem>
              </TextField>
            }
          />
          {(
            [
              [
                "cityLabel",
                "City label",
                DEFAULT_CITY_LABEL,
                "Label with the place name",
              ],
              [
                "latitudeLabel",
                "Latitude label",
                DEFAULT_LATITUDE_LABEL,
                "Label with the latitude in decimal degrees",
              ],
              [
                "longitudeLabel",
                "Longitude label",
                DEFAULT_LONGITUDE_LABEL,
                "Label with the longitude in decimal degrees",
              ],
            ] as const
          ).map(([key, label, placeholder, description]) => (
            <OptionsEditorControl
              key={key}
              label={label}
              description={description}
              control={
                <TextField
                  size="small"
                  placeholder={placeholder}
                  value={value[key] ?? ""}
                  onChange={(e) => set({ [key]: e.target.value || undefined })}
                />
              }
            />
          ))}
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Format">
          <FormatControls
            value={value.format ?? DEFAULT_FORMAT}
            onChange={(format) => set({ format })}
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Colour">
          <OptionsEditorControl
            label="Colour scheme"
            control={
              <TextField
                select
                size="small"
                value={value.colorScheme ?? DEFAULT_COLOR_SCHEME}
                onChange={(e) =>
                  set({ colorScheme: e.target.value as ColorScheme })
                }
              >
                {Object.entries(COLOR_SCHEME_LABELS).map(([id, label]) => (
                  <MenuItem key={id} value={id}>
                    {label}
                  </MenuItem>
                ))}
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Scale"
            description="Logarithmic spreads heavy-tailed values (a few countries with most traffic)"
            control={
              <TextField
                select
                size="small"
                value={value.scale ?? DEFAULT_SCALE}
                onChange={(e) => set({ scale: e.target.value as ScaleType })}
              >
                <MenuItem value="linear">Linear</MenuItem>
                <MenuItem value="log">Logarithmic</MenuItem>
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Min"
            description="Lower end of the scale; from the data when empty"
            control={
              <TextField
                size="small"
                type="number"
                value={value.min ?? ""}
                onChange={(e) => set({ min: parseBound(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Max"
            description="Upper end of the scale; from the data when empty"
            control={
              <TextField
                size="small"
                type="number"
                value={value.max ?? ""}
                onChange={(e) => set({ max: parseBound(e.target.value) })}
              />
            }
          />
          <OptionsEditorControl
            label="Show legend"
            control={
              <Switch
                checked={value.showLegend ?? true}
                onChange={(_, showLegend) => set({ showLegend })}
              />
            }
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Zoom">
          <OptionsEditorControl
            label="Zoom and pan"
            description="Mouse wheel or pinch to zoom, drag to pan, and the zoom buttons"
            control={
              <Switch
                checked={value.zoom ?? true}
                onChange={(_, zoom) => set({ zoom })}
              />
            }
          />
          <OptionsEditorControl
            label="Click to zoom"
            description="Click a country to zoom to it; click it again or the sea to zoom out"
            control={
              <Switch
                checked={value.clickToZoom ?? true}
                onChange={(_, clickToZoom) => set({ clickToZoom })}
              />
            }
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
    </OptionsEditorGrid>
  );
}
