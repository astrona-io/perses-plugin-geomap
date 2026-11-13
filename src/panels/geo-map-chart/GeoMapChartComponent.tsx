import { ReactElement, useCallback, useMemo, useState } from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import { formatValue, useChartsTheme } from "@perses-dev/components";
import {
  COLOR_RAMPS,
  DEFAULT_CITY_LABEL,
  DEFAULT_COLOR_SCHEME,
  DEFAULT_COUNTRY_LABEL,
  DEFAULT_LATITUDE_LABEL,
  DEFAULT_LONGITUDE_LABEL,
  DEFAULT_SCALE,
  DEFAULT_SHOW_CITIES,
  GeoMapChartProps,
} from "./geo-map-chart-types";
import { reduceSeries } from "./data";
import {
  WORLD_ASPECT_SCALE,
  WORLD_MAP_NAME,
  countryDisplayName,
  countryName,
  ensureWorldMap,
  isOnMap,
  mapCodes,
  regionBounds,
  worldAspect,
  worldBounds,
} from "./world";
import { MapCanvas, MapView } from "./MapCanvas";

const LEGEND_HEIGHT = 44;
const DEFAULT_FORMAT = { unit: "decimal" as const };
const FOOTNOTE_HEIGHT = 18;

/** Deepest zoom, relative to the whole world. 20x shows a region of a few hundred km. */
const MAX_ZOOM = 20;
/** Country names and (in `auto` mode) cities appear from this zoom on. */
const DETAIL_ZOOM = 2;
/** A country gets a name label once its main land is at least this wide on screen (px). */
const LABEL_MIN_WIDTH = 44;
/** City names next to their points from this zoom on. */
const CITY_LABEL_ZOOM = 4;
/** Share of the panel a clicked country fills, so its edges stay visible. */
const FIT_FILL = 0.8;
const POINT_MIN_SIZE = 5;
const POINT_MAX_SIZE = 22;

interface MapDatum {
  name: string;
  value: number;
  raw: number;
}

interface PointDatum {
  name: string;
  value: [number, number, number];
  raw: number;
  country?: string;
  symbolSize: number;
}

