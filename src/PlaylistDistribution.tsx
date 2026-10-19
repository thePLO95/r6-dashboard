import { useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import type { PlayerData } from './data';
import { playlistCounts } from './stats';
import { useChart } from './useChart';

export default function PlaylistDistribution({ player }: { player: PlayerData }) {
  const [pct, setPct] = useState(false);
  const option = useMemo<EChartsOption>(() => {
    const { seasons, playlists, counts } = playlistCounts(player.matches);
    const total = (s: string) => playlists.reduce((acc, p) => acc + counts(p, s), 0);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => (pct ? `${(+(v as number)).toFixed(1)}%` : String(v)) },
      legend: { top: 0 },
      grid: { top: 40, left: 55, right: 20 },
      xAxis: { type: 'category', data: seasons },
      yAxis: { type: 'value', name: pct ? '% de partidas' : 'Partidas', max: pct ? 100 : undefined },
      series: playlists.map((p) => ({ name: p, type: 'bar' as const, stack: 'total', data: seasons.map((s) => (pct ? (counts(p, s) / total(s)) * 100 : counts(p, s))) })),
    };
  }, [player, pct]);
  return (
    <>
      <label><input type="checkbox" checked={pct} onChange={(e) => setPct(e.target.checked)} /> Mostrar en %</label>
      <div ref={useChart(option)} style={{ width: '100%', height: 420 }} />
    </>
  );
}
