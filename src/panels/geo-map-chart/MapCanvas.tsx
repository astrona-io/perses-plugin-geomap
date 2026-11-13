import { ReactElement, useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  IconButton,
  SvgIcon,
  Tooltip,
  alpha,
  useTheme,
} from "@mui/material";
import { init, type ECharts, type EChartsOption } from "echarts";

/** Where the map looks: `center` in lon/lat, `zoom` relative to the whole world (1). */
export interface MapView {
  center?: [number, number];
  zoom: number;
  /** Country the view was zoomed to by a click, so a second click zooms back out. */
  focus?: string;
}

interface MapCanvasProps {
  /** Full chart option; its `geo` component gets the current view merged in. */
  option: { geo: Record<string, unknown> } & Record<string, unknown>;
  theme: string | object;
  width: number;
  height: number;
  /** The view resets to the whole world whenever this changes (for example a new panel spec). */
  viewKey: string;
  /** Mouse-wheel / pinch zoom, drag to pan and the zoom buttons. */
  zoom: boolean;
  /** Click a country to zoom to it; click it again or the sea to zoom out. */
  clickToZoom: boolean;
  maxZoom: number;
  /** Center of the whole-world view. */
  homeCenter: [number, number];
  /** The view that fits a country, or undefined for an unknown one. */
  fitRegion: (name: string) => MapView | undefined;
  /** Called whenever the zoom level changes, from any source. */
  onZoom: (zoom: number) => void;
}

const ZOOM_STEP = 2;
/** Pointer travel (px) between press and release above which a click counts as a drag. */
const DRAG_TOLERANCE = 5;
const HOME: MapView = { zoom: 1 };

/**
 * Renders with the shared `echarts` module itself rather than Perses' `EChart` component.
 *
 * `EChart` (in @perses-dev/components) draws with the host's own `echarts/core` copy, which has no
 * map series registered and does not see maps registered through the shared `echarts` singleton:
 * the visualMap legend rendered but no country did. Using `init` from the same module that
 * `registerMap` was called on keeps the map, the series type and the chart in one registry.
 *
 * The view (center and zoom) lives here, outside the option, so a data refresh redraws the
 * chart without moving the map. It resets only when `viewKey` changes.
 */