interface TooltipParams {
  name: string;
  seriesType?: string;
  data?: MapDatum | PointDatum;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Zoom levels in half-octave bands: labels and the city layer only change between bands. */
function zoomBand(zoom: number): number {
  return Math.max(0, Math.floor(Math.log2(zoom) * 2 + 1e-9));
}

export function GeoMapChartComponent(
  props: GeoMapChartProps,
): ReactElement | null {
  const { queryResults, spec, contentDimensions } = props;
  const muiTheme = useTheme();
  const chartsTheme = useChartsTheme();

  const calculation = spec.calculation ?? "last";
  const countryLabel = spec.countryLabel || DEFAULT_COUNTRY_LABEL;
  const cityLabel = spec.cityLabel || DEFAULT_CITY_LABEL;
  const latitudeLabel = spec.latitudeLabel || DEFAULT_LATITUDE_LABEL;
  const longitudeLabel = spec.longitudeLabel || DEFAULT_LONGITUDE_LABEL;
  const showCities = spec.showCities ?? DEFAULT_SHOW_CITIES;
  const scale = spec.scale ?? DEFAULT_SCALE;
  const showLegend = spec.showLegend ?? true;
  const zoomEnabled = spec.zoom ?? true;
  const clickToZoom = spec.clickToZoom ?? true;
  // Without a format, short numbers (1.2K) rather than every digit of a mean.
  const format = spec.format ?? DEFAULT_FORMAT;
  const mode = muiTheme.palette.mode === "dark" ? "dark" : "light";
  const ramp = COLOR_RAMPS[spec.colorScheme ?? DEFAULT_COLOR_SCHEME][mode];

  // The view resets when the panel spec changes, never on a data refresh.
  const viewKey = useMemo(() => JSON.stringify(spec), [spec]);
  const [band, setBand] = useState(0);
  const onZoom = useCallback((zoom: number) => setBand(zoomBand(zoom)), []);
  /** Lowest zoom of the current band. */
  const bandZoom = Math.pow(2, band / 2);

  ensureWorldMap();

  const { data, points, unplaced, labelNames, min, max, missingLabel } =
    useMemo(() => {
      const { values, labelNames, points, badPoints, missingLabel } =
        reduceSeries(queryResults, {
          calculation,
          countryLabel,
          cityLabel,
          latitudeLabel,
          longitudeLabel,
          points: showCities !== "never",
        });
      const data: MapDatum[] = [];
      const unplaced: Array<[string, number]> = [];
      for (const [code, raw] of values) {
        if (!isOnMap(code)) {
          unplaced.push([countryDisplayName(code, labelNames.get(code)), raw]);
          continue;
        }
        data.push({ name: code, raw, value: toScale(raw, scale) });
      }
      for (const [name, raw] of badPoints)
        unplaced.push([`${name} (no coordinates)`, raw]);
      unplaced.sort((a, b) => b[1] - a[1]);
      const raws = [
        ...data.map((d) => d.raw),
        ...points.map((p) => p.value),
      ].filter((v) => scale === "linear" || v > 0);
      let min =
        spec.min ??
        (scale === "log" ? Math.min(...raws) : Math.min(0, ...raws));
      let max = spec.max ?? Math.max(...raws);
      if (!Number.isFinite(min)) min = scale === "log" ? 1 : 0;
      if (!Number.isFinite(max) || max <= min) max = min + 1;
      return { data, points, unplaced, labelNames, min, max, missingLabel };
    }, [
      queryResults,
      calculation,
      countryLabel,
      cityLabel,
      latitudeLabel,
      longitudeLabel,
      showCities,
      scale,
      spec.min,
      spec.max,
    ]);

  const hasFootnote = unplaced.length > 0 || missingLabel > 0;

  /** Pixel layout of the map at zoom 1: the box it fits in and its size per degree. */
  const layout = useMemo(() => {
    const bottom =
      (showLegend ? LEGEND_HEIGHT : 4) + (hasFootnote ? FOOTNOTE_HEIGHT : 0);
    const aspect = worldAspect();
    const boxWidth = Math.max(0, (contentDimensions?.width ?? 0) - 8);
    const boxHeight = Math.max(
      0,
      (contentDimensions?.height ?? 0) - bottom - 4,
    );
    const size = Math.max(10, Math.min(boxWidth, boxHeight * aspect));
    // As ECharts sizes a map from layoutSize: the longer side gets `size`.
    const mapWidth = aspect > 1 ? size : size * aspect;
    const mapHeight = aspect > 1 ? size / aspect : size;
    const world = worldBounds();
    return {
      boxWidth,
      boxHeight,
      size,
      pxPerLon: mapWidth / (world.maxLon - world.minLon),
      pxPerLat: mapHeight / (world.maxLat - world.minLat),
      home: [
        (world.minLon + world.maxLon) / 2,
        (world.minLat + world.maxLat) / 2,
      ] as [number, number],
    };
  }, [showLegend, hasFootnote, contentDimensions]);

  const fitRegion = useCallback(
    (code: string): MapView | undefined => {
      const b = regionBounds(code);
      if (!b) return undefined;
      // At least half a degree, so a city state does not hit the zoom limit on its own.
      const width = Math.max(0.5, b.maxLon - b.minLon) * layout.pxPerLon;
      const height = Math.max(0.5, b.maxLat - b.minLat) * layout.pxPerLat;
      const zoom =
        Math.min(layout.boxWidth / width, layout.boxHeight / height) * FIT_FILL;
      return {
        zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)),
        center: [(b.minLon + b.maxLon) / 2, (b.minLat + b.maxLat) / 2],
      };
    },
    [layout],
  );

  const citiesShown =
    points.length > 0 &&
    (showCities === "always" ||
      (showCities === "auto" &&
        (bandZoom >= DETAIL_ZOOM || data.length === 0)));

  const option = useMemo(() => {
    const text = muiTheme.palette.text;
    const paper = muiTheme.palette.background.paper;
    const neutral = alpha(text.primary, mode === "dark" ? 0.1 : 0.08);
    const fmt = (v: number): string => formatValue(v, format);

    // Name labels only once zoomed in, and only on countries wide enough on screen to hold one.
    const regions =
      bandZoom >= DETAIL_ZOOM
        ? mapCodes()
            .filter((code) => {
              const b = regionBounds(code);
              return (
                !!b &&
                (b.maxLon - b.minLon) * layout.pxPerLon * bandZoom >=
                  LABEL_MIN_WIDTH
              );
            })
            .map((name) => ({
              name,
              label: { show: true },
              emphasis: { label: { show: true } },
            }))
        : [];

    const maxPoint = Math.max(0, ...points.map((p) => Math.abs(p.value)));
    const pointData: PointDatum[] = citiesShown
      ? points.map((p) => ({
          name: p.name,
          country: p.country,
          raw: p.value,
          value: [p.lon, p.lat, toScale(p.value, scale)],
          symbolSize:
            maxPoint > 0
              ? POINT_MIN_SIZE +
                (POINT_MAX_SIZE - POINT_MIN_SIZE) *
                  Math.sqrt(Math.max(0, p.value) / maxPoint)
              : POINT_MIN_SIZE,
        }))
      : [];

    const textStyle = {
      color: text.primary,
      fontSize: 10,
      textBorderColor: paper,
      textBorderWidth: 2,
    };
    const scaleRange = {
      min: toScale(min, scale),
      max: toScale(max, scale),
      inRange: { color: ramp },
    };

    return {
      // No entry animation; view changes (zoom to a country, reset) glide.
      animation: true,
      animationDuration: 0,
      animationDurationUpdate: 450,
      animationEasingUpdate: "cubicOut",
      tooltip: {
        trigger: "item",
        confine: true,
        formatter: (params: TooltipParams): string => {
          if (params.seriesType === "scatter" && params.data) {
            const p = params.data as PointDatum;
            const where = p.country
              ? `<br/>${escapeHtml(countryDisplayName(p.country, labelNames.get(p.country)))}`
              : "";
            return `${escapeHtml(p.name)}${where}<br/><b>${escapeHtml(fmt(p.raw))}</b>`;
          }
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
            seriesIndex: [0, 1],
            ...scaleRange,
            orient: "horizontal",
            left: "center",
            bottom: (hasFootnote ? FOOTNOTE_HEIGHT : 0) + 6,
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
            seriesIndex: [0, 1],
            ...scaleRange,
          },
      // The map is a `geo` component so the city points share its coordinates, zoom and pan.
      geo: {
        map: WORLD_MAP_NAME,
        // Fit the whole map into the space above the legend without stretching it.
        layoutCenter: [layout.boxWidth / 2 + 4, layout.boxHeight / 2 + 4],
        layoutSize: layout.size,
        aspectScale: WORLD_ASPECT_SCALE,
        selectedMode: false,
        tooltip: { show: true },
        itemStyle: {
          areaColor: neutral,
          borderColor: paper,
          borderWidth: 0.5,
        },
        label: {
          show: false,
          formatter: (p: { name: string }): string =>
            countryName(p.name, labelNames.get(p.name)),
          ...textStyle,
        },
        emphasis: {
          label: { show: false },
          itemStyle: {
            areaColor: "inherit",
            borderColor: text.primary,
            borderWidth: 1,
          },
        },
        regions,
      },
      series: [
        { type: "map", geoIndex: 0, data },
        {
          type: "scatter",
          coordinateSystem: "geo",
          data: pointData,
          z: 3,
          itemStyle: { borderColor: paper, borderWidth: 1, opacity: 0.9 },
          label: {
            show: bandZoom >= CITY_LABEL_ZOOM,
            formatter: "{b}",
            position: "right",
            ...textStyle,
          },
          labelLayout: { hideOverlap: true },
          emphasis: {
            scale: 1.3,
            label: { show: true },
            itemStyle: { borderColor: text.primary },
          },
        },
      ],
    };
  }, [
    data,
    points,
    citiesShown,
    labelNames,
    hasFootnote,
    min,
    max,
    scale,
    ramp,
    format,
    showLegend,
    mode,
    muiTheme,
    contentDimensions,
    layout,
    bandZoom,
  ]);

  if (!contentDimensions) return null;

  const footnote = unplaced.length
    ? `Not on the map: ${unplaced
        .slice(0, 4)
        .map(([name, v]) => `${name} ${formatValue(v, format)}`)
        .join(
          ", ",
        )}${unplaced.length > 4 ? ` +${unplaced.length - 4} more` : ""}`
    : missingLabel
      ? `${missingLabel} series without a "${countryLabel}" label or coordinates`
      : "";

  return (
    <Box
      sx={{
        position: "relative",
        width: contentDimensions.width,
        height: contentDimensions.height,
      }}
    >
      {data.length === 0 && points.length === 0 && unplaced.length === 0 ? (
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
            ? `No series with a "${countryLabel}" label or coordinates`
            : "No data"}
        </Typography>
      ) : null}
      <MapCanvas
        option={option}
        theme={chartsTheme.echartsTheme}
        width={contentDimensions.width}
        height={contentDimensions.height}
        viewKey={viewKey}
        zoom={zoomEnabled}
        clickToZoom={clickToZoom}
        maxZoom={MAX_ZOOM}
        homeCenter={layout.home}
        fitRegion={fitRegion}
        onZoom={onZoom}
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
