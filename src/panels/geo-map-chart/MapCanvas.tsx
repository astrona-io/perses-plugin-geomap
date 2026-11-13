import { ReactElement, useEffect, useRef } from "react";
import { init, type ECharts, type EChartsOption } from "echarts";

interface MapCanvasProps {
  option: object;
  theme: string | object;
  width: number;
  height: number;
}

/**
 * Renders with the shared `echarts` module itself rather than Perses' `EChart` component.
 *
 * `EChart` (in @perses-dev/components) draws with the host's own `echarts/core` copy, which has no
 * map series registered and does not see maps registered through the shared `echarts` singleton:
 * the visualMap legend rendered but no country did. Using `init` from the same module that
 * `registerMap` was called on keeps the map, the series type and the chart in one registry.
 */
export function MapCanvas({
  option,
  theme,
  width,
  height,
}: MapCanvasProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ECharts | null>(null);

  // (Re)create the chart when the theme changes (light/dark switch).
  useEffect(() => {
    if (!ref.current) return;
    const instance = init(ref.current, theme as never);
    chart.current = instance;
    return () => {
      instance.dispose();
      chart.current = null;
    };
  }, [theme]);

  useEffect(() => {
    chart.current?.setOption(option as EChartsOption, { notMerge: true });
  }, [option, theme]);

  useEffect(() => {
    chart.current?.resize({ width, height });
  }, [width, height, theme]);

  return <div ref={ref} style={{ width, height }} />;
}
