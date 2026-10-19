import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import { rankSeries, type Metric, type PlayerData, type XAxis } from './data';
import { useChart } from './useChart';

export default function RankEvolution({ players, season, metric, x }: { players: PlayerData[]; season: string; metric: Metric; x: XAxis }) {
  // La leyenda ocupa varias filas con muchos jugadores: reservamos ese alto arriba para que no tape el gráfico
  const legendH = Math.max(1, Math.ceil(players.length / 7)) * 20;
  const option = useMemo<EChartsOption>(() => ({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, itemWidth: 14, itemHeight: 8, itemGap: 8, textStyle: { fontSize: 11 } },
    grid: { top: legendH + 24, left: 55, right: 20 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18 }],
    xAxis: { type: x === 'date' ? 'time' : 'value', name: x === 'date' ? '' : 'Partida nº', min: x === 'match' ? 1 : undefined },
    yAxis: { type: 'value', scale: true, name: metric === 'rating' ? 'Rank points' : metric === 'progress' ? 'Δ vs inicio' : 'Victorias − derrotas' },
    series: players.map((p) => ({ name: p.name, type: 'line', symbolSize: 4, data: rankSeries(p, season, metric, x), step: metric === 'netwins' ? 'end' : false })),
  }), [players, season, metric, x, legendH]);
  return <div ref={useChart(option)} style={{ width: '100%', height: 380 + legendH }} />;
}
