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
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COUNTRY_LABEL,
  DEFAULT_SCALE,
  GeoMapChartEditorProps,
  GeoMapChartOptions,
  ScaleType,
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
      </OptionsEditorColumn>
    </OptionsEditorGrid>
  );
}
