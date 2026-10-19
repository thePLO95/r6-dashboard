import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

/**
 * Devuelve un "callback ref" para el <div> del gráfico: <div ref={useChart(option)} />.
 * El gráfico se crea cuando el div realmente existe (puede aparecer tarde: tras un "Cargando…" o un filtro vacío),
 * se destruye cuando desaparece, y se redibuja cada vez que cambia `option` (pásala con useMemo).
 */
export function useChart(option: EChartsOption) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const chart = useRef<echarts.ECharts>();
  const latest = useRef(option);
  latest.current = option;

  useEffect(() => {
    if (!el) return;
    const c = echarts.init(el);
    chart.current = c;
    c.setOption(latest.current, true);
    const ro = new ResizeObserver(() => c.resize());
    ro.observe(el);
    return () => { ro.disconnect(); c.dispose(); chart.current = undefined; };
  }, [el]);

  useEffect(() => { chart.current?.setOption(option, true); }, [option]);
  return setEl;
}