export function MapCanvas(props: MapCanvasProps): ReactElement {
  const {
    option,
    theme,
    width,
    height,
    viewKey,
    maxZoom,
    zoom: zoomEnabled,
  } = props;
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);
  const view = useRef<MapView>(HOME);
  const appliedKey = useRef(viewKey);
  const [zoomLevel, setZoomLevel] = useState(1);
  // Latest props for the chart's event handlers, which are bound once per chart instance.
  const latest = useRef(props);
  latest.current = props;

  const report = useCallback((next: MapView) => {
    view.current = next;
    setZoomLevel(next.zoom);
    latest.current.onZoom(next.zoom);
  }, []);

  /** Animates the map to a new view; zoom 1 always means the whole world, centred. */
  const goTo = useCallback(
    (next: MapView) => {
      const { homeCenter, maxZoom } = latest.current;
      const zoom = Math.min(maxZoom, Math.max(1, next.zoom));
      const target: MapView =
        zoom <= 1
          ? { zoom: 1, center: homeCenter }
          : {
              ...next,
              zoom,
              center: next.center ?? view.current.center ?? homeCenter,
            };
      chart.current?.setOption({
        geo: { center: target.center, zoom },
      } as EChartsOption);
      report(target);
    },
    [report],
  );

  // (Re)create the chart when the theme changes (light/dark switch).
  useEffect(() => {
    if (!ref.current) return;
    const instance = init(ref.current, theme as never);
    chart.current = instance;
    const zr = instance.getZr();
    let down: [number, number] | undefined;
    let dragged = false;
    zr.on("mousedown", (e) => {
      down = [e.offsetX, e.offsetY];
      dragged = false;
    });
    zr.on("mouseup", (e) => {
      dragged =
        !!down &&
        Math.hypot(e.offsetX - down[0], e.offsetY - down[1]) > DRAG_TOLERANCE;
      down = undefined;
    });
    // Wheel, pinch and drag: read back what ECharts did, so a redraw keeps it.
    instance.on("georoam", () => {
      const geo = (
        instance.getOption() as {
          geo?: Array<{ zoom?: number; center?: [number, number] }>;
        }
      ).geo?.[0];
      if (!geo) return;
      report({ ...view.current, zoom: geo.zoom ?? 1, center: geo.center });
    });
    instance.on("click", (params) => {
      if (dragged || !latest.current.clickToZoom) return;
      const p = params as {
        componentType?: string;
        seriesType?: string;
        name?: string;
      };
      if (!(p.componentType === "geo" || p.seriesType === "map") || !p.name)
        return;
      if (view.current.focus === p.name) {
        goTo(HOME);
        return;
      }
      const fit = latest.current.fitRegion(p.name);
      if (fit) goTo({ ...fit, focus: p.name });
    });
    // A click on the sea (no shape under the pointer) zooms back out.
    zr.on("click", (e) => {
      if (dragged || e.target || !latest.current.clickToZoom) return;
      if (view.current.zoom > 1 || view.current.focus) goTo(HOME);
    });
    return () => {
      instance.dispose();
      chart.current = null;
    };
  }, [theme, goTo, report]);

  useEffect(() => {
    if (appliedKey.current !== viewKey) {
      appliedKey.current = viewKey;
      report(HOME);
    }
    const { center, zoom } = view.current;
    // notMerge rebuilds the tooltip component; one still showing is then re-shown into
    // its removed element and throws, so hide it first.
    chart.current?.dispatchAction({ type: "hideTip" });
    chart.current?.setOption(
      {
        ...option,
        geo: {
          ...option.geo,
          roam: zoomEnabled,
          scaleLimit: { min: 1, max: maxZoom },
          zoom,
          center,
        },
      } as EChartsOption,
      { notMerge: true },
    );
  }, [option, theme, viewKey, zoomEnabled, maxZoom, report]);

  useEffect(() => {
    chart.current?.resize({ width, height });
  }, [width, height, theme]);

  return (
    <Box sx={{ position: "relative", width, height }}>
      <div ref={ref} style={{ width, height }} />
      {zoomEnabled ? (
        <ZoomControls
          canZoomIn={zoomLevel < maxZoom}
          canZoomOut={zoomLevel > 1}
          onZoomIn={() =>
            goTo({ ...view.current, zoom: view.current.zoom * ZOOM_STEP })
          }
          onZoomOut={() =>
            goTo({ ...view.current, zoom: view.current.zoom / ZOOM_STEP })
          }
          onReset={() => goTo(HOME)}
        />
      ) : null}
    </Box>
  );
}

interface ZoomControlsProps {
  canZoomIn: boolean;
  canZoomOut: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

const ICONS = {
  plus: "M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z",
  minus: "M5 11h14v2H5z",
  fit: "M4 4h6v2H6v4H4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z",
};

function ZoomControls(props: ZoomControlsProps): ReactElement {
  const theme = useTheme();
  const buttons = [
    {
      label: "Zoom in",
      path: ICONS.plus,
      onClick: props.onZoomIn,
      disabled: !props.canZoomIn,
    },
    {
      label: "Zoom out",
      path: ICONS.minus,
      onClick: props.onZoomOut,
      disabled: !props.canZoomOut,
    },
    {
      label: "Reset zoom",
      path: ICONS.fit,
      onClick: props.onReset,
      disabled: !props.canZoomOut,
    },
  ];
  return (
    <Box
      role="group"
      aria-label="Map zoom"
      sx={{
        position: "absolute",
        top: 4,
        right: 4,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.85),
        overflow: "hidden",
      }}
    >
      {buttons.map((b) => (
        <Tooltip key={b.label} title={b.label} placement="left">
          {/* The span keeps the tooltip working on a disabled button. */}
          <span>
            <IconButton
              size="small"
              aria-label={b.label}
              disabled={b.disabled}
              onClick={b.onClick}
              sx={{ borderRadius: 0, p: 0.5, display: "flex" }}
            >
              <SvgIcon sx={{ fontSize: 16 }}>
                <path d={b.path} />
              </SvgIcon>
            </IconButton>
          </span>
        </Tooltip>
      ))}
    </Box>
  );
}
