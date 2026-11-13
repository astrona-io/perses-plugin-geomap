import { ReactElement, useMemo } from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import { formatValue, useChartsTheme } from "@perses-dev/components";
import {
  COLOR_RAMPS,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COUNTRY_LABEL,
  DEFAULT_SCALE,
  GeoMapChartProps,
} from "./geo-map-chart-types";
import { reduceToCountries } from "./data";
import {
  WORLD_ASPECT_SCALE,
  WORLD_MAP_NAME,
  countryDisplayName,
  ensureWorldMap,
  isOnMap,
  worldAspect,
} from "./world";
import { MapCanvas } from "./MapCanvas";

const LEGEND_HEIGHT = 44;
const DEFAULT_FORMAT = { unit: "decimal" as const };
const FOOTNOTE_HEIGHT = 18;

interface MapDatum {
  name: string;
  value: number;
  raw: number;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function GeoMapChartComponent(
  props: GeoMapChartProps,
): ReactElement | null {
  const { queryResults, spec, contentDimensions } = props;
  const muiTheme = useTheme();
  const chartsTheme = useChartsTheme();

  const calculation = spec.calculation ?? "last";
  const countryLabel = spec.countryLabel || DEFAULT_COUNTRY_LABEL;
  const scale = spec.scale ?? DEFAULT_SCALE;
  const showLegend = spec.showLegend ?? true;
  // Without a format, short numbers (1.2K) rather than every digit of a mean.
  const format = spec.format ?? DEFAULT_FORMAT;
  const mode = muiTheme.palette.mode === "dark" ? "dark" : "light";
  const ramp = COLOR_RAMPS[spec.colorScheme ?? DEFAULT_COLOR_SCHEME][mode];

  ensureWorldMap();

  const { data, offMap, labelNames, min, max, missingLabel } = useMemo(() => {
    const { values, labelNames, missingLabel } = reduceToCountries(
      queryResults,
      calculation,
      countryLabel,
    );
    const data: MapDatum[] = [];
    const offMap: Array<[string, number]> = [];
    for (const [code, raw] of values) {
      if (!isOnMap(code)) {
        offMap.push([code, raw]);
        continue;
      }
      data.push({ name: code, raw, value: toScale(raw, scale) });
    }
    offMap.sort((a, b) => b[1] - a[1]);
    const raws = data
      .map((d) => d.raw)
      .filter((v) => scale === "linear" || v > 0);
    let min =
      spec.min ?? (scale === "log" ? Math.min(...raws) : Math.min(0, ...raws));
    let max = spec.max ?? Math.max(...raws);
    if (!Number.isFinite(min)) min = scale === "log" ? 1 : 0;
    if (!Number.isFinite(max) || max <= min) max = min + 1;
    return { data, offMap, labelNames, min, max, missingLabel };
  }, [queryResults, calculation, countryLabel, scale, spec.min, spec.max]);

  const option = useMemo(() => {
    const text = muiTheme.palette.text;
    const neutral = alpha(text.primary, mode === "dark" ? 0.1 : 0.08);
    const border = muiTheme.palette.background.paper;
    const fmt = (v: number): string => formatValue(v, format);
    const bottom =
      (showLegend ? LEGEND_HEIGHT : 4) +
      (offMap.length || missingLabel ? FOOTNOTE_HEIGHT : 0);
    const aspect = worldAspect();
    const boxWidth = Math.max(0, (contentDimensions?.width ?? 0) - 8);
    const boxHeight = Math.max(
      0,
      (contentDimensions?.height ?? 0) - bottom - 4,
    );
    return {
      animation: false,
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (params: { name: string; data?: MapDatum }): string => {
          const name = escapeHtml(
            countryDisplayName(params.name, labelNames.get(params.name)),
          );
          const value = params.data
            ? escapeHtml(fmt(params.data.raw))
            : "No data";
          return `${name}<br/><b>${value}</b>`;
        },
      },
      visualMap: showLegend
        ? {
            type: "continuous",
            seriesIndex: 0,
            min: toScale(min, scale),
            max: toScale(max, scale),
            inRange: { color: ramp },
            orient: "horizontal",
            left: "center",
            bottom: (offMap.length || missingLabel ? FOOTNOTE_HEIGHT : 0) + 6,
            itemWidth: 10,
            itemHeight: Math.max(
              80,
              Math.min(320, (contentDimensions?.width ?? 400) * 0.45),
            ),
            calculable: false,
            realtime: false,
            text: [fmt(max), fmt(min)],
            // Label of the hover indicator: the colour scale runs on log10 values for a log scale.
            formatter: (v: number): string => fmt(fromScale(v, scale)),
            textGap: 8,
            textStyle: { color: text.secondary, fontSize: 11 },
          }
        : {
            type: "continuous",
            show: false,
            seriesIndex: 0,
            min: toScale(min, scale),
            max: toScale(max, scale),
            inRange: { color: ramp },
          },
      series: [
        {
          type: "map",
          map: WORLD_MAP_NAME,
          roam: false,
          // Fit the whole map into the space above the legend without stretching it.
          layoutCenter: [boxWidth / 2 + 4, boxHeight / 2 + 4],
          layoutSize: Math.max(10, Math.min(boxWidth, boxHeight * aspect)),
          aspectScale: WORLD_ASPECT_SCALE,
          selectedMode: false,
          data,
          itemStyle: {
            areaColor: neutral,
            borderColor: border,
            borderWidth: 0.5,
          },
          label: { show: false },
          emphasis: {
            label: { show: false },
            itemStyle: {
              areaColor: "inherit",
              borderColor: text.primary,
              borderWidth: 1,
            },
          },
        },
      ],
    };
  }, [
    data,
    labelNames,
    offMap.length,
    missingLabel,
    min,
    max,
    scale,
    ramp,
    format,
    showLegend,
    mode,
    muiTheme,
    contentDimensions,
  ]);

  if (!contentDimensions) return null;

  const footnote = offMap.length
    ? `Not on the map: ${offMap
        .slice(0, 4)
        .map(
          ([code, v]) =>
            `${countryDisplayName(code, labelNames.get(code))} ${formatValue(v, format)}`,
        )
        .join(", ")}${offMap.length > 4 ? ` +${offMap.length - 4} more` : ""}`
    : missingLabel
      ? `${missingLabel} series without a "${countryLabel}" label`
      : "";

  return (
    <Box
      sx={{
        position: "relative",
        width: contentDimensions.width,
        height: contentDimensions.height,
      }}
    >
      {data.length === 0 && offMap.length === 0 ? (
        <Typography
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "text.secondary",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {missingLabel
            ? `No series with a "${countryLabel}" label`
            : "No data"}
        </Typography>
      ) : null}
      <MapCanvas
        option={option}
        theme={chartsTheme.echartsTheme}
        width={contentDimensions.width}
        height={contentDimensions.height}
      />
      {footnote ? (
        <Typography
          variant="caption"
          noWrap
          title={footnote}
          sx={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 0,
            color: "text.secondary",
            textAlign: "center",
          }}
        >
          {footnote}
        </Typography>
      ) : null}
    </Box>
  );
}

function fromScale(value: number, scale: string): number {
  return scale === "log" ? Math.pow(10, value) : value;
}

function toScale(value: number, scale: string): number {
  if (scale !== "log") return value;
  return value > 0 ? Math.log10(value) : 0;
}
